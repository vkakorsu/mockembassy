import { describe, expect, it } from "vitest";
import { planDrill, planSession } from "../director";
import { amaF1 } from "../fixtures";
import { buildOfficerInstruction } from "../officer-prompt";

const base = { profile: amaF1, pastSessions: [], readiness: 0.4, mode: "drill" as const };

describe("drills", () => {
  it("plans one question with a fresh officer and no opening", () => {
    const probe = planSession({ ...base, mode: "real", seed: "x" }).probes[0].probeId;
    const plan = planDrill({ ...base, seed: "d1" }, probe)!;
    expect(plan.mode).toBe("drill");
    expect(plan.probes.map((p) => p.probeId)).toEqual([probe]);
    const text = buildOfficerInstruction(plan, amaF1);
    expect(text).toContain("ONE-QUESTION DRILL");
    expect(text).not.toContain("Passport and I-20, please");
  });

  it("drills a note from the applicant's documents, and refuses unknown topics", () => {
    const notes = [{ id: "n1", sourceKind: "ds160", category: "travel" as const, text: "Visited the UK in 2023." }];
    expect(planDrill({ ...base, seed: "d2", notes }, "note:n1")?.probes[0].entry).toContain("Visited the UK");
    expect(planDrill({ ...base, seed: "d3" }, "note:missing")).toBeNull();
    expect(planDrill({ ...base, seed: "d4" }, "f1.nope")).toBeNull();
  });

});

describe("fingerprints at the window", () => {
  it("happen only in the dress rehearsal", () => {
    const rehearsal = planSession({ ...base, mode: "dress_rehearsal", seed: "fp" });
    expect(rehearsal.fingerprintsAtWindow).toBe(true);
    expect(buildOfficerInstruction(rehearsal, amaF1)).toContain("scan_fingerprints");
    for (const mode of ["real", "practice"] as const) {
      const plan = planSession({ ...base, mode, seed: "fp" });
      expect(plan.fingerprintsAtWindow).toBe(false);
      expect(buildOfficerInstruction(plan, amaF1)).not.toContain("scan_fingerprints and say");
    }
  });
});
