export function EarlyAccess() {
  return (
    <section id="early-access" aria-labelledby="ea-title" className="grain relative scroll-mt-8 overflow-hidden border-t border-line bg-ink text-white">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-24 sm:px-8 lg:grid-cols-2 lg:py-32">
        <div>
          <h2 id="ea-title" className="font-display text-[clamp(2.6rem,6vw,5rem)]">
            Your window is coming. <em className="text-gold">Walk up ready.</em>
          </h2>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-white/65">
            We&rsquo;re opening to the first applicants soon. Leave your WhatsApp number and we&rsquo;ll send your free
            mock the day we launch.
          </p>
        </div>
        <form action="/api/waitlist" method="post" className="grid gap-4 self-end rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
          <label className="grid gap-2 text-sm">
            <span className="text-white/70">WhatsApp number</span>
            <input
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              required
              placeholder="024 000 0000"
              pattern="[0-9+ ]{9,16}"
              className="rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-base text-white placeholder:text-white/30"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm">
              <span className="text-white/70">Visa</span>
              <select name="visaType" className="rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-base text-white">
                <option value="F1">F-1 student</option>
                <option value="B1B2">B1/B2 visitor</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-white/70">Interview month (if booked)</span>
              <input
                name="interviewMonth"
                type="month"
                className="rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-base text-white [color-scheme:dark]"
              />
            </label>
          </div>
          <label className="flex items-start gap-3 text-sm text-white/60">
            <input name="consent" type="checkbox" required className="mt-1 accent-[var(--gold)]" />
            I agree to receive launch messages on WhatsApp. You can opt out anytime.
          </label>
          <button type="submit" className="mt-2 rounded-full bg-gold px-6 py-3.5 font-medium text-ink transition hover:brightness-110">
            Get early access
          </button>
        </form>
      </div>
    </section>
  );
}
