/**
 * The session recording: 16 kHz mono 16-bit PCM in a WAV file, the same audio
 * the officer hears. Session time 0 is the first sample, so a turn's
 * startedMs/endedMs index straight into it. Pure: runs in the browser (encode)
 * and on the server (slice, measure).
 */

export const RECORDING_RATE = 16_000;

export function encodeWav(chunks: readonly Int16Array[], sampleRate = RECORDING_RATE): Uint8Array<ArrayBuffer> {
  const samples = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(44 + samples * 2);
  const v = new DataView(out.buffer);
  const ascii = (at: number, s: string) => [...s].forEach((ch, i) => v.setUint8(at + i, ch.charCodeAt(0)));
  ascii(0, "RIFF");
  v.setUint32(4, 36 + samples * 2, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  ascii(36, "data");
  v.setUint32(40, samples * 2, true);
  let at = 44;
  for (const c of chunks) {
    for (let i = 0; i < c.length; i++, at += 2) v.setInt16(at, c[i], true);
  }
  return out;
}

/** The PCM samples of a 16-bit mono WAV written by encodeWav. */
export function wavSamples(wav: Uint8Array): { samples: Int16Array; sampleRate: number } {
  const v = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  if (String.fromCharCode(...wav.subarray(0, 4)) !== "RIFF") throw new Error("Not a WAV file");
  const sampleRate = v.getUint32(24, true);
  // Walk the chunks to find "data" (other writers may add chunks before it).
  let at = 12;
  while (at + 8 <= wav.length) {
    const id = String.fromCharCode(...wav.subarray(at, at + 4));
    const size = v.getUint32(at + 4, true);
    if (id === "data") {
      const len = Math.min(size, wav.length - at - 8) >> 1;
      const samples = new Int16Array(len);
      for (let i = 0; i < len; i++) samples[i] = v.getInt16(at + 8 + i * 2, true);
      return { samples, sampleRate };
    }
    at += 8 + size + (size & 1);
  }
  throw new Error("WAV has no data");
}

export function sliceSamples(samples: Int16Array, sampleRate: number, startMs: number, endMs: number): Int16Array {
  const a = Math.max(0, Math.floor((startMs / 1000) * sampleRate));
  const b = Math.min(samples.length, Math.ceil((endMs / 1000) * sampleRate));
  return samples.slice(a, Math.max(a, b));
}

export interface VoiceMetrics {
  /** Seconds with speech. */
  voicedSec: number;
  /** Silences of 1.5 s or more inside the answer. */
  longPauses: number;
  longestPauseSec: number;
  /** Loudness of the last third relative to the first (below ~0.55 = trailing off). */
  endLoudness: number;
}

/** Speech/silence from 50 ms frames, with a threshold relative to the answer's own loudness. */
export function voiceMetrics(samples: Int16Array, sampleRate = RECORDING_RATE): VoiceMetrics {
  const frame = Math.round(sampleRate * 0.05);
  const levels: number[] = [];
  for (let i = 0; i + frame <= samples.length; i += frame) {
    let sum = 0;
    for (let j = i; j < i + frame; j++) sum += (samples[j] / 32768) ** 2;
    levels.push(Math.sqrt(sum / frame));
  }
  if (!levels.length) return { voicedSec: 0, longPauses: 0, longestPauseSec: 0, endLoudness: 1 };
  const sorted = [...levels].sort((a, b) => a - b);
  const loud = sorted[Math.floor(sorted.length * 0.9)];
  const threshold = Math.max(0.01, loud * 0.18);
  const voiced = levels.map((l) => l >= threshold);
  const first = voiced.indexOf(true);
  const last = voiced.lastIndexOf(true);
  if (first < 0) return { voicedSec: 0, longPauses: 0, longestPauseSec: 0, endLoudness: 1 };

  let longPauses = 0;
  let longest = 0;
  let run = 0;
  for (let i = first; i <= last; i++) {
    if (voiced[i]) {
      if (run * 0.05 >= 1.5) longPauses++;
      longest = Math.max(longest, run * 0.05);
      run = 0;
    } else run++;
  }
  const speech = levels.slice(first, last + 1).filter((_, i) => voiced[first + i]);
  const third = Math.max(1, Math.floor(speech.length / 3));
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  const startLevel = mean(speech.slice(0, third));
  const endLevel = mean(speech.slice(-third));
  return {
    voicedSec: Math.round(voiced.filter(Boolean).length * 0.05 * 10) / 10,
    longPauses,
    longestPauseSec: Math.round(longest * 10) / 10,
    endLoudness: startLevel > 0 ? Math.round((endLevel / startLevel) * 100) / 100 : 1,
  };
}
