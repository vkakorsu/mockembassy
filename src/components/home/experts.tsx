export function Experts() {
  return (
    <section id="experts" aria-labelledby="experts-title" className="scroll-mt-8 border-b border-line">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-8 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-accent">Human experts</p>
            <h2 id="experts-title" className="font-display mt-3 text-[clamp(2.2rem,4.6vw,3.8rem)]">
              AI for the reps. <em className="text-muted">People for the judgement.</em>
            </h2>
          </div>
          <p className="self-end text-lg leading-relaxed text-muted">
            When you want a human, a certified Okwan Coach or a Senior Expert, such as a former consular officer, joins
            you at the same window. They play the officer first, then coach you face to face. What they flag is
            retested in every AI session you do afterwards.
          </p>
        </div>
        <ul className="mt-14 grid gap-5 md:grid-cols-3">
          {[
            { t: "Verified, then calibrated", b: "Credentials are checked, then every expert grades the same test interviews our AI is held to." },
            { t: "Your case, briefed", b: "Experts get a short brief: your confirmed facts, Case Scan flags and your three weakest recorded answers." },
            { t: "Advice that keeps working", b: "Their notes feed the Director, so a new officer presses the same weak spot in different words." },
          ].map((c) => (
            <li key={c.t} className="reveal rounded-3xl border border-line bg-raised p-7">
              <p className="font-medium">{c.t}</p>
              <p className="mt-2 leading-relaxed text-muted">{c.b}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
