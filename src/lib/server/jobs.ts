import "server-only";
import { CaseProfile } from "@/lib/domain/case";
import { deliveryMetrics } from "@/lib/domain/delivery";
import type { SessionPlan } from "@/lib/domain/director";
import { dedupeConflicts, mergeDraft, type DraftConflict } from "@/lib/domain/draft";
import { mergeGrades } from "@/lib/domain/grade-merge";
import { validateRewrite } from "@/lib/domain/rewrite-validator";
import { isDuplicateNote, redactIdentifiers, toUsd } from "@/lib/domain/notes";
import { isRepeatRequest, stripToolText } from "@/lib/domain/transcript";
import { env } from "@/lib/env";
import { sliceSamples, voiceMetrics, wavSamples, encodeWav, type VoiceMetrics } from "@/lib/domain/voice";
import { caseVocabulary, extractFacts, gradeDebrief, isTransient, transcribeAnswer, transcribeDocument } from "@/lib/server/gemini";
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
    const input = { bytes: new Uint8Array(await file.arrayBuffer()), mimeType: file.type || "application/pdf", kind: doc.kind };
    const [facts, fullText] = await Promise.all([
      extractFacts(input),
      // The transcription is a bonus: a failure here shouldn't fail the facts.
      transcribeDocument(input).catch(() => null),
    ]);
    // Never persist raw passport numbers; only the last four digits live on the case.
    const { appointment, documentLooksLike, notes, legibility, unreadable, ...profileFacts } = facts;

    // Statement amounts come as printed (usually cedis); convert for the USD fields.
    let fx: { amount: number; currency: string; usd: number; rate: number } | undefined;
    if (profileFacts.funding) {
      const { fundsAvailable, recentLargeDeposit, ...rest } = profileFacts.funding;
      const funding: typeof rest = { ...rest };
      if (fundsAvailable && funding.liquidFundsUsd === undefined) {
        const usd = toUsd(fundsAvailable.amount, fundsAvailable.currency, env.fxGhsPerUsd);
        if (usd !== undefined) {
          funding.liquidFundsUsd = usd;
          if (!/^(USD|US\$|\$)$/i.test(fundsAvailable.currency.trim())) {
            fx = { amount: fundsAvailable.amount, currency: fundsAvailable.currency, usd, rate: env.fxGhsPerUsd };
          }
        }
      }
      if (recentLargeDeposit && funding.recentLargeDepositUsd === undefined) {
        const usd = toUsd(recentLargeDeposit.amount, recentLargeDeposit.currency, env.fxGhsPerUsd);
        if (usd !== undefined) funding.recentLargeDepositUsd = usd;
      }
      profileFacts.funding = funding;
    }

    const { data: caseRow } = await db.from("cases").select("draft_profile, interview_at").eq("id", doc.case_id).single();
    const existing = (caseRow?.draft_profile ?? {}) as Record<string, unknown>;
    const { merged, conflicts } = mergeDraft(existing, profileFacts, doc.kind);
    // Reading a document again replaces its earlier disagreements.
    const allConflicts = dedupeConflicts([
      ...((existing._conflicts as DraftConflict[]) ?? []).filter((c) => c.documentId !== doc.id),
      ...conflicts.map((c) => ({ ...c, documentId: doc.id })),
    ]);
    await db
      .from("cases")
      .update({ draft_profile: { ...merged, _conflicts: allConflicts, ...(fx ? { _fx: fx } : {}) } })
      .eq("id", doc.case_id);

    // Re-reading replaces this document's undecided notes; decided ones stay
    // (and a removed note doesn't come back).
    await db.from("case_notes").delete().eq("document_id", doc.id).eq("status", "pending");
    // Skip notes that repeat one already on the case (the I-20 and the admission
    // letter often state the same scholarship).
    const { data: existingNotes } = await db.from("case_notes").select("text").eq("case_id", doc.case_id);
    const known = (existingNotes ?? []).map((n) => n.text as string);
    const fresh: { category: string; text: string; quote: string | null }[] = [];
    for (const n of notes ?? []) {
      const text = redactIdentifiers(n.text);
      if ([...known, ...fresh.map((f) => f.text)].some((k) => isDuplicateNote(k, text))) continue;
      fresh.push({ category: n.category, text, quote: n.quote ? redactIdentifiers(n.quote) : null });
    }
    if (fresh.length) {
      await db.from("case_notes").insert(
        fresh.map((n) => ({
          case_id: doc.case_id,
          document_id: doc.id,
          source_kind: doc.kind,
          category: n.category,
          text: n.text,
          quote: n.quote,
        })),
      );
    }

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
      .update({
        extraction: { documentLooksLike, facts: profileFacts, legibility, unreadable },
        full_text: fullText ? redactIdentifiers(fullText).slice(0, 60_000) : null,
        extraction_status: "done",
        extraction_error: null,
      })
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
    const { data: session } = await db
      .from("sessions")
      .select("case_id, profile_version, plan, debrief, recording_path")
      .eq("id", sessionId)
      .single();
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
      .select("seq, officer_text, user_transcript_raw, user_transcript_corrected, user_transcript_asr, started_ms, ended_ms")
      .eq("session_id", sessionId)
      .order("seq");

    // From the recording: a careful second transcript of each answer (once),
    // and how it sounded (pace, pauses, trailing off).
    const voice = new Map<number, VoiceMetrics>();
    if (session!.recording_path?.endsWith(".wav")) {
      try {
        const { data: file } = await db.storage.from("recordings").download(session!.recording_path);
        if (file) {
          const { samples, sampleRate } = wavSamples(new Uint8Array(await file.arrayBuffer()));
          const vocabulary = caseVocabulary(profile);
          const timed = (turns ?? []).filter((t) => t.started_ms != null && t.ended_ms != null && t.ended_ms > t.started_ms);
          for (let i = 0; i < timed.length; i += 4) {
            await Promise.all(
              timed.slice(i, i + 4).map(async (t) => {
                const clip = sliceSamples(samples, sampleRate, t.started_ms! - 400, t.ended_ms! + 800);
                const m = voiceMetrics(clip, sampleRate);
                voice.set(t.seq, m);
                if (t.user_transcript_asr != null) return;
                // Near-silence makes speech recognition invent words ("Pichilemu"): record it as nothing said.
                let text: string | null = "";
                if (m.voicedSec >= 0.4) {
                  text = await transcribeAnswer({
                    wav: encodeWav([clip], sampleRate),
                    question: stripToolText(t.officer_text),
                    vocabulary,
                  }).catch((e) => {
                    console.warn("[asr] answer transcription failed:", e instanceof Error ? e.message.slice(0, 200) : e);
                    return null;
                  });
                }
                if (text === null) return;
                t.user_transcript_asr = text;
                await db.from("turns").update({ user_transcript_asr: text }).eq("session_id", sessionId).eq("seq", t.seq);
              }),
            );
          }
        }
      } catch {
        // The live transcript still works; this only improves it.
      }
    }
    const answerText = (t: { user_transcript_corrected: string | null; user_transcript_asr: string | null; user_transcript_raw: string | null }) =>
      // An empty second transcript means nothing was said; only null means it's missing.
      (t.user_transcript_corrected ?? t.user_transcript_asr ?? t.user_transcript_raw ?? "").trim();

    const { data: noteRows } = await db
      .from("case_notes")
      .select("text")
      .eq("case_id", session!.case_id)
      .eq("status", "confirmed");
    const confirmedNotes = (noteRows ?? []).map((n) => n.text as string);
    const { data: docRows } = await db
      .from("documents")
      .select("kind, full_text")
      .eq("case_id", session!.case_id)
      .not("full_text", "is", null);
    // Keep the grading call bounded: ~40k characters of documents in total.
    let budget = 40_000;
    const documents = (docRows ?? []).flatMap((d) => {
      if (budget <= 0) return [];
      const text = String(d.full_text).slice(0, Math.min(15_000, budget));
      budget -= text.length;
      return [{ kind: d.kind as string, text }];
    });

    const answered = (turns ?? []).filter(
      (t) =>
        answerText(t) &&
        // Handing over the passport isn't an answer to grade, nor is "What?".
        !(t.seq === 1 && !String(t.officer_text).includes("?")) &&
        !isRepeatRequest(answerText(t)),
    );
    const input = answered.map((t) => ({
      seq: t.seq,
      officer: stripToolText(t.officer_text),
      answer: answerText(t),
      seconds: t.started_ms != null && t.ended_ms != null ? (t.ended_ms - t.started_ms) / 1000 : 0,
    }));
    // Grade twice and merge (src/lib/domain/grade-merge.ts); one failed run still yields a debrief.
    const runs = input.length
      ? await Promise.allSettled([
          gradeDebrief({ profile, plan, turns: input, confirmedNotes, documents }),
          gradeDebrief({ profile, plan, turns: input, confirmedNotes, documents }),
        ])
      : [];
    const ok = runs.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    if (input.length && !ok.length) throw (runs[0] as PromiseRejectedResult).reason;
    const { merged: graded, agreement } = ok.length ? mergeGrades(ok[0], ok[1] ?? null) : { merged: null, agreement: null };

    for (const t of input) {
      const g = graded?.turns.find((x) => x.seq === t.seq);
      let stronger = g?.stronger_answer ?? null;
      let blocked: string[] = [];
      if (stronger) {
        // Confirmed notes are the applicant's own facts too.
        const check = validateRewrite(stronger, profile, `${t.answer} ${confirmedNotes.join(" ")}`);
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
            voice: voice.get(t.seq) ?? null,
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
