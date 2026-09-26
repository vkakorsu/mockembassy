-- Limits that keep one account's cost bounded (docs/PRICING.md, "Abuse").

-- 1. Live tokens per session: a reconnect after a dropped line is fine, an
--    endless stream of tokens for one session isn't (api/sessions/[id]/token).
alter table public.sessions add column if not exists tokens_issued int not null default 0;

-- 2. Document reads: each upload or re-read is one Gemini call. Counted here,
--    not from documents, so deleting and re-uploading still counts.
create table if not exists public.document_reads (
  id bigint generated always as identity primary key,
  case_id uuid not null references public.cases (id) on delete cascade,
  at timestamptz not null default now()
);
create index if not exists document_reads_case_at_idx on public.document_reads (case_id, at);
alter table public.document_reads enable row level security; -- server only: no policies

-- 3. One free allowance per inbox: name+tag@ and Gmail dots reach the same
--    person (mirrors canonicalEmail in src/lib/domain/abuse.ts).
create or replace function public.canonical_email(e text) returns text
language sql immutable set search_path = '' as $$
  select case
    when e is null or position('@' in e) = 0 then lower(e)
    else (
      with p as (select split_part(lower(e), '@', 1) as l, split_part(lower(e), '@', 2) as d)
      select case when d in ('gmail.com', 'googlemail.com')
        then replace(split_part(l, '+', 1), '.', '') || '@gmail.com'
        else split_part(l, '+', 1) || '@' || d end
      from p
    )
  end
$$;
alter table public.profiles add column if not exists email_canonical text
  generated always as (public.canonical_email(email)) stored;
create index if not exists profiles_email_canonical_idx on public.profiles (email_canonical);

-- 4. Storage: a ceiling on files per account, so uploads that are never
--    registered can't pile up.
drop policy if exists "own objects: upload" on storage.objects;
create policy "own objects: upload" on storage.objects for insert to authenticated
  with check (
    bucket_id in ('documents', 'recordings')
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and case
      when bucket_id = 'documents' then (
        select count(*) from storage.objects o
        where o.bucket_id = 'documents' and (storage.foldername(o.name))[1] = (select auth.uid())::text
      ) < 60
      else (
        select count(*) from storage.objects o
        where o.bucket_id = 'recordings' and (storage.foldername(o.name))[1] = (select auth.uid())::text
      ) < 800
    end
  );
