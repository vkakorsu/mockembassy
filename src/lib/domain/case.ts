import { z } from "zod";

/**
 * The confirmed Case Profile: the single source of truth that the Director,
 * the Officer and every coaching rewrite may use. Fields are only ever
 * filled from user-confirmed extraction, never from raw document text.
 */

export const VisaType = z.enum(["F1", "B1B2"]);
export type VisaType = z.infer<typeof VisaType>;

const Usd = z.number().nonnegative();

export const Sponsor = z.object({
  relationship: z.string().min(1).max(60),
  occupation: z.string().max(120).optional(),
  annualIncomeUsd: Usd.optional(),
});

export const UsContact = z.object({
  relationship: z.string().min(1).max(60),
  city: z.string().max(80).optional(),
  status: z.enum(["citizen", "green_card", "visa_holder", "unknown"]).default("unknown"),
});

export const PriorRefusal = z.object({
  year: z.number().int().min(1990).max(2100),
  section: z.enum(["214b", "221g", "other"]),
});

export const CaseProfile = z.object({
  version: z.number().int().positive(),
  visaType: VisaType,
  applicant: z.object({
    firstName: z.string().min(1).max(60),
    age: z.number().int().min(10).max(110),
    maritalStatus: z.enum(["single", "married", "divorced", "widowed"]),
    children: z.number().int().min(0).max(20).default(0),
    city: z.string().max(80),
  }),
  study: z
    .object({
      school: z.string().min(1).max(160),
      program: z.string().min(1).max(160),
      level: z.enum(["undergraduate", "masters", "phd", "certificate"]),
      startTerm: z.string().max(40),
      i20Year1CostUsd: Usd,
      /** Scholarship or other school funding per year (the I-20's "funds from this school"). */
      scholarshipUsd: Usd.optional(),
      currentOccupation: z.string().max(160).optional(),
      postStudyPlan: z.string().max(400).optional(),
    })
    .optional(),
  visit: z
    .object({
      purpose: z.string().min(1).max(200),
      durationDays: z.number().int().positive().max(365),
      hostRelationship: z.string().max(60).optional(),
      hostCity: z.string().max(80).optional(),
    })
    .optional(),
  funding: z.object({
    sponsors: z.array(Sponsor).max(5),
    liquidFundsUsd: Usd,
    recentLargeDepositUsd: Usd.optional(),
  }),
  ties: z.object({
    employer: z.string().max(160).optional(),
    role: z.string().max(120).optional(),
    yearsEmployed: z.number().min(0).max(60).optional(),
    ownsBusiness: z.boolean().default(false),
    ownsProperty: z.boolean().default(false),
  }),
  history: z.object({
    priorUsVisits: z.number().int().min(0).default(0),
    otherCountriesVisited: z.array(z.string().max(60)).max(40).default([]),
    priorRefusals: z.array(PriorRefusal).max(10).default([]),
  }),
  usContacts: z.array(UsContact).max(10).default([]),
});

export type CaseProfile = z.infer<typeof CaseProfile>;

/** What the applicant still has to show for year one after school funding. 0 when covered. */
export function fundingGapUsd(c: CaseProfile): number {
  if (!c.study) return 0;
  return Math.max(0, c.study.i20Year1CostUsd - (c.study.scholarshipUsd ?? 0) - c.funding.liquidFundsUsd);
}
