const nevers = [
  { title: "Approval percentages", body: "A 214(b) decision depends on your real case. Anyone quoting your odds is guessing." },
  { title: "Scripts to memorise", body: "Officers hear memorised answers all day. We train you to say your own true case, briefly." },
  { title: "Invented facts", body: "A stronger answer may only use facts you've confirmed. Misrepresentation can bar you for life." },
  { title: "Pretending to be the embassy", body: "Okwan is independent. No seals, no flags, no borrowed authority." },
];

export function Principles() {
  return (
    <section aria-labelledby="principles-title" className="border-b border-ink">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-8 lg:grid-cols-12 lg:py-28">
        <div className="lg:col-span-4">
          <p className="label text-muted">Our terms</p>
          <h2 id="principles-title" className="font-display mt-3 text-[clamp(2.4rem,4.6vw,4rem)] uppercase">
            What we will never sell you.
          </h2>
          <div className="kente-rule mt-8 w-32" aria-hidden />
        </div>
        <ul className="lg:col-span-8">
          {nevers.map((n) => (
            <li key={n.title} className="grid gap-3 border-t border-ink py-6 first:border-t-2 sm:grid-cols-[9rem_1fr] sm:items-baseline">
              <span className="stamp w-fit text-refused">Never</span>
              <div>
                <p className="text-xl font-semibold">{n.title}</p>
                <p className="mt-1 leading-relaxed text-muted">{n.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
