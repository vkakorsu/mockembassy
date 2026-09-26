import { describe, expect, it } from "vitest";
import { creditBalance, creditExpiry, PACKS, type Grant } from "../credits";
import { drillEntitlement } from "../entitlement";

const d = (s: string) => new Date(`${s}T12:00:00Z`);
const grant = (on: string, pack: keyof typeof PACKS, over: Partial<Grant> = {}): Grant => ({
  purchasedAt: d(on),
  expiresAt: creditExpiry(d(on)),
  interviews: PACKS[pack].interviews,
  drills: PACKS[pack].drills,
  refunded: false,
  ...over,
});

describe("credits", () => {
  it("counts down as paid sessions start", () => {
    const b = creditBalance([grant("2026-09-01", "full")], [
      { at: d("2026-09-02"), kind: "interview" },
      { at: d("2026-09-03"), kind: "drill" },
      { at: d("2026-09-03"), kind: "drill" },
    ], d("2026-09-10"));
    expect(b).toMatchObject({ interviews: 9, drills: 58 });
  });

  it("uses the credits that expire first, and drops expired ones", () => {
    const grants = [grant("2026-01-01", "prep"), grant("2026-06-01", "topup")];
    const uses = Array.from({ length: 4 }, (_, i) => ({ at: d(`2026-06-0${i + 2}`), kind: "interview" as const }));
    // All four came out of the older Prep pack; the Top-up is untouched.
    expect(creditBalance(grants, uses, d("2026-06-10")).interviews).toBe(3);
    // Unused Prep credits vanish after 6 months; Top-up ones remain.
    expect(creditBalance(grants, [], d("2026-07-10"))).toMatchObject({ interviews: 3, drills: 15 });
  });

  it("ignores refunded packs and has no date to game", () => {
    expect(creditBalance([grant("2026-09-01", "full", { refunded: true })], [], d("2026-09-02")).interviews).toBe(0);
  });

  it("falls back to free drills when paid ones run out", () => {
    const none = { interviews: 0, drills: 0, expiresAt: null };
    expect(drillEntitlement({ credits: none, freeDrillsUsed: 0 }).kind).toBe("free");
    expect(drillEntitlement({ credits: none, freeDrillsUsed: 3 }).kind).toBe("none");
    expect(drillEntitlement({ credits: { ...none, drills: 1 }, freeDrillsUsed: 3 }).reason).toBe("1 drill left");
  });
});
