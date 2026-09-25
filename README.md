# Okwan

US visa interview practice built for Ghanaians. You upload your documents, then practise with a simulated consular officer who has read your case. Every session is a different officer. After each one you get an honest debrief, grounded only in your own facts.

> Okwan means *the way / the road* in Twi.

## Docs
- [`docs/PLAN.md`](docs/PLAN.md): product, engineering, design and SEO plan, with sources
- [`docs/PRICING.md`](docs/PRICING.md): pricing, unit economics and pass rules
- [`docs/EXPERTS.md`](docs/EXPERTS.md): human coaches and senior experts

## What's built so far (milestone 1)

| Area | Where |
|---|---|
| **Interview engine**: the Director (plans each session per user), the probe taxonomy, officer sampling, Case Scan, the Referee (rules-based outcomes) | `src/lib/domain/` |
| **Pass rules**: the 60-day ceiling, appointment proof, date moves, refunds | `src/lib/domain/pass.ts` |
| **Marketing site**: the Window hero, the live engine demo, pricing, FAQ, early access | `src/app/page.tsx`, `src/components/home/` |
| **SEO**: metadata, JSON-LD (Organization, WebSite, SoftwareApplication, FAQPage), robots.txt with AI crawlers, sitemap, manifest, OG image | `src/app/` |
| **Database**: schema with RLS and tamper guards | `supabase/migrations/` |
| **Waitlist API**: stores sign-ups in Supabase | `src/app/api/waitlist/route.ts` |
| **Officer audio**: pre-rendered with Gemini 3.8 Flash TTS | `scripts/render-officer-audio.mts` |

## Develop

```bash
pnpm install
cp .env.example .env.local   # fill in what you have
pnpm dev                     # http://localhost:3000
```

| Command | What it does |
|---|---|
| `pnpm test` | Engine, Referee, pass-rule and Case Scan tests (Vitest) |
| `pnpm test:db` | Runs the core migration and RLS tests on a throwaway Postgres 16. Run it as a non-root user, because `initdb` refuses to run as root. |
| `pnpm typecheck`, `pnpm lint`, `pnpm build` | The usual checks |
| `pnpm audio:hero` | Renders the hero's officer questions to `public/audio/`. Needs `GEMINI_API_KEY`. |

Apply the migrations with the Supabase CLI (`supabase db push`). The second migration needs pgvector, which Supabase enables by default.

This app runs **Next.js 16**. Read `AGENTS.md` before changing framework code.
