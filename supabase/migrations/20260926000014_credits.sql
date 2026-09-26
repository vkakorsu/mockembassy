-- Pricing by what you use, not by an interview date (docs/PRICING.md).
-- A purchase grants interview and drill credits for 6 months. The balance is
-- computed from purchases minus started paid sessions (src/lib/domain/credits.ts).
-- The date-window columns (activated_at, has_appointment_proof, date_moves,
-- second_attempt_used) are no longer used; kept for history.
alter table public.passes drop constraint if exists passes_plan_check;
alter table public.passes add constraint passes_plan_check
  check (plan in ('prep', 'full', 'topup', 'sprint', 'pass', 'family', 'coach', 'senior'));
alter table public.passes add column interviews int not null default 0 check (interviews >= 0);
alter table public.passes add column drills int not null default 0 check (drills >= 0);
alter table public.passes add column expires_at timestamptz;

-- Existing passes become Full Prep packs.
update public.passes
set interviews = 10, drills = 60, expires_at = purchased_at + interval '183 days'
where expires_at is null;
alter table public.passes alter column expires_at set not null;
