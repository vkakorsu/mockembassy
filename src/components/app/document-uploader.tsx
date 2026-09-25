"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { registerDocument } from "@/app/app/actions";
import { createClient } from "@/lib/supabase/browser";
import { Button, Field, inputCls } from "./ui";

const KINDS: { value: string; label: string; visa?: "F1" | "B1B2" }[] = [
  { value: "ds160", label: "DS-160 confirmation or answers" },
  { value: "i20", label: "I-20", visa: "F1" },
  { value: "admission_letter", label: "Admission letter", visa: "F1" },
  { value: "bank_statement", label: "Bank statement" },
  { value: "sponsor_letter", label: "Sponsor letter" },
  { value: "employment_letter", label: "Employment letter" },
  { value: "business_registration", label: "Business registration" },
  { value: "property", label: "Property document" },
  { value: "invitation_letter", label: "Invitation letter", visa: "B1B2" },
  { value: "refusal_letter", label: "Previous refusal letter" },
  { value: "appointment_confirmation", label: "Appointment confirmation" },
  { value: "passport_travel_page", label: "Passport travel history page" },
  { value: "other", label: "Other" },
];

export function DocumentUploader(props: { caseId: string; userId: string; visaType: "F1" | "B1B2"; supabaseUrl: string; publishableKey: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const file = form.get("file") as File | null;
    const kind = String(form.get("kind"));
    if (!file || file.size === 0) return;
    if (file.size > 10 * 1024 * 1024) return setError("Files must be under 10 MB.");
    setBusy(true);
    setError(null);
    try {
      const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${props.userId}/${props.caseId}/${crypto.randomUUID()}.${ext}`;
      const supabase = createClient(props.supabaseUrl, props.publishableKey);
      const { error: upErr } = await supabase.storage.from("documents").upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      await registerDocument(props.caseId, kind, path);
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <Field label="What is it?">
        <select name="kind" className={inputCls}>
          {KINDS.filter((k) => !k.visa || k.visa === props.visaType).map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="File" hint="PDF or photo, up to 10 MB. Raw files are deleted after 30 days.">
        <input name="file" type="file" required accept="application/pdf,image/jpeg,image/png,image/webp,image/heic" className={inputCls} />
      </Field>
      <Button disabled={busy}>{busy ? "Uploading…" : "Upload and read"}</Button>
      {error && <p role="alert" className="text-sm text-refused">{error}</p>}
    </form>
  );
}
