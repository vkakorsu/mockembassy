"use client";

import { useState } from "react";
import type { Flashcard } from "@/lib/domain/fact-sheet";

/** Say the answer out loud, then check it. One card at a time; later rounds are shuffled. */
export function Flashcards({ cards }: { cards: Flashcard[] }) {
  // File order first (the same on the server and in the browser), shuffled from the second round.
  const [order, setOrder] = useState(() => cards.map((_, i) => i));
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const [missed, setMissed] = useState<number[]>([]);
  if (!cards.length) return null;
  const done = i >= order.length;
  const card = cards[order[i]];

  function next(gotIt: boolean) {
    if (!gotIt) setMissed((m) => [...m, order[i]]);
    setShown(false);
    setI((n) => n + 1);
  }

  if (done) {
    return (
      <div className="text-sm">
        <p className="font-semibold">
          {missed.length ? `You missed ${missed.length} of ${cards.length}.` : `All ${cards.length} right.`}
        </p>
        {missed.length > 0 && (
          <ul className="mt-2 space-y-1 text-muted">
            {missed.map((m) => (
              <li key={m}>
                {cards[m].question} <span className="text-fg">{cards[m].answer}</span>
              </li>
            ))}
          </ul>
        )}
        <button
          onClick={() => {
            const shuffled = [...order];
            for (let k = shuffled.length - 1; k > 0; k--) {
              const j = Math.floor(Math.random() * (k + 1));
              [shuffled[k], shuffled[j]] = [shuffled[j], shuffled[k]];
            }
            setOrder(shuffled);
            setI(0);
            setMissed([]);
          }}
          className="mt-3 rounded-[3px] border border-ink px-4 py-2 font-semibold hover:bg-ink hover:text-on-ink"
        >
          Go again
        </button>
      </div>
    );
  }

  return (
    <div className="text-sm">
      <p className="label text-muted tabular">
        {i + 1} of {cards.length}
      </p>
      <p className="font-voice mt-2 text-2xl leading-tight">&ldquo;{card.question}&rdquo;</p>
      {shown ? (
        <>
          <p className="mt-3">
            On your file: <span className="font-semibold">{card.answer}</span>
          </p>
          <div className="mt-3 flex gap-2">
            <button onClick={() => next(true)} className="rounded-[3px] bg-ink px-4 py-2 font-semibold text-on-ink hover:bg-stamp">
              I said that
            </button>
            <button onClick={() => next(false)} className="rounded-[3px] border border-ink px-4 py-2 font-semibold hover:bg-ink hover:text-on-ink">
              I didn&rsquo;t
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-3 text-muted">Answer out loud first, in one short sentence.</p>
          <button onClick={() => setShown(true)} className="mt-3 rounded-[3px] border border-ink px-4 py-2 font-semibold hover:bg-ink hover:text-on-ink">
            Show what&rsquo;s on my file
          </button>
        </>
      )}
    </div>
  );
}
