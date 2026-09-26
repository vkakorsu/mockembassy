import type { CaseFlag } from "@/lib/domain/case-scan";
import type { ChecklistGroup, ChecklistItem } from "@/lib/domain/checklist";

/** Shared by the free Case Scan and the case page. No hooks: works on server and client. */

const SEVERITY: Record<string, string> = {
  high: "bg-refused/10 text-refused",
  medium: "bg-stamp/10 text-accent",
  low: "bg-fg/5 text-muted",
};

export function FlagList({ flags }: { flags: CaseFlag[] }) {
  if (!flags.length) return <p className="mt-3 text-sm text-muted">Nothing stands out from these answers. The interview itself decides it.</p>;
  return (
    <ul className="mt-4 space-y-3">
      {flags.map((f) => (
        <li key={f.id} className="flex items-start gap-3 rounded-[4px] border border-line p-4">
          <span className={`mt-0.5 rounded-[3px] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider ${SEVERITY[f.severity]}`}>{f.severity}</span>
          <span>
            <span className="block font-medium">{f.title}</span>
            <span className="mt-1 block text-sm text-muted">{f.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function QuestionList({ questions }: { questions: { id: string; question: string; key: boolean }[] }) {
  return (
    <ol className="mt-4 space-y-2.5">
      {questions.map((q, i) => (
        <li key={q.id} className="flex gap-3">
          <span className="label mt-1 w-5 shrink-0 text-muted">{String(i + 1).padStart(2, "0")}</span>
          <span className="font-voice text-lg leading-snug">
            &ldquo;{q.question}&rdquo;
            {q.key && <span className="label ml-2 not-italic text-stamp">key</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

const GROUP_NOTE: Record<ChecklistGroup, string> = {
  Required: "Without these you may not get to the window.",
  "Likely to be asked for": "Have them in order, on top.",
  "Good to have": "In the folder, in case.",
};

/**
 * @param uploaded document kinds already uploaded (ticked), when known.
 */
export function Checklist({ items, uploaded }: { items: ChecklistItem[]; uploaded?: readonly string[] }) {
  const groups = [...new Set(items.map((i) => i.group))];
  return (
    <div className="mt-4 space-y-6">
      {groups.map((g) => (
        <div key={g}>
          <p className="label text-fg">{g}</p>
          <p className="mt-0.5 text-xs text-muted">{GROUP_NOTE[g]}</p>
          <ul className="mt-2 divide-y divide-line">
            {items
              .filter((i) => i.group === g)
              .map((i) => {
                const have = Boolean(uploaded && i.docKind && uploaded.includes(i.docKind));
                return (
                  <li key={i.id} className="flex gap-3 py-2.5 text-sm">
                    <span aria-hidden className={`mt-0.5 grid size-4 shrink-0 place-items-center border border-ink text-[10px] ${have ? "bg-stamp text-on-ink" : ""}`}>
                      {have ? "✓" : ""}
                    </span>
                    <span className="min-w-0">
                      <span className="block">
                        {i.label}
                        {have && <span className="label ml-2 text-stamp">uploaded</span>}
                      </span>
                      <span className="block text-xs text-muted">{i.why}</span>
                    </span>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
      <p className="text-xs text-muted">
        Officers rarely look at supporting documents; your answers decide most interviews. Don&rsquo;t hand anything over unless
        you&rsquo;re asked. Originals, not copies.
      </p>
    </div>
  );
}
