"use client";

import { useSyncExternalStore } from "react";
import { createCase } from "@/app/app/actions";
import { SCAN_STORAGE_KEY } from "@/components/quick-scan";
import { Button, Field, inputCls } from "./ui";

function readScan(): string | null {
  try {
    return localStorage.getItem(SCAN_STORAGE_KEY);
  } catch {
    return null;
  }
}
const subscribe = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
};

/** New case; if the person did the free Case Scan in this browser, their answers come along as a draft. */
export function NewCaseForm() {
  const raw = useSyncExternalStore(subscribe, readScan, () => null);
  let scan: { draft?: { visaType?: "F1" | "B1B2" } } | null = null;
  try {
    scan = raw ? JSON.parse(raw) : null;
  } catch {}

  return (
    <form
      action={createCase}
      onSubmit={() => {
        try {
          localStorage.removeItem(SCAN_STORAGE_KEY);
        } catch {}
      }}
      className="mt-5 grid gap-4"
    >
      {scan?.draft && (
        <>
          <input type="hidden" name="scan" value={JSON.stringify(scan.draft)} />
          <p className="rounded-[3px] border border-stamp px-3 py-2 text-sm">
            Your Case Scan answers will be filled in. You&rsquo;ll still confirm every fact.
          </p>
        </>
      )}
      <Field label="Applicant's name" hint="As on the passport.">
        <input name="applicantName" required maxLength={80} className={inputCls} />
      </Field>
      <Field label="Visa">
        <select name="visaType" defaultValue={scan?.draft?.visaType ?? "F1"} key={scan?.draft?.visaType ?? "none"} className={inputCls}>
          <option value="F1">F-1 student</option>
          <option value="B1B2">B1/B2 visitor</option>
        </select>
      </Field>
      <Field label="Interview date (if booked)">
        <input name="interviewDate" type="date" className={inputCls} />
      </Field>
      <Button type="submit">Create case</Button>
    </form>
  );
}
