export function Experts() {
  return (
    <section id="experts" aria-labelledby="experts-title" className="scroll-mt-4 border-b border-ink">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-8 lg:grid-cols-12 lg:py-28">
        <div className="lg:col-span-5">
          <p className="label text-muted">Part 04 / 05</p>
          <h2 id="experts-title" className="font-display mt-3 text-[clamp(2.4rem,4.6vw,4rem)] uppercase">
            AI for the reps. People for judgement.
          </h2>
          <p className="mt-6 text-lg leading-relaxed">
            When you want a person, a certified Okwan Coach or a Senior Expert, such as a former consular officer, joins
            you at the same window. They play the officer first, then coach you face to face. What they flag comes back in
            every AI session afterwards.
          </p>
        </div>
        <dl className="doc self-start lg:col-span-6 lg:col-start-7">
          {[
            ["Verified, then calibrated", "We check credentials. Then every expert grades the same test interviews our AI is held to."],
            ["Briefed on your case", "They see your confirmed facts, your case-scan flags and your three weakest recorded answers."],
            ["Advice that keeps working", "Their notes feed the Director, so a new officer presses the same weak spot in new words."],
          ].map(([t, b], i) => (
            <div key={t} className="grid grid-cols-[3rem_1fr] gap-3 border-b border-line px-5 py-5 last:border-b-0">
              <span className="label pt-1 text-muted">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <dt className="font-semibold">{t}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-muted">{b}</dd>
              </div>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
