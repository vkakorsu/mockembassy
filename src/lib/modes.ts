/**
 * How each interview mode behaves, in plain words for users. Keep in step
 * with the planner (src/lib/domain/director.ts) and the Referee.
 */
export const MODE_INFO = {
  real: {
    name: "Real interview",
    length: "1–4 min",
    body: "As close to the embassy as we can make it. A new officer who decides how long it lasts: they may cut you off, ask to see a document, or decide after two answers. Ends with approved, refused or 221(g).",
  },
  practice: {
    name: "Practice mode",
    length: "3–5 min",
    body: "Lower stakes for working on answers. Fewer surprises, and a bad answer doesn't end it: the officer covers every topic. Still ends with a verdict and a full debrief.",
  },
  dress_rehearsal: {
    name: "Dress rehearsal",
    length: "2–3½ min",
    body: "Your final check before the real day. A tougher officer and the whole routine: passport through the slot, fingerprints at the window, 3–4 topics and a verdict. Do it standing, dressed as you'll be.",
  },
  drill: {
    name: "Drill",
    length: "under 1 min",
    body: "One question, a new officer each time, graded straight away. No verdict. Start one from any debrief or from Answers to fix.",
  },
  free: {
    name: "Free mock",
    length: "90 s",
    body: "A real interview, cut short: two topics and a verdict, then a full debrief. One per account.",
  },
} as const;
