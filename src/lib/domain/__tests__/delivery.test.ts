import { describe, expect, it } from "vitest";
import { deliveryMetrics, deliveryNotes } from "../delivery";

const words = (n: number) => Array.from({ length: n }, () => "word").join(" ");

describe("delivery notes", () => {
  it("judges pace over the whole answer, pauses included", () => {
    // From a real session: 44 words in 16.8 s, 11.2 s of it voiced. 157 wpm is normal.
    const d = deliveryMetrics(words(44), 16.8);
    expect(deliveryNotes(d, { voicedSec: 11.2, longPauses: 0, longestPauseSec: 0.6, endLoudness: 0.91 })).toEqual([]);
    expect(deliveryNotes(deliveryMetrics(words(60), 15))[0]).toMatch(/Fast: about 240/);
  });

  it("flags long pauses, a fading voice, fillers and long answers", () => {
    const d = deliveryMetrics(`${words(80)} um uh er`, 40);
    const notes = deliveryNotes(d, { voicedSec: 30, longPauses: 2, longestPauseSec: 3.1, endLoudness: 0.4 });
    expect(notes.join(" ")).toMatch(/Long answer/);
    expect(notes.join(" ")).toMatch(/2 long pauses/);
    expect(notes.join(" ")).toMatch(/voice dropped/);
    expect(notes.join(" ")).toMatch(/3 fillers/);
  });
});
