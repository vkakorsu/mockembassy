import type { VisaType } from "./case";

/**
 * Refused before: should they reapply now, or wait? A 214(b) refusal isn't a
 * ban and there's no waiting period, but the next officer sees the refusal and
 * asks what has changed. Reapplying with the same case usually gets the same
 * answer and costs another $185. This says so honestly.
 */

export interface ChangeOption {
  id: string;
  label: string;
  /** A change in the facts of the case, which an officer can weigh. */
  material: boolean;
  visa?: VisaType;
}

export const CHANGE_OPTIONS: readonly ChangeOption[] = [
  { id: "funding", label: "Stronger, documented funding: a new sponsor with papers, a scholarship, or money held for months, not just deposited", material: true },
  { id: "ties", label: "A new job, promotion, business or property in Ghana", material: true },
  { id: "family", label: "New family responsibilities in Ghana: marriage, children, caring for a parent", material: true },
  { id: "program", label: "A school or program that clearly fits your studies or work better", material: true, visa: "F1" },
  { id: "purpose", label: "A different, clearer reason to travel, with evidence (an invitation, a conference, a graduation)", material: true, visa: "B1B2" },
  { id: "time", label: "Real progress since then: you finished a degree, worked a year or more, or travelled and came back", material: true },
  { id: "answers", label: "You answered badly last time (froze, rambled, contradicted your form) and have practised since", material: false },
];

export type ReapplyVerdict = "reapply" | "risky" | "wait";

export interface ReapplyAdvice {
  verdict: ReapplyVerdict;
  title: string;
  body: string;
}

export function reapplyAdvice(selected: readonly string[]): ReapplyAdvice {
  const chosen = CHANGE_OPTIONS.filter((o) => selected.includes(o.id));
  if (chosen.some((o) => o.material)) {
    return {
      verdict: "reapply",
      title: "Reapplying can make sense",
      body: "Something real has changed. The officer will ask \"What has changed since your last refusal?\". Be ready to say it in one sentence, first, and bring the evidence. Make sure your new DS-160 shows it.",
    };
  }
  if (chosen.length) {
    return {
      verdict: "risky",
      title: "Reapplying now is a risk",
      body: "The officer will see the same case as last time. It can still work if your refusal came from how you answered rather than your facts. Practise the \"What's changed?\" question until it's solid, and be honest that your circumstances are the same.",
    };
  }
  return {
    verdict: "wait",
    title: "Waiting is probably wiser",
    body: "Reapplying with the same case usually gets the same answer, and each attempt costs the $185 fee. Come back when something real has changed: your funding, your job, your studies or your family ties.",
  };
}
