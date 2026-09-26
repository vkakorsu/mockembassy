import { fundingGapUsd, type CaseProfile, type VisaType } from "./case";

/**
 * The probe taxonomy. A probe is a hypothesis the officer tests. The Director
 * may only choose *what to test* from this list; phrasing can vary, the
 * substance cannot be invented. Seed version, to be owned and extended by
 * the former-officer advisors (see docs/PLAN.md §2.2.4).
 */

export type ProbeCategory =
  | "purpose"
  | "academic"
  | "funding"
  | "career"
  | "ties"
  | "us_contacts"
  | "history"
  | "wildcard";

export interface Probe {
  id: string;
  visaTypes: readonly VisaType[];
  category: ProbeCategory;
  /** Critical probes decide 214(b). Non-critical ones colour the picture. */
  critical: boolean;
  /** 0 means not applicable to this case; 1 means central to it. */
  relevance: (c: CaseProfile) => number;
  /** Case Profile fields the officer may cite for this probe. */
  grounding: readonly string[];
  entry: readonly string[];
  followUpVague: readonly string[];
  followUpContradiction: readonly string[];
  /** Facts a satisfying answer should contain (for the Referee and the debrief). */
  mustInclude: (c: CaseProfile) => string[];
}

const both: readonly VisaType[] = ["F1", "B1B2"];
const f1: readonly VisaType[] = ["F1"];
const b: readonly VisaType[] = ["B1B2"];

const hasEmployer = (c: CaseProfile) => Boolean(c.ties.employer);

