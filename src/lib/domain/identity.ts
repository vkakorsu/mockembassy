import type { CaseProfile } from "./case";

/**
 * An account belongs to one applicant (docs/PRICING.md). Once the identity is
 * locked (after the first paid interview), re-confirmed facts must still
 * describe the same person, so credits can't be handed to a friend by
 * overwriting the facts with theirs.
 */

/** One account is one applicant; someone else practising makes their own account. */
export const MAX_CASES_PER_ACCOUNT = 1;
export const FREE_MOCKS_PER_ACCOUNT = 1;

export type IdentityCheck = { ok: true } | { ok: false; field: string };

const same = (a?: string, b?: string) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

export function sameApplicant(locked: CaseProfile, next: CaseProfile): IdentityCheck {
  if (!same(locked.applicant.firstName, next.applicant.firstName)) return { ok: false, field: "first name" };
  // Birthdays happen; bigger jumps mean a different person.
  if (Math.abs(locked.applicant.age - next.applicant.age) > 1) return { ok: false, field: "age" };
  if (locked.visaType !== next.visaType) return { ok: false, field: "visa type" };
  if (locked.study && next.study && !same(locked.study.school, next.study.school) && !same(locked.study.program, next.study.program)) {
    // Changing school *or* program is normal (transfers, corrections); changing both is a new applicant.
    return { ok: false, field: "school and program" };
  }
  return { ok: true };
}
