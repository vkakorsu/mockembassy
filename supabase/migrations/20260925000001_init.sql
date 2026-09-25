-- Okwan core schema (docs/PLAN.md §4.4). Every user-owned table has RLS:
-- a user can only ever see their own rows. Service-role code (jobs, the
-- agent worker, webhooks) bypasses RLS and is the only writer of results.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- waitlist
create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null unique check (phone_e164 ~ '^\+\d{9,15}$'),
  visa_type text not null check (visa_type in ('F1', 'B1B2', 'other')),
  interview_month date,
  consent_whatsapp boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.waitlist enable row level security;
-- No policies: only the service role may read or write.

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  phone_e164 text,
  locale text not null default 'en-GH',
  role text not null default 'applicant' check (role in ('applicant', 'coach', 'senior', 'admin')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "own profile: read" on public.profiles for select using (id = auth.uid());
create policy "own profile: update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- Users can't promote themselves to coach/senior/admin.
create function public.guard_profile_role() returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null and new.role is distinct from old.role then
    raise exception 'role can only be changed by an admin';
  end if;
  return new;
end $$;
create trigger profiles_role_guard before update on public.profiles
  for each row execute function public.guard_profile_role();

-- ------------------------------------------------------------------- cases
-- One applicant identity per case; a pass is bound to exactly one case.
create table public.cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  visa_type text not null check (visa_type in ('F1', 'B1B2')),
  applicant_name text not null,
  ds160_confirmation text check (ds160_confirmation ~ '^AA[0-9A-Z]{8}$'),
  passport_last4 text check (passport_last4 ~ '^[0-9A-Z]{4}$'),
  identity_locked_at timestamptz,
  interview_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.cases (user_id);
alter table public.cases enable row level security;
create policy "own cases: read" on public.cases for select using (user_id = auth.uid());
create policy "own cases: insert" on public.cases for insert with check (user_id = auth.uid());
create policy "own cases: update" on public.cases for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Identity fields can't change after the first full mock (docs/PRICING.md §3a).
create function public.guard_case_identity() returns trigger language plpgsql set search_path = '' as $$
begin
  if old.identity_locked_at is not null and (
    new.applicant_name is distinct from old.applicant_name or
    new.ds160_confirmation is distinct from old.ds160_confirmation or
    new.passport_last4 is distinct from old.passport_last4 or
    new.visa_type is distinct from old.visa_type
  ) then
    raise exception 'case identity is locked';
  end if;
  return new;
end $$;
create trigger cases_identity_guard before update on public.cases
  for each row execute function public.guard_case_identity();

-- Versioned, user-confirmed Case Profile (src/lib/domain/case.ts).
create table public.case_profiles (
  case_id uuid not null references public.cases (id) on delete cascade,
  version int not null check (version > 0),
  profile jsonb not null,
  confirmed_at timestamptz not null default now(),
  primary key (case_id, version)
);
alter table public.case_profiles enable row level security;
create policy "own profiles: read" on public.case_profiles for select
  using (exists (select 1 from public.cases c where c.id = case_id and c.user_id = auth.uid()));
create policy "own profiles: insert" on public.case_profiles for insert
  with check (exists (select 1 from public.cases c where c.id = case_id and c.user_id = auth.uid()));

-- --------------------------------------------------------------- documents
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  kind text not null check (kind in (
    'ds160', 'i20', 'ds2019', 'admission_letter', 'bank_statement', 'sponsor_letter',
    'employment_letter', 'business_registration', 'property', 'invitation_letter',
    'refusal_letter', 'appointment_confirmation', 'passport_travel_page', 'other'
  )),
  storage_path text not null,
  extraction jsonb,
  delete_after timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now()
);
create index on public.documents (case_id);
create index on public.documents (delete_after);
alter table public.documents enable row level security;
create policy "own documents: read" on public.documents for select
  using (exists (select 1 from public.cases c where c.id = case_id and c.user_id = auth.uid()));
create policy "own documents: delete" on public.documents for delete
  using (exists (select 1 from public.cases c where c.id = case_id and c.user_id = auth.uid()));

-- ------------------------------------------------------------------ passes
create table public.passes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete restrict,
  plan text not null check (plan in ('sprint', 'pass', 'family', 'coach', 'senior')),
  paystack_reference text not null unique,
  amount_pesewas int not null check (amount_pesewas >= 0),
  purchased_at timestamptz not null default now(),
  activated_at timestamptz,
  has_appointment_proof boolean not null default false,
  date_moves int not null default 0,
  second_attempt_used boolean not null default false,
  refunded_at timestamptz
);
create index on public.passes (case_id);
alter table public.passes enable row level security;
create policy "own passes: read" on public.passes for select
  using (exists (select 1 from public.cases c where c.id = case_id and c.user_id = auth.uid()));
-- Writes only via the Paystack webhook (service role).

