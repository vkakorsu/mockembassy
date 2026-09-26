import { describe, expect, it } from "vitest";
import type { AnswerQuality, PastSession, SessionMode } from "../director";
import { amaF1 } from "../fixtures";
import { readiness, readinessTopics, type ReadinessTopic } from "../readiness";

const NOW = Date.parse("2026-09-26T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

let n = 0;
/** A past session; `daysAgo` and `minutesAgo` place it in time. Newest first in the arrays below. */
function session(opts: {
  results: [string, AnswerQuality][];
  officer?: string;
  sceptic?: number;
  mode?: SessionMode;
  daysAgo?: number;
  minutesAgo?: number;
  outcome?: string;
  grades?: [string, number][];
  inconsistency?: boolean;
}): PastSession {
  const name = opts.officer ?? `Officer ${n++}`;
  const at = NOW - (opts.daysAgo ?? 1) * DAY - (opts.minutesAgo ?? 0) * 60_000;
  return {
    officer: { name, voice: "v", traits: { pace: 0.5, warmth: 0.5, scepticism: opts.sceptic ?? 0.4, patience: 0.5, silence: 0.5 } },
    askedQuestions: [],
    probeResults: opts.results.map(([probeId, quality]) => ({ probeId, quality, officerName: name })),
    mode: opts.mode ?? "real",
    at: new Date(at).toISOString(),
    outcome: opts.outcome ?? null,
    grades: (opts.grades ?? []).map(([probeId, score]) => ({ probeId, score })),
    hadInconsistency: opts.inconsistency ?? false,
  };
}

const topics: ReadinessTopic[] = [
  { id: "a", critical: true, weight: 2 },
  { id: "b", critical: true, weight: 2 },
  { id: "c", critical: false, weight: 1 },
];
const r = (history: PastSession[]) => readiness(history, topics, NOW);
const topic = (history: PastSession[], id: string) => r(history).topics.find((t) => t.id === id)!;

describe("readiness", () => {
  it("starts at zero and moves after the first good answers", () => {
    expect(r([]).score).toBe(0);
    expect(r([]).level).toBe("not_started");
    const one = r([session({ results: [["a", "strong"], ["b", "adequate"]] })]);
    expect(one.score).toBeGreaterThan(0);
    expect(one.answeredWell).toBe(2);
    expect(one.level).toBe("building");
  });

  it("needs two officers, one of them tough, before a topic is solid", () => {
    const lenient = [session({ results: [["a", "strong"]], sceptic: 0.3 }), session({ results: [["a", "strong"]], sceptic: 0.3, daysAgo: 2 })];
    expect(topic(lenient, "a").status).toBe("improving");
    expect(topic(lenient, "a").mastery).toBeLessThanOrEqual(0.7);
    const withTough = [session({ results: [["a", "strong"]], sceptic: 0.8 }), session({ results: [["a", "strong"]], sceptic: 0.3, daysAgo: 2 })];
    expect(topic(withTough, "a").status).toBe("solid");
    expect(topic(withTough, "a").toughOfficer).toBe(true);
  });

  it("values a strong answer above an adequate one", () => {
    const strong = topic([session({ results: [["a", "strong"]] })], "a").mastery;
    const adequate = topic([session({ results: [["a", "adequate"]] })], "a").mastery;
    expect(strong).toBeGreaterThan(adequate);
  });

  it("drops a topic after a weak answer without erasing all earlier evidence", () => {
    const history = [
      session({ results: [["a", "weak"]] }),
      session({ results: [["a", "strong"]], sceptic: 0.8, daysAgo: 2 }),
      session({ results: [["a", "strong"]], daysAgo: 3 }),
    ];
    const t = topic(history, "a");
    expect(t.status).toBe("weak");
    expect(t.mastery).toBeGreaterThan(0);
    expect(t.mastery).toBeLessThanOrEqual(0.3);
  });

  it("counts crammed drills for less than spaced interviews", () => {
    const crammed = [
      session({ results: [["a", "strong"]], mode: "drill", sceptic: 0.8, daysAgo: 1, minutesAgo: 0 }),
      session({ results: [["a", "strong"]], mode: "drill", daysAgo: 1, minutesAgo: 5 }),
    ];
    const spaced = [
      session({ results: [["a", "strong"]], sceptic: 0.8, daysAgo: 1 }),
      session({ results: [["a", "strong"]], daysAgo: 4 }),
    ];
    expect(topic(crammed, "a").mastery).toBeLessThan(topic(spaced, "a").mastery);
  });

  it("fades evidence that's weeks old", () => {
    const recent = [session({ results: [["a", "strong"]], daysAgo: 1 })];
    const old = [session({ results: [["a", "strong"]], daysAgo: 60 })];
    expect(topic(old, "a").mastery).toBeLessThan(topic(recent, "a").mastery / 2);
  });

  it("uses the independent debrief grade alongside the officer's judgement", () => {
    const officerOnly = topic([session({ results: [["a", "strong"]] })], "a").mastery;
    const graderDisagrees = topic([session({ results: [["a", "strong"]], grades: [["a", 0.25]] })], "a").mastery;
    expect(graderDisagrees).toBeLessThan(officerOnly);
  });

  it("stays below 90% until a full interview is passed with a tough officer", () => {
    const solidEverywhere = (outcome?: string, sceptic = 0.8) => [
      session({ results: [["a", "strong"], ["b", "strong"], ["c", "strong"]], sceptic, outcome }),
      session({ results: [["a", "strong"], ["b", "strong"], ["c", "strong"]], daysAgo: 2 }),
      session({ results: [["a", "strong"], ["b", "strong"], ["c", "strong"]], daysAgo: 3 }),
      session({ results: [["a", "strong"], ["b", "strong"], ["c", "strong"]], daysAgo: 4 }),
    ];
    const noPass = r(solidEverywhere());
    expect(noPass.score).toBeLessThanOrEqual(0.9);
    expect(noPass.caps.map((c) => c.id)).toContain("no_full_pass");
    const lenientPass = r(solidEverywhere("approved", 0.3));
    expect(lenientPass.caps.map((c) => c.id)).toContain("no_full_pass");
    const passed = r(solidEverywhere("approved"));
    expect(passed.caps).toEqual([]);
    expect(passed.score).toBeGreaterThan(noPass.score);
  });

  it("holds the score down while a key topic is untested, or after contradicting the file", () => {
    const partial = r([session({ results: [["a", "strong"], ["c", "strong"]], sceptic: 0.8, outcome: "approved" })]);
    expect(partial.caps.map((c) => c.id)).toContain("key_topic_untested");
    const inconsistent = r([session({ results: [["a", "strong"]], inconsistency: true })]);
    expect(inconsistent.caps[0].id).toBe("inconsistency");
    expect(inconsistent.score).toBeLessThanOrEqual(0.6);
  });

  it("suggests weak key topics first", () => {
    const history = [session({ results: [["a", "weak"], ["c", "strong"]] })];
    expect(r(history).next[0]).toBe("a");
  });

  it("weights topics by how likely they are to come up, and leaves surprise questions out", () => {
    const t = readinessTopics(amaF1);
    expect(t.some((x) => x.id.includes("wildcard"))).toBe(false);
    const sponsor = t.find((x) => x.id === "f1.funding.sponsor")!;
    const explain = t.find((x) => x.id === "f1.academic.explain")!;
    expect(sponsor.weight).toBe(2);
    expect(explain.weight).toBeLessThan(1);
  });
});
