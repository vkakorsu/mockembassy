/**
 * Deterministic delivery metrics from the transcript and timings. These never
 * depend on an LLM, so they are consistent across sessions.
 */

const FILLERS = ["um", "uh", "erm", "er", "hmm", "like", "you know", "i mean", "actually", "basically", "so yeah"];

export interface DeliveryMetrics {
  words: number;
  seconds: number;
  wordsPerMinute: number;
  fillers: number;
  tooLong: boolean;
}

export function deliveryMetrics(text: string, seconds: number): DeliveryMetrics {
  const clean = text.toLowerCase().replace(/[^\p{L}\p{N}' ]/gu, " ");
  const words = clean.split(/\s+/).filter(Boolean).length;
  let fillers = 0;
  for (const f of FILLERS) {
    const re = new RegExp(`(^|\\s)${f}(?=\\s|$)`, "g");
    fillers += clean.match(re)?.length ?? 0;
  }
  const secs = Math.max(0, seconds);
  return {
    words,
    seconds: Math.round(secs * 10) / 10,
    wordsPerMinute: secs > 0 ? Math.round((words / secs) * 60) : 0,
    fillers,
    tooLong: secs > 35,
  };
}
