import { describe, expect, it } from "vitest";
import { NOTE_PROBE_PREFIX, planSession } from "../director";
import { amaF1 } from "../fixtures";
import { isDuplicateNote, matchDocumentKind, redactIdentifiers, toUsd, type CaseNote } from "../notes";
import { buildOfficerInstruction } from "../officer-prompt";

const notes: CaseNote[] = [
  { id: "n1", sourceKind: "bank_statement", category: "funding", text: "GH₵270,000 was deposited on 2 Sep 2026, three weeks before the interview." },
  { id: "n2", sourceKind: "ds160", category: "travel", text: "Visited the UK in 2023 for two weeks." },
];

describe("case notes", () => {
  it("redacts ID and account numbers but keeps amounts and dates", () => {
    const out = redactIdentifiers("Passport G1234567, Ghana Card GHA-123456789-0, acct 1441000123456, paid 12,500.00 on 2026-09-01; 4000 5000 12000");
    expect(out).not.toContain("G1234567");
    expect(out).not.toContain("123456789");
    expect(out).not.toContain("1441000123456");
    expect(out).toContain("••••3456");
    expect(out).toContain("12,500.00");
    expect(out).toContain("2026-09-01");
    expect(out).toContain("4000 5000 12000");
  });

  it("converts cedis to dollars and ignores unknown currencies", () => {
    expect(toUsd(115000, "GHS", 11.5)).toBe(10000);
    expect(toUsd(5000, "USD", 11.5)).toBe(5000);
    expect(toUsd(5000, "EUR", 11.5)).toBeUndefined();
  });

  it("matches what the officer asks for to a document in the folder", () => {
    const folder = ["bank_statement", "employment_letter"];
    expect(matchDocumentKind("your bank statements", folder)).toBe("bank_statement");
    expect(matchDocumentKind("a letter from your employer", folder)).toBe("employment_letter");
    expect(matchDocumentKind("property deed", folder)).toBeNull();
    expect(matchDocumentKind("your financial aid award", ["bank_statement", "scholarship_letter"])).toBe("scholarship_letter");
  });

  it("plans questions from the applicant's own notes across sessions", () => {
    const seeds = Array.from({ length: 20 }, (_, i) => `s${i}`);
    const plans = seeds.map((seed) =>
      planSession({ profile: amaF1, pastSessions: [], readiness: 0.4, mode: "real", seed, notes, folder: ["bank_statement", "ds160"] }),
    );
    const withNote = plans.filter((p) => p.probes.some((q) => q.probeId.startsWith(NOTE_PROBE_PREFIX)));
    expect(withNote.length).toBeGreaterThan(8);
    for (const p of plans) {
      expect(p.probes.length).toBeLessThanOrEqual(5);
      expect(p.probes[0].probeId.startsWith(NOTE_PROBE_PREFIX)).toBe(false);
    }
  });

  it("puts on-screen notes in the officer's file and keeps folder notes out", () => {
    const plan = planSession({ profile: amaF1, pastSessions: [], readiness: 0.4, mode: "practice", seed: "x", notes, folder: ["bank_statement"] });
    plan.probes = plan.probes.filter((p) => !p.probeId.startsWith(NOTE_PROBE_PREFIX));
    const text = buildOfficerInstruction(plan, amaF1);
    expect(text).toContain("Visited the UK in 2023");
    expect(text).not.toContain("GH₵270,000");
    expect(text).toContain("bank statement");
  });

  it("is unchanged for cases without notes", () => {
    const a = planSession({ profile: amaF1, pastSessions: [], readiness: 0.4, mode: "real", seed: "same" });
    const b = planSession({ profile: amaF1, pastSessions: [], readiness: 0.4, mode: "real", seed: "same", notes: [] });
    expect(b.probes).toEqual(a.probes);
  });

  it("recognises the same fact stated by two documents", () => {
    expect(
      isDuplicateNote(
        "The student received a $67,674 scholarship from Loyola University New Orleans toward the 9-month estimated cost of $73,790.",
        "The applicant was awarded an institutional merit-based Ignatian Scholarship of $67,674 annually.",
      ),
    ).toBe(true);
    expect(isDuplicateNote("Completed secondary school at Mawuli School in 2022.", "Belongs to four charitable organizations in Ghana.")).toBe(false);
    expect(isDuplicateNote("Program runs from 2025 to 2030.", "Visited the UK in 2025.")).toBe(false);
  });

  it("doesn't reveal a folder document's contents before it's handed over", () => {
    for (const seed of ["a", "b", "c", "d", "e", "f"]) {
      const plan = planSession({ profile: amaF1, pastSessions: [], readiness: 0.4, mode: "real", seed, notes: [notes[0]], folder: ["bank_statement"] });
      expect(buildOfficerInstruction(plan, amaF1)).not.toContain("GH₵270,000");
    }
  });
});
