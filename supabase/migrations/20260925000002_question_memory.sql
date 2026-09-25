-- Question memory for the Director's novelty check (docs/PLAN.md §2.2.4).
-- Requires pgvector (enabled by default on Supabase).
create extension if not exists vector with schema extensions;

create table public.asked_questions (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.sessions (id) on delete cascade,
  probe_id text not null,
  text text not null,
  embedding extensions.vector(768),
  created_at timestamptz not null default now()
);
create index on public.asked_questions (session_id);
create index on public.asked_questions using hnsw (embedding extensions.vector_cosine_ops);
alter table public.asked_questions enable row level security;
-- Service role only: the Director reads it server-side.
