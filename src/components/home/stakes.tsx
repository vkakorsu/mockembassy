const rows = [
  {
    value: "81%",
    label: "of Ghanaian F-1 student visa applications were refused in 2025, a record high",
    source: { name: "ICEF Monitor", href: "https://monitor.icef.com/2026/04/visa-rejections-climb-in-the-us-for-international-students-from-key-markets-including-india/" },
  },
  {
    value: "No clock",
    label: "Interviews have no fixed length. Some end after two questions; others dig into your funding, family and plans. Officers often decide in the first minute",
    source: { name: "VisaMet", href: "https://visamet.com/guides/us-visa-interview-questions-2026-guide" },
  },
  {
    value: "$785",
    label: "in US government fees for an F-1 applicant: MRV, SEVIS and the new visa integrity fee",
    source: { name: "Manifest Law", href: "https://manifestlaw.com/blog/immigration/news/visa-integrity-fee/" },
  },
];

export function Stakes() {
  return (
    <section aria-labelledby="stakes-title" className="border-b border-ink">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-8 lg:grid-cols-12 lg:py-28">
        <div className="lg:col-span-4">
          <p className="label text-muted">Part 01 / 05</p>
          <h2 id="stakes-title" className="font-display mt-3 text-[clamp(2.4rem,4.6vw,4rem)] uppercase">
            Short interview. Long consequences.
          </h2>
        </div>
        <dl className="lg:col-span-8">
          {rows.map((r) => (
            <div key={r.value} className="grid gap-2 border-t border-ink py-7 first:border-t-2 sm:grid-cols-[minmax(9rem,14rem)_1fr] sm:gap-8">
              <dt className="font-display text-6xl tabular sm:text-7xl">{r.value}</dt>
              <dd>
                <p className="text-lg leading-snug">{r.label}.</p>
                <a href={r.source.href} rel="noopener" target="_blank" className="label mt-3 inline-block text-muted underline-offset-4 hover:underline">
                  Source: {r.source.name}
                </a>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
