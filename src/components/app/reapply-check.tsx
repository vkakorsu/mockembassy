"use client";

import { useState } from "react";
import type { VisaType } from "@/lib/domain/case";
import { CHANGE_OPTIONS, reapplyAdvice } from "@/lib/domain/reapply";

const TONE = { reapply: "border-approved text-approved", risky: "border-stamp text-accent", wait: "border-refused text-refused" } as const;

/** Tick what has really changed since the refusal; the advice updates as you go. Nothing is saved. */
export function ReapplyCheck({ visaType }: { visaType: VisaType }) {
  const [selected, setSelected] = useState<string[]>([]);
  const advice = reapplyAdvice(selected);
  const options = CHANGE_OPTIONS.filter((o) => !o.visa || o.visa === visaType);
  return (
    <div className="text-sm">
      <ul className="space-y-2">
        {options.map((o) => (
          <li key={o.id}>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={selected.includes(o.id)}
                onChange={(e) => setSelected((s) => (e.target.checked ? [...s, o.id] : s.filter((x) => x !== o.id)))}
              />
              <span>{o.label}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className={`mt-4 border-l-4 pl-4 ${TONE[advice.verdict]}`} aria-live="polite">
        <p className="font-semibold">{advice.title}</p>
        <p className="mt-1 text-fg">{advice.body}</p>
      </div>
    </div>
  );
}
