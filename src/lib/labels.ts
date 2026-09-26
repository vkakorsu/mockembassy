/**
 * Human words for internal values, so ids and enum keys never reach the
 * screen. One place, used by the app and admin alike.
 */
import { PACKS, type PackId } from "@/lib/domain/credits";
import { MODE_INFO } from "@/lib/modes";

export const TOPIC_LABELS: Record<string, string> = {
  "f1.purpose.school": "Why this school",
  "f1.academic.program": "Program of study",
  "f1.funding.sponsor": "Sponsor",
  "f1.funding.gap": "Covering the cost",
  "f1.funding.scholarship": "Scholarship",
  "f1.funding.deposit": "Recent large deposit",
  "f1.career.after": "Plans after graduation",
  "f1.academic.preparedness": "Academic preparation",
  "f1.ties.job": "Current job",
  "f1.wildcard.ghana": "Why not study in Ghana",
  "f1.wildcard.us": "Why the US",
  "f1.wildcard.work": "Working while studying",
  "f1.wildcard.job_offer": "A US job offer",
  "f1.funding.living": "Living costs",
  "f1.academic.tests": "Test scores",
  "f1.academic.applications": "Schools applied to",
  "f1.purpose.gap": "Time since your last studies",
  "f1.ties.family": "Family in Ghana",
  "b.purpose.trip": "Purpose of the trip",
  "b.purpose.duration": "Length of stay",
  "b.host": "Who you're visiting",
  "b.funding.trip": "Paying for the trip",
  "b.ties.work": "Work in Ghana",
  "b.ties.family": "Family in Ghana",
  "b.wildcard.return": "Reason to return",
  "b.wildcard.work": "Working in the US",
  "b.visit.stay": "Where you'll stay",
  "b.ties.income": "Your income",
  "b.ties.leave": "Leave from work",
  "b.ties.business": "Your business",
  "b.companions": "Who's travelling with you",
  "common.us_contacts": "Family in the US",
  "common.history.refusal": "Previous refusal",
  "common.history.us_visits": "Previous US visits",
  "common.history.travel": "Travel history",
  "common.ties.property": "Property in Ghana",
  "common.residence": "Living in Ghana",
  "f1.purpose.discovery": "How you found the school",
  "f1.academic.explain": "Explaining your field",
};

export function topicLabel(probeId: string): string {
  if (probeId.startsWith("note:")) return "A question from their documents";
  if (probeId.startsWith("case:")) return "A question about their case";
  if (probeId === "check:facts") return "Facts on your form";
  return TOPIC_LABELS[probeId] ?? probeId;
}

/** The grader's "testing" category (debrief), in words. */
export const TESTING_LABELS: Record<string, string> = {
  purpose: "Purpose",
  intent: "Intent to return",
  ties: "Ties to Ghana",
  funding: "Funding",
  sponsor: "Sponsor",
  academic: "Studies",
  career: "Plans after graduation",
  history: "Travel history",
  credibility: "Credibility",
  other: "General",
};

export function modeLabel(mode: string, isFree = false): string {
  if (isFree && mode !== "drill") return MODE_INFO.free.name;
  return (MODE_INFO as Record<string, { name: string }>)[mode]?.name ?? mode;
}

export const OUTCOME_LABELS: Record<string, string> = {
  approved: "Approved",
  refused_214b: "Refused, 214(b)",
  administrative_221g: "221(g)",
  incomplete: "No decision (left early)",
  refused_other: "Refused, other",
};
export const outcomeLabel = (o: string) => OUTCOME_LABELS[o] ?? o;

export function packLabel(plan: string): string {
  const legacy: Record<string, string> = { pass: "Interview Pass (old)", sprint: "Sprint (old)", family: "Family Pass (old)", coach: "Pass + Coach (old)", senior: "Pass + Senior (old)" };
  return PACKS[plan as PackId]?.name ?? legacy[plan] ?? plan;
}

export const DEBRIEF_STATUS_LABELS: Record<string, string> = {
  done: "Graded",
  failed: "Failed",
  pending: "Waiting",
  running: "Grading now",
};

/** "26 Sep 2026": day first, as in Ghana. */
export const formatDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export const formatDateTime = (d: string | Date) =>
  new Date(d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " GMT";

export const capitalize = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
