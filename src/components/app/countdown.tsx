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
      <form action={setDate} className="grid gap-2">
        <span className="label text-muted">{interviewAt ? "Change interview date" : "When is your interview?"}</span>
        <input
          name="interviewDate"
          type="date"
          required
          defaultValue={interviewAt ? interviewAt.slice(0, 10) : ""}
          className="rounded-[3px] border border-ink bg-card px-3 py-2 text-base"
        />
        <div className="flex items-center gap-3">
          <button className="rounded-[3px] bg-ink px-4 py-1.5 text-sm font-semibold text-on-ink hover:bg-stamp">Save</button>
          {interviewAt && (
            <button type="button" onClick={() => setEditing(false)} className="text-sm underline underline-offset-4">
              Cancel
            </button>
          )}
        </div>
      </form>
    );
  }

  const urgent = days >= 0 && days <= 7;
  return (
    <div className="min-w-[11rem]">
      <p className="label text-muted">{days >= 0 ? "Interview in" : "Interview"}</p>
      <p className={`font-display mt-1 text-5xl uppercase tabular ${urgent ? "text-refused" : ""}`}>
        {days > 1 ? (
          <>
            {days} <span className="text-2xl">days</span>
          </>
        ) : (
          countdownLabel(days).replace("Interview ", "")
        )}
      </p>
      <p className="mt-2 text-xs text-muted">
        {new Date(interviewAt).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
        {" · "}
        <button type="button" onClick={() => setEditing(true)} className="underline underline-offset-4 hover:text-fg">
          Change
        </button>
      </p>
    </div>
  );
}