-- ---------------------------------------------------------------- sessions
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  profile_version int not null,
  mode text not null check (mode in ('real', 'practice', 'dress_rehearsal')),
  -- The Director's plan and seed make any session reproducible (director.ts).
  plan jsonb not null,
  seed text not null,
  planner_version text not null,
  outcome text check (outcome in ('approved', 'refused_214b', 'administrative_221g')),
  decision_reasons text[],
  started_at timestamptz,
  ended_at timestamptz,
  recording_path text,
  realism_rating int check (realism_rating between 1 and 5),
  created_at timestamptz not null default now(),
  foreign key (case_id, profile_version) references public.case_profiles (case_id, version)
);
create index on public.sessions (case_id, created_at desc);
alter table public.sessions enable row level security;
create policy "own sessions: read" on public.sessions for select
  using (exists (select 1 from public.cases c where c.id = case_id and c.user_id = auth.uid()));
create policy "own sessions: rate" on public.sessions for update
  using (exists (select 1 from public.cases c where c.id = case_id and c.user_id = auth.uid()));

-- Users may only change their realism rating; everything else is service-written.
create function public.guard_session_update() returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null and (
    new.plan is distinct from old.plan or new.outcome is distinct from old.outcome or
    new.decision_reasons is distinct from old.decision_reasons or new.seed is distinct from old.seed or
    new.recording_path is distinct from old.recording_path or new.started_at is distinct from old.started_at or
    new.ended_at is distinct from old.ended_at or new.mode is distinct from old.mode
  ) then
    raise exception 'only realism_rating can be changed by the user';
  end if;
  return new;
end $$;
create trigger sessions_update_guard before update on public.sessions
  for each row execute function public.guard_session_update();

-- The Referee's per-probe log: the Director's memory of weak spots.
create table public.probe_results (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.sessions (id) on delete cascade,
  probe_id text not null,
  quality text not null check (quality in ('strong', 'adequate', 'weak', 'contradiction')),
  officer_name text not null,
  duration_sec numeric(6, 1),
  inconsistency jsonb,
  created_at timestamptz not null default now()
);
create index on public.probe_results (session_id);
alter table public.probe_results enable row level security;
create policy "own probe results: read" on public.probe_results for select
  using (exists (
    select 1 from public.sessions s join public.cases c on c.id = s.case_id
    where s.id = session_id and c.user_id = auth.uid()
  ));

create table public.turns (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.sessions (id) on delete cascade,
  seq int not null,
  probe_id text,
  officer_text text not null,
  user_transcript_raw text,
  user_transcript_corrected text,
  started_ms int,
  ended_ms int,
  scores jsonb,
  red_flags text[],
  unique (session_id, seq)
);
alter table public.turns enable row level security;
create policy "own turns: read" on public.turns for select
  using (exists (
    select 1 from public.sessions s join public.cases c on c.id = s.case_id
    where s.id = session_id and c.user_id = auth.uid()
  ));
-- Users can correct their transcript before grading (docs/PLAN.md §3, accent risk).
create policy "own turns: correct transcript" on public.turns for update
  using (exists (
    select 1 from public.sessions s join public.cases c on c.id = s.case_id
    where s.id = session_id and c.user_id = auth.uid()
  ));

create function public.guard_turn_update() returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null and (
    new.session_id is distinct from old.session_id or new.seq is distinct from old.seq or
    new.probe_id is distinct from old.probe_id or new.officer_text is distinct from old.officer_text or
    new.user_transcript_raw is distinct from old.user_transcript_raw or new.scores is distinct from old.scores or
    new.red_flags is distinct from old.red_flags or new.started_ms is distinct from old.started_ms or
    new.ended_ms is distinct from old.ended_ms
  ) then
    raise exception 'only user_transcript_corrected can be changed by the user';
  end if;
  return new;
end $$;
create trigger turns_update_guard before update on public.turns
  for each row execute function public.guard_turn_update();

-- --------------------------------------------------------------- outcomes
create table public.outcomes (
  case_id uuid primary key references public.cases (id) on delete cascade,
  result text not null check (result in ('approved', 'administrative_221g', 'refused_214b', 'refused_other')),
  reported_questions text[] not null default '{}',
  realism_rating int check (realism_rating between 1 and 5),
  consent_to_aggregate boolean not null default false,
  reported_at timestamptz not null default now()
);
alter table public.outcomes enable row level security;
create policy "own outcome: read" on public.outcomes for select
  using (exists (select 1 from public.cases c where c.id = case_id and c.user_id = auth.uid()));
create policy "own outcome: write" on public.outcomes for insert
  with check (exists (select 1 from public.cases c where c.id = case_id and c.user_id = auth.uid()));
create policy "own outcome: update" on public.outcomes for update
  using (exists (select 1 from public.cases c where c.id = case_id and c.user_id = auth.uid()));
