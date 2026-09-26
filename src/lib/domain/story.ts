import { z } from "zod";
import type { VisaType } from "./case";
import { sameValue } from "./draft";

/**
 * The applicant's story across sessions. After each session the debrief
 * grader lists the facts the applicant stated ("my uncle pays", "$41,000",
 * "I'll work at MTN"). If a fact changes between sessions (the sponsor was
 * "father" on Tuesday and "uncle" on Thursday) that's flagged: at the real
 * window, a story that shifts is one of the fastest routes to a refusal.
 */

export const CLAIM_KEYS = [
  "sponsor",
  "sponsor_job",
  "sponsor_income",
  "funds",
  "cost",
  "scholarship",
  "living_costs",
  "school",
  "program",
  "plan_after",
  "trip_purpose",
  "trip_length",
  "host",
  "employer",
  "job",
  "monthly_income",
  "marital_status",
  "children",
  "us_relatives",
  "travel_before",
  "refused_before",
] as const;
export type ClaimKey = (typeof CLAIM_KEYS)[number];

export const Claim = z.object({
  seq: z.number().int(),
  key: z.enum(CLAIM_KEYS),
  /** Short canonical form: "uncle", "cocoa exporter", "MS Data Science", "return to Accra to work in fintech". */
  value: z.string().min(1).max(100),
  /** For money: the number as stated, with its currency. */
  amount: z.number().nonnegative().optional(),
  currency: z.enum(["USD", "GHS"]).optional(),
});
export type Claim = z.infer<typeof Claim>;

export const CLAIM_LABELS: Record<ClaimKey, string> = {
  sponsor: "who pays",
  sponsor_job: "what your sponsor does",
  sponsor_income: "your sponsor's income",
  funds: "the money available",
  cost: "what it costs",
  scholarship: "your scholarship",
  living_costs: "who pays living costs",
  school: "your school",
  program: "your program",
  plan_after: "your plan afterwards",
  trip_purpose: "why you're travelling",
  trip_length: "how long you'll stay",
  host: "who you're visiting",
  employer: "where you work",
  job: "what you do",
  monthly_income: "what you earn",
  marital_status: "your marital status",
  children: "your children",
  us_relatives: "your relatives in the US",
  travel_before: "your travel history",
  refused_before: "your previous refusals",
};

/** The topic to drill when a fact wobbles. */
export function claimProbe(key: ClaimKey, visaType: VisaType): string | null {
  const f1: Partial<Record<ClaimKey, string>> = {
    sponsor: "f1.funding.sponsor",
    sponsor_job: "f1.funding.sponsor",
    sponsor_income: "f1.funding.sponsor",
    funds: "f1.funding.gap",
    cost: "f1.funding.gap",
    scholarship: "f1.funding.scholarship",
    living_costs: "f1.funding.living",
    school: "f1.purpose.school",
    program: "f1.academic.program",
    plan_after: "f1.career.after",
    employer: "f1.ties.job",
    job: "f1.ties.job",
  };
  const b: Partial<Record<ClaimKey, string>> = {
    sponsor: "b.funding.trip",
    funds: "b.funding.trip",
    cost: "b.funding.trip",
    trip_purpose: "b.purpose.trip",
    trip_length: "b.purpose.duration",
    host: "b.host",
    employer: "b.ties.work",
    job: "b.ties.work",
    monthly_income: "b.ties.income",
  };
  const common: Partial<Record<ClaimKey, string>> = {
    us_relatives: "common.us_contacts",
    travel_before: "common.history.travel",
    refused_before: "common.history.refusal",
  };
  return (visaType === "F1" ? f1 : b)[key] ?? common[key] ?? null;
}

/** Whether two statements of one fact agree: amounts within 12% in the same currency, or the same words. */
export function sameClaim(a: Claim, b: Claim): boolean {
  if (a.amount !== undefined && b.amount !== undefined && (a.currency ?? "USD") === (b.currency ?? "USD")) {
    const hi = Math.max(a.amount, b.amount);
    return hi === 0 || Math.abs(a.amount - b.amount) / hi <= 0.12;
  }
  return sameValue(a.value, b.value);
}

/**
 * The grader runs twice; keep a claim only when both runs heard it (same key,
 * agreeing value), so one run's misreading doesn't become a "changed story".
 */
export function agreedClaims(a: readonly Claim[], b: readonly Claim[] | null): Claim[] {
  if (!b) return [...a];
  return a.filter((x) => b.some((y) => y.key === x.key && sameClaim(x, y)));
}

export interface StoryPoint {
  sessionId: string;
  at: string;
  value: string;
}

export interface StoryChange {
  key: ClaimKey;
  before: StoryPoint;
  after: StoryPoint;
  /** The latest session still says something different from the one before: unresolved. */
  open: boolean;
}

/** Sessions oldest first, each with its agreed claims. One value per key per session (the last said). */
export function storyChanges(
  sessions: readonly { id: string; at: string; claims: readonly Claim[] }[],
): StoryChange[] {
  const changes: StoryChange[] = [];
  const last = new Map<ClaimKey, { claim: Claim; point: StoryPoint }>();
  for (const s of sessions) {
    const perKey = new Map<ClaimKey, Claim>();
    for (const c of s.claims) perKey.set(c.key, c);
    for (const [key, claim] of perKey) {
      const point = { sessionId: s.id, at: s.at, value: claim.value };
      const prev = last.get(key);
      if (prev) {
        const differs = !sameClaim(prev.claim, claim);
        // Any earlier open change on this key is settled once two sessions in a row agree.
        for (const ch of changes) if (ch.key === key) ch.open = false;
        if (differs) changes.push({ key, before: prev.point, after: point, open: true });
      }
      last.set(key, { claim, point });
    }
  }
  return changes;
}
