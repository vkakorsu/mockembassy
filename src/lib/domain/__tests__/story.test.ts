import { describe, expect, it } from "vitest";
import { openStoryChanges, planSession, type PastSession } from "../director";
import { amaF1 } from "../fixtures";
import { readiness, readinessTopics } from "../readiness";
import { agreedClaims, sameClaim, storyChanges, type Claim } from "../story";

const claim = (key: Claim["key"], value: string, extra: Partial<Claim> = {}): Claim => ({ seq: 2, key, value, ...extra });
const NOW = Date.parse("2026-09-26T12:00:00Z");
const day = (d: number) => new Date(NOW - d * 86400000).toISOString();

function past(id: string, daysAgo: number, claims: Claim[]): PastSession {
  return {
    id,
    at: day(daysAgo),
    claims,
    mode: "real",
    officer: { name: `Officer ${id}`, voice: "v", traits: { pace: 0.5, warmth: 0.5, scepticism: 0.5, patience: 0.5, silence: 0.5 } },
    askedQuestions: [],
    probeResults: [],
  };
}

describe("same fact, same answer", () => {
  it("compares amounts with a margin and words loosely", () => {
    expect(sameClaim(claim("funds", "$41,000", { amount: 41000, currency: "USD" }), claim("funds", "about 40k", { amount: 40000, currency: "USD" }))).toBe(true);
    expect(sameClaim(claim("funds", "$41,000", { amount: 41000, currency: "USD" }), claim("funds", "$30,000", { amount: 30000, currency: "USD" }))).toBe(false);
    expect(sameClaim(claim("sponsor", "father"), claim("sponsor", "Father"))).toBe(true);
    expect(sameClaim(claim("sponsor", "father"), claim("sponsor", "uncle"))).toBe(false);
  });

  it("keeps only claims both grading runs heard", () => {
    const a = [claim("sponsor", "father"), claim("plan_after", "work at mtn")];
    const b = [claim("sponsor", "father")];
    expect(agreedClaims(a, b).map((c) => c.key)).toEqual(["sponsor"]);
    expect(agreedClaims(a, null)).toHaveLength(2);
  });
});

describe("a changing story", () => {
  it("flags a fact that changed, and settles it once two sessions agree", () => {
    const changes = storyChanges([
      { id: "s1", at: day(5), claims: [claim("sponsor", "father")] },
      { id: "s2", at: day(3), claims: [claim("sponsor", "uncle")] },
    ]);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ key: "sponsor", open: true, before: { value: "father" }, after: { value: "uncle", sessionId: "s2" } });
    const settled = storyChanges([
      { id: "s1", at: day(5), claims: [claim("sponsor", "father")] },
      { id: "s2", at: day(3), claims: [claim("sponsor", "uncle")] },
      { id: "s3", at: day(1), claims: [claim("sponsor", "uncle")] },
    ]);
    expect(settled.every((c) => !c.open)).toBe(true);
  });

  it("holds readiness down and makes the next officer test that topic", () => {
    const history = [past("s2", 1, [claim("sponsor", "uncle")]), past("s1", 3, [claim("sponsor", "father")])];
    expect(openStoryChanges(history)).toHaveLength(1);
    const r = readiness(history, readinessTopics(amaF1), NOW);
    expect(r.caps.map((c) => c.id)).toContain("story_changed");
    const tested = Array.from({ length: 20 }, (_, i) =>
      planSession({ profile: amaF1, pastSessions: history, readiness: 0.3, mode: "real", seed: `st${i}` }),
    ).filter((p) => p.probes.some((x) => x.probeId === "f1.funding.sponsor")).length;
    expect(tested).toBeGreaterThanOrEqual(18);
  });
});
