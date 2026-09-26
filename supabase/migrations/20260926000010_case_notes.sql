-- Whole-document understanding (docs/INTERVIEW-REALISM.md §6).
-- documents.full_text: the document transcribed in full (ID and account numbers
-- reduced to their last 4 digits). Deleted with the document after 30 days.
alter table public.documents add column full_text text;

-- Case notes: free-form facts specific to this applicant, each quoting its
-- document. Only notes the user confirmed reach the officer or the coach.
create table public.case_notes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  -- Kept when the document is deleted: a confirmed note is the user's own fact.
  document_id uuid references public.documents (id) on delete set null,
  source_kind text not null,
  category text not null check (category in ('funding', 'ties', 'study', 'employment', 'family', 'travel', 'history', 'visit', 'other')),
  text text not null check (char_length(text) between 1 and 300),
  quote text check (char_length(quote) <= 300),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'removed')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index on public.case_notes (case_id);
create index on public.case_notes (document_id);
alter table public.case_notes enable row level security;
-- Read-only to the owner; the server writes after checking ownership.
create policy "own case notes: read" on public.case_notes for select
  using (exists (select 1 from public.cases c where c.id = case_id and c.user_id = (select auth.uid())));
