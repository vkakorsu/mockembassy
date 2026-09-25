import type { CaseFlag } from "@/lib/domain/case-scan";

const severity: Record<CaseFlag["severity"], string> = {
  high: "text-refused",
  medium: "text-gold",
  low: "text-muted",
};

function Step({ n, title, body, children }: { n: string; title: string; body: string; children: React.ReactNode }) {
  return (
    <li className="grid gap-8 border-t border-ink py-12 lg:grid-cols-12 lg:gap-10 lg:py-16">
      <div className="lg:col-span-5">
        <p className="label text-muted">{n}</p>
        <h3 className="font-display mt-3 text-[clamp(2rem,3.4vw,3rem)] uppercase">{title}</h3>
        <p className="mt-4 max-w-md text-lg leading-relaxed">{body}</p>
      </div>
      <div className="lg:col-span-7">{children}</div>
    </li>
  );
}

export function HowItWorks({ flags }: { flags: CaseFlag[] }) {
  return (
    <section id="how" aria-labelledby="how-title" className="scroll-mt-4 border-b border-ink">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-8 lg:py-28">
        <p className="label text-muted">Part 02 / 05</p>
        <h2 id="how-title" className="font-display mt-3 max-w-4xl text-[clamp(2.4rem,4.6vw,4rem)] uppercase">
          Your case, your officer, an honest debrief.
        </h2>
        <ol className="mt-12">
          <Step
            n="Section A · Case"
            title="Upload what the officer sees"
            body="Your DS-160, I-20, bank statements and letters. We read the facts and you confirm them. The Case Scan then shows where an officer is likely to press. It never gives approval odds."
          >
            <div className="doc">
              <div className="flex items-center justify-between border-b border-ink px-5 py-3">
                <span className="label">Case scan · Sample applicant · F-1</span>
                <span className="label text-muted">{flags.length} findings</span>
              </div>
              <ul className="divide-y divide-line">
                {flags.slice(0, 4).map((f) => (
                  <li key={f.id} className="grid grid-cols-[5.5rem_1fr] gap-4 px-5 py-4">
                    <span className={`label pt-0.5 font-semibold ${severity[f.severity]}`}>{f.severity}</span>
                    <span>
                      <span className="block font-semibold">{f.title}</span>
                      <span className="mt-1 block text-sm leading-relaxed text-muted">{f.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Step>
          <Step
            n="Section B · Window"
            title="Answer out loud"
            body="A real-time voice officer who has read your file. They interrupt, pause to type, ask for a document, follow up on what you volunteer, and decide when they've heard enough."
          >
            <div className="doc p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <span className="label">Officer Kessler</span>
                <span className="label tabular text-muted">00:41</span>
              </div>
              <p className="font-voice mt-6 text-3xl leading-tight sm:text-4xl">
                &ldquo;Your I-20 says about $52,000 for the first year. Where is that money coming from?&rdquo;
              </p>
              <div className="perforated my-6" />
              <p className="text-sm text-muted">You answer. Twenty-two seconds in, the officer cuts in with a follow-up.</p>
            </div>
          </Step>
          <Step
            n="Section C · Debrief"
            title="Hear what they heard"
            body="Each answer is scored for directness, specificity, consistency with your documents and length. Then you see a stronger version, built only from your own true facts."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="doc p-5">
                <div className="flex items-center justify-between">
                  <span className="label text-muted">What you said · 41s</span>
                  <span className="stamp text-refused">Vague</span>
                </div>
                <p className="mt-4 leading-relaxed text-muted">
                  &ldquo;So, um, my father, he has been in business for a long time, and also my uncle might help, and I have
                  been saving too, so I think it will be fine…&rdquo;
                </p>
              </div>
              <div className="doc p-5">
                <div className="flex items-center justify-between">
                  <span className="label text-muted">Stronger · 12s</span>
                  <span className="stamp text-stamp">Your facts</span>
                </div>
                <p className="mt-4 leading-relaxed">
                  &ldquo;My father pays. He&rsquo;s a cocoa exporter earning about $60,000 a year, and $41,000 is already in
                  the account.&rdquo;
                </p>
                <p className="mt-3 text-sm text-muted">The $11,000 gap to the I-20 still needs evidence. We say so plainly.</p>
              </div>
            </div>
          </Step>
          <Step
            n="Section D · Readiness"
            title="Know when you're ready"
            body="Readiness only moves once different officers, including a tough one, have tested everything relevant to your case. Repeating easy sessions won't raise it."
          >
            <div className="doc">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-ink">
                    <th scope="col" className="label px-5 py-3 font-normal">Officer</th>
                    <th scope="col" className="label px-5 py-3 font-normal">Style</th>
                    <th scope="col" className="label px-5 py-3 text-right font-normal">Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {[
                    ["Harper", "Brisk", "Approved", "text-stamp"],
                    ["Reyes", "Sceptical", "214(b)", "text-refused"],
                    ["Park", "Long silences", "Approved", "text-stamp"],
                  ].map(([name, style, decision, cls]) => (
                    <tr key={name}>
                      <td className="px-5 py-3 font-semibold">{name}</td>
                      <td className="px-5 py-3 text-muted">{style}</td>
                      <td className="px-5 py-3 text-right">
                        <span className={`stamp ${cls}`}>{decision}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-ink px-5 py-4">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">Readiness</span>
                  <span className="label tabular text-muted">6 of 8 topics solid</span>
                </div>
                <div className="mt-2 h-2 border border-ink">
                  <div className="h-full w-3/4 bg-ink" />
                </div>
              </div>
            </div>
          </Step>
        </ol>
      </div>
    </section>
  );
}
