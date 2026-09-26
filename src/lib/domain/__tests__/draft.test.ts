import { describe, expect, it } from "vitest";
import { fundingGapUsd } from "../case";
import { scanCase } from "../case-scan";
import { dedupeConflicts, mergeDraft, sameValue } from "../draft";
import { amaF1 } from "../fixtures";

describe("document disagreements", () => {
  it("ignores case, punctuation and fuller forms", () => {
    expect(sameValue("VINCENT KOFI", "Vincent Kofi")).toBe(true);
    expect(sameValue("HO", "Ho")).toBe(true);
    expect(sameValue("VINCENT KOFI", "Vincent")).toBe(true);
    expect(sameValue("COMPUTER AND INFORMATION SCIENCES", "Computer and Information Sciences, General")).toBe(true);
    expect(sameValue("12 JANUARY 2026", "Fall 2025")).toBe(false);
    expect(sameValue(73790, 73790)).toBe(true);
    expect(sameValue(73790, 52000)).toBe(false);
  });

  it("only reports real disagreements, once", () => {
    const { conflicts } = mergeDraft(
      { applicant: { firstName: "VINCENT KOFI", city: "HO" }, study: { startTerm: "12 JANUARY 2026" } },
      { applicant: { firstName: "Vincent", city: "Ho" }, study: { startTerm: "Fall 2025" } },
      "admission_letter",
    );
    expect(conflicts.map((c) => c.path)).toEqual(["study.startTerm"]);
    expect(dedupeConflicts([...conflicts, ...conflicts])).toHaveLength(1);
  });
});

describe("scholarships", () => {
  it("count towards the first-year cost", () => {
    const withScholarship = { ...amaF1, study: { ...amaF1.study!, i20Year1CostUsd: 73790, scholarshipUsd: 67674 }, funding: { ...amaF1.funding, liquidFundsUsd: 7000 } };
    expect(fundingGapUsd(withScholarship)).toBe(0);
    expect(scanCase(withScholarship).some((f) => f.id === "funding_gap")).toBe(false);
    const without = { ...withScholarship, study: { ...withScholarship.study, scholarshipUsd: undefined } };
    expect(fundingGapUsd(without)).toBe(66790);
  });
});
