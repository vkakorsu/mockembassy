import { describe, expect, it } from "vitest";
import { encodeWav, sliceSamples, voiceMetrics, wavSamples } from "../voice";

const RATE = 16_000;
/** A 200 Hz tone at `amp` for `sec` seconds, or silence when amp is 0. */
function tone(sec: number, amp: number): Int16Array {
  const out = new Int16Array(Math.round(sec * RATE));
  for (let i = 0; i < out.length; i++) out[i] = Math.round(amp * 32767 * Math.sin((2 * Math.PI * 200 * i) / RATE));
  return out;
}

describe("session recording", () => {
  it("round-trips through WAV and slices by session time", () => {
    const wav = encodeWav([tone(1, 0), tone(2, 0.5), tone(1, 0)]);
    const { samples, sampleRate } = wavSamples(wav);
    expect(sampleRate).toBe(RATE);
    expect(samples.length).toBe(4 * RATE);
    const answer = sliceSamples(samples, sampleRate, 1000, 3000);
    expect(answer.length).toBe(2 * RATE);
    expect(Math.abs(answer[100])).toBeGreaterThan(1000);
  });

  it("measures speech, long pauses and trailing off", () => {
    const m = voiceMetrics(Int16Array.from([...tone(2, 0.5), ...tone(2, 0), ...tone(2, 0.15)]));
    expect(m.voicedSec).toBeGreaterThan(3.5);
    expect(m.voicedSec).toBeLessThan(4.5);
    expect(m.longPauses).toBe(1);
    expect(m.longestPauseSec).toBeGreaterThanOrEqual(1.9);
    expect(m.endLoudness).toBeLessThan(0.55);
    expect(voiceMetrics(tone(2, 0)).voicedSec).toBe(0);
  });
});
