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

/** How the answer sounded, from the recording (src/lib/domain/voice.ts). */
export interface VoiceSummary {
  voicedSec: number;
  longPauses: number;
  longestPauseSec: number;
  endLoudness: number;
}

/** Plain coaching lines about delivery. Deterministic: same audio, same advice. */
export function deliveryNotes(d: DeliveryMetrics, voice?: VoiceSummary | null): string[] {
  const notes: string[] = [];
  const speaking = voice?.voicedSec && voice.voicedSec > 2 ? voice.voicedSec : d.seconds;
  const wpm = speaking > 2 ? Math.round((d.words / speaking) * 60) : 0;
  if (d.tooLong) notes.push(`Long answer (${Math.round(d.seconds)} s). Aim for under 20 seconds.`);
  if (wpm > 175) notes.push(`Fast: about ${wpm} words a minute. Slow down so every word lands.`);
  else if (wpm > 0 && wpm < 95 && d.words >= 8) notes.push(`Slow: about ${wpm} words a minute. Know your answer well enough to say it smoothly.`);
  if (voice && voice.longPauses > 0)
    notes.push(`${voice.longPauses} long pause${voice.longPauses > 1 ? "s" : ""} (longest ${voice.longestPauseSec} s). Pauses read as uncertainty.`);
  if (voice && voice.voicedSec > 3 && voice.endLoudness < 0.55) notes.push("Your voice dropped towards the end. Finish as clearly as you start.");
  if (d.fillers >= 3) notes.push(`${d.fillers} fillers (um, uh…). Pause silently instead.`);
  return notes;
}
