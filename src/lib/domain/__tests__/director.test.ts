import { describe, expect, it } from "vitest";
import { planSession, probeStatus, type PastSession, type SessionPlan } from "../director";
import { amaF1, kofiB1B2 } from "../fixtures";
import { traitDistance } from "../officer";
import { similarity } from "../similarity";

const base = { readiness: 0.3, mode: "real" as const, pastSessions: [] };

function toPast(plan: SessionPlan, quality: "strong" | "weak" = "strong"): PastSession {
  return {
    officer: plan.officer,
    askedQuestions: plan.probes.map((p) => p.entry),
    probeResults: plan.probes.map((p) => ({ probeId: p.probeId, quality, officerName: plan.officer.name })),
  };
}

describe("planSession", () => {
  it("is reproducible from its seed", () => {
    const a = planSession({ ...base, profile: amaF1, seed: "s1" });
    const b = planSession({ ...base, profile: amaF1, seed: "s1" });
    expect(a).toEqual(b);
  });

  it("produces varied sessions across seeds", () => {
    const plans = Array.from({ length: 30 }, (_, i) => planSession({ ...base, profile: amaF1, seed: `v${i}` }));
    const signatures = new Set(plans.map((p) => p.probes.map((x) => x.entry).join("|")));
    const officers = new Set(plans.map((p) => p.officer.name));
    expect(signatures.size).toBeGreaterThan(20);
    expect(officers.size).toBeGreaterThan(8);
  });

  it("always tests at least one critical probe and only probes from the case's visa type", () => {
    for (let i = 0; i < 50; i++) {
      const plan = planSession({ ...base, profile: kofiB1B2, seed: `c${i}` });
      expect(plan.probes.some((p) => p.critical)).toBe(true);
      expect(plan.probes.every((p) => !p.probeId.startsWith("f1."))).toBe(true);
    }
  });

  it("grounds questions in the user's own facts", () => {
    const plans = Array.from({ length: 40 }, (_, i) => planSession({ ...base, profile: amaF1, seed: `g${i}` }));
    const text = plans.flatMap((p) => p.probes.map((x) => x.entry)).join(" ");
    expect(text).toContain("University of Cincinnati");
    expect(text).not.toMatch(/\{\w+\}/);
  });

  it("always presses a prior refusal", () => {
    for (let i = 0; i < 30; i++) {
      const plan = planSession({ ...base, profile: kofiB1B2, seed: `r${i}` });
      expect(plan.probes.map((p) => p.probeId)).toContain("common.history.refusal");
    }
  });

  it("retests a weak answer with a new officer and new phrasing", () => {
    const first = planSession({ ...base, profile: amaF1, seed: "w1" });
    const weakProbe = first.probes.find((p) => p.critical)!;
    const past: PastSession = {
      ...toPast(first),
      probeResults: first.probes.map((p) => ({
        probeId: p.probeId,
        quality: p.probeId === weakProbe.probeId ? "weak" : "strong",
        officerName: first.officer.name,
      })),
    };
    for (let i = 0; i < 20; i++) {
      const next = planSession({ ...base, profile: amaF1, seed: `w2-${i}`, pastSessions: [past] });
      const retest = next.probes.find((p) => p.probeId === weakProbe.probeId);
      expect(retest?.reason).toBe("weak_retest");
      expect(next.officer.name).not.toBe(first.officer.name);
      expect(retest!.entry).not.toBe(weakProbe.entry);
      expect(similarity(retest!.entry, weakProbe.entry)).toBeLessThan(0.6);
    }
  });

  it("keeps a user's run of sessions fresh", () => {
    const history: PastSession[] = [];
    const novelty: number[] = [];
    for (let i = 0; i < 6; i++) {
      const plan = planSession({ ...base, profile: amaF1, seed: `run${i}`, pastSessions: history });
      if (history[0]) {
        const prev = history[0];
        expect(plan.probes.map((p) => p.entry)).not.toEqual(prev.askedQuestions);
        expect(plan.officer.name).not.toBe(prev.officer.name);
      }
      novelty.push(plan.noveltyRate);
      history.unshift(toPast(plan));
    }
    const avg = novelty.reduce((a, b) => a + b, 0) / novelty.length;
    expect(avg).toBeGreaterThan(0.5);
  });

  it("picks officers unlike the recent ones", () => {
    const first = planSession({ ...base, profile: amaF1, seed: "o1" });
    let total = 0;
    for (let i = 0; i < 20; i++) {
      const next = planSession({ ...base, profile: amaF1, seed: `o2-${i}`, pastSessions: [toPast(first)] });
      total += traitDistance(next.officer.traits, first.officer.traits);
    }
    expect(total / 20).toBeGreaterThan(0.2);
  });

  it("makes dress rehearsals fuller and tougher", () => {
    for (let i = 0; i < 20; i++) {
      const plan = planSession({ ...base, profile: amaF1, seed: `d${i}`, mode: "dress_rehearsal" });
      expect(plan.probes.filter((p) => p.reason !== "wildcard").length).toBeGreaterThanOrEqual(3);
      expect(plan.targetDurationSec).toBeGreaterThanOrEqual(120);
    }
  });

  it("puts expert-flagged probes into the plan", () => {
    const plan = planSession({ ...base, profile: amaF1, seed: "e1", expertFlaggedProbes: ["f1.ties.job"] });
    expect(plan.probes.find((p) => p.probeId === "f1.ties.job")?.reason).toBe("expert_flag");
  });
});

describe("probeStatus", () => {
  const officer = (name: string) => ({ name, voice: "Kore", traits: { pace: 0.5, warmth: 0.5, scepticism: 0.5, patience: 0.5, silence: 0.5 } });
  const session = (name: string, quality: "strong" | "weak", scepticism = 0.8): PastSession => {
    const o = officer(name);
    return {
      officer: { ...o, traits: { ...o.traits, scepticism } },
      askedQuestions: [],
      probeResults: [{ probeId: "p", quality, officerName: name }],
    };
  };

  it("needs two different officers, one of them tough, after the last weak answer to count as solid", () => {
    expect(probeStatus("p", [])).toBe("untested");
    expect(probeStatus("p", [session("A", "weak")])).toBe("weak");
    expect(probeStatus("p", [session("B", "strong"), session("A", "weak")])).toBe("improving");
    expect(probeStatus("p", [session("B", "strong"), session("B", "strong"), session("A", "weak")])).toBe("improving");
    expect(probeStatus("p", [session("C", "strong"), session("B", "strong"), session("A", "weak")])).toBe("solid");
    // Two lenient officers aren't enough.
    expect(probeStatus("p", [session("C", "strong", 0.3), session("B", "strong", 0.3), session("A", "weak")])).toBe("improving");
  });
});
