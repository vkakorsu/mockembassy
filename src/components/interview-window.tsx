"use client";

import { useEffect, useRef, useState } from "react";

export interface WindowLine {
  officer: string;
  question: string;
  /** Optional pre-rendered officer audio (Gemini 3.8 Flash TTS, see scripts/). */
  audioSrc?: string;
}

const BARS = 28;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function InterviewWindow({ lines }: { lines: WindowLine[] }) {
  const [index, setIndex] = useState(-1);
  const [chars, setChars] = useState(0);
  const [asked, setAsked] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const line = index >= 0 ? lines[index % lines.length] : null;
  const shown = line ? line.question.slice(0, chars) : "";
  const speaking = line !== null && chars < line.question.length;
  const frost = Math.max(3, 18 - asked * 5);

  // Type the question out; only setState from the timer callback.
  useEffect(() => {
    if (!line || chars >= line.question.length) return;
    const timer = window.setTimeout(() => setChars((c) => c + 1), 34);
    return () => window.clearTimeout(timer);
  }, [line, chars]);

  function ask() {
    const next = lines[(index + 1) % lines.length];
    setIndex((i) => i + 1);
    setAsked((n) => n + 1);
    setChars(prefersReducedMotion() ? next.question.length : 0);
    if (next.audioSrc) {
      audioRef.current?.pause();
      audioRef.current = new Audio(next.audioSrc);
      audioRef.current.play().catch(() => {});
    }
  }

  return (
    <div className="window-frame w-full" style={{ ["--frost" as string]: `${frost}px` }}>
      <div className="relative aspect-[4/5] overflow-hidden rounded-[18px] sm:aspect-[5/4]">
        <div className="window-room" aria-hidden />
        {/* Silhouette of the officer behind the glass */}
        <div aria-hidden className="absolute bottom-0 left-1/2 h-[62%] w-[46%] -translate-x-1/2">
          <div className="mx-auto h-[34%] w-[42%] rounded-full bg-[#0a0f18]/80" />
          <div className="mx-auto -mt-[4%] h-[70%] w-full rounded-t-[45%] bg-[#0a0f18]/85" />
        </div>
        <div className="window-glass" aria-hidden />
        <div className="window-sheen" aria-hidden />

        {/* Name plate */}
        <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-white/70 backdrop-blur">
          <span className={`size-1.5 rounded-full ${speaking ? "bg-gold" : "bg-white/40"}`} />
          {line ? line.officer : "Window 7"}
        </div>
        <div className="absolute right-4 top-4 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 font-mono text-[11px] text-white/70 backdrop-blur tabular">
          02:30
        </div>

        {/* Question */}
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
          <div className="mb-4 flex h-8 items-center gap-[3px]" aria-hidden>
            {Array.from({ length: BARS }, (_, i) => (
              <span
                key={i}
                className="wave-bar h-full"
                style={{
                  animationDelay: `${(i * 73) % 900}ms`,
                  animationPlayState: speaking ? "running" : "paused",
                  opacity: speaking ? 1 : 0.35,
                }}
              />
            ))}
          </div>
          <p
            aria-live="polite"
            className="font-display min-h-[2.2em] text-[clamp(1.6rem,3.6vw,2.6rem)] leading-[1.05] text-white"
          >
            {line ? (
              <>
                &ldquo;{shown}
                {shown.length === line.question.length ? "”" : <span className="animate-pulse">▍</span>}
              </>
            ) : (
              <span className="text-white/60">The officer looks up from your DS&#8209;160.</span>
            )}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={ask}
              className="rounded-full bg-gold px-5 py-2.5 text-sm font-medium text-ink transition hover:brightness-110 active:scale-[0.98]"
            >
              {index < 0 ? "Ask me a question" : "Next officer"}
            </button>
            <span className="text-xs text-white/55">
              {index < 0
                ? "Every session is a different officer."
                : speaking
                  ? "Listen…"
                  : "Answer out loud, in under 20 seconds."}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
