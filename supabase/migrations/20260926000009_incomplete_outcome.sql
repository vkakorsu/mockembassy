-- A session the applicant left before the key questions has no decision.
alter table public.sessions drop constraint if exists sessions_outcome_check;
alter table public.sessions
  add constraint sessions_outcome_check check (outcome in ('approved', 'refused_214b', 'administrative_221g', 'incomplete'));
