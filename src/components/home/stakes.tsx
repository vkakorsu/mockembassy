const stats = [
  {
    value: "81%",
    label: "of Ghanaian F-1 student visa applications were refused in 2025, a record.",
    source: { name: "ICEF Monitor", href: "https://monitor.icef.com/2026/04/visa-rejections-climb-in-the-us-for-international-students-from-key-markets-including-india/" },
  },
  {
    value: "~2.5 min",
    label: "is roughly how long an officer has to hear your case and decide.",
    source: { name: "Kuck Baxter", href: "https://immigration.net/2026/08/10/why-your-visa-interview-is-only-2-5-minutes-long/" },
  },
  {
    value: "$785",
    label: "in government fees for an F-1 applicant: MRV, SEVIS and the new integrity fee.",
    source: { name: "Manifest Law", href: "https://manifestlaw.com/blog/immigration/news/visa-integrity-fee/" },
  },
];

export function Stakes() {
  return (
    <section aria-labelledby="stakes-title" className="border-b border-line">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-8 lg:py-28">
        <h2 id="stakes-title" className="reveal font-display max-w-3xl text-[clamp(2.2rem,4.6vw,3.8rem)]">
          The interview is short. <span className="text-muted">The stakes aren&rsquo;t.</span>
        </h2>
        <dl className="mt-14 grid gap-px overflow-hidden rounded-3xl border border-line bg-line sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.value} className="reveal bg-raised p-7 sm:p-9">
              <dt className="sr-only">{s.label}</dt>
              <dd>
                <p className="font-display text-6xl tabular text-accent sm:text-7xl">{s.value}</p>
                <p className="mt-4 leading-relaxed text-fg">{s.label}</p>
                <a
                  href={s.source.href}
                  rel="noopener"
                  target="_blank"
                  className="mt-4 inline-block text-xs text-muted underline-offset-4 hover:underline"
                >
                  Source: {s.source.name}
                </a>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
