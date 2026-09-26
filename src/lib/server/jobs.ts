import "server-only";
import { CaseProfile } from "@/lib/domain/case";
import { deliveryMetrics } from "@/lib/domain/delivery";
import type { SessionPlan } from "@/lib/domain/director";
import { mergeDraft, type DraftConflict } from "@/lib/domain/draft";
import { mergeGrades } from "@/lib/domain/grade-merge";
import { validateRewrite } from "@/lib/domain/rewrite-validator";
import { extractFacts, gradeDebrief, isTransient } from "@/lib/server/gemini";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Background work, run with next/server `after()` for now. If jobs outgrow a
 * function's time limit, move these into Inngest steps unchanged.
 */

export async function runExtraction(documentId: string) {
  const db = createServiceClient();
  const { data: doc } = await db.from("documents").select("id, case_id, kind, storage_path").eq("id", documentId).single();
  if (!doc) return;
  try {
    const { data: file, error } = await db.storage.from("documents").download(doc.storage_path);
    if (error || !file) throw error ?? new Error("File missing");
    const facts = await extractFacts({
      bytes: new Uint8Array(await file.arrayBuffer()),
      mimeType: file.type || "application/pdf",
      kind: doc.kind,
    });
    // Never persist raw passport numbers; only the last four digits live on the case.
    const { appointment, documentLooksLike, ...profileFacts } = facts;

    const { data: caseRow } = await db.from("cases").select("draft_profile, interview_at").eq("id", doc.case_id).single();
    const existing = (caseRow?.draft_profile ?? {}) as Record<string, unknown>;
    const { merged, conflicts } = mergeDraft(existing, profileFacts, doc.kind);
    const allConflicts = [...((existing._conflicts as DraftConflict[]) ?? []), ...conflicts];
    await db.from("cases").update({ draft_profile: { ...merged, _conflicts: allConflicts } }).eq("id", doc.case_id);

    // An appointment confirmation is proof for the pass rules (docs/PRICING.md §3a).
    if (doc.kind === "appointment_confirmation" && appointment?.date) {
      const parsed = new Date(appointment.date);
      if (!Number.isNaN(parsed.getTime())) {
        await db.from("cases").update({ interview_at: parsed.toISOString() }).eq("id", doc.case_id);
        await db.from("passes").update({ has_appointment_proof: true }).eq("case_id", doc.case_id).is("refunded_at", null);
      }
    }
    await db
      .from("documents")
      .update({ extraction: { documentLooksLike, facts: profileFacts }, extraction_status: "done", extraction_error: null })
      .eq("id", doc.id);
  } catch (e) {
    await db
      .from("documents")
      .update({
        extraction_status: "failed",
        extraction_error: isTransient(e)
          ? "The reading service was busy. Try again in a minute."
          : e instanceof Error
            ? e.message.slice(0, 300)
            : "failed",
      })
      .eq("id", doc.id);
  }
}

export async function runDebrief(sessionId: string) {
  const db = createServiceClient();
  await db.from("sessions").update({ debrief_status: "running" }).eq("id", sessionId);
  try {
    const { data: session } = await db.from("sessions").select("case_id, profile_version, plan, debrief").eq("id", sessionId).single();
    const { data: prof } = await db
      .from("case_profiles")
      .select("profile")
      .eq("case_id", session!.case_id)
      .eq("version", session!.profile_version)
      .single();
    const profile = CaseProfile.parse(prof!.profile);
    const plan = session!.plan as SessionPlan;
    const { data: turns } = await db
      .from("turns")
      .select("seq, officer_text, user_transcript_raw, user_transcript_corrected, started_ms, ended_ms")
      .eq("session_id", sessionId)
      .order("seq");

    const answered = (turns ?? []).filter((t) => (t.user_transcript_corrected ?? t.user_transcript_raw ?? "").trim());
    const input = answered.map((t) => ({
      seq: t.seq,
      officer: t.officer_text,
      answer: (t.user_transcript_corrected ?? t.user_transcript_raw ?? "").trim(),
      seconds: t.started_ms != null && t.ended_ms != null ? (t.ended_ms - t.started_ms) / 1000 : 0,
    }));
    // Grade twice and merge (src/lib/domain/grade-merge.ts); one failed run still yields a debrief.
    const runs = input.length
      ? await Promise.allSettled([gradeDebrief({ profile, plan, turns: input }), gradeDebrief({ profile, plan, turns: input })])
      : [];
    const ok = runs.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    if (input.length && !ok.length) throw (runs[0] as PromiseRejectedResult).reason;
    const { merged: graded, agreement } = ok.length ? mergeGrades(ok[0], ok[1] ?? null) : { merged: null, agreement: null };

    for (const t of input) {
      const g = graded?.turns.find((x) => x.seq === t.seq);
      let stronger = g?.stronger_answer ?? null;
      let blocked: string[] = [];
      if (stronger) {
        const check = validateRewrite(stronger, profile, t.answer);
        if (!check.ok) {
          blocked = check.unsupported;
          stronger = null; // never show a rewrite that adds facts
        }
      }
      await db
        .from("turns")
        .update({
          scores: {
            ...(g ? { llm: g.scores, testing: g.testing, probe_id: g.probe_id } : {}),
            delivery: deliveryMetrics(t.answer, t.seconds),
            stronger_answer: stronger,
            missing_evidence: g?.missing_evidence ?? null,
            rewrite_blocked_terms: blocked,
          },
          red_flags: g?.red_flags ?? [],
        })
        .eq("session_id", sessionId)
        .eq("seq", t.seq);
    }

    const firstMinute = input.filter((t) => {
      const turn = turns?.find((x) => x.seq === t.seq);
      return (turn?.started_ms ?? Infinity) < 60_000;
    });
    await db
      .from("sessions")
      .update({
        debrief: {
          summary: graded?.summary ?? "You didn't answer any questions in this session.",
          top_fixes: graded?.top_fixes ?? [],
          first_minute_seqs: firstMinute.map((t) => t.seq),
          judge_agreement: agreement,
          regrades: (session!.debrief as { regrades?: number } | null)?.regrades ?? 0,
        },
        debrief_status: "done",
      })
      .eq("id", sessionId);
  } catch (e) {
    console.error("debrief failed", sessionId, e);
    await db.from("sessions").update({ debrief_status: "failed" }).eq("id", sessionId);
  }
}
