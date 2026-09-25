"use client";

import { useActionState } from "react";
import { confirmProfile, type ConfirmState } from "@/app/app/actions";
import { Button, Field, inputCls } from "./ui";

type V = Record<string, unknown>;
const get = (o: V | undefined, path: string): string => {
  const v = path.split(".").reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as V)[k] : undefined), o);
  return v === undefined || v === null ? "" : Array.isArray(v) ? v.join(", ") : String(v);
};

export function ProfileForm({ caseId, visaType, values }: { caseId: string; visaType: "F1" | "B1B2"; values: V }) {
  const [state, action, pending] = useActionState<ConfirmState, FormData>(confirmProfile.bind(null, caseId), {});
  const v = (p: string) => get(values, p);
  const sponsor = ((values.funding as V | undefined)?.sponsors as V[] | undefined)?.[0];
  const contact = (values.usContacts as V[] | undefined)?.[0];
  const refusal = ((values.history as V | undefined)?.priorRefusals as V[] | undefined)?.[0];
  const section = "grid gap-4 sm:grid-cols-2";
  const h = "font-display col-span-full mt-6 text-2xl first:mt-0";

  return (
    <form action={action} className={section}>
      <h2 className={h}>You</h2>
      <Field label="First name"><input name="applicant.firstName" defaultValue={v("applicant.firstName")} className={inputCls} required /></Field>
      <Field label="Age"><input name="applicant.age" type="number" min={10} max={110} defaultValue={v("applicant.age")} className={inputCls} required /></Field>
      <Field label="Marital status">
        <select name="applicant.maritalStatus" defaultValue={v("applicant.maritalStatus") || "single"} className={inputCls}>
          <option value="single">Single</option><option value="married">Married</option><option value="divorced">Divorced</option><option value="widowed">Widowed</option>
        </select>
      </Field>
      <Field label="Children"><input name="applicant.children" type="number" min={0} defaultValue={v("applicant.children") || "0"} className={inputCls} /></Field>
      <Field label="City you live in"><input name="applicant.city" defaultValue={v("applicant.city")} className={inputCls} required /></Field>

      {visaType === "F1" ? (
        <>
          <h2 className={h}>Your studies</h2>
          <Field label="School"><input name="study.school" defaultValue={v("study.school")} className={inputCls} required /></Field>
          <Field label="Program"><input name="study.program" defaultValue={v("study.program")} className={inputCls} required /></Field>
          <Field label="Level">
            <select name="study.level" defaultValue={v("study.level") || "masters"} className={inputCls}>
              <option value="undergraduate">Undergraduate</option><option value="masters">Master&rsquo;s</option><option value="phd">PhD</option><option value="certificate">Certificate</option>
            </select>
          </Field>
          <Field label="Start term"><input name="study.startTerm" defaultValue={v("study.startTerm")} placeholder="Fall 2027" className={inputCls} /></Field>
          <Field label="I-20 first-year cost (USD)"><input name="study.i20Year1CostUsd" type="number" min={0} defaultValue={v("study.i20Year1CostUsd")} className={inputCls} required /></Field>
          <Field label="What you do now"><input name="study.currentOccupation" defaultValue={v("study.currentOccupation")} className={inputCls} /></Field>
          <div className="col-span-full">
            <Field label="Your honest plan after graduating" hint="Only used for coaching, in your words. Never shown to the officer as a fact they 'know'.">
              <textarea name="study.postStudyPlan" defaultValue={v("study.postStudyPlan")} rows={2} maxLength={400} className={inputCls} />
            </Field>
          </div>
        </>
      ) : (
        <>
          <h2 className={h}>Your trip</h2>
          <div className="col-span-full"><Field label="Purpose"><input name="visit.purpose" defaultValue={v("visit.purpose")} className={inputCls} required /></Field></div>
          <Field label="Length of stay (days)"><input name="visit.durationDays" type="number" min={1} max={365} defaultValue={v("visit.durationDays")} className={inputCls} required /></Field>
          <Field label="Who you're visiting"><input name="visit.hostRelationship" defaultValue={v("visit.hostRelationship")} placeholder="daughter" className={inputCls} /></Field>
          <Field label="Their city"><input name="visit.hostCity" defaultValue={v("visit.hostCity")} className={inputCls} /></Field>
        </>
      )}

      <h2 className={h}>Money</h2>
      <Field label="Sponsor (relationship)" hint="e.g. self, father, employer"><input name="sponsor.relationship" defaultValue={String(sponsor?.relationship ?? "")} className={inputCls} /></Field>
      <Field label="Sponsor's occupation"><input name="sponsor.occupation" defaultValue={String(sponsor?.occupation ?? "")} className={inputCls} /></Field>
      <Field label="Sponsor's yearly income (USD)"><input name="sponsor.annualIncomeUsd" type="number" min={0} defaultValue={String(sponsor?.annualIncomeUsd ?? "")} className={inputCls} /></Field>
      <Field label="Documented funds available (USD)"><input name="funding.liquidFundsUsd" type="number" min={0} defaultValue={v("funding.liquidFundsUsd")} className={inputCls} required /></Field>
      <Field label="Any large recent deposit (USD)"><input name="funding.recentLargeDepositUsd" type="number" min={0} defaultValue={v("funding.recentLargeDepositUsd")} className={inputCls} /></Field>

      <h2 className={h}>Ties to Ghana</h2>
      <Field label="Employer"><input name="ties.employer" defaultValue={v("ties.employer")} className={inputCls} /></Field>
      <Field label="Role"><input name="ties.role" defaultValue={v("ties.role")} className={inputCls} /></Field>
      <Field label="Years there"><input name="ties.yearsEmployed" type="number" min={0} step="0.5" defaultValue={v("ties.yearsEmployed")} className={inputCls} /></Field>
      <div className="flex flex-col justify-end gap-2 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="ties.ownsBusiness" defaultChecked={v("ties.ownsBusiness") === "true"} /> I own a business</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="ties.ownsProperty" defaultChecked={v("ties.ownsProperty") === "true"} /> I own property</label>
      </div>

      <h2 className={h}>History</h2>
      <Field label="Previous US visits"><input name="history.priorUsVisits" type="number" min={0} defaultValue={v("history.priorUsVisits") || "0"} className={inputCls} /></Field>
      <Field label="Other countries visited" hint="Comma-separated"><input name="history.otherCountriesVisited" defaultValue={v("history.otherCountriesVisited")} className={inputCls} /></Field>
      <Field label="Previous US visa refusal (year)"><input name="refusal.year" type="number" min={1990} max={2100} defaultValue={String(refusal?.year ?? "")} className={inputCls} /></Field>
      <Field label="Refusal section">
        <select name="refusal.section" defaultValue={String(refusal?.section ?? "214b")} className={inputCls}>
          <option value="214b">214(b)</option><option value="221g">221(g)</option><option value="other">Other</option>
        </select>
      </Field>
      <Field label="Relative in the US (relationship)" hint="As on your DS-160"><input name="usContact.relationship" defaultValue={String(contact?.relationship ?? "")} className={inputCls} /></Field>
      <Field label="Their city"><input name="usContact.city" defaultValue={String(contact?.city ?? "")} className={inputCls} /></Field>
      <Field label="Their status">
        <select name="usContact.status" defaultValue={String(contact?.status ?? "unknown")} className={inputCls}>
          <option value="unknown">Not sure</option><option value="citizen">US citizen</option><option value="green_card">Green card</option><option value="visa_holder">Visa holder</option>
        </select>
      </Field>

      <div className="col-span-full mt-6 flex flex-wrap items-center gap-4">
        <Button disabled={pending}>{pending ? "Saving…" : "These facts are true. Confirm."}</Button>
        {state.error && <p role="alert" className="text-sm text-refused">{state.error}</p>}
      </div>
    </form>
  );
}
