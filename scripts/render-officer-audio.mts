/**
 * Pre-renders officer questions with Gemini 3.8 Flash TTS (docs/PLAN.md §3).
 * TTS has ~13 s time-to-first-audio, so it's used for pre-rendered audio only;
 * the live officer uses Gemini 3.8 Live.
 *
 *   GEMINI_API_KEY=... pnpm audio:hero
 *
 * Verify the model id against the Gemini API model list before running.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { heroAudioPath, heroQuestions } from "../src/lib/demo";

const MODEL = process.env.GEMINI_TTS_MODEL ?? "gemini-3.8-flash-tts";
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) {
  console.error("Set GEMINI_API_KEY first.");
  process.exit(1);
}

function wav(pcm: Buffer, sampleRate = 24000): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

async function render(text: string, voice: string): Promise<Buffer> {
  const direction =
    "[neutral American consular officer, brisk and flat, slightly muffled as if through glass] ";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": KEY! },
    body: JSON.stringify({
      contents: [{ parts: [{ text: direction + text }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const json = await res.json();
  const data = json.candidates?.[0]?.content?.parts?.find((p: { inlineData?: unknown }) => p.inlineData)?.inlineData?.data;
  if (!data) throw new Error("No audio in response");
  return wav(Buffer.from(data, "base64"));
}

const questions = heroQuestions();
for (const [i, q] of questions.entries()) {
  const out = join(process.cwd(), "public", heroAudioPath(i));
  writeFileSync(out, await render(q.question, q.voice));
  console.log(`✓ ${out}  (${q.officer}, ${q.voice}): ${q.question}`);
}
