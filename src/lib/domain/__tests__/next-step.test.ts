import { describe, expect, it } from "vitest";
import { nextStep, type NextStepInput } from "@/lib/next-step";

const base: NextStepInput = {
  caseId: "c",
  documents: [],
  factsConfirmed: false,
  pendingNotes: 0,
  sessions: [],
  canInterview: "free",
  canDrill: "free",
  weakest: null,
  daysToInterview: null,
  requiredStillToPack: 6,
  outcomeReported: false,
};
const done = { status: "done" as const };

describe("next step", () => {
  it("walks a new applicant through setup in order", () => {
    expect(nextStep(base).id).toBe("documents");
    expect(nextStep({ ...base, documents: [{ status: "pending" }] }).id).toBe("reading");
    expect(nextStep({ ...base, documents: [done] }).id).toBe("facts");
    expect(nextStep({ ...base, documents: [done], factsConfirmed: true, pendingNotes: 3 }).id).toBe("notes");
    expect(nextStep({ ...base, documents: [done], factsConfirmed: true }).id).toBe("first");
  });

  it("after the first interview, fixes the weakest answer, then keeps practising", () => {
    const after = { ...base, documents: [done], factsConfirmed: true, sessions: [{ mode: "real", ended: true }] };
    const weakest = { probeId: "f1.funding.sponsor", question: "Who is paying?" };
    expect(nextStep({ ...after, weakest }).action).toMatchObject({ kind: "drill", probeId: "f1.funding.sponsor", label: "Free drill" });
    expect(nextStep({ ...after, weakest, canDrill: "none", canInterview: "full" }).id).toBe("practise");
    expect(nextStep({ ...after, canDrill: "none", canInterview: "none" }).action).toMatchObject({ label: "Get interviews" });
  });

  it("uses the countdown: rehearse, pack, then ask how it went", () => {
    const ready = { ...base, documents: [done], factsConfirmed: true, sessions: [{ mode: "real", ended: true }], canInterview: "full" as const };
    expect(nextStep({ ...ready, daysToInterview: 3 }).action).toMatchObject({ kind: "session", mode: "dress_rehearsal" });
    expect(nextStep({ ...ready, daysToInterview: 1 }).id).toBe("pack");
    expect(nextStep({ ...ready, daysToInterview: 1, requiredStillToPack: 0 }).id).toBe("rehearsal");
    expect(nextStep({ ...ready, daysToInterview: -1 }).id).toBe("outcome");
    expect(nextStep({ ...ready, daysToInterview: -1, outcomeReported: true }).id).not.toBe("outcome");
  });
});
