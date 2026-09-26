import { describe, expect, it } from "vitest";
import { planSession } from "../director";
import { amaF1 } from "../fixtures";
import { createRefereeState, decide, finalJudgements, recordTurn, shouldEnd, uncoveredCritical, type TurnEvaluation } from "../referee";

function stateWith(turns: Omit<TurnEvaluation, "durationSec">[], scepticism = 0.5) {
  const plan = planSession({ profile: amaF1, pastSessions: [], readiness: 0.3, mode: "real", seed: "ref" });
  plan.officer.traits.scepticism = scepticism;
  const critical = plan.probes.filter((p) => p.critical).map((p) => p.probeId);
  let s = createRefereeState(plan);
  turns.forEach((t, i) => {
    s = recordTurn(s, { ...t, probeId: t.probeId === "*" ? critical[i % critical.length] : t.probeId, durationSec: 12 });
  });
  return s;
}

describe("referee", () => {
  it("approves clear, consistent key answers", () => {
    expect(decide(stateWith([{ probeId: "*", quality: "strong" }, { probeId: "*", quality: "strong" }])).outcome).toBe("approved");
  });

  it("refuses on a contradiction in a key answer", () => {
    expect(decide(stateWith([{ probeId: "*", quality: "strong" }, { probeId: "*", quality: "contradiction" }])).outcome).toBe("refused_214b");
  });

  it("refuses when several key answers are weak", () => {
    expect(decide(stateWith([{ probeId: "*", quality: "weak" }, { probeId: "*", quality: "weak" }])).outcome).toBe("refused_214b");
  });

  it("issues a 221(g) when a requested document is missing", () => {
    const s = { ...stateWith([{ probeId: "*", quality: "strong" }]), documentRequested: true };
    expect(decide(s).outcome).toBe("administrative_221g");
  });

  it("a sceptical officer is harder on borderline answers", () => {
    const turns = [{ probeId: "*", quality: "adequate" as const }, { probeId: "*", quality: "adequate" as const }];
    expect(decide(stateWith(turns, 0)).outcome).toBe("approved");
    expect(decide(stateWith(turns, 1)).outcome).toBe("refused_214b");
  });

  it("downgrades long rambling answers", () => {
    const plan = planSession({ profile: amaF1, pastSessions: [], readiness: 0.3, mode: "real", seed: "ref" });
    const s = recordTurn(createRefereeState(plan), { probeId: plan.probes[0].probeId, quality: "strong", durationSec: 75 });
    expect(s.turns[0].quality).toBe("adequate");
  });

  it("ends at the time budget", () => {
    const s = stateWith([]);
    expect(shouldEnd(s, 0)).toBe(false);
    expect(shouldEnd(s, s.plan.targetDurationSec)).toBe(true);
  });

  it("an all-adequate interview doesn't satisfy a sceptical officer", () => {
    const turns = [{ probeId: "*", quality: "adequate" as const }, { probeId: "*", quality: "adequate" as const }];
    expect(decide(stateWith(turns, 0.75)).outcome).toBe("refused_214b");
  });

  it("knows which key topics were never covered", () => {
    const s = stateWith([]);
    const critical = s.plan.probes.filter((p) => p.critical).map((p) => p.probeId);
    expect(uncoveredCritical(s)).toEqual(critical);
    expect(uncoveredCritical(stateWith(critical.map(() => ({ probeId: "*", quality: "strong" as const }))))).toEqual([]);
  });

  it("judges each topic on the officer's final view, after follow-ups", () => {
    const s0 = stateWith([], 0.25);
    const probe = s0.plan.probes.find((p) => p.critical)!.probeId;
    let s = s0;
    for (const q of ["weak", "adequate"] as const) s = recordTurn(s, { probeId: probe, quality: q, durationSec: 10 });
    expect(finalJudgements(s).map((t) => t.quality)).toEqual(["adequate"]);
    // A contradiction isn't erased by a later answer.
    s = recordTurn(recordTurn(s0, { probeId: probe, quality: "contradiction", durationSec: 5 }), { probeId: probe, quality: "strong", durationSec: 5 });
    expect(decide(s).outcome).toBe("refused_214b");
  });
});

describe("early refusals", () => {
  it("ends after a key contradiction or two weak key answers, except in practice", () => {
    const plan = planSession({ profile: amaF1, pastSessions: [], readiness: 0.3, mode: "real", seed: "ref" });
    const critical = plan.probes.filter((p) => p.critical).map((p) => p.probeId);
    const base = createRefereeState(plan);
    expect(shouldEnd(recordTurn(base, { probeId: critical[0], quality: "contradiction", durationSec: 5 }), 10)).toBe(true);
    if (critical.length >= 2) {
      let s = base;
      for (const id of critical.slice(0, 2)) s = recordTurn(s, { probeId: id, quality: "weak", durationSec: 5 });
      expect(shouldEnd(s, 10)).toBe(true);
    }
    const practice = createRefereeState({ ...plan, mode: "practice" });
    expect(shouldEnd(recordTurn(practice, { probeId: critical[0], quality: "contradiction", durationSec: 5 }), 10)).toBe(false);
  });
});
