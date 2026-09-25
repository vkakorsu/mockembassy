import type { CaseFlag } from "@/lib/domain/case-scan";

const severityStyle: Record<CaseFlag["severity"], string> = {
  high: "bg-refused/10 text-refused",
  medium: "bg-gold/15 text-accent",
  low: "bg-fg/5 text-muted",
};

function Step({ n, title, body, children }: { n: string; title: string; body: string; children: React.ReactNode }) {
  return (
    <li className="reveal grid gap-8 border-t border-line py-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:py-16">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">{n}</p>
        <h3 className="font-display mt-3 text-[clamp(2rem,3.6vw,3rem)]">{title}</h3>
        <p className="mt-4 max-w-md text-lg leading-relaxed text-muted">{body}</p>
      </div>
      <div className="rounded-3xl border border-line bg-raised p-5 sm:p-7">{children}</div>
    </li>
  );
}

export function HowItWorks({ flags }: { flags: CaseFlag[] }) {
  return (
    <section id="how" aria-labelledby="how-title" className="scroll-mt-8">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-8 lg:py-28">
        <p className="text-sm uppercase tracking-[0.2em] text-accent">How it works</p>
        <h2 id="how-title" className="font-display mt-3 max-w-3xl text-[clamp(2.2rem,4.6vw,3.8rem)]">
          Your case. Your officer. Your honest debrief.
        </h2>
        <ol className="mt-12">
          <Step
            n="01 · Case"
            title="Upload what the officer will see"
            body="Your DS-160, I-20, bank statements, letters. We extract the facts, you confirm them, and the Case Scan shows where the officer is likely to press. No approval percentages."
          >
            <p className="text-sm text-muted">Case Scan · Ama, F-1 · sample</p>
            <ul className="mt-4 space-y-3">
              {flags.slice(0, 4).map((f) => (
                <li key={f.id} className="flex items-start gap-3 rounded-2xl border border-line p-4">
                  <span className={`mt-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider ${severityStyle[f.severity]}`}>
                    {f.severity}
                  </span>
                  <span>
                    <span className="block font-medium">{f.title}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-muted">{f.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Step>
          <Step
            n="02 · Window"
            title="Stand at the window, out loud"
            body="A real-time voice officer who has read your file. They interrupt, pause to type, ask for a document, follow up on what you volunteer, and decide, sometimes after two questions."
          >
            <div className="rounded-2xl border border-white/10 bg-ink p-5 text-white">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-white/60">
                <span>Officer Kessler</span>
                <span className="font-mono tabular">01:12</span>
              </div>
              <p className="font-display mt-6 text-3xl leading-tight">&ldquo;Your I-20 says about $52,000 for the first year. Where is that money coming from?&rdquo;</p>
              <p className="mt-6 text-sm text-white/55">You answer. They cut in at 22 seconds.</p>
            </div>
          </Step>
          <Step
            n="03 · Debrief"
            title="Hear what the officer heard"
            body="Every answer is scored for directness, specificity, consistency with your documents, and length. Then you see a stronger version built only from your own true facts."
          >
            <div className="space-y-4">
              <div className="rounded-2xl border border-line p-4">
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>What you said · 41s</span>
                  <span className="rounded-full bg-refused/10 px-2 py-0.5 text-refused">Too long · vague</span>
                </div>
                <p className="mt-2 leading-relaxed text-muted">
                  &ldquo;So, um, my father, he has been in business for a long time, and also my uncle might help,
                  and I have been saving too, so I think it will be fine…&rdquo;
                </p>
              </div>
              <div className="rounded-2xl border border-approved/30 bg-approved/5 p-4">
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>Your answer, stronger · 12s</span>
                  <span className="rounded-full bg-approved/10 px-2 py-0.5 text-approved">Only your facts</span>
                </div>
                <p className="mt-2 leading-relaxed">
                  &ldquo;My father pays. He&rsquo;s a cocoa exporter earning about $60,000 a year, and $41,000 is
                  already in the account.&rdquo;
                </p>
                <p className="mt-2 text-sm text-muted">The $11,000 gap to the I-20 still needs evidence. We tell you that plainly.</p>
              </div>
            </div>
          </Step>
          <Step
            n="04 · Readiness"
            title="Know when you're actually ready"
            body="Readiness only turns green after different officers, including a tough one, have tested everything relevant to your case. Repeating easy sessions won't move it."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { name: "Officer Harper", note: "Brisk · approved", ok: true },
                { name: "Officer Reyes", note: "Sceptical · refused", ok: false },
                { name: "Officer Park", note: "Silent · approved", ok: true },
              ].map((o) => (
                <div key={o.name} className="rounded-2xl border border-line p-4">
                  <span className={`block size-2 rounded-full ${o.ok ? "bg-approved" : "bg-refused"}`} />
                  <p className="mt-3 font-medium">{o.name}</p>
                  <p className="text-sm text-muted">{o.note}</p>
                </div>
              ))}
            </div>
            <div className="mt-5">
              <div className="flex justify-between text-sm">
                <span>Readiness</span>
                <span className="tabular text-muted">6 of 8 topics solid</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-fg/10">
                <div className="h-full w-3/4 rounded-full bg-gold" />
              </div>
            </div>
          </Step>
        </ol>
      </div>
    </section>
  );
}
