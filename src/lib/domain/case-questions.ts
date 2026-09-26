import { z } from "zod";
import type { CaseProfile } from "./case";
import { PROBES, fillTemplate } from "./probes";
import { validateRewrite } from "./rewrite-validator";
import { maxSimilarity } from "./similarity";

/**
 * Questions written for one applicant from their confirmed facts: the kind a
 * real officer thinks of after reading this particular file ("Your father's
 * business was registered in 2021 and your scholarship only covers tuition.
 * Who pays your rent?"). They're generated after the profile is confirmed
 * (src/lib/server/jobs.ts), stored on the case, and checked again here every
 * time they're used, so a question can never state a name or number that
 * isn't on the officer's file.
 */

export const CASE_PROBE_PREFIX = "case:";

export const CASE_QUESTION_CATEGORIES = ["purpose", "academic", "funding", "career", "ties", "us_contacts", "history"] as const;

/** What the model returns. */
export const GeneratedCaseQuestions = z.object({
  questions: z
    .array(
      z.object({
        question: z.string().max(200),
        goal: z.string().max(200),
        category: z.enum(CASE_QUESTION_CATEGORIES),
        /** The facts from the file the question rests on, quoted as given. */
        facts: z.array(z.string().max(200)).max(4),
      }),
    )
    .max(6),
});
export type GeneratedCaseQuestions = z.infer<typeof GeneratedCaseQuestions>;

export const CaseQuestion = z.object({
  id: z.string().regex(/^[a-z0-9]{4,16}$/),
  question: z.string().min(8).max(200),
  goal: z.string().max(200),
  category: z.enum(CASE_QUESTION_CATEGORIES),
  facts: z.array(z.string().max(200)).max(4),
});
export type CaseQuestion = z.infer<typeof CaseQuestion>;

/** Stored on cases.case_questions. */
export const CaseQuestionSet = z.object({
  profileVersion: z.number().int(),
  generatedAt: z.string(),
  questions: z.array(CaseQuestion).max(6),
});
export type CaseQuestionSet = z.infer<typeof CaseQuestionSet>;

/** A short, stable id from the wording (FNV-1a). */
export function caseQuestionId(question: string): string {
  let h = 0x811c9dc5;
  for (const ch of question.toLowerCase().replace(/\s+/g, " ").trim()) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).padStart(6, "0");
}

const FACT_FILLER = new Set(["about", "also", "their", "there", "with", "from", "that", "this", "year", "years", "have", "they", "applicant", "file", "form"]);

/** Most of a fact's content words appear in the file ("father", "cocoa", "exporter"). */
function grounded(fact: string, sourceLower: string): boolean {
  const words = (fact.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter((w) => !FACT_FILLER.has(w));
  if (!words.length) return false;
  return words.filter((w) => sourceLower.includes(w)).length / words.length >= 0.75;
}

/** Sample wordings of the standard questions, to skip generated ones that merely repeat them. */
function standardWordings(profile: CaseProfile): string[] {
  return PROBES.filter((p) => p.visaTypes.includes(profile.visaType)).flatMap((p) =>
    p.entry.map((t) => fillTemplate(t, profile).replace(/\{\w+\}/g, "")),
  );
}

/**
 * Keeps generated questions that are safe to put in front of the officer:
 * one short question, no brackets or instructions, not a copy of a standard
 * question, and every name and number in it (and in its facts) found in the
 * officer's file. `fileText` is what the officer has on screen.
 */
export function acceptCaseQuestions(
  generated: GeneratedCaseQuestions["questions"],
  profile: CaseProfile,
  fileText: string,
): CaseQuestion[] {
  const standard = standardWordings(profile);
  // The post-study plan is coaching material, not on the officer's file.
  const visible: CaseProfile = { ...profile, study: profile.study ? { ...profile.study, postStudyPlan: undefined } : undefined };
  const out: CaseQuestion[] = [];
  for (const g of generated) {
    const question = g.question.trim().replace(/\s+/g, " ");
    if (question.length < 8 || question.length > 200 || !question.endsWith("?")) continue;
    // One question at a time, and nothing that could read as an instruction to the officer.
    if ((question.match(/\?/g) ?? []).length > 2 || /[[\]{}<>]|\b(ignore|instruction|system|referee|tool)\b/i.test(question)) continue;
    if (maxSimilarity(question, standard) >= 0.55) continue;
    if (!validateRewrite(`${question} ${g.facts.join(". ")}`, visible, fileText).ok) continue;
    // It must rest on something actually on the file, not on the model's reading between the lines.
    const source = `${JSON.stringify(visible)} ${fileText}`.toLowerCase();
    if (!g.facts.length || !g.facts.every((f) => grounded(f, source))) continue;
    const id = caseQuestionId(question);
    if (out.some((q) => q.id === id || maxSimilarity(q.question, [question]) >= 0.6)) continue;
    const parsed = CaseQuestion.safeParse({ id, question, goal: g.goal.trim(), category: g.category, facts: g.facts.map((f) => f.trim()) });
    if (parsed.success) out.push(parsed.data);
    if (out.length >= 4) break;
  }
  return out;
}

/**
 * The stored questions still safe to use with this profile. They're checked
 * again on every use: the profile may have changed since they were written,
 * and a stored row is never trusted on its own.
 */
export function usableCaseQuestions(stored: unknown, profile: CaseProfile, fileText: string): CaseQuestion[] {
  const set = CaseQuestionSet.safeParse(stored);
  if (!set.success) return [];
  return acceptCaseQuestions(set.data.questions, profile, fileText);
}
