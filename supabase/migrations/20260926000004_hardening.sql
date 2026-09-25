-- Hardening from the Supabase advisors:
-- 1. handle_new_user is a trigger, never an RPC.
-- 2. Policies use (select auth.uid()) so it's evaluated once per query, not per row.
-- 3. Index the sessions → case_profiles foreign key.
-- 4. Recording uploads use upsert, which needs an update policy on storage.

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create index if not exists sessions_case_profile_idx on public.sessions (case_id, profile_version);

-- Helper expression reused below.
-- owner of a case:   exists (select 1 from public.cases c where c.id = X and c.user_id = (select auth.uid()))

drop policy "own profile: read" on public.profiles;
drop policy "own profile: update" on public.profiles;
create policy "own profile: read" on public.profiles for select using (id = (select auth.uid()));
create policy "own profile: update" on public.profiles for update
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy "own cases: read" on public.cases;
drop policy "own cases: insert" on public.cases;
drop policy "own cases: update" on public.cases;
create policy "own cases: read" on public.cases for select using (user_id = (select auth.uid()));
create policy "own cases: insert" on public.cases for insert with check (user_id = (select auth.uid()));
create policy "own cases: update" on public.cases for update
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy "own profiles: read" on public.case_profiles;
drop policy "own profiles: insert" on public.case_profiles;
create policy "own profiles: read" on public.case_profiles for select
  using (exists (select 1 from public.cases c where c.id = case_id and c.user_id = (select auth.uid())));
create policy "own profiles: insert" on public.case_profiles for insert
  with check (exists (select 1 from public.cases c where c.id = case_id and c.user_id = (select auth.uid())));

drop policy "own documents: read" on public.documents;
drop policy "own documents: delete" on public.documents;
drop policy "own documents: insert" on public.documents;
create policy "own documents: read" on public.documents for select
  using (exists (select 1 from public.cases c where c.id = case_id and c.user_id = (select auth.uid())));
create policy "own documents: delete" on public.documents for delete
  using (exists (select 1 from public.cases c where c.id = case_id and c.user_id = (select auth.uid())));
create policy "own documents: insert" on public.documents for insert
  with check (
    exists (select 1 from public.cases c where c.id = case_id and c.user_id = (select auth.uid()))
    and storage_path like (select auth.uid())::text || '/%'
  );

drop policy "own passes: read" on public.passes;
create policy "own passes: read" on public.passes for select
  using (exists (select 1 from public.cases c where c.id = case_id and c.user_id = (select auth.uid())));

drop policy "own sessions: read" on public.sessions;
drop policy "own sessions: rate" on public.sessions;
create policy "own sessions: read" on public.sessions for select
  using (exists (select 1 from public.cases c where c.id = case_id and c.user_id = (select auth.uid())));
create policy "own sessions: rate" on public.sessions for update
  using (exists (select 1 from public.cases c where c.id = case_id and c.user_id = (select auth.uid())));

drop policy "own probe results: read" on public.probe_results;
create policy "own probe results: read" on public.probe_results for select
  using (exists (
    select 1 from public.sessions s join public.cases c on c.id = s.case_id
    where s.id = session_id and c.user_id = (select auth.uid())
  ));

drop policy "own turns: read" on public.turns;
drop policy "own turns: correct transcript" on public.turns;
create policy "own turns: read" on public.turns for select
  using (exists (
    select 1 from public.sessions s join public.cases c on c.id = s.case_id
    where s.id = session_id and c.user_id = (select auth.uid())
  ));
create policy "own turns: correct transcript" on public.turns for update
  using (exists (
    select 1 from public.sessions s join public.cases c on c.id = s.case_id
    where s.id = session_id and c.user_id = (select auth.uid())
  ));

drop policy "own outcome: read" on public.outcomes;
drop policy "own outcome: write" on public.outcomes;
drop policy "own outcome: update" on public.outcomes;
create policy "own outcome: read" on public.outcomes for select
  using (exists (select 1 from public.cases c where c.id = case_id and c.user_id = (select auth.uid())));
create policy "own outcome: write" on public.outcomes for insert
  with check (exists (select 1 from public.cases c where c.id = case_id and c.user_id = (select auth.uid())));
create policy "own outcome: update" on public.outcomes for update
  using (exists (select 1 from public.cases c where c.id = case_id and c.user_id = (select auth.uid())));

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    execute $p$
      create policy "own objects: update" on storage.objects for update to authenticated
        using (bucket_id in ('documents', 'recordings') and (storage.foldername(name))[1] = (select auth.uid())::text)
    $p$;
  end if;
end $$;
