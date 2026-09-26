"use client";

import { FunctionResponseScheduling, GoogleGenAI, type LiveServerMessage, type Session } from "@google/genai";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Guilloche } from "@/components/guilloche";
import type { LiveBehaviour } from "@/lib/domain/live-behaviour";
import { createClient } from "@/lib/supabase/browser";

/**
 * The Window: a real-time voice interview with the Officer (Gemini Live).
 * The browser holds only a single-use token with the officer's config locked
 * server-side. Tool calls are relayed to the server Referee.
 */

type Phase = "ready" | "connecting" | "live" | "ending" | "error";
interface Turn {
  officer: string;
  answer: string;
  startedMs: number | null;
  endedMs: number | null;
}

interface Props {
  sessionId: string;
  userId: string;
  officerName: string;
  targetDurationSec: number;
  isFree: boolean;
  supabaseUrl: string;
  publishableKey: string;
}

function toBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function fromBase64(b64: string) {
  const bin = atob(b64);
  const out = new Int16Array(bin.length / 2);
  for (let i = 0; i < out.length; i++) {
    const lo = bin.charCodeAt(i * 2);
    const hi = bin.charCodeAt(i * 2 + 1);
    out[i] = (hi << 8) | lo;
  }
  return out;
}

const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function LiveRoom(props: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("ready");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [officerLevel, setOfficerLevel] = useState(0);
  const [micLevel, setMicLevel] = useState(0);
  const [status, setStatus] = useState("");

  const sessionRef = useRef<Session | null>(null);
  const startRef = useRef(0);
  const turnsRef = useRef<Turn[]>([]);
  const lastSpeakerRef = useRef<"officer" | "user" | null>(null);
  const decidedRef = useRef(false);
  const wrapSentRef = useRef(false);
  const finishingRef = useRef(false);
  const cleanupRef = useRef<() => void>(() => {});
  const playRef = useRef<{ ctx: AudioContext; analyser: AnalyserNode; next: number; sources: AudioBufferSourceNode[] } | null>(null);
  const recorderRef = useRef<{ rec: MediaRecorder; chunks: Blob[] } | null>(null);
  // Client-timed realism (src/lib/domain/live-behaviour.ts).
  const behaviourRef = useRef<LiveBehaviour | null>(null);
  const officerTurnRef = useRef(0);
  const officerSpeakingRef = useRef(false);
  const answerSinceRef = useRef<number | null>(null);
  const cutInSentRef = useRef(false);
  /** When to tell the officer the documents are through the slot, if the applicant stays silent. */
  const handoverAtRef = useRef<number | null>(null);

  const now = () => Date.now() - startRef.current;

  function currentTurn(): Turn {
    const t = turnsRef.current;
    if (!t.length) t.push({ officer: "", answer: "", startedMs: null, endedMs: null });
    return t[t.length - 1];
  }

  function onOfficerText(text: string) {
    if (lastSpeakerRef.current === "user") {
      turnsRef.current.push({ officer: "", answer: "", startedMs: null, endedMs: null });
    }
    lastSpeakerRef.current = "officer";
    currentTurn().officer += text;
  }

  function onUserText(text: string) {
    handoverAtRef.current = null;
    if (lastSpeakerRef.current !== "user") {
      answerSinceRef.current = Date.now();
      cutInSentRef.current = false;
    }
    const turn = currentTurn();
    if (turn.startedMs === null) turn.startedMs = now();
    turn.endedMs = now();
    turn.answer += text;
    lastSpeakerRef.current = "user";
  }

  function playPcm(b64: string) {
    const p = playRef.current;
    if (!p) return;
    const pcm = fromBase64(b64);
    const buffer = p.ctx.createBuffer(1, pcm.length, 24000);
    const ch = buffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 0x8000;
    const src = p.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(p.analyser);
    if (!officerSpeakingRef.current) {
      // First audio of a new officer turn.
      officerSpeakingRef.current = true;
      officerTurnRef.current += 1;
      answerSinceRef.current = null;
      const silence = behaviourRef.current?.typingSilence;
      if (silence && silence.turn === officerTurnRef.current) {
        // The officer looks down and types before speaking.
        p.next = Math.max(p.next, p.ctx.currentTime + silence.seconds);
      }
    }
    const at = Math.max(p.ctx.currentTime + 0.02, p.next);
    src.start(at);
    p.next = at + buffer.duration;
    p.sources.push(src);
    src.onended = () => {
      p.sources = p.sources.filter((s) => s !== src);
    };
  }

  function stopPlayback() {
    const p = playRef.current;
    if (!p) return;
    p.sources.forEach((s) => {
      try {
        s.stop();
      } catch {}
    });
    p.sources = [];
    p.next = p.ctx.currentTime;
  }

  function referee(text: string) {
    sessionRef.current?.sendClientContent({ turns: [{ role: "user", parts: [{ text: `[REFEREE] ${text}` }] }], turnComplete: true });
  }

  async function handleToolCalls(msg: LiveServerMessage) {
    const calls = msg.toolCall?.functionCalls ?? [];
    for (const call of calls) {
      try {
        const res = await fetch(`/api/sessions/${props.sessionId}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: call.name, args: call.args ?? {} }),
        });
        const result = await res.json();
        if (call.name === "end_interview") decidedRef.current = true;
        sessionRef.current?.sendToolResponse({
          functionResponses: [
            {
              id: call.id,
              name: call.name,
              response: result.response ?? { ok: true },
              scheduling: result.speak ? FunctionResponseScheduling.WHEN_IDLE : FunctionResponseScheduling.SILENT,
            },
          ],
        });
        if (result.wrapUp && !wrapSentRef.current) {
          wrapSentRef.current = true;
          referee("You have heard enough. Call end_interview now.");
        }
      } catch {
        sessionRef.current?.sendToolResponse({
          functionResponses: [{ id: call.id, name: call.name, response: { ok: false }, scheduling: FunctionResponseScheduling.SILENT }],
        });
      }
    }
  }

  function onMessage(msg: LiveServerMessage) {
    const sc = msg.serverContent;
    if (sc?.interrupted) stopPlayback();
    if (sc?.turnComplete && officerTurnRef.current === 1 && lastSpeakerRef.current !== "user") {
      // The officer asked for the documents. Most people pass them silently, so
      // after the request finishes playing, tell the officer they're through.
      const p = playRef.current;
      handoverAtRef.current = Date.now() + (p ? Math.max(0, (p.next - p.ctx.currentTime) * 1000) : 0) + 2500;
    }
    if (sc?.turnComplete || sc?.interrupted) officerSpeakingRef.current = false;
    for (const part of sc?.modelTurn?.parts ?? []) {
      if (part.inlineData?.data) playPcm(part.inlineData.data);
    }
    if (sc?.outputTranscription?.text) onOfficerText(sc.outputTranscription.text);
    if (sc?.inputTranscription?.text) onUserText(sc.inputTranscription.text);
    if (sc?.turnComplete && decidedRef.current) {
      // Let the decision line finish playing, then leave the window.
      const p = playRef.current;
      const wait = p ? Math.max(0, (p.next - p.ctx.currentTime) * 1000) + 1200 : 1500;
      window.setTimeout(() => void finish(), wait);
    }
    if (msg.toolCall) void handleToolCalls(msg);
    if (msg.goAway) setStatus("Connection ending soon…");
  }

  async function finish() {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setPhase("ending");
    setStatus("Saving your interview…");
    cleanupRef.current();

    let recordingPath: string | null = null;
    const r = recorderRef.current;
    if (r) {
      await new Promise<void>((resolve) => {
        if (r.rec.state === "inactive") return resolve();
        r.rec.onstop = () => resolve();
        r.rec.stop();
      });
      try {
        const blob = new Blob(r.chunks, { type: r.rec.mimeType || "audio/webm" });
        const path = `${props.userId}/${props.sessionId}.webm`;
        const supabase = createClient(props.supabaseUrl, props.publishableKey);
        const { error } = await supabase.storage.from("recordings").upload(path, blob, { upsert: true, contentType: blob.type });
        if (!error) recordingPath = path;
      } catch {}
    }
    const turns = turnsRef.current.filter((t) => t.officer.trim() || t.answer.trim());
    await fetch(`/api/sessions/${props.sessionId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ turns, recordingPath }),
    });
    router.replace(`/app/sessions/${props.sessionId}/debrief`);
  }

  async function start() {
    setPhase("connecting");
    setError(null);
    try {
      const tokenRes = await fetch(`/api/sessions/${props.sessionId}/token`, { method: "POST" });
      const tokenJson = await tokenRes.json();
      if (!tokenRes.ok) throw new Error(tokenJson.error ?? "Couldn't open the window");
      behaviourRef.current = tokenJson.behaviour ?? null;

      const mic = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
      // Release the mic if anything below fails before the full cleanup is wired up.
      cleanupRef.current = () => mic.getTracks().forEach((t) => t.stop());

      const playCtx = new AudioContext({ sampleRate: 24000 });
      const analyser = playCtx.createAnalyser();
      analyser.fftSize = 256;
      // A touch of "through the glass": gentle low-pass on the officer's voice.
      const glass = playCtx.createBiquadFilter();
      glass.type = "lowpass";
      glass.frequency.value = 5200;
      analyser.connect(glass).connect(playCtx.destination);
      playRef.current = { ctx: playCtx, analyser, next: 0, sources: [] };

      const capCtx = new AudioContext();
      await capCtx.audioWorklet.addModule("/worklets/pcm-capture.js");
      const node = new AudioWorkletNode(capCtx, "pcm-capture");
      capCtx.createMediaStreamSource(mic).connect(node);

      const rec = new MediaRecorder(mic);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.start(1000);
      recorderRef.current = { rec, chunks };

      const ai = new GoogleGenAI({ apiKey: tokenJson.token, httpOptions: { apiVersion: "v1alpha" } });
      const session = await ai.live.connect({
        model: tokenJson.model,
        config: {},
        callbacks: {
          onmessage: onMessage,
          onerror: () => {
            setError("The connection dropped.");
            void finish();
          },
          onclose: () => {
            if (!finishingRef.current) void finish();
          },
        },
      });
      sessionRef.current = session;

      node.port.onmessage = (e: MessageEvent<{ pcm: ArrayBuffer; level: number }>) => {
        setMicLevel(e.data.level);
        sessionRef.current?.sendRealtimeInput({ audio: { data: toBase64(e.data.pcm), mimeType: "audio/pcm;rate=16000" } });
      };

      const levels = new Uint8Array(analyser.frequencyBinCount);
      const meter = window.setInterval(() => {
        analyser.getByteFrequencyData(levels);
        setOfficerLevel(levels.reduce((a, b) => a + b, 0) / levels.length / 255);
        setElapsed(Math.floor(now() / 1000));
        const handoverAt = handoverAtRef.current;
        if (handoverAt && Date.now() > handoverAt) {
          handoverAtRef.current = null;
          referee("The applicant has passed the documents through the slot without speaking. Begin your questions.");
        }
        // An impatient officer cuts in on a long answer.
        const cutIn = behaviourRef.current?.cutInAfterSec;
        const since = answerSinceRef.current;
        if (cutIn && since && !cutInSentRef.current && !decidedRef.current && Date.now() - since > cutIn * 1000) {
          cutInSentRef.current = true;
          referee(`Cut in. The applicant has been answering for ${cutIn} seconds.`);
        }
      }, 100);

      cleanupRef.current = () => {
        window.clearInterval(meter);
        node.port.onmessage = null;
        mic.getTracks().forEach((t) => t.stop());
        void capCtx.close();
        try {
          sessionRef.current?.close();
        } catch {}
        sessionRef.current = null;
      };

      startRef.current = Date.now();
      setPhase("live");
      setStatus("");
      referee("The applicant has stepped up to your window. Greet them briefly and begin.");
    } catch (e) {
      cleanupRef.current();
      setPhase("error");
      setError(e instanceof Error ? e.message : "Couldn't start. Check your microphone permission.");
    }
  }

  // Time limits: nudge the officer to decide, then hard-stop.
  useEffect(() => {
    if (phase !== "live") return;
    if (elapsed >= props.targetDurationSec + 15 && !wrapSentRef.current) {
      wrapSentRef.current = true;
      referee("Time is up. Call end_interview now.");
    }
    if (elapsed >= props.targetDurationSec + 75) void finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, phase]);

  useEffect(() => () => cleanupRef.current(), []);

  const bars = 40;
  return (
    <div className="flex min-h-[100dvh] flex-col bg-paper">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:py-10">
        <div className="doc relative flex flex-1 flex-col overflow-hidden">
          <Guilloche className="guilloche pointer-events-none absolute -right-52 -top-52 w-[560px]" />
          <div className="relative flex items-center justify-between border-b border-ink px-5 py-3">
            <span className="label">Window 07 · {props.isFree ? "Free mock" : "Practice interview"}</span>
            <span className="label tabular" aria-label="Time at the window">
              {phase === "live" || phase === "ending" ? fmt(elapsed) : "00:00"}
            </span>
          </div>

          <div className="relative flex flex-1 flex-col justify-center px-6 py-10 sm:px-10">
            <span className="stamp w-fit text-stamp">{props.officerName}</span>
            <div className="mt-10 flex h-24 items-center gap-[3px]" aria-hidden>
              {Array.from({ length: bars }, (_, i) => {
                const h = Math.max(0.06, Math.min(1, officerLevel * 3.2 * (0.55 + 0.45 * Math.abs(Math.sin(i * 1.3 + elapsed)))));
                return <span key={i} className="w-[4px] bg-ink transition-[height] duration-100" style={{ height: `${h * 100}%` }} />;
              })}
            </div>
            <p aria-live="polite" className="font-voice mt-8 text-[clamp(1.6rem,3.2vw,2.3rem)] leading-tight">
              {phase === "ready" && "Stand up. Take a breath. When you're ready, step up to the window."}
              {phase === "connecting" && "The officer is looking at your file…"}
              {phase === "live" && (status || "Speak naturally. The officer may interrupt you, and decides when they've heard enough.")}
              {phase === "ending" && status}
              {phase === "error" && error}
            </p>
          </div>

          <div className="perforated" />
          <div className="relative flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
            {phase === "ready" || phase === "error" ? (
              <button onClick={start} className="rounded-[3px] bg-ink px-6 py-3.5 font-semibold text-on-ink hover:bg-stamp">
                Step up to the window
              </button>
            ) : phase === "live" ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="label text-muted">Your mic</span>
                  <span className="h-2 w-32 border border-ink">
                    <span className="block h-full bg-stamp" style={{ width: `${Math.min(100, micLevel * 400)}%` }} />
                  </span>
                </div>
                <button onClick={() => void finish()} className="text-sm underline underline-offset-4">
                  Leave the window
                </button>
              </>
            ) : (
              <span className="label text-muted">Saving…</span>
            )}
          </div>
        </div>
        <p className="mx-auto mt-4 max-w-md text-center text-xs text-muted">
          Practice simulation. The outcome is a training signal, not a prediction. Uses about 3–5 MB of data per minute.
        </p>
      </div>
    </div>
  );
}
