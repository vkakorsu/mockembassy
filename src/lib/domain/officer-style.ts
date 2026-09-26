import { stripToolText } from "./transcript";

/**
 * How our officers talk, compared with real ones. The reference comes from
 * 335 officer lines in real West African F-1 interview transcripts
 * (huggingface.co/datasets/Blessing988/f1_visa_transcripts, MIT; analysis in
 * docs/INTERVIEW-REALISM.md §10). A simulated officer that drifts well above
 * these numbers sounds like an interviewer, not a visa officer.
 */
export const REAL_OFFICER_STYLE = {
  medianWords: 7,
  p90Words: 15,
  /** Lines that aren't questions: reactions, instructions, statements about the file. */
  nonQuestionShare: 0.45,
  /** Officer lines in a whole interview, greeting to decision. */
  medianLinesPerInterview: 9,
} as const;

export interface OfficerStyle {
  lines: number;
  medianWords: number;
  p90Words: number;
  nonQuestionShare: number;
}

const quantile = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];

export function officerStyle(officerLines: readonly string[]): OfficerStyle | null {
  const lines = officerLines.map((l) => stripToolText(l).replace(/\s+/g, " ").trim()).filter(Boolean);
  if (!lines.length) return null;
  const words = lines.map((l) => l.split(" ").length).sort((a, b) => a - b);
  return {
    lines: lines.length,
    medianWords: quantile(words, 0.5),
    p90Words: quantile(words, 0.9),
    nonQuestionShare: lines.filter((l) => !l.includes("?")).length / lines.length,
  };
}
