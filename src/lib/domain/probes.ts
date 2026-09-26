import { fundingGapUsd, type CaseProfile, type VisaType } from "./case";

/**
 * The probe taxonomy. A probe is a hypothesis the officer tests: a goal (what
 * they need to find out), the facts on their file to check the answer
 * against, and example wordings. The officer phrases each question and
 * follow-up in their own words, reacting to what the applicant says; the
 * Director only decides *what* is tested, from this list. Seed version, to be
 * owned and extended by the former-officer advisors (see docs/PLAN.md §2.2.4).
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
  /** What the officer needs to find out, in plain words. */
  goal: string;
  /**
   * Facts on the officer's file that an answer can be checked against, in
   * plain words. Empty means there is nothing to catch a contradiction with.
   */
  onFile: (c: CaseProfile) => string[];
  /**
   * Whether the file holds enough to challenge an answer on this topic.
   * Defaults to "onFile isn't empty". Without it, contradiction lines are never
   * planned, so the officer can't claim "your form says…" about nothing.
   */
  canContradict?: (c: CaseProfile) => boolean;
  /** Example openings. The officer words it their own way. */
  entry: readonly string[];
  /** Example follow-ups for a vague answer. */
  followUpVague: readonly string[];
  /** Example challenges when an answer conflicts with the file. */
  followUpContradiction: readonly string[];
  /** Facts a satisfying answer should contain (for the Referee and the debrief). */
  mustInclude: (c: CaseProfile) => string[];
}

const both: readonly VisaType[] = ["F1", "B1B2"];
const f1: readonly VisaType[] = ["F1"];
const b: readonly VisaType[] = ["B1B2"];

const hasEmployer = (c: CaseProfile) => Boolean(c.ties.employer);
const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const ghs = (n: number) => `GH₵${Math.round(n).toLocaleString("en-US")}`;
/** Keeps the facts that are present; `cond && "text"` entries drop out when cond is falsy (including 0). */
const compact = (xs: unknown[]) => xs.filter((x): x is string => typeof x === "string" && x.length > 0);

/* ---------------------------------------------------- facts on the file */

export function sponsorFacts(c: CaseProfile): string[] {
  return c.funding.sponsors.map((s) => {
    const who = s.name ? `${s.relationship} (${s.name})` : s.relationship;
    const detail = compact([
      s.occupation,
      s.employerOrBusiness && `at ${s.employerOrBusiness}`,
      s.annualIncomeUsd !== undefined && `about ${usd(s.annualIncomeUsd)} a year`,
      s.otherDependants !== undefined && `also supports ${s.otherDependants} other ${s.otherDependants === 1 ? "person" : "people"}`,
    ]).join(", ");
    return `Sponsor: ${who}${detail ? `, ${detail}` : ""}`;
  });
}

function moneyFacts(c: CaseProfile): string[] {
  return compact([
    c.study && `I-20 first-year cost: ${usd(c.study.i20Year1CostUsd)}`,
    c.study?.scholarshipUsd && `School funding or scholarship: ${usd(c.study.scholarshipUsd)} a year`,
    `Documented funds: ${usd(c.funding.liquidFundsUsd)}`,
    c.funding.recentLargeDepositUsd && `Recent large deposit: ${usd(c.funding.recentLargeDepositUsd)}`,
    c.visit?.tripCostUsd && `Estimated trip cost: ${usd(c.visit.tripCostUsd)}`,
  ]);
}

function educationFacts(c: CaseProfile): string[] {
  const e = c.education;
  if (!e) return [];
  return compact([
    (e.lastSchool || e.lastProgram) &&
      `Previous study: ${compact([e.lastProgram, e.lastSchool && `at ${e.lastSchool}`, e.graduationYear && `finished ${e.graduationYear}`]).join(", ")}`,
    e.result && `Result: ${e.result}`,
  ]);
}

function testFacts(c: CaseProfile): string[] {
  return (c.education?.tests ?? []).map((t) => `${t.name}: ${t.score}`);
}

