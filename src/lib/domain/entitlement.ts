import { passWindow, PASS_RULES, type PassState } from "./pass";

/**
 * Can this case start a session right now, and what kind? Pure so it's
 * testable; the server loads the rows and calls this.
 */

export type PlanId = "sprint" | "pass" | "family" | "coach" | "senior";

export interface PassRow extends PassState {
  plan: PlanId;
  refunded: boolean;
}

export type Entitlement =
  | { kind: "full"; reason: string }
  | { kind: "free"; reason: string }
  | { kind: "none"; reason: string };

export const FREE_MOCK_SECONDS = 90;
/** One-question drills: a few free to show the value, then plenty with a pass. */
export const FREE_DRILLS_PER_ACCOUNT = 3;
export const DAILY_DRILLS = 30;
export const SPRINT_MOCKS = 3;
export const SPRINT_DAYS = 14;

const DAY = 24 * 60 * 60 * 1000;

export function entitlement(input: {
  passes: PassRow[];
  /** Full (non-free) sessions started today, and since each pass's purchase. */
  fullSessionsToday: number;
  fullSessionsSince: (since: Date) => number;
  freeSessionsUsed: number;
  now: Date;
}): Entitlement {
  const { passes, now } = input;
  for (const p of passes) {
    if (p.refunded) continue;
    if (p.plan === "sprint") {
      const inWindow = now.getTime() - p.purchasedAt.getTime() <= SPRINT_DAYS * DAY;
      const used = input.fullSessionsSince(p.purchasedAt);
      if (inWindow && used < SPRINT_MOCKS) {
        return { kind: "full", reason: `Sprint: ${SPRINT_MOCKS - used} full mock(s) left` };
      }
      continue;
    }
    const w = passWindow(p, now);
    if (w.status === "active") {
      // If abuse shows up, lower passes without proof to PASS_RULES.dailyFullMocksWithoutProofFallback.
      const cap = PASS_RULES.dailyFullMocks;
      if (input.fullSessionsToday >= cap) {
        return { kind: "none", reason: `Daily limit reached (${cap} full mocks). Come back tomorrow.` };
      }
      return { kind: "full", reason: "Interview Pass active" };
    }
    if (w.status === "pending") {
      return { kind: "none", reason: `Your pass starts on ${w.startsAt.toDateString()}. You can activate it early.` };
    }
  }
  if (input.freeSessionsUsed === 0) return { kind: "free", reason: "Your free 90-second mock" };
  return { kind: "none", reason: "Get a pass to keep practising." };
}

/** Drills sit beside mocks: they never use up a mock or the daily mock limit. */
export function drillEntitlement(input: {
  mock: Entitlement;
  drillsToday: number;
  freeDrillsUsed: number;
}): Entitlement {
  const hasPass = input.mock.kind === "full" || input.mock.reason.startsWith("Daily limit");
  if (hasPass) {
    return input.drillsToday < DAILY_DRILLS
      ? { kind: "full", reason: "Drills included with your pass" }
      : { kind: "none", reason: `Daily limit reached (${DAILY_DRILLS} drills). Come back tomorrow.` };
  }
  const left = FREE_DRILLS_PER_ACCOUNT - input.freeDrillsUsed;
  return left > 0
    ? { kind: "free", reason: `${left} free drill${left > 1 ? "s" : ""} left` }
    : { kind: "none", reason: "Get a pass for unlimited drills." };
}
