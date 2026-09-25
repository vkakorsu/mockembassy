import { faq } from "@/lib/faq";

export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-8 border-b border-line">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:py-28">
        <h2 id="faq-title" className="font-display text-[clamp(2.2rem,4.6vw,3.8rem)]">
          Questions, <em className="text-muted">answered straight.</em>
        </h2>
        <div className="divide-y divide-line border-y border-line">
          {faq.map((item) => (
            <details key={item.q} className="group py-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-medium [&::-webkit-details-marker]:hidden">
                {item.q}
                <span aria-hidden className="text-2xl text-accent transition group-open:rotate-45">
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