function workFacts(c: CaseProfile): string[] {
  const t = c.ties;
  return compact([
    t.employer &&
      `Works at ${t.employer}${t.role ? ` as ${t.role}` : ""}${t.yearsEmployed !== undefined ? `, ${t.yearsEmployed} years` : ""}`,
    t.monthlyIncomeGhs !== undefined && `Monthly income: ${ghs(t.monthlyIncomeGhs)}`,
    t.leaveApproved && "Employer has approved leave for the trip",
    t.ownsBusiness && `Owns a business${t.businessName ? `: ${t.businessName}` : ""}${t.businessYears !== undefined ? `, ${t.businessYears} years` : ""}`,
    t.ownsProperty && `Owns property${t.propertyDetail ? `: ${t.propertyDetail}` : ""}`,
  ]);
}

function familyFacts(c: CaseProfile): string[] {
  const f = c.family;
  return compact([
    `Marital status: ${c.applicant.maritalStatus}${c.applicant.children ? `, ${c.applicant.children} children` : ""}`,
    f?.spouseOccupation && `Spouse: ${f.spouseOccupation}`,
    f?.fatherOccupation && `Father: ${f.fatherOccupation}`,
    f?.motherOccupation && `Mother: ${f.motherOccupation}`,
    f?.siblings !== undefined && `${f.siblings} brothers and sisters`,
  ]);
}

function usVisitFacts(c: CaseProfile): string[] {
  const listed = c.history.usVisits.map(
    (v) => `US trip in ${v.year}${v.durationDays ? `, ${v.durationDays} days` : ""}${v.purpose ? ` (${v.purpose})` : ""}`,
  );
  if (listed.length) return listed;
  return c.history.priorUsVisits > 0 ? [`${c.history.priorUsVisits} previous US visit(s); dates not on file`] : [];
}

function visitFacts(c: CaseProfile): string[] {
  const v = c.visit;
  if (!v) return [];
  return compact([
    `Purpose on the form: ${v.purpose}`,
    v.event && `Event: ${v.event}`,
    `Length of stay: ${v.durationDays} days`,
    v.arrivalDate && `Arriving: ${v.arrivalDate}`,
    v.hostRelationship && `Visiting: ${v.hostRelationship}${v.hostCity ? ` in ${v.hostCity}` : ""}`,
    v.stayingAt && `Staying at: ${v.stayingAt}`,
    v.travellingWith && `Travelling with: ${v.travellingWith}`,
  ]);
}

/** A nationality other than Ghanaian: they must show residence in Ghana. */
export const isForeignResident = (c: CaseProfile) =>
  Boolean(c.applicant.nationality && !/^\s*ghana(ian)?\s*$/i.test(c.applicant.nationality));

/** The year the applicant would start, from "Fall 2027"; otherwise this year. */
function startYear(c: CaseProfile): number {
  const m = c.study?.startTerm.match(/\b(19|20)\d{2}\b/);
  return m ? Number(m[0]) : new Date().getUTCFullYear();
}
const yearsSinceStudy = (c: CaseProfile) =>
  c.education?.graduationYear ? startYear(c) - c.education.graduationYear : 0;

