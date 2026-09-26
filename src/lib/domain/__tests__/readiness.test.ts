import { describe, expect, it } from "vitest";
import type { PastSession } from "../director";
import { amaF1 } from "../fixtures";
import { readiness, readinessTopics } from "../readiness";

const officer = { name: "x", voice: "v", traits: { pace: 0.5, warmth: 0.5, scepticism: 0.5, patience: 0.5, silence: 0.5 } };
const session = (name: string, results: [string, "strong" | "adequate" | "weak" | "contradiction"][]): PastSession => ({
  officer: { ...officer, name },
  askedQuestions: [],
  probeResults: results.map(([probeId, quality]) => ({ probeId, quality, officerName: name })),
});

describe("readiness", () => {
  const topics = [
    { id: "a", critical: true },
    { id: "b", critical: true },
    { id: "c", critical: false },
  ];

  it("moves after the first good answers (the reported bug: it stayed at 0)", () => {
    // Two sessions, newest first, like the one reported: one good answer each, one weak.
    const history = [session("Okafor", [["b", "adequate"], ["c", "weak"]]), session("Brennan", [["a", "weak"], ["a", "adequate"]])];
    const r = readiness(history, topics);
    expect(r.answeredWell).toBe(2);
    expect(r.confirmed).toBe(0);
    expect(r.score).toBeCloseTo((2 * 0.5 + 2 * 0.5) / 5);
  });

  it("gives full credit once a second officer agrees, and resets on a weak answer", () => {
    const confirmed = readiness([session("B", [["a", "strong"]]), session("A", [["a", "adequate"]])], topics);
    expect(confirmed.confirmed).toBe(1);
    expect(confirmed.score).toBeCloseTo(2 / 5);
    const reset = readiness([session("C", [["a", "weak"]]), session("B", [["a", "strong"]]), session("A", [["a", "strong"]])], topics);
    expect(reset.score).toBe(0);
  });

  it("leaves surprise questions out of the topics", () => {
    expect(readinessTopics(amaF1).some((t) => t.id.includes("wildcard"))).toBe(false);
    expect(readinessTopics(amaF1).length).toBeGreaterThan(2);
  });
});
