import { describe, expect, it } from "vitest";
import { isRefundable, moveInterviewDate, passWindow, type PassState } from "../pass";

const d = (s: string) => new Date(`${s}T12:00:00Z`);
const base: PassState = { purchasedAt: d("2026-10-01"), interviewDate: d("2026-10-20"), hasAppointmentProof: false, dateMoves: 0 };

describe("pass rules", () => {
  it("runs to the interview date + 7 days for an honest near date", () => {
    const w = passWindow(base, d("2026-10-05"));
    expect(w.status).toBe("active");
    expect(w.endsAt).toEqual(d("2026-10-27"));
    expect(w.limitedBy).toBe("interview_date");
  });

  it("caps a far-away (possibly fake) date at 60 days of use", () => {
    const liar = { ...base, interviewDate: d("2028-10-01"), activatedAt: d("2026-10-01") };
    const w = passWindow(liar, d("2026-10-05"));
    expect(w.limitedBy).toBe("usage_ceiling");
    expect(w.endsAt).toEqual(d("2026-11-30"));
    expect(passWindow(liar, d("2026-12-15")).status).toBe("expired");
  });

  it("lets appointment proof lift the ceiling", () => {
    const proven = { ...base, interviewDate: d("2027-03-01"), activatedAt: d("2026-10-01"), hasAppointmentProof: true };
    expect(passWindow(proven, d("2027-02-01")).status).toBe("active");
  });

  it("auto-activates 45 days before a far date so honest early buyers lose nothing", () => {
    const early = { ...base, interviewDate: d("2027-03-01") };
    const w = passWindow(early, d("2026-10-05"));
    expect(w.status).toBe("pending");
    expect(w.startsAt).toEqual(d("2027-01-15"));
    expect(w.endsAt).toEqual(d("2027-03-08"));
  });

  it("allows one free date move, then requires proof", () => {
    const now = d("2026-10-02");
    const first = moveInterviewDate(base, d("2026-11-10"), now, { withNewProof: false });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(moveInterviewDate(first.pass, d("2026-12-01"), now, { withNewProof: false })).toEqual({ ok: false, reason: "proof_required" });
    expect(moveInterviewDate(first.pass, d("2026-12-01"), now, { withNewProof: true }).ok).toBe(true);
  });

  it("refunds only within 7 days, with at most one full mock, once per identity", () => {
    expect(isRefundable(base, { fullMocks: 1, priorRefundsForIdentity: 0 }, d("2026-10-07"))).toBe(true);
    expect(isRefundable(base, { fullMocks: 2, priorRefundsForIdentity: 0 }, d("2026-10-07"))).toBe(false);
    expect(isRefundable(base, { fullMocks: 0, priorRefundsForIdentity: 1 }, d("2026-10-07"))).toBe(false);
    expect(isRefundable(base, { fullMocks: 0, priorRefundsForIdentity: 0 }, d("2026-10-09"))).toBe(false);
  });
});
