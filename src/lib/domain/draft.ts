import { z } from "zod";
import { PriorRefusal, Sponsor, UsContact, VisaType } from "./case";
import { ExtractedNote } from "./notes";

const Money = z.object({ amount: z.number(), currency: z.string().max(8) });

/**
 * What extraction may produce from one document: every field optional. The
 * draft is shown to the user to confirm; nothing here reaches the officer
 * until it's confirmed into a CaseProfile.
 */
export const ExtractedFacts = z.object({
  documentLooksLike: z.string().max(80).optional(),
  /** How well the scan or photo could be read. */
  legibility: z.enum(["clear", "partly_unreadable", "unreadable"]).optional(),
  /** What couldn't be read, in plain words ("the balance column on page 2 is blurred"). */
  unreadable: z.string().max(200).optional(),
  visaType: VisaType.optional(),
  applicant: z
    .object({
      firstName: z.string().max(60),
      age: z.number().int(),
      maritalStatus: z.enum(["single", "married", "divorced", "widowed"]),
      children: z.number().int(),
      city: z.string().max(80),
    })
    .partial()
    .optional(),
  study: z
    .object({
      school: z.string().max(160),
      program: z.string().max(160),
      level: z.enum(["undergraduate", "masters", "phd", "certificate"]),
      startTerm: z.string().max(40),
      i20Year1CostUsd: z.number(),
      currentOccupation: z.string().max(160),
    })
    .partial()
    .optional(),
  visit: z
    .object({
      purpose: z.string().max(200),
      durationDays: z.number().int(),
      hostRelationship: z.string().max(60),
      hostCity: z.string().max(80),
    })
    .partial()
    .optional(),
  funding: z
    .object({
      sponsors: z.array(Sponsor).max(5),
      liquidFundsUsd: z.number(),
      recentLargeDepositUsd: z.number(),
      /** As printed (e.g. GHS). Converted to USD on the server, for the user to confirm. */
      fundsAvailable: Money,
      recentLargeDeposit: Money.extend({ date: z.string().max(40).optional() }),
    })
    .partial()
    .optional(),
  ties: z
    .object({
      employer: z.string().max(160),
      role: z.string().max(120),
      yearsEmployed: z.number(),
      ownsBusiness: z.boolean(),
      ownsProperty: z.boolean(),
    })
    .partial()
    .optional(),
  history: z
    .object({
      priorUsVisits: z.number().int(),
      otherCountriesVisited: z.array(z.string().max(60)).max(40),
      priorRefusals: z.array(PriorRefusal).max(10),
    })
    .partial()
    .optional(),
  usContacts: z.array(UsContact).max(10).optional(),
  appointment: z.object({ date: z.string().max(40), post: z.string().max(60) }).partial().optional(),
  /** Facts specific to this applicant that the fields above can't hold. */
  notes: z.array(ExtractedNote).max(12).optional(),
});
export type ExtractedFacts = z.infer<typeof ExtractedFacts>;

export interface DraftConflict {
  path: string;
  existing: unknown;
  incoming: unknown;
  source: string;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

/** Fill gaps from a new document; record disagreements instead of overwriting. */
export function mergeDraft(existing: Obj, incoming: Obj, source: string, path = ""): { merged: Obj; conflicts: DraftConflict[] } {
  const merged: Obj = { ...existing };
  const conflicts: DraftConflict[] = [];
  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined || value === null || value === "" || key === "_conflicts") continue;
    const here = path ? `${path}.${key}` : key;
    const current = merged[key];
    if (current === undefined || current === null || current === "") merged[key] = value;
    else if (isObj(current) && isObj(value)) {
      const r = mergeDraft(current, value, source, here);
      merged[key] = r.merged;
      conflicts.push(...r.conflicts);
    } else if (Array.isArray(current) && Array.isArray(value)) {
      const seen = new Set(current.map((v) => JSON.stringify(v)));
      merged[key] = [...current, ...value.filter((v) => !seen.has(JSON.stringify(v)))];
    } else if (JSON.stringify(current) !== JSON.stringify(value)) {
      conflicts.push({ path: here, existing: current, incoming: value, source });
    }
  }
  return { merged, conflicts };
}
