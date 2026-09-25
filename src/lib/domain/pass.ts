/**
 * Interview Pass validity rules (docs/PRICING.md §3a). Honest users never
 * notice them; a fake interview date can earn at most a bounded window.
 */

const DAY = 24 * 60 * 60 * 1000;

export const PASS_RULES = {
  /** Usage ceiling without appointment proof. */
  maxDaysWithoutProof: 60,
  /** Days after the interview the pass stays open. */
  graceDaysAfterInterview: 7,
  /** Auto-activation this many days before the entered interview date. */
  autoActivateDaysBefore: 45,
  dailyFullMocks: 3,
  dailyFullMocksWithoutProofFallback: 2,
  freeDateMoves: 1,
  refundWindowDays: 7,
  refundMaxFullMocks: 1,
  secondAttemptWindowDays: 365,
} as const;

export interface PassState {
  purchasedAt: Date;
  /** Explicit activation by the user, if any. */
  activatedAt?: Date;
  interviewDate: Date;
  /** Appointment confirmation uploaded and matched to the Case. */
  hasAppointmentProof: boolean;
  dateMoves: number;
}

export type PassStatus = "pending" | "active" | "expired";

export interface PassWindow {
  status: PassStatus;
  startsAt: Date;
  endsAt: Date;
  /** Which rule set the end date. */
  limitedBy: "interview_date" | "usage_ceiling";
}

export function effectiveActivation(p: PassState): Date {
  if (p.activatedAt) return p.activatedAt;
  const auto = new Date(p.interviewDate.getTime() - PASS_RULES.autoActivateDaysBefore * DAY);
  return auto < p.purchasedAt ? p.purchasedAt : auto;
}

export function passWindow(p: PassState, now: Date): PassWindow {
  const startsAt = effectiveActivation(p);
  const byInterview = new Date(p.interviewDate.getTime() + PASS_RULES.graceDaysAfterInterview * DAY);
  const byCeiling = new Date(startsAt.getTime() + PASS_RULES.maxDaysWithoutProof * DAY);
  const endsAt = p.hasAppointmentProof || byInterview <= byCeiling ? byInterview : byCeiling;
  const limitedBy = endsAt === byInterview ? "interview_date" : "usage_ceiling";
  const status: PassStatus = now < startsAt ? "pending" : now > endsAt ? "expired" : "active";
  return { status, startsAt, endsAt, limitedBy };
}

export type DateMoveResult =
  | { ok: true; pass: PassState }
  | { ok: false; reason: "proof_required" | "date_in_past" };

/** First move is free; later moves need a new appointment confirmation. */
export function moveInterviewDate(
  p: PassState,
  newDate: Date,
  now: Date,
  opts: { withNewProof: boolean },
): DateMoveResult {
  if (newDate < now) return { ok: false, reason: "date_in_past" };
  if (p.dateMoves >= PASS_RULES.freeDateMoves && !opts.withNewProof) {
    return { ok: false, reason: "proof_required" };
  }
  return {
    ok: true,
    pass: {
      ...p,
      interviewDate: newDate,
      dateMoves: p.dateMoves + 1,
      hasAppointmentProof: opts.withNewProof ? true : p.hasAppointmentProof,
    },
  };
}

export function isRefundable(
  p: Pick<PassState, "purchasedAt">,
  usage: { fullMocks: number; priorRefundsForIdentity: number },
  now: Date,
): boolean {
  return (
    now.getTime() - p.purchasedAt.getTime() <= PASS_RULES.refundWindowDays * DAY &&
    usage.fullMocks <= PASS_RULES.refundMaxFullMocks &&
    usage.priorRefundsForIdentity === 0
  );
}
