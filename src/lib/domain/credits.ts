/**
 * Pricing by what you use (docs/PRICING.md). A pack grants interview and
 * drill credits, usable for 6 months. No interview date is involved, so
 * there's nothing to lie about: the worst case is using every credit, and
 * that's priced in.
 */

export type PackId = "prep" | "full" | "topup";

export const PACKS: Record<PackId, { name: string; priceGhs: number; interviews: number; drills: number }> = {
  prep: { name: "Prep", priceGhs: 149, interviews: 4, drills: 20 },
  full: { name: "Full Prep", priceGhs: 299, interviews: 10, drills: 60 },
  topup: { name: "Top-up", priceGhs: 79, interviews: 3, drills: 15 },
};

export const CREDIT_VALIDITY_DAYS = 183;
const DAY = 24 * 60 * 60 * 1000;

export const creditExpiry = (purchasedAt: Date) => new Date(purchasedAt.getTime() + CREDIT_VALIDITY_DAYS * DAY);

export interface Grant {
  purchasedAt: Date;
  expiresAt: Date;
  interviews: number;
  drills: number;
  refunded: boolean;
}

/** A paid session that started: a full interview (any mode) or a drill. */
export interface Use {
  at: Date;
  kind: "interview" | "drill";
}

export interface Balance {
  interviews: number;
  drills: number;
  /** When the soonest-expiring remaining credits run out, if any remain. */
  expiresAt: Date | null;
}

/**
 * What's left now. Each use draws from the valid grant that expires first,
 * so older credits are used before newer ones.
 */
export function creditBalance(grants: readonly Grant[], uses: readonly Use[], now: Date): Balance {
  const pool = grants
    .filter((g) => !g.refunded)
    .map((g) => ({ ...g, left: { interview: g.interviews, drill: g.drills } }))
    .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime());
  for (const u of [...uses].sort((a, b) => a.at.getTime() - b.at.getTime())) {
    const g = pool.find((p) => p.purchasedAt <= u.at && u.at < p.expiresAt && p.left[u.kind] > 0);
    if (g) g.left[u.kind]--;
  }
  const live = pool.filter((g) => now < g.expiresAt && (g.left.interview > 0 || g.left.drill > 0));
  return {
    interviews: live.reduce((n, g) => n + g.left.interview, 0),
    drills: live.reduce((n, g) => n + g.left.drill, 0),
    expiresAt: live[0]?.expiresAt ?? null,
  };
}