export const PROBES: readonly Probe[] = [
  // ---------- F-1 ----------
  {
    id: "f1.purpose.school",
    visaTypes: f1,
    category: "purpose",
    critical: true,
    relevance: () => 1,
    grounding: ["study.school", "study.program"],
    goal: "Find out why they chose this school, and whether the reason is specific and their own rather than rehearsed.",
    onFile: (c) =>
      compact([
        c.study && `School: ${c.study.school}, ${c.study.program} (${c.study.level})`,
        c.study?.schoolsAppliedTo && `Applied to ${c.study.schoolsAppliedTo} schools`,
        c.study?.admissionsReceived !== undefined && `Admitted by ${c.study.admissionsReceived}`,
      ]),
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
    // Real Accra transcripts: "How did you get to know about Purdue?", "Walk me through how you secured this scholarship."
    id: "f1.purpose.discovery",
    visaTypes: f1,
    category: "purpose",
    critical: false,
    relevance: () => 0.55,
    grounding: ["study.school", "study.scholarshipUsd"],
    goal: "Find out how they found this school and how they got in (and won any funding), in their own words: a genuine applicant knows their own story.",
    onFile: (c) => compact([c.study && `School: ${c.study.school}`, c.study?.scholarshipUsd && `School funding: ${usd(c.study.scholarshipUsd)} a year`]),
    canContradict: () => false,
    entry: [
      "How did you hear about {school}?",
      "How did you find this school?",
      "Walk me through how you got this scholarship.",
      "Who helped you with your application?",
    ],
    followUpVague: ["Did an agent apply for you?", "Who did you talk to at the school?"],
    followUpContradiction: [],
    mustInclude: () => ["how they found the school, in their own words"],
  },
  {
    // "Catalysis? What's that?": officers check the applicant understands their own field.
    id: "f1.academic.explain",
    visaTypes: f1,
    category: "academic",
    critical: false,
    relevance: (c) => (c.study?.level === "phd" ? 0.8 : c.study?.level === "masters" ? 0.55 : 0.35),
    grounding: ["study.program", "study.level"],
    goal: "Check they genuinely understand what they'll study: ask them to explain it, or a term they use, in plain words.",
    onFile: (c) => compact([c.study && `Program: ${c.study.program} (${c.study.level})`]),
    canContradict: () => false,
    entry: [
      "Tell me about the research you'll be doing.",
      "What exactly is {program}?",
      "Explain your program to me like I'm not in your field.",
    ],
    followUpVague: ["What's that?", "Give me an example.", "What will your thesis be on?"],
    followUpContradiction: [],
    mustInclude: () => ["a plain, specific explanation of the field"],
  },
  {
    id: "f1.academic.program",
    visaTypes: f1,
    category: "academic",
    critical: false,
    relevance: () => 0.8,
    grounding: ["study.program", "study.level", "study.currentOccupation", "education.lastProgram"],
    goal: "Find out what they'll study and how it follows from what they've studied or worked at so far.",
    onFile: (c) =>
      compact([c.study && `Program: ${c.study.program}`, c.study?.currentOccupation && `Does now: ${c.study.currentOccupation}`, ...educationFacts(c).slice(0, 1)]),
    entry: [
      "What will you study?",
      "Why {program}?",
      "How does {program} connect to what you've done so far?",
      "You studied {lastProgram}. Why {program} now?",
    ],
    followUpVague: ["What will you actually learn in that program?", "Which courses are you looking forward to?"],
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
    goal: "Find out who pays, what they do, and whether they can really afford it alongside everyone else they support.",
    onFile: (c) => [...sponsorFacts(c), ...moneyFacts(c)],
    canContradict: (c) => c.funding.sponsors.length > 0,
    entry: ["Who is paying for your studies?", "How are you funding your first year?", "Who is sponsoring you?"],
    followUpVague: [
      "What does your {sponsor} do for a living?",
      "How much does your {sponsor} earn in a year?",
      "Who else is your {sponsor} paying for?",
      "What's the name of your {sponsor}'s business?",
    ],
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
    goal: "Find out exactly how they cover the part of the first-year cost their documented funds don't reach, and how year two gets paid.",
    onFile: (c) => [...moneyFacts(c), `Shortfall for year one: about ${usd(fundingGapUsd(c))}`],
    entry: [
      "Your I-20 says about ${i20} for the first year. Where is that money coming from?",
      "How will you cover the full first-year cost?",
      "Your bank statement doesn't reach the first-year cost. How do you close that?",
      "Where does the rest of the tuition money come from?",
    ],
    followUpVague: ["And the second year?", "Where exactly is that money right now?"],
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
    goal: "Find out what the scholarship is for, what it covers and doesn't, and whether it renews.",
    onFile: (c) => moneyFacts(c).slice(0, 2),
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
    id: "f1.funding.living",
    visaTypes: f1,
    category: "funding",
    critical: false,
    relevance: (c) => (c.study?.scholarshipUsd ? 0.6 : 0),
    grounding: ["study.scholarshipUsd", "funding.sponsors"],
    goal: "Find out who pays for rent, food and books that the scholarship doesn't cover, and roughly how much that is.",
    onFile: (c) => [...moneyFacts(c), ...sponsorFacts(c)],
    entry: [
      "Your scholarship covers part of it. Who pays for your rent and food?",
      "How will you pay your living costs?",
      "Where will you live, and who pays for it?",
    ],
    followUpVague: ["How much is rent there?", "How much will you need a month?"],
    followUpContradiction: ["That's not what your I-20 shows."],
    mustInclude: () => ["who pays living costs", "a rough monthly figure"],
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
    goal: "Find out where the recent large deposit really came from and why it arrived just before the application.",
    onFile: (c) => moneyFacts(c),
    entry: ["There's a large deposit in this account recently. Where did it come from?", "Why did this money go in just before your application?"],
    followUpVague: ["Why was it moved just before your application?", "Whose money is it?"],
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
    goal: "Find out what they intend to do after the program, and whether it honestly points back to Ghana.",
    // The post-study plan is coaching material, never on the officer's file.
    onFile: (c) => compact([c.study?.currentOccupation && `Does now: ${c.study.currentOccupation}`]),
    canContradict: () => false,
    entry: [
      "What will you do after you graduate?",
      "Where do you see yourself working after the program?",
      "What's your plan once you finish?",
    ],
    followUpVague: ["What kind of work, back home?", "Why does this degree help you there?", "Which companies in Ghana hire for that?"],
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
    relevance: (c) => (educationFacts(c).length ? 0.6 : 0.4),
    grounding: ["education.lastSchool", "education.lastProgram", "education.result"],
    goal: "Check their previous study and results, and that they're prepared for this program.",
    onFile: educationFacts,
    entry: [
      "What did you study before this?",
      "How did you do at {lastSchool}?",
      "What did you finish with at {lastSchool}?",
      "What was your final result?",
    ],
    followUpVague: ["What were your grades like?", "What class did you graduate with?"],
    followUpContradiction: ["That's not what your application shows."],
    mustInclude: () => ["previous study and results, stated simply"],
  },
  {
    id: "f1.academic.tests",
    visaTypes: f1,
    category: "academic",
    critical: false,
    relevance: (c) => (testFacts(c).length ? 0.6 : 0.3),
    grounding: ["education.tests"],
    goal: "Check their English and admission test scores.",
    onFile: testFacts,
    entry: ["Did you take any English or admission tests?", "What did you get on the {test}?", "What was your {test} score?"],
    followUpVague: ["What was the score exactly?", "When did you take it?"],
    followUpContradiction: ["That's not the score on your file."],
    mustInclude: (c) => (testFacts(c).length ? testFacts(c) : ["the tests taken and their scores"]),
  },
  {
    id: "f1.academic.applications",
    visaTypes: f1,
    category: "academic",
    critical: false,
    relevance: (c) => (c.study?.schoolsAppliedTo !== undefined || c.study?.admissionsReceived !== undefined ? 0.6 : 0.4),
    grounding: ["study.schoolsAppliedTo", "study.admissionsReceived"],
    goal: "Find out how many schools they applied to and which admitted them, and why they picked this one among them.",
    onFile: (c) =>
      compact([
        c.study?.schoolsAppliedTo && `Applied to ${c.study.schoolsAppliedTo} schools`,
        c.study?.admissionsReceived !== undefined && `Admitted by ${c.study.admissionsReceived}`,
      ]),
    entry: ["How many schools did you apply to?", "How many schools admitted you?", "Which other schools admitted you?"],
    followUpVague: ["Why did you pick {school} over them?"],
    followUpContradiction: ["That's not what you told me a minute ago."],
    mustInclude: () => ["how many applied to and admitted", "why this one"],
  },
  {
    id: "f1.purpose.gap",
    visaTypes: f1,
    category: "purpose",
    critical: false,
    relevance: (c) => (yearsSinceStudy(c) >= 2 ? 0.8 : 0),
    grounding: ["education.graduationYear", "study.currentOccupation"],
    goal: "Find out what they've done since their last studies and why they're going back to school now.",
    onFile: (c) => [...educationFacts(c), ...compact([c.study?.currentOccupation && `Does now: ${c.study.currentOccupation}`])],
    entry: [
      "You finished at {lastSchool} in {gradYear}. What have you been doing since?",
      "Why go back to school now?",
      "What have you done since you graduated?",
    ],
    followUpVague: ["Where exactly did you work?", "Why now and not earlier?"],
    followUpContradiction: ["That's not what your form says you've been doing."],
    mustInclude: () => ["what they've done since", "why now"],
  },
  {
    id: "f1.ties.job",
    visaTypes: f1,
    category: "ties",
    critical: false,
    relevance: (c) => (hasEmployer(c) ? 0.8 : 0),
    grounding: ["ties.employer", "ties.role", "ties.yearsEmployed"],
    goal: "Find out what they do at their job now and what happens to it while they study.",
    onFile: workFacts,
    entry: ["What do you do at {employer}?", "Are you leaving your job at {employer}?", "Will {employer} keep your job for you?"],
    followUpVague: ["Will they take you back?", "Do you have that in writing?"],
    followUpContradiction: ["Your form says you work somewhere else."],
    mustInclude: (c) => [c.ties.employer ?? "", c.ties.role ?? ""].filter(Boolean),
  },
  {
    id: "f1.ties.family",
    visaTypes: f1,
    category: "ties",
    critical: false,
    relevance: (c) => (c.family ? 0.5 : 0.35),
    grounding: ["family", "applicant.maritalStatus", "applicant.children"],
    goal: "Find out who they have in Ghana and what their family does.",
    onFile: familyFacts,
    canContradict: (c) => Boolean(c.family),
    entry: ["What do your parents do?", "Who do you have back home in Ghana?", "Do you have brothers and sisters?"],
    followUpVague: ["Where do they live?", "What does your father do exactly?"],
    followUpContradiction: ["That's not what your application says."],
    mustInclude: () => ["family in Ghana, stated plainly"],
  },
  {
    id: "f1.wildcard.ghana",
    visaTypes: f1,
    category: "wildcard",
    critical: false,
    relevance: () => 0.6,
    grounding: ["study.program"],
    goal: "Find out why they can't do this program in Ghana.",
    onFile: () => [],
    entry: ["Why not study {program} in Ghana?", "Can't you do this program at home?"],
    followUpVague: ["Be specific. What's missing locally?"],
    followUpContradiction: [],
    mustInclude: () => ["a specific gap in local options"],
  },
  {
    id: "f1.wildcard.us",
    visaTypes: f1,
    category: "wildcard",
    critical: false,
    relevance: () => 0.5,
    grounding: ["study.program"],
    goal: "Find out why the US rather than the UK, Canada or elsewhere.",
    onFile: () => [],
    entry: ["Why the US and not the UK or Canada?", "Why do you have to study in America?"],
    followUpVague: ["That's true of many countries. Why here?"],
    followUpContradiction: [],
    mustInclude: () => ["a specific reason tied to the program or school"],
  },
  {
    id: "f1.wildcard.work",
    visaTypes: f1,
    category: "wildcard",
    critical: false,
    relevance: () => 0.5,
    grounding: [],
    goal: "Find out whether they're counting on working in the US to pay their way.",
    onFile: () => [],
    entry: ["Do you plan to work while you study?", "Will you need a job there to support yourself?"],
    followUpVague: ["So how will you pay if your sponsor can't?"],
    followUpContradiction: [],
    mustInclude: () => ["funding doesn't depend on working in the US"],
  },
  {
    id: "f1.wildcard.job_offer",
    visaTypes: f1,
    category: "wildcard",
    critical: false,
    relevance: () => 0.4,
    grounding: [],
    goal: "Test how firm their intention to return is.",
    onFile: () => [],
    entry: ["What if a US company offers you a job when you finish?", "Wouldn't you rather stay and work there?"],
    followUpVague: ["Why would you turn it down?"],
    followUpContradiction: [],
    mustInclude: () => ["an honest reason to return"],
  },

  // ---------- B1/B2 ----------
  {
    id: "b.purpose.trip",
    visaTypes: b,
    category: "purpose",
    critical: true,
    relevance: () => 1,
    grounding: ["visit.purpose", "visit.event"],
    goal: "Find out exactly why they're going and what they'll do there.",
    onFile: visitFacts,
    entry: ["What is the purpose of your trip?", "Why are you going to the United States?", "What's taking you to the US?"],
    followUpVague: ["What exactly will you do there?", "What's the event, and when is it?"],
    followUpContradiction: ["Your form gives a different reason."],
    mustInclude: (c) => [c.visit?.purpose ?? "the purpose"],
  },
  {
    id: "b.purpose.duration",
    visaTypes: b,
    category: "purpose",
    critical: false,
    relevance: (c) => (c.visit ? (c.visit.durationDays > 30 ? 0.9 : 0.5) : 0),
    grounding: ["visit.durationDays", "visit.arrivalDate"],
    goal: "Find out how long they'll stay, why that long, and when exactly they come back.",
    onFile: (c) => compact([c.visit && `Length of stay: ${c.visit.durationDays} days`, c.visit?.arrivalDate && `Arriving: ${c.visit.arrivalDate}`]),
    entry: ["How long will you stay?", "{days} days is a long time. Why that long?", "When are you travelling, and when are you back?"],
    followUpVague: ["When is your return flight?", "What will you do for the rest of the time?"],
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
    goal: "Find out who they're visiting, what that person does and their status in the US.",
    onFile: (c) => [...visitFacts(c).filter((f) => f.startsWith("Visiting")), ...contactFacts(c)],
    entry: ["Who are you visiting?", "What does your {host} do in {hostCity}?", "How long has your {host} lived in the US?"],
    followUpVague: ["What is their immigration status?", "What do they do there?"],
    followUpContradiction: ["That's not who's listed on your form."],
    mustInclude: (c) => [c.visit?.hostRelationship ?? ""].filter(Boolean),
  },
  {
    id: "b.visit.stay",
    visaTypes: b,
    category: "purpose",
    critical: false,
    relevance: (c) => (c.visit?.stayingAt ? 0.6 : 0.4),
    grounding: ["visit.stayingAt", "visit.hostCity"],
    goal: "Find out where they'll stay.",
    onFile: (c) => compact([c.visit?.stayingAt && `Staying at: ${c.visit.stayingAt}`]),
    entry: ["Where will you stay?", "Where will you be staying in the US?", "What's the address where you'll stay?"],
    followUpVague: ["Which city?", "Who lives there?"],
    followUpContradiction: ["Your form gives a different address."],
    mustInclude: () => ["where they'll stay"],
  },
  {
    id: "b.funding.trip",
    visaTypes: b,
    category: "funding",
    critical: true,
    relevance: () => 1,
    grounding: ["funding.sponsors", "funding.liquidFundsUsd", "visit.tripCostUsd"],
    goal: "Find out who pays for the trip, roughly what it costs, and whether they can afford it.",
    onFile: (c) => [...sponsorFacts(c), ...moneyFacts(c)],
    canContradict: (c) => c.funding.sponsors.length > 0,
    entry: ["Who is paying for this trip?", "How are you funding the trip?", "How much will this trip cost you?"],
    followUpVague: ["How much will the trip cost?", "Where is that money now?"],
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
    goal: "Find out what they do for a living in Ghana, how established it is, and what makes them go back to it.",
    onFile: workFacts,
    entry: ["What do you do for a living?", "Where do you work?", "How long have you worked at {employer}?"],
    followUpVague: ["How much do you earn a month?", "What exactly is your role?"],
    followUpContradiction: ["That doesn't match the employer on your form."],
    mustInclude: (c) => [c.ties.employer ?? (c.ties.ownsBusiness ? "your business" : "your occupation")],
  },
  {
    id: "b.ties.income",
    visaTypes: b,
    category: "ties",
    critical: false,
    relevance: (c) => (hasEmployer(c) || c.ties.ownsBusiness ? 0.6 : 0),
    grounding: ["ties.monthlyIncomeGhs"],
    goal: "Find out how much they earn, and whether it fits the trip and their job.",
    onFile: (c) => compact([c.ties.monthlyIncomeGhs !== undefined && `Monthly income: ${ghs(c.ties.monthlyIncomeGhs)}`]),
    entry: ["How much do you earn a month?", "What's your monthly salary?", "How much does the business make in a month?"],
    followUpVague: ["Give me a number.", "Is that before or after tax?"],
    followUpContradiction: ["Your form shows a different income."],
    mustInclude: () => ["a monthly figure"],
  },
  {
    id: "b.ties.leave",
    visaTypes: b,
    category: "ties",
    critical: false,
    relevance: (c) => (hasEmployer(c) ? 0.5 : 0),
    grounding: ["ties.employer", "ties.leaveApproved"],
    goal: "Find out whether their employer knows about the trip and has approved leave.",
    onFile: (c) => compact([c.ties.employer && `Works at ${c.ties.employer}`, c.ties.leaveApproved && "Employer has approved leave for the trip"]),
    canContradict: (c) => Boolean(c.ties.leaveApproved),
    entry: ["Does {employer} know you're travelling?", "Who approved your leave?", "How much leave do you have?"],
    followUpVague: ["When do they expect you back?"],
    followUpContradiction: ["Your letter says your leave is approved. Is it?"],
    mustInclude: () => ["leave approved, and the return date"],
  },
  {
    id: "b.ties.business",
    visaTypes: b,
    category: "ties",
    critical: false,
    relevance: (c) => (c.ties.ownsBusiness ? 0.8 : 0),
    grounding: ["ties.businessName", "ties.businessYears"],
    goal: "Find out what their business does, how long it has run, and who runs it while they're away.",
    onFile: (c) => workFacts(c).filter((f) => f.startsWith("Owns a business")),
    entry: ["Tell me about your business.", "What does {business} do?", "How long have you run {business}?"],
    followUpVague: ["Who runs it while you're away?", "How many people work for you?"],
    followUpContradiction: ["Your business registration says otherwise."],
    mustInclude: () => ["what the business does", "who runs it while away"],
  },
  {
    id: "b.ties.family",
    visaTypes: b,
    category: "ties",
    critical: false,
    relevance: (c) => (c.applicant.maritalStatus === "married" || c.applicant.children > 0 ? 0.7 : 0),
    grounding: ["applicant.maritalStatus", "applicant.children", "family"],
    goal: "Find out who they're leaving behind in Ghana.",
    onFile: familyFacts,
    entry: ["Who are you leaving behind in Ghana?", "Is your family travelling with you?", "What does your {spouse} do?"],
    followUpVague: ["Who will look after your children?"],
    followUpContradiction: ["Your form says otherwise."],
    mustInclude: () => ["family remaining in Ghana"],
  },
  {
    id: "b.companions",
    visaTypes: b,
    category: "purpose",
    critical: false,
    relevance: (c) => (c.visit?.travellingWith ? 0.5 : 0.25),
    grounding: ["visit.travellingWith"],
    goal: "Find out who they're travelling with.",
    onFile: (c) => compact([c.visit?.travellingWith && `Travelling with: ${c.visit.travellingWith}`]),
    entry: ["Are you travelling alone?", "Who is going with you?"],
    followUpVague: ["Do they have visas?"],
    followUpContradiction: ["Your form says you're travelling with someone else."],
    mustInclude: () => ["who travels with them"],
  },
  {
    id: "b.wildcard.return",
    visaTypes: b,
    category: "wildcard",
    critical: false,
    relevance: () => 0.6,
    grounding: [],
    goal: "Test what really brings them back to Ghana.",
    onFile: () => [],
    entry: ["How do I know you'll come back?", "What brings you back to Ghana?"],
    followUpVague: ["That's not a reason. Give me one."],
    followUpContradiction: [],
    mustInclude: () => ["one concrete obligation in Ghana"],
  },
  {
    id: "b.wildcard.work",
    visaTypes: b,
    category: "wildcard",
    critical: false,
    relevance: () => 0.4,
    grounding: [],
    goal: "Check they don't intend to work in the US.",
    onFile: () => [],
    entry: ["Will you do any work while you're there?", "Are you going to look for work?"],
    followUpVague: ["Not even a little, to help out?"],
    followUpContradiction: [],
    mustInclude: () => ["no work in the US"],
  },

  // ---------- Both ----------
  {
    id: "common.us_contacts",
    visaTypes: both,
    category: "us_contacts",
    critical: false,
    relevance: (c) => (c.usContacts.length > 0 ? 0.8 : 0.2),
    grounding: ["usContacts"],
    goal: "Find out who they know in the US and those people's status, and whether it matches the form.",
    // The DS-160 asks about relatives in the US, so "none listed" is on file too.
    onFile: (c) => (c.usContacts.length ? contactFacts(c) : ["Relatives in the US on the form: none"]),
    entry: ["Do you have any family in the US?", "Do you know anyone in the United States?", "Who do you have in America?"],
    followUpVague: ["What is their status there?", "When did they go?"],
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
    goal: "Find out what has materially changed since the last refusal.",
    onFile: (c) => c.history.priorRefusals.map((r) => `Refused in ${r.year} under ${r.section === "214b" ? "214(b)" : r.section === "221g" ? "221(g)" : "another section"}`),
    entry: ["You were refused before. What has changed since then?", "Why were you refused last time?", "What's different this time?"],
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
    grounding: ["history.priorUsVisits", "history.usVisits"],
    goal: "Find out when they last went to the US, how long they stayed, and that they left on time.",
    onFile: usVisitFacts,
    // Only a listed stay can be contradicted; a bare count can't.
    canContradict: (c) => c.history.usVisits.some((v) => v.durationDays),
    entry: [
      "You've been to the US before. When was your last trip, and how long did you stay?",
      "Tell me about your last visit to the US.",
      "When did you last travel to the US?",
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
    goal: "Find out where else they've travelled and that they came back each time.",
    onFile: (c) => compact([c.history.otherCountriesVisited.length > 0 && `Countries visited: ${c.history.otherCountriesVisited.join(", ")}`]),
    entry: ["Have you travelled outside Ghana before?", "Where have you travelled?", "When did you last leave Ghana?"],
    followUpVague: ["When was that?", "How long were you there?"],
    followUpContradiction: ["Your passport shows different travel."],
    mustInclude: (c) => c.history.otherCountriesVisited.slice(0, 2),
  },
  {
    // Since Sept 2025 applicants interview in their country of nationality or
    // residence; a non-Ghanaian applying in Accra must show they really live in Ghana.
    id: "common.residence",
    visaTypes: both,
    category: "ties",
    critical: true,
    relevance: (c) => (isForeignResident(c) ? 1 : 0),
    grounding: ["applicant.nationality", "applicant.city"],
    goal: "Find out how long they've lived in Ghana, on what basis, and what keeps them here rather than in their home country.",
    onFile: (c) => compact([c.applicant.nationality && `Nationality: ${c.applicant.nationality}`, c.applicant.city && `Lives in: ${c.applicant.city}`]),
    entry: [
      "You're {nationality}. Why are you applying in Accra?",
      "How long have you lived in Ghana?",
      "What's your status in Ghana?",
    ],
    followUpVague: ["Do you have a residence permit?", "What do you do here?"],
    followUpContradiction: ["Your form says you live somewhere else."],
    mustInclude: () => ["how long and on what basis they live in Ghana"],
  },
  {
    id: "common.ties.property",
    visaTypes: both,
    category: "ties",
    critical: false,
    relevance: (c) => (c.ties.ownsProperty ? 0.6 : 0),
    grounding: ["ties.ownsProperty", "ties.propertyDetail"],
    goal: "Find out what property they own in Ghana and where.",
    onFile: (c) => workFacts(c).filter((f) => f.startsWith("Owns property")),
    entry: ["You own property. What is it?", "Where is your property?", "What do you own in Ghana?"],
    followUpVague: ["Whose name is it in?", "When did you buy it?"],
    followUpContradiction: ["That's not what your documents show."],
    mustInclude: () => ["what the property is and where"],
  },
];

function contactFacts(c: CaseProfile): string[] {
  const status: Record<string, string> = { citizen: "US citizen", green_card: "green card", visa_holder: "on a visa", unknown: "status unknown" };
  return c.usContacts.map((u) => `Relative in the US: ${u.relationship}${u.city ? ` in ${u.city}` : ""} (${status[u.status] ?? u.status})`);
}

export function probesFor(visaType: VisaType): Probe[] {
  return PROBES.filter((p) => p.visaTypes.includes(visaType));
}

export function getProbe(id: string): Probe {
  const probe = PROBES.find((p) => p.id === id);
  if (!probe) throw new Error(`Unknown probe: ${id}`);
  return probe;
}

/** Whether the officer's file holds enough to challenge an answer on this probe. */
export function canContradict(probe: Probe, c: CaseProfile): boolean {
  return probe.canContradict ? probe.canContradict(c) : probe.onFile(c).length > 0;
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
    sponsor: c.funding.sponsors.find((s) => s.relationship.toLowerCase() !== "self")?.relationship,
    lastSchool: c.education?.lastSchool,
    lastProgram: c.education?.lastProgram,
    gradYear: c.education?.graduationYear ? String(c.education.graduationYear) : undefined,
    test: c.education?.tests[0]?.name === "Other" ? undefined : c.education?.tests[0]?.name,
    business: c.ties.businessName,
    spouse: c.applicant.maritalStatus === "married" ? "spouse" : undefined,
    nationality: isForeignResident(c) ? c.applicant.nationality : undefined,
  };
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? `{${key}}`);
}

/** A template is usable only if every placeholder resolves from the profile. */
export function isFillable(template: string, c: CaseProfile): boolean {
  return !/\{\w+\}/.test(fillTemplate(template, c));
}
