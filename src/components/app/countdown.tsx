"use client";

import { useState } from "react";
import { countdownLabel } from "@/lib/countdown";

/**
 * The interview countdown at the top of a case, and where the date is set or
 * changed. The date is only for the countdown; it never affects what can be used.
 */
export function Countdown({
  interviewAt,
  days,
  setDate,
}: {
  interviewAt: string | null;
  days: number | null;
  setDate: (formData: FormData) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);

  if (editing || !interviewAt || days === null) {
    return (
      <form action={setDate} className="doc flex flex-wrap items-end gap-2 px-4 py-3">
        <label className="grid gap-1">
          <span className="label text-muted">Interview date</span>
          <input
            name="interviewDate"
            type="date"
            required
            defaultValue={interviewAt ? interviewAt.slice(0, 10) : ""}
            className="rounded-[3px] border border-ink bg-card px-3 py-2 text-base"
          />
        </label>
        <button className="rounded-[3px] bg-ink px-4 py-2 text-sm font-semibold text-on-ink hover:bg-stamp">Save</button>
        {interviewAt && (
          <button type="button" onClick={() => setEditing(false)} className="px-2 py-2 text-sm underline underline-offset-4">
            Cancel
          </button>
        )}
      </form>
    );
  }

  const urgent = days >= 0 && days <= 7;
  return (
    <div className={`doc px-5 py-3 text-right ${urgent ? "border-2 border-refused" : ""}`}>
      <p className={`font-display text-4xl uppercase tabular sm:text-5xl ${urgent ? "text-refused" : ""}`}>
        {days > 1 ? (
          <>
            {days} <span className="text-2xl sm:text-3xl">days</span>
          </>
        ) : (
          countdownLabel(days).replace("Interview ", "")
        )}
      </p>
      <p className="label mt-1 text-muted">
        {days >= 0 ? `to your interview · ${new Date(interviewAt).toDateString()}` : `interview was ${new Date(interviewAt).toDateString()}`}
      </p>
      <button type="button" onClick={() => setEditing(true)} className="mt-1 text-xs underline underline-offset-4">
        Change date
      </button>
    </div>
  );
}
