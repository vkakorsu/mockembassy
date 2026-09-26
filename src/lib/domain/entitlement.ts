import type { Balance } from "./credits";

/**
 * Can this case start a session right now, and what kind? Pure so it's
 * testable; the server loads the rows and calls this. Paid sessions spend
 * credits (credits.ts); the free mock and free drills are per account.
 */

export type Entitlement =
  | { kind: "full"; reason: string }
  | { kind: "free"; reason: string }
  | { kind: "none"; reason: string };

export const FREE_MOCK_SECONDS = 90;
/** One-question drills: a few free to show the value. */
export const FREE_DRILLS_PER_ACCOUNT = 3;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function entitlement(input: { credits: Balance; freeSessionsUsed: number }): Entitlement {
  if (input.credits.interviews > 0) return { kind: "full", reason: `${plural(input.credits.interviews, "interview")} left` };
  if (input.freeSessionsUsed === 0) return { kind: "free", reason: "Your free 90-second mock" };
  return { kind: "none", reason: "You've used your interviews. Get more to keep practising." };
}

export function drillEntitlement(input: { credits: Balance; freeDrillsUsed: number }): Entitlement {
  if (input.credits.drills > 0) return { kind: "full", reason: `${plural(input.credits.drills, "drill")} left` };
  const left = FREE_DRILLS_PER_ACCOUNT - input.freeDrillsUsed;
  return left > 0
    ? { kind: "free", reason: `${plural(left, "free drill")} left` }
    : { kind: "none", reason: "You've used your drills. Get more to keep practising." };
}
