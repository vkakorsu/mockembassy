"use client";

import { FunctionResponseScheduling, GoogleGenAI, type LiveServerMessage, type Session } from "@google/genai";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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

  const bars = 32;
  return (
    <div className="grain relative flex min-h-[100dvh] flex-col bg-ink text-white">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:py-10">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-white/60">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">{props.officerName}</span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 font-mono tabular">
            {phase === "live" ? fmt(elapsed) : props.isFree ? "Free · 01:30" : "Window 7"}
          </span>
        </div>

        <div className="window-frame mt-8 flex-1">
          <div className="relative flex h-full min-h-[340px] flex-col items-center justify-center overflow-hidden rounded-[18px]">
            <div className="window-room" aria-hidden />
            <div aria-hidden className="absolute bottom-0 left-1/2 h-[60%] w-[46%] -translate-x-1/2">
              <div className="mx-auto h-[34%] w-[42%] rounded-full bg-[#0a0f18]/85" />
              <div className="mx-auto -mt-[4%] h-[70%] w-full rounded-t-[45%] bg-[#0a0f18]/90" />
            </div>
            <div className="window-glass" aria-hidden style={{ ["--frost" as string]: "10px" }} />
            <div className="relative flex h-16 items-center gap-[3px]" aria-hidden>
              {Array.from({ length: bars }, (_, i) => {
                const h = Math.max(0.08, Math.min(1, officerLevel * 3.2 * (0.6 + 0.4 * Math.sin(i * 1.7 + elapsed))));
                return <span key={i} className="w-[3px] rounded-full bg-gold transition-[height] duration-100" style={{ height: `${h * 100}%` }} />;
              })}
            </div>
            <p aria-live="polite" className="relative mt-6 px-6 text-center text-sm text-white/70">
              {phase === "ready" && "Stand up, take a breath. When you're ready, step up to the window."}
              {phase === "connecting" && "Opening the window…"}
              {phase === "live" && (status || "Speak naturally. The officer can interrupt you.")}
              {phase === "ending" && status}
              {phase === "error" && error}
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center gap-4">
          {phase === "ready" || phase === "error" ? (
            <button onClick={start} className="rounded-full bg-gold px-8 py-4 font-medium text-ink transition hover:brightness-110">
              Step up to the window
            </button>
          ) : phase === "live" ? (
            <>
              <div className="flex items-center gap-3 text-xs text-white/50">
                <span>Your mic</span>
                <span className="h-1.5 w-32 overflow-hidden rounded-full bg-white/10">
                  <span className="block h-full rounded-full bg-white/70" style={{ width: `${Math.min(100, micLevel * 400)}%` }} />
                </span>
              </div>
              <button onClick={() => void finish()} className="text-sm text-white/50 underline-offset-4 hover:text-white hover:underline">
                Leave the window
              </button>
            </>
          ) : null}
          <p className="max-w-md text-center text-xs text-white/40">
            Practice simulation. The outcome is a training signal, not a prediction. Uses about 3–5 MB of data per minute.
          </p>
        </div>
      </div>
    </div>
  );
}
