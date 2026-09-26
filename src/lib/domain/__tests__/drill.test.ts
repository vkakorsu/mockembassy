import { describe, expect, it } from "vitest";
import { planDrill, planSession } from "../director";
import { DAILY_DRILLS, drillEntitlement, FREE_DRILLS_PER_ACCOUNT } from "../entitlement";
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

  it("gives free drills, then unlimited-ish with a pass, without touching mocks", () => {
    const noPass = { kind: "none" as const, reason: "Get a pass to keep practising." };
    expect(drillEntitlement({ mock: noPass, drillsToday: 0, freeDrillsUsed: 0 }).kind).toBe("free");
    expect(drillEntitlement({ mock: noPass, drillsToday: 0, freeDrillsUsed: FREE_DRILLS_PER_ACCOUNT }).kind).toBe("none");
    const pass = { kind: "full" as const, reason: "Interview Pass active" };
    expect(drillEntitlement({ mock: pass, drillsToday: DAILY_DRILLS - 1, freeDrillsUsed: 9 }).kind).toBe("full");
    expect(drillEntitlement({ mock: pass, drillsToday: DAILY_DRILLS, freeDrillsUsed: 0 }).kind).toBe("none");
    const mockCapped = { kind: "none" as const, reason: "Daily limit reached (3 full mocks). Come back tomorrow." };
    expect(drillEntitlement({ mock: mockCapped, drillsToday: 0, freeDrillsUsed: 0 }).kind).toBe("full");
  });
});