export const PROBES: readonly Probe[] = [
  // ---------- F-1 ----------
  {
    id: "f1.purpose.school",
    visaTypes: f1,
    category: "purpose",
    critical: true,
    relevance: () => 1,
    grounding: ["study.school", "study.program"],
    entry: [
      "Why did you choose {school}?",
      "Why this university?",
      "How did you pick {school} out of all the schools in the US?",
      "Which other schools did you apply to?",
    ],
    followUpVague: ["What specifically about {school}?", "Name one thing only {school} offers you."],
    followUpContradiction: ["Your form says {school}. Which school are you going to?"],
    mustInclude: (c) => [c.study?.school ?? "", "a specific reason tied to the program"].filter(Boolean),
  },
  {
    id: "f1.academic.program",
    visaTypes: f1,
    category: "academic",
    critical: false,
    relevance: () => 0.8,
    grounding: ["study.program", "study.level", "study.currentOccupation"],
    entry: [
      "What will you study?",
      "Why {program}?",
      "How does {program} connect to what you've done so far?",
    ],
    followUpVague: ["What will you actually learn in that program?"],
    followUpContradiction: ["That's not the program on your I-20. Which is it?"],
    mustInclude: (c) => [c.study?.program ?? "", "link to previous study or work"].filter(Boolean),
  },
  {
    id: "f1.funding.sponsor",
    visaTypes: f1,
    category: "funding",
    critical: true,
    relevance: () => 1,
    grounding: ["funding.sponsors", "funding.liquidFundsUsd", "study.i20Year1CostUsd"],
    entry: [
      "Who is paying for your studies?",
      "How are you funding your first year?",
      "Who is sponsoring you?",
    ],
    followUpVague: ["What does your sponsor do for a living?", "How much do they earn in a year?"],
    followUpContradiction: ["Your form lists a different sponsor. Who is actually paying?"],
    mustInclude: (c) => [
      c.funding.sponsors[0]?.relationship ?? "the sponsor",
      c.funding.sponsors[0]?.occupation ?? "the sponsor's occupation",
    ],
  },
  {
    id: "f1.funding.gap",
    visaTypes: f1,
    category: "funding",
    critical: true,
    relevance: (c) => (fundingGapUsd(c) > 0 ? 1 : 0),
    grounding: ["study.i20Year1CostUsd", "study.scholarshipUsd", "funding.liquidFundsUsd"],
    entry: [
      "Your I-20 says about ${i20} for the first year. Where is that money coming from?",
      "How will you cover the full first-year cost?",
      "Your bank statement doesn't reach the first-year cost. How do you close that?",
      "Where does the rest of the tuition money come from?",
    ],
    followUpVague: ["And the second year?"],
    followUpContradiction: ["Those numbers don't add up. Explain it to me."],
    mustInclude: () => ["the exact source covering the shortfall"],
  },
  {
    id: "f1.funding.scholarship",
    visaTypes: f1,
    category: "funding",
    critical: false,
    relevance: (c) => (c.study?.scholarshipUsd ? 0.8 : 0),
    grounding: ["study.scholarshipUsd"],
    entry: [
      "I see a scholarship on your I-20. What is it for?",
      "Why did {school} give you a scholarship?",
      "Does your scholarship renew every year?",
      "What does the scholarship cover, and what doesn't it?",
    ],
    followUpVague: ["What do you have to do to keep it?"],
    followUpContradiction: ["That's not what your I-20 shows."],
    mustInclude: () => ["what the scholarship is for and what it covers", "how the rest is paid"],
  },
  {
    id: "f1.funding.deposit",
    visaTypes: f1,
    category: "funding",
    critical: false,
    relevance: (c) =>
      c.funding.recentLargeDepositUsd && c.funding.recentLargeDepositUsd > 0.3 * c.funding.liquidFundsUsd
        ? 0.9
        : 0,
    grounding: ["funding.recentLargeDepositUsd"],
    entry: ["There's a large deposit in this account recently. Where did it come from?"],
    followUpVague: ["Why was it moved just before your application?"],
    followUpContradiction: ["That's not what your statement shows."],
    mustInclude: () => ["the true origin of the deposit"],
  },
  {
    id: "f1.career.after",
    visaTypes: f1,
    category: "career",
    critical: true,
    relevance: () => 1,
    grounding: ["study.postStudyPlan", "study.currentOccupation"],
    entry: [
      "What will you do after you graduate?",
      "Where do you see yourself working after the program?",
      "What's your plan once you finish?",
    ],
    followUpVague: ["What kind of work, back home?", "Why does this degree help you there?"],
    followUpContradiction: ["A minute ago you said something different. Which is it?"],
    // 9 FAM 402.5-5: young students aren't expected to have long-range plans; officers
    // look for a *present* intent to depart. Mid-career applicants are held to more.
    mustInclude: (c) =>
      c.study?.currentOccupation || c.applicant.age >= 26
        ? ["a specific, honest plan that uses the degree back home"]
        : ["an honest present intention to return after studying"],
  },
  {
    id: "f1.academic.preparedness",
    visaTypes: f1,
    category: "academic",
    critical: false,
    // Officers don't go behind the I-20 on admission, but may check English and
    // academic preparation for the course (9 FAM 402.5-5).
    relevance: () => 0.5,
    grounding: ["study.program", "study.level"],
    entry: [
      "What did you study before this?",
      "How did you do in your last degree?",
      "Did you take any English or admission tests?",
    ],
    followUpVague: ["What were your grades like?"],
    followUpContradiction: ["That's not what your application shows."],
    mustInclude: () => ["previous study and results, stated simply"],
  },
  {
    id: "f1.ties.job",
    visaTypes: f1,
    category: "ties",
    critical: false,
    relevance: (c) => (hasEmployer(c) ? 0.8 : 0),
    grounding: ["ties.employer", "ties.role", "ties.yearsEmployed"],
    entry: ["What do you do at {employer}?", "Are you leaving your job at {employer}?"],
    followUpVague: ["Will they take you back?"],
    followUpContradiction: ["Your form says you work somewhere else."],
    mustInclude: (c) => [c.ties.employer ?? "", c.ties.role ?? ""].filter(Boolean),
  },
  {
    id: "f1.wildcard.ghana",
    visaTypes: f1,
    category: "wildcard",
    critical: false,
    relevance: () => 0.6,
    grounding: ["study.program"],
    entry: ["Why not study {program} in Ghana?", "Can't you do this program at home?"],
    followUpVague: ["Be specific. What's missing locally?"],
    followUpContradiction: [],
    mustInclude: () => ["a specific gap in local options"],
  },

  // ---------- B1/B2 ----------
  {
    id: "b.purpose.trip",
    visaTypes: b,
    category: "purpose",
    critical: true,
    relevance: () => 1,
    grounding: ["visit.purpose"],
    entry: ["What is the purpose of your trip?", "Why are you going to the United States?", "What's taking you to the US?"],
    followUpVague: ["What exactly will you do there?"],
    followUpContradiction: ["Your form gives a different reason."],
    mustInclude: (c) => [c.visit?.purpose ?? "the purpose"],
  },
  {
    id: "b.purpose.duration",
    visaTypes: b,
    category: "purpose",
    critical: false,
    relevance: (c) => (c.visit ? (c.visit.durationDays > 30 ? 0.9 : 0.5) : 0),
    grounding: ["visit.durationDays"],
    entry: ["How long will you stay?", "{days} days is a long time. Why that long?"],
    followUpVague: ["When is your return flight?"],
    followUpContradiction: ["You wrote a different length of stay on your form."],
    mustInclude: (c) => [`${c.visit?.durationDays ?? "?"} days`],
  },
  {
    id: "b.host",
    visaTypes: b,
    category: "us_contacts",
    critical: false,
    relevance: (c) => (c.visit?.hostRelationship ? 0.8 : 0),
    grounding: ["visit.hostRelationship", "visit.hostCity"],
    entry: ["Who are you visiting?", "What does your {host} do in {hostCity}?"],
    followUpVague: ["What is their immigration status?"],
    followUpContradiction: ["That's not who's listed on your form."],
    mustInclude: (c) => [c.visit?.hostRelationship ?? ""].filter(Boolean),
  },
  {
    id: "b.funding.trip",
    visaTypes: b,
    category: "funding",
    critical: true,
    relevance: () => 1,
    grounding: ["funding.sponsors", "funding.liquidFundsUsd"],
    entry: ["Who is paying for this trip?", "How are you funding the trip?"],
    followUpVague: ["How much will the trip cost?"],
    followUpContradiction: ["Your form says someone else is paying."],
    mustInclude: () => ["who pays", "roughly how much"],
  },
  {
    id: "b.ties.work",
    visaTypes: b,
    category: "ties",
    critical: true,
    relevance: () => 1,
    grounding: ["ties.employer", "ties.role", "ties.yearsEmployed", "ties.ownsBusiness"],
    entry: ["What do you do for a living?", "Where do you work?", "How long have you worked at {employer}?"],
    followUpVague: ["How much do you earn a month?"],
    followUpContradiction: ["That doesn't match the employer on your form."],
    mustInclude: (c) => [c.ties.employer ?? (c.ties.ownsBusiness ? "your business" : "your occupation")],
  },
  {
    id: "b.ties.family",
    visaTypes: b,
    category: "ties",
    critical: false,
    relevance: (c) => (c.applicant.maritalStatus === "married" || c.applicant.children > 0 ? 0.7 : 0),
    grounding: ["applicant.maritalStatus", "applicant.children"],
    entry: ["Who are you leaving behind in Ghana?", "Is your family travelling with you?"],
    followUpVague: ["Who will look after your children?"],
    followUpContradiction: ["Your form says otherwise."],
    mustInclude: () => ["family remaining in Ghana"],
  },
  {
    id: "b.wildcard.return",
    visaTypes: b,
    category: "wildcard",
    critical: false,
    relevance: () => 0.6,
    grounding: [],
    entry: ["How do I know you'll come back?", "What brings you back to Ghana?"],
    followUpVague: ["That's not a reason. Give me one."],
    followUpContradiction: [],
    mustInclude: () => ["one concrete obligation in Ghana"],
  },

  // ---------- Both ----------
  {
    id: "common.us_contacts",
    visaTypes: both,
    category: "us_contacts",
    critical: false,
    relevance: (c) => (c.usContacts.length > 0 ? 0.8 : 0.2),
    grounding: ["usContacts"],
    entry: ["Do you have any family in the US?", "Do you know anyone in the United States?"],
    followUpVague: ["What is their status there?"],
    followUpContradiction: ["You didn't list any relatives in the US on your form."],
    mustInclude: (c) => c.usContacts.map((u) => u.relationship),
  },
  {
    id: "common.history.refusal",
    visaTypes: both,
    category: "history",
    critical: true,
    relevance: (c) => (c.history.priorRefusals.length > 0 ? 1 : 0),
    grounding: ["history.priorRefusals"],
    entry: ["You were refused before. What has changed since then?", "Why were you refused last time?"],
    followUpVague: ["What's different now, specifically?"],
    followUpContradiction: ["Our records show a prior refusal."],
    mustInclude: () => ["a material change since the refusal"],
  },
  {
    // Since interview waivers ended (Sept 2025), returning visitors interview
    // again, and whether they left on time last visit is the first thing checked.
    id: "common.history.us_visits",
    visaTypes: both,
    category: "history",
    critical: true,
    relevance: (c) => (c.history.priorUsVisits > 0 ? 1 : 0),
    grounding: ["history.priorUsVisits"],
    entry: [
      "You've been to the US before. When was your last trip, and how long did you stay?",
      "Tell me about your last visit to the US.",
    ],
    followUpVague: ["What did you do there?", "When exactly did you come back?"],
    followUpContradiction: ["Our records show a different stay."],
    mustInclude: () => ["when, how long, and that they left on time"],
  },
  {
    id: "common.history.travel",
    visaTypes: both,
    category: "history",
    critical: false,
    relevance: (c) => (c.history.otherCountriesVisited.length > 0 || c.history.priorUsVisits > 0 ? 0.6 : 0.3),
    grounding: ["history.otherCountriesVisited", "history.priorUsVisits"],
    entry: ["Have you travelled outside Ghana before?", "Where have you travelled?"],
    followUpVague: ["When was that?"],
    followUpContradiction: ["Your passport shows different travel."],
    mustInclude: (c) => c.history.otherCountriesVisited.slice(0, 2),
  },
];

export function probesFor(visaType: VisaType): Probe[] {
  return PROBES.filter((p) => p.visaTypes.includes(visaType));
}

export function getProbe(id: string): Probe {
  const probe = PROBES.find((p) => p.id === id);
  if (!probe) throw new Error(`Unknown probe: ${id}`);
  return probe;
}

/** Fill `{placeholders}` from the confirmed profile only. */
export function fillTemplate(template: string, c: CaseProfile): string {
  const values: Record<string, string | undefined> = {
    school: c.study?.school,
    program: c.study?.program,
    i20: c.study ? c.study.i20Year1CostUsd.toLocaleString("en-US") : undefined,
    employer: c.ties.employer,
    days: c.visit ? String(c.visit.durationDays) : undefined,
    host: c.visit?.hostRelationship,
    hostCity: c.visit?.hostCity,
  };
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? `{${key}}`);
}

/** A template is usable only if every placeholder resolves from the profile. */
export function isFillable(template: string, c: CaseProfile): boolean {
  return !/\{\w+\}/.test(fillTemplate(template, c));
}
