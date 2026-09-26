/**
 * A short daily plan counting down to the interview: what to do today, and
 * the shape of the weeks ahead. Pure, from the interview date, readiness and
 * what the applicant has already done today.
 */

export type PlanPhase = "no_date" | "foundation" | "build" | "sharpen" | "dress" | "today" | "done";

export interface PlanTask {
  id: "interview" | "tough_interview" | "drill" | "quiz" | "story" | "dress_rehearsal" | "day_guide" | "pack" | "rest" | "set_date" | "report";
  label: string;
  /** Done today, when we can tell from sessions. Undefined when we can't track it. */
  done?: boolean;
}

export interface DailyPlan {
  phase: PlanPhase;
  title: string;
  /** How the days ahead should look, in one line. */
  rhythm: string;
  today: PlanTask[];
}

export interface PlanInput {
  daysToInterview: number | null;
  readiness: number;
  /** Sessions started, with mode and start time (ISO). */
  sessions: readonly { mode: string; at: string }[];
  hasWeakTopic: boolean;
  hasStoryChange: boolean;
  outcomeReported: boolean;
  now?: number;
}

const DAY = 24 * 60 * 60 * 1000;

export function dailyPlan(i: PlanInput): DailyPlan {
  const now = i.now ?? Date.now();
  const today = Math.floor(now / DAY);
  const onDay = (at: string) => Math.floor(Date.parse(at) / DAY) === today;
  const interviewedToday = i.sessions.some((s) => s.mode !== "drill" && onDay(s.at));
  const drilledToday = i.sessions.some((s) => s.mode === "drill" && onDay(s.at));
  const rehearsed = i.sessions.some((s) => s.mode === "dress_rehearsal" && now - Date.parse(s.at) <= 4 * DAY);
  const d = i.daysToInterview;

  const fix: PlanTask[] = [
    ...(i.hasStoryChange ? [{ id: "story" as const, label: "Settle the answer that changed between interviews, then drill it", done: undefined }] : []),
    ...(i.hasWeakTopic ? [{ id: "drill" as const, label: "Drill your weakest answer", done: drilledToday }] : []),
  ];

  if (d !== null && d < 0) {
    return {
      phase: "done",
      title: "How did it go?",
      rhythm: "Your interview date has passed.",
      today: i.outcomeReported ? [] : [{ id: "report", label: "Tell us how it went. It helps the next applicant." }],
    };
  }
  if (d === 0) {
    return {
      phase: "today",
      title: "Interview day",
      rhythm: "No new practice today. Stay calm and go early.",
      today: [
        { id: "day_guide", label: "Read the day-of guide" },
        { id: "pack", label: "Check your folder against What to bring" },
      ],
    };
  }
  if (d !== null && d <= 2) {
    return {
      phase: "dress",
      title: d === 1 ? "Tomorrow's the day" : "Two days to go",
      rhythm: "One dress rehearsal, a last look at your file, then rest.",
      today: [
        { id: "dress_rehearsal", label: "Do a dress rehearsal: standing, dressed as you'll be", done: rehearsed },
        { id: "quiz", label: "Run the quick quiz on Know your file" },
        { id: "day_guide", label: "Read the day-of guide" },
        ...(d === 1 ? [{ id: "pack" as const, label: "Pack your folder tonight" }, { id: "rest" as const, label: "Early night. No new answers now." }] : []),
      ],
    };
  }
  if (d !== null && d <= 7) {
    return {
      phase: "sharpen",
      title: `${d} days to go: sharpen`,
      rhythm: "One interview a day, a tough officer when you can, and your numbers every day.",
      today: [
        { id: "tough_interview", label: i.readiness >= 0.6 ? "Face a tough officer: a full interview" : "Do one full interview", done: interviewedToday },
        ...fix,
        { id: "quiz", label: "Run the quick quiz on Know your file" },
      ],
    };
  }
  if (d !== null && d <= 21) {
    return {
      phase: "build",
      title: `${d} days to go: build`,
      rhythm: "An interview every day or two, and drill each weak answer the same day.",
      today: [{ id: "interview", label: "Do one full interview", done: interviewedToday }, ...fix],
    };
  }
  return {
    phase: d === null ? "no_date" : "foundation",
    title: d === null ? "Set your interview date" : `${d} days to go: foundations`,
    rhythm: "Three interviews a week is plenty this far out. Fix weak answers as they come up.",
    today: [
      ...(d === null ? [{ id: "set_date" as const, label: "Add your interview date so we can plan the days" }] : []),
      { id: "interview", label: "Do one full interview", done: interviewedToday },
      ...fix,
    ],
  };
}
