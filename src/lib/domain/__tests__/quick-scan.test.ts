import { describe, expect, it } from "vitest";
import { scanCase } from "../case-scan";
import { likelyQuestions, whatToBring } from "../checklist";
import { amaF1, kofiB1B2 } from "../fixtures";
import { QuickScanInput, quickScanProfile } from "../quick-scan";

describe("free Case Scan", () => {
  it("builds a profile from a few answers, converting cedis", () => {
    const input = QuickScanInput.parse({
      visaType: "F1",
      age: "21",
      i20Year1CostUsd: "73790",
      scholarshipUsd: "67674",
      sponsorRelationship: "uncle",
      funds: "80000",
      fundsCurrency: "GHS",
    });
    const { profile, draft } = quickScanProfile(input);
    expect(profile.funding.liquidFundsUsd).toBe(6957);
    expect(draft.applicant?.firstName).toBeUndefined();
    const flags = scanCase(profile).map((f) => f.id);
    expect(flags).not.toContain("funding_gap"); // scholarship + funds cover it
    expect(flags).toContain("unclear_sponsor"); // no occupation given
  });

  it("flags a gap, a refusal and weak ties for a B1/B2 visitor", () => {
    const { profile } = quickScanProfile(
      QuickScanInput.parse({ visaType: "B1B2", age: "30", purpose: "visit my sister", durationDays: "90", priorRefusalYear: "2024" }),
    );
    const flags = scanCase(profile).map((f) => f.id);
    expect(flags).toEqual(expect.arrayContaining(["prior_refusal", "weak_ties", "long_visit"]));
  });
});

describe("what to bring", () => {
  it("lists required items first and tailors to the case", () => {
    const f1 = whatToBring(amaF1);
    expect(f1[0].group).toBe("Required");
    expect(f1.map((i) => i.id)).toEqual(expect.arrayContaining(["passport", "ds160", "i20", "sevis", "bank"]));
    const b = whatToBring(kofiB1B2).map((i) => i.id);
    expect(b).not.toContain("i20");
    expect(b).toContain("itinerary");
  });

  it("asks how a non-parent sponsor is related", () => {
    const withUncle = { ...amaF1, funding: { ...amaF1.funding, sponsors: [{ relationship: "uncle", occupation: "pharmacist" }] } };
    expect(whatToBring(withUncle).map((i) => i.id)).toContain("relationship");
  });

  it("gives key questions first", () => {
    const qs = likelyQuestions(amaF1);
    expect(qs.length).toBeGreaterThan(2);
    expect(qs[0].key).toBe(true);
    expect(qs.every((q) => !q.question.includes("{"))).toBe(true);
  });
});

describe("B1/B2 checklists", () => {
  it("fit the visitor, not a student", () => {
    const retiree = { ...kofiB1B2, ties: { ...kofiB1B2.ties, employer: undefined, ownsBusiness: false }, visit: { ...kofiB1B2.visit!, purpose: "visit my daughter" } };
    const ids = whatToBring(retiree).map((i) => i.id);
    expect(ids).toEqual(expect.arrayContaining(["passport", "ds160", "income"]));
    expect(ids).not.toEqual(expect.arrayContaining(["i20"]));
    expect(ids).not.toContain("sevis");
    const trip = { ...kofiB1B2, visit: { ...kofiB1B2.visit!, purpose: "Attend a medical conference" } };
    expect(whatToBring(trip).map((i) => i.id)).toContain("business_trip");
  });

  it("gives visitor questions", () => {
    const qs = likelyQuestions(kofiB1B2).map((q) => q.id);
    expect(qs.every((id) => !id.startsWith("f1."))).toBe(true);
    expect(qs).toContain("b.purpose.trip");
  });
});

describe("checklist ids", () => {
  it("are all accepted by the server when ticked", async () => {
    const { CHECKLIST_ID } = await import("../checklist");
    const f1 = { ...amaF1, funding: { ...amaF1.funding, sponsors: [{ relationship: "uncle" }], recentLargeDepositUsd: 9000 } };
    const ids = [...whatToBring(f1), ...whatToBring({ ...kofiB1B2, visit: { ...kofiB1B2.visit!, purpose: "business meeting" } })].map((i) => i.id);
    for (const id of ids) expect(id).toMatch(CHECKLIST_ID);
  });
});
