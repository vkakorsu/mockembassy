import { faq } from "@/lib/faq";

export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-4 border-b border-ink">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-8 lg:grid-cols-12 lg:py-28">
        <div className="lg:col-span-4">
          <p className="label text-muted">Questions</p>
          <h2 id="faq-title" className="font-display mt-3 text-[clamp(2.4rem,4.6vw,4rem)] uppercase">
            Answered straight.
          </h2>
        </div>
        <div className="border-b border-ink lg:col-span-8">
          {faq.map((item) => (
            <details key={item.q} className="group border-t border-ink py-6">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                {item.q}
                <span aria-hidden className="font-mono text-xl leading-none transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-4 max-w-2xl leading-relaxed text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
