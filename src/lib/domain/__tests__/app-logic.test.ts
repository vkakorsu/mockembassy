import { describe, expect, it } from "vitest";
import { deliveryMetrics } from "../delivery";
import { planSession } from "../director";
import { entitlement, type PassRow } from "../entitlement";
import { amaF1, kofiB1B2 } from "../fixtures";
import { buildOfficerInstruction, officerFile } from "../officer-prompt";
import { validateRewrite } from "../rewrite-validator";

describe("validateRewrite", () => {
  it("accepts a rewrite built only from confirmed facts", () => {
    const r = validateRewrite(
      "My father pays. He's a cocoa exporter earning about $60,000 a year, and $41,000 is already in the account.",
      amaF1,
    );
    expect(r).toEqual({ ok: true, unsupported: [] });
  });

  it("blocks invented numbers and people", () => {
    const r = validateRewrite("My uncle Kwame in Toronto will add $25,000.", amaF1);
    expect(r.ok).toBe(false);
    expect(r.unsupported).toEqual(expect.arrayContaining(["Kwame", "Toronto", "25000"]));
  });

  it("allows facts the user said themselves", () => {
    expect(validateRewrite("I work at Hubtel and my manager is Esi.", amaF1, "my manager Esi").ok).toBe(true);
  });

  it("accepts 41k style amounts", () => {
    expect(validateRewrite("About 41k is in the account.", amaF1).ok).toBe(true);
  });
});

describe("deliveryMetrics", () => {
  it("counts fillers and flags long answers", () => {
    const m = deliveryMetrics("Um, so, like, my father, uh, he pays, you know", 41);
    expect(m.fillers).toBe(4);
    expect(m.tooLong).toBe(true);
    expect(m.wordsPerMinute).toBeGreaterThan(0);
  });
});

describe("officer instruction", () => {
  const plan = planSession({ profile: kofiB1B2, pastSessions: [], readiness: 0.3, mode: "real", seed: "prompt" });
  const text = buildOfficerInstruction(plan, kofiB1B2);

  it("includes the plan's questions and the officer's name", () => {
    expect(text).toContain(plan.officer.name);
    for (const p of plan.probes) expect(text).toContain(p.entry);
  });

  it("shows the officer only what a real officer sees", () => {
    const file = officerFile(amaF1);
    expect(Object.keys(file)).not.toContain("version");
    expect(JSON.stringify(file)).not.toContain("Return to lead analytics");
    expect(text).not.toMatch(/readiness|weak_retest|pastSessions/i);
  });
});

describe("entitlement", () => {
  const d = (s: string) => new Date(`${s}T12:00:00Z`);
  const now = d("2026-10-10");
  const pass = (over: Partial<PassRow>): PassRow => ({
    plan: "pass",
    purchasedAt: d("2026-10-01"),
    interviewDate: d("2026-10-30"),
    hasAppointmentProof: false,
    dateMoves: 0,
    refunded: false,
    ...over,
  });
  const base = { fullSessionsToday: 0, fullSessionsSince: () => 0, freeSessionsUsed: 0, now };

  it("gives one free mock per case, then asks for a pass", () => {
    expect(entitlement({ ...base, passes: [] }).kind).toBe("free");
    expect(entitlement({ ...base, passes: [], freeSessionsUsed: 1 }).kind).toBe("none");
  });

  it("gives full mocks with an active pass, up to the daily cap", () => {
    expect(entitlement({ ...base, passes: [pass({})] }).kind).toBe("full");
    expect(entitlement({ ...base, passes: [pass({})], fullSessionsToday: 3 }).kind).toBe("none");
  });

  it("ignores refunded passes", () => {
    expect(entitlement({ ...base, passes: [pass({ refunded: true })], freeSessionsUsed: 1 }).kind).toBe("none");
  });

  it("limits a sprint to 3 mocks in 14 days", () => {
    const sprint = pass({ plan: "sprint" });
    expect(entitlement({ ...base, passes: [sprint], fullSessionsSince: () => 2 }).kind).toBe("full");
    expect(entitlement({ ...base, passes: [sprint], fullSessionsSince: () => 3, freeSessionsUsed: 1 }).kind).toBe("none");
    expect(entitlement({ ...base, passes: [sprint], now: d("2026-10-20"), freeSessionsUsed: 1 }).kind).toBe("none");
  });
});

import { mergeDraft } from "../draft";

describe("mergeDraft", () => {
  it("fills gaps and flags disagreements instead of overwriting", () => {
    const a = { study: { school: "UC", program: "MS Data Science" }, funding: { liquidFundsUsd: 41000 } };
    const b = { study: { school: "UC", startTerm: "Fall 2027" }, funding: { liquidFundsUsd: 39000 } };
    const { merged, conflicts } = mergeDraft(a, b, "bank_statement");
    expect(merged).toEqual({
      study: { school: "UC", program: "MS Data Science", startTerm: "Fall 2027" },
      funding: { liquidFundsUsd: 41000 },
    });
    expect(conflicts).toEqual([{ path: "funding.liquidFundsUsd", existing: 41000, incoming: 39000, source: "bank_statement" }]);
  });
});
