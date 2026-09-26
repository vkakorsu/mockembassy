import { z } from "zod";
import { CaseProfile } from "./case";
import type { ExtractedFacts } from "./draft";
import { toUsd } from "./notes";

/**
 * The free Case Scan: a handful of answers, no documents, no AI. The same
 * deterministic rules as a full case (case-scan.ts, checklist.ts), so it costs
 * nothing to run and can't be abused. Answers carry into a real case after
 * signup as a draft the user still confirms.
 */

/** Fallback cedis per dollar when the page doesn't pass the server's rate; the user confirms figures later. */
export const SCAN_GHS_PER_USD = 11.5;

const num = z.coerce.number().nonnegative().optional();
const text = (max: number) => z.string().trim().max(max).optional().transform((v) => v || undefined);

export const QuickScanInput = z.object({
  visaType: z.enum(["F1", "B1B2"]),
  age: z.coerce.number().int().min(10).max(110),
  maritalStatus: z.enum(["single", "married", "divorced", "widowed"]).default("single"),
  children: z.coerce.number().int().min(0).max(20).default(0),
  // F-1
  school: text(160),
  i20Year1CostUsd: num,
  scholarshipUsd: num,
  // B1/B2
  purpose: text(200),
  durationDays: z.coerce.number().int().positive().max(365).optional(),
  hostRelationship: text(60),
  // Money
  sponsorRelationship: text(60),
  sponsorOccupation: text(120),
  funds: num,
  fundsCurrency: z.enum(["GHS", "USD"]).default("GHS"),
  recentLargeDeposit: num,
  // Ties and history
  employer: text(160),
  yearsEmployed: num,
  ownsBusiness: z.coerce.boolean().default(false),
  ownsProperty: z.coerce.boolean().default(false),
  priorRefusalYear: z.coerce.number().int().min(1990).max(2100).optional(),
  usRelative: text(60),
  countriesVisited: text(400),
});
export type QuickScanInput = z.infer<typeof QuickScanInput>;

export function quickScanProfile(
  i: QuickScanInput,
  ghsPerUsd = SCAN_GHS_PER_USD,
): { profile: CaseProfile; draft: ExtractedFacts } {
  const rate = ghsPerUsd > 0 && Number.isFinite(ghsPerUsd) ? ghsPerUsd : SCAN_GHS_PER_USD;
  const usd = (n: number | undefined) => (n === undefined ? undefined : toUsd(n, i.fundsCurrency, rate));
  const sponsor = i.sponsorRelationship ? { relationship: i.sponsorRelationship, occupation: i.sponsorOccupation } : undefined;
  const countries = (i.countriesVisited ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 40);

  // Only what the person actually said: this becomes their draft after signup.
  const draft: ExtractedFacts = {
    visaType: i.visaType,
    applicant: { age: i.age, maritalStatus: i.maritalStatus, children: i.children },
    ...(i.visaType === "F1"
      ? { study: { school: i.school, i20Year1CostUsd: i.i20Year1CostUsd, scholarshipUsd: i.scholarshipUsd } }
      : { visit: { purpose: i.purpose, durationDays: i.durationDays, hostRelationship: i.hostRelationship } }),
    funding: {
      sponsors: sponsor ? [sponsor] : [],
      liquidFundsUsd: usd(i.funds),
      recentLargeDepositUsd: usd(i.recentLargeDeposit),
    },
    ties: { employer: i.employer, yearsEmployed: i.yearsEmployed, ownsBusiness: i.ownsBusiness, ownsProperty: i.ownsProperty },
    history: {
      otherCountriesVisited: countries,
      priorRefusals: i.priorRefusalYear ? [{ year: i.priorRefusalYear, section: "214b" }] : [],
    },
    usContacts: i.usRelative ? [{ relationship: i.usRelative, status: "unknown" }] : [],
  };

  // Placeholders fill what the rules need but the person didn't say.
  const profile = CaseProfile.parse({
    version: 1,
    visaType: i.visaType,
    applicant: { firstName: "You", age: i.age, maritalStatus: i.maritalStatus, children: i.children, city: "" },
    study:
      i.visaType === "F1"
        ? {
            school: i.school ?? "your school",
            program: "your program",
            level: "undergraduate",
            startTerm: "",
            i20Year1CostUsd: i.i20Year1CostUsd ?? 0,
            scholarshipUsd: i.scholarshipUsd,
          }
        : undefined,
    visit:
      i.visaType === "B1B2" ? { purpose: i.purpose ?? "a visit", durationDays: i.durationDays ?? 14, hostRelationship: i.hostRelationship } : undefined,
    funding: { sponsors: sponsor ? [sponsor] : [], liquidFundsUsd: usd(i.funds) ?? 0, recentLargeDepositUsd: usd(i.recentLargeDeposit) },
    ties: { employer: i.employer, yearsEmployed: i.yearsEmployed, ownsBusiness: i.ownsBusiness, ownsProperty: i.ownsProperty },
    history: { priorUsVisits: 0, otherCountriesVisited: countries, priorRefusals: draft.history!.priorRefusals },
    usContacts: draft.usContacts,
  });
  return { profile, draft };
}
