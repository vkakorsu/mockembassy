const nevers = [
  { title: "No approval percentages", body: "A 214(b) decision depends on your real case. Anyone quoting your odds is guessing." },
  { title: "No scripts to memorise", body: "Officers hear memorised answers all day. We train you to say your own true case, briefly." },
  { title: "No invented facts", body: "Stronger answers may only use facts you've confirmed. Misrepresentation can bar you permanently." },
  { title: "No government affiliation", body: "Okwan is independent. We're not the embassy, and we'll never dress up like it." },
];

export function Principles() {
  return (
    <section aria-labelledby="principles-title" className="border-b border-line">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:py-28">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-accent">Our promise</p>
          <h2 id="principles-title" className="font-display mt-3 text-[clamp(2.2rem,4.6vw,3.8rem)]">
            Real practice. <br />
            No snake oil.
          </h2>
          <div className="path-rule mt-8 w-40 text-accent" aria-hidden />
        </div>
        <ul className="grid gap-px overflow-hidden rounded-3xl border border-line bg-line sm:grid-cols-2">
          {nevers.map((n) => (
            <li key={n.title} className="reveal bg-raised p-7">
              <p className="font-medium">{n.title}</p>
              <p className="mt-2 leading-relaxed text-muted">{n.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
