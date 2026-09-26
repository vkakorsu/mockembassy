"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

/**
 * Plays back one answer from the session recording. One <audio> element for
 * the page; each answer's button seeks to its segment and stops at its end.
 */
const Ctx = createContext<{ play: (id: number, startMs: number, endMs: number) => void; playing: number | null } | null>(null);

export function AnswerAudioProvider({ src, children }: { src: string; children: React.ReactNode }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const stopAt = useRef<number | null>(null);
  const [playing, setPlaying] = useState<number | null>(null);

  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const onTime = () => {
      if (stopAt.current !== null && a.currentTime >= stopAt.current) {
        a.pause();
        stopAt.current = null;
        setPlaying(null);
      }
    };
    const onPause = () => setPlaying(null);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("pause", onPause);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("pause", onPause);
    };
  }, []);

  function play(id: number, startMs: number, endMs: number) {
    const a = audio.current;
    if (!a) return;
    if (playing === id) {
      a.pause();
      return;
    }
    a.currentTime = Math.max(0, startMs / 1000 - 0.3);
    stopAt.current = endMs / 1000 + 0.6;
    void a.play().then(() => setPlaying(id), () => setPlaying(null));
  }

  return (
    <Ctx.Provider value={{ play, playing }}>
      <audio ref={audio} src={src} preload="none" />
      {children}
    </Ctx.Provider>
  );
}

export function PlayAnswer({ id, startMs, endMs }: { id: number; startMs: number; endMs: number }) {
  const ctx = useContext(Ctx);
  if (!ctx) return null;
  const on = ctx.playing === id;
  return (
    <button
      type="button"
      onClick={() => ctx.play(id, startMs, endMs)}
      className="inline-flex items-center gap-2 rounded-[3px] border border-ink px-3 py-1.5 text-xs font-semibold hover:bg-ink hover:text-on-ink"
      aria-pressed={on}
    >
      <span aria-hidden>{on ? "■" : "▶"}</span> {on ? "Stop" : "Hear your answer"}
    </button>
  );
}
