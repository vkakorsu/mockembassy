import Link from "next/link";
import { startDrill } from "@/app/app/actions";
import type { VisaType } from "@/lib/domain/case";
import { CLAIM_LABELS, claimProbe, type StoryChange } from "@/lib/domain/story";
import { formatDate } from "@/lib/labels";
import { Button, Card } from "./ui";

/**
 * Facts that changed between sessions (src/lib/domain/story.ts). At the real
 * window a story that shifts is fatal; here it's a note to settle the truth.
 */
export function StoryChanges({ caseId, visaType, changes }: { caseId: string; visaType: VisaType; changes: readonly StoryChange[] }) {
  const open = changes.filter((c) => c.open);
  if (!open.length) return null;
  return (
    <Card className="border-refused">
      <h2 className="font-display text-2xl uppercase">Your story changed</h2>
      <p className="mt-1 text-sm text-muted">
        You gave different answers about the same fact in different interviews. Officers treat a changing story as a sign that
        something isn&rsquo;t true. Settle on the true answer, make sure your DS-160 says the same, and give it every time.
      </p>
      <ul className="mt-4 divide-y divide-line">
        {open.map((c) => {
          const probe = claimProbe(c.key, visaType);
          return (
            <li key={`${c.key}-${c.after.sessionId}`} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <span className="min-w-0 flex-1">
                <span className="font-semibold">{CLAIM_LABELS[c.key][0].toUpperCase() + CLAIM_LABELS[c.key].slice(1)}</span>
                <span className="mt-0.5 block">
                  <Link href={`/app/sessions/${c.before.sessionId}/debrief`} className="underline underline-offset-2">
                    &ldquo;{c.before.value}&rdquo;
                  </Link>{" "}
                  <span className="text-muted">({formatDate(c.before.at)})</span> →{" "}
                  <Link href={`/app/sessions/${c.after.sessionId}/debrief`} className="underline underline-offset-2">
                    &ldquo;{c.after.value}&rdquo;
                  </Link>{" "}
                  <span className="text-muted">({formatDate(c.after.at)})</span>
                </span>
              </span>
              {probe && (
                <form action={startDrill.bind(null, caseId, probe)}>
                  <Button variant="ghost">Drill it ▸</Button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
