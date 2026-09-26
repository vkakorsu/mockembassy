import type { CaseProfile } from "./case";

/**
 * Quick checks: the short factual questions officers fire between topics
 * ("Are you married?", "Graduated when?", "Have you travelled before?"). In
 * real West African F-1 transcripts (docs/INTERVIEW-REALISM.md §10) they're a
 * large share of what officers say. Each is only asked when the file holds
 * the answer, so a mismatch is a real contradiction, not a guess.
 */

export interface QuickCheck {
  /** Which fact it checks; the Director never asks one that a planned topic covers. */
  topic: "marital" | "children" | "siblings" | "graduation" | "degree" | "work" | "travel" | "us_visits" | "refusals";
  question: string;
  onFile: string;
}

export function quickChecks(c: CaseProfile): QuickCheck[] {
  const out: QuickCheck[] = [
    { topic: "marital", question: "Are you married?", onFile: `Marital status: ${c.applicant.maritalStatus}` },
    { topic: "children", question: "Any kids?", onFile: `Children: ${c.applicant.children}` },
    {
      topic: "travel",
      question: "Have you travelled outside Ghana before?",
      onFile: c.history.otherCountriesVisited.length ? `Countries visited: ${c.history.otherCountriesVisited.join(", ")}` : "No other countries listed",
    },
    {
      topic: "us_visits",
      question: "Have you been to the US before?",
      onFile: c.history.priorUsVisits ? `${c.history.priorUsVisits} previous US visit(s)` : "No previous US visits",
    },
    {
      topic: "refusals",
      question: "Have you applied for a US visa before?",
      onFile: c.history.priorRefusals.length
        ? `Refused before: ${c.history.priorRefusals.map((r) => r.year).join(", ")}`
        : c.history.priorUsVisits
          ? "Has held a US visa (previous visits); no refusals"
          : "No previous applications or refusals listed",
    },
  ];
  if (c.family?.siblings !== undefined) out.push({ topic: "siblings", question: "How many siblings do you have?", onFile: `Siblings: ${c.family.siblings}` });
  if (c.education?.graduationYear) out.push({ topic: "graduation", question: "When did you finish school?", onFile: `Finished last studies: ${c.education.graduationYear}` });
  if (c.education?.lastProgram) out.push({ topic: "degree", question: "What was your first degree in?", onFile: `Previous study: ${c.education.lastProgram}` });
  if (c.ties.employer) out.push({ topic: "work", question: "Where do you work?", onFile: `Works at: ${c.ties.employer}` });
  return out;
}

/** Topics whose planned probe already asks the same fact. */
export const QUICK_CHECK_COVERED_BY: Record<QuickCheck["topic"], readonly string[]> = {
  marital: ["b.ties.family", "f1.ties.family"],
  children: ["b.ties.family", "f1.ties.family"],
  siblings: ["f1.ties.family"],
  graduation: ["f1.purpose.gap", "f1.academic.preparedness"],
  degree: ["f1.academic.preparedness", "f1.academic.program"],
  work: ["f1.ties.job", "b.ties.work"],
  travel: ["common.history.travel"],
  us_visits: ["common.history.us_visits"],
  refusals: ["common.history.refusal"],
};

/** Folder documents an officer asks to see while on a topic, most likely first. */
export const DOCUMENTS_FOR_PROBE: Record<string, readonly string[]> = {
  "f1.funding.sponsor": ["bank_statement", "sponsor_letter"],
  "f1.funding.gap": ["bank_statement", "sponsor_letter"],
  "f1.funding.deposit": ["bank_statement"],
  "f1.funding.scholarship": ["scholarship_letter", "i20"],
  "f1.funding.living": ["scholarship_letter", "bank_statement"],
  "f1.purpose.discovery": ["scholarship_letter", "admission_letter"],
  "f1.academic.preparedness": ["academic_record"],
  "f1.academic.tests": ["academic_record"],
  "f1.ties.job": ["employment_letter"],
  "b.funding.trip": ["bank_statement", "sponsor_letter"],
  "b.ties.work": ["employment_letter", "business_registration"],
  "b.ties.income": ["employment_letter", "bank_statement"],
  "b.ties.leave": ["employment_letter"],
  "b.ties.business": ["business_registration"],
  "b.purpose.trip": ["invitation_letter"],
  "b.host": ["invitation_letter"],
  "common.ties.property": ["property"],
  "common.history.refusal": ["refusal_letter"],
};
