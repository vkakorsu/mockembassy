import { describe, expect, it } from "vitest";
import { practiceCalendar } from "../calendar";
import { dailyPlan } from "../daily-plan";
import { reapplyAdvice } from "../reapply";

const NOW = Date.parse("2026-09-26T10:00:00Z");
const DAY = 86400000;

describe("reapply or wait", () => {
  it("says wait when nothing has changed, and is honest that practice alone isn't a change", () => {
    expect(reapplyAdvice([]).verdict).toBe("wait");
    expect(reapplyAdvice(["answers"]).verdict).toBe("risky");
    expect(reapplyAdvice(["answers", "funding"]).verdict).toBe("reapply");
  });
});

describe("daily plan", () => {
  const base = { readiness: 0.4, sessions: [], hasWeakTopic: false, hasStoryChange: false, outcomeReported: false, now: NOW };

  it("follows the countdown", () => {
    expect(dailyPlan({ ...base, daysToInterview: null }).phase).toBe("no_date");
    expect(dailyPlan({ ...base, daysToInterview: 30 }).phase).toBe("foundation");
    expect(dailyPlan({ ...base, daysToInterview: 14 }).phase).toBe("build");
    expect(dailyPlan({ ...base, daysToInterview: 5 }).phase).toBe("sharpen");
    expect(dailyPlan({ ...base, daysToInterview: 1 }).today.map((t) => t.id)).toContain("dress_rehearsal");
    expect(dailyPlan({ ...base, daysToInterview: 0 }).today.map((t) => t.id)).toEqual(["day_guide", "pack"]);
    expect(dailyPlan({ ...base, daysToInterview: -2 }).today.map((t) => t.id)).toEqual(["report"]);
    expect(dailyPlan({ ...base, daysToInterview: -2, outcomeReported: true }).today).toEqual([]);
  });

  it("ticks off what was done today and adds fixes first", () => {
    const plan = dailyPlan({
      ...base,
      daysToInterview: 10,
      hasWeakTopic: true,
      hasStoryChange: true,
      sessions: [
        { mode: "real", at: new Date(NOW - 3600000).toISOString() },
        { mode: "drill", at: new Date(NOW - 2 * DAY).toISOString() },
      ],
    });
    expect(plan.today.find((t) => t.id === "interview")?.done).toBe(true);
    expect(plan.today.find((t) => t.id === "drill")?.done).toBe(false);
    expect(plan.today.map((t) => t.id)).toContain("story");
  });
});

describe("calendar reminders", () => {
  const ics = practiceCalendar({
    caseId: "c1",
    applicantName: "Ama",
    interviewAt: new Date(NOW + 10 * DAY).toISOString(),
    siteUrl: "https://okwan.example",
    now: NOW,
  });

  it("is a valid calendar with daily practice, a dress rehearsal and the interview", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3);
    expect(ics).toContain("RRULE:FREQ=DAILY;UNTIL=");
    expect(ics).toContain("SUMMARY:US visa interview\\, US Embassy Accra");
    expect(ics.split("\r\n").every((l) => l.length <= 75)).toBe(true);
  });

  it("skips reminders that would be in the past", () => {
    const soon = practiceCalendar({ caseId: "c1", applicantName: "Ama", interviewAt: new Date(NOW + DAY).toISOString(), siteUrl: "https://x", now: NOW });
    expect(soon.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });
});
