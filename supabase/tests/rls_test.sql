-- Run after stub_auth.sql + 20260925000001_init.sql. Fails loudly on any violation.
\set ON_ERROR_STOP on
insert into auth.users values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');
-- profiles are created by the on_auth_user_created trigger
insert into public.cases (id, user_id, visa_type, applicant_name) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'F1', 'Ama'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'B1B2', 'Kofi');
insert into public.case_profiles values ('10000000-0000-0000-0000-00000000000a', 1, '{}');
insert into public.sessions (id, case_id, profile_version, mode, plan, seed, planner_version) values
  ('20000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-00000000000a', 1, 'real', '{}', 's', 'v1');
insert into public.turns (session_id, seq, officer_text, scores) values ('20000000-0000-0000-0000-00000000000a', 1, 'Why this school?', '{"d":1}');

grant usage on schema public, auth to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);

do $$
declare n int;
begin
  select count(*) into n from public.cases;
  if n <> 1 then raise exception 'user A sees % cases, expected 1', n; end if;
  select count(*) into n from public.waitlist;
  if n <> 0 then raise exception 'waitlist visible to users'; end if;

  -- A can't read B's case
  select count(*) into n from public.cases where user_id = '00000000-0000-0000-0000-00000000000b';
  if n <> 0 then raise exception 'cross-user leak'; end if;

  -- can't self-promote
  begin
    update public.profiles set role = 'admin' where id = auth.uid();
    raise exception 'self-promotion allowed';
  exception when raise_exception then
    if sqlerrm = 'self-promotion allowed' then raise; end if;
  end;

  -- can correct transcript, can't touch scores
  update public.turns set user_transcript_corrected = 'fixed' where seq = 1;
  begin
    update public.turns set scores = '{"d":5}' where seq = 1;
    raise exception 'score tampering allowed';
  exception when raise_exception then
    if sqlerrm = 'score tampering allowed' then raise; end if;
  end;

  -- can rate, can't change outcome
  update public.sessions set realism_rating = 4;
  begin
    update public.sessions set outcome = 'approved';
    raise exception 'outcome tampering allowed';
  exception when raise_exception then
    if sqlerrm = 'outcome tampering allowed' then raise; end if;
  end;

  -- identity lock
  update public.cases set identity_locked_at = now();
  begin
    update public.cases set applicant_name = 'Someone else';
    raise exception 'identity change allowed';
  exception when raise_exception then
    if sqlerrm = 'identity change allowed' then raise; end if;
  end;
  raise notice 'RLS tests passed';
end $$;
