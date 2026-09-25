-- App wiring: profiles on sign-up, extraction drafts, Referee state,
-- debriefs, and private storage buckets.

-- Create a profile row for every new auth user.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, phone_e164) values (new.id, new.phone) on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Draft facts from extraction, waiting for the user to confirm (never used by the officer).
alter table public.cases add column draft_profile jsonb not null default '{}';

alter table public.documents
  add column extraction_status text not null default 'pending'
    check (extraction_status in ('pending', 'done', 'failed')),
  add column extraction_error text;
create policy "own documents: insert" on public.documents for insert
  with check (
    exists (select 1 from public.cases c where c.id = case_id and c.user_id = auth.uid())
    and storage_path like auth.uid()::text || '/%'
  );

alter table public.sessions
  add column is_free boolean not null default false,
  add column referee_state jsonb not null default '{}',
  add column debrief jsonb,
  add column debrief_status text not null default 'pending'
    check (debrief_status in ('pending', 'running', 'done', 'failed'));

-- Private buckets. Objects live under "<user_id>/..." and only their owner can touch them.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
      ('documents', 'documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']),
      ('recordings', 'recordings', false, 52428800, array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/wav'])
    on conflict (id) do nothing;

    execute $p$
      create policy "own objects: read" on storage.objects for select to authenticated
        using (bucket_id in ('documents', 'recordings') and (storage.foldername(name))[1] = auth.uid()::text)
    $p$;
    execute $p$
      create policy "own objects: upload" on storage.objects for insert to authenticated
        with check (bucket_id in ('documents', 'recordings') and (storage.foldername(name))[1] = auth.uid()::text)
    $p$;
    execute $p$
      create policy "own objects: delete" on storage.objects for delete to authenticated
        using (bucket_id in ('documents', 'recordings') and (storage.foldername(name))[1] = auth.uid()::text)
    $p$;
  end if;
end $$;
