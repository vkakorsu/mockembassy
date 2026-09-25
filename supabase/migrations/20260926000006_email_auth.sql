-- Email + password accounts: keep the email on the profile (admin search),
-- and let an admin be pre-approved by email before they sign up.

alter table public.profiles add column if not exists email text;
create index if not exists profiles_email_idx on public.profiles (lower(email));

update public.profiles p set email = u.email from auth.users u where u.id = p.id and p.email is null;

-- Emails listed here become admins when they sign up. Service role only.
create table if not exists public.admin_invites (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);
alter table public.admin_invites enable row level security;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, phone_e164, email, role)
  values (
    new.id,
    new.phone,
    lower(new.email),
    case when exists (select 1 from public.admin_invites i where i.email = lower(new.email)) then 'admin' else 'applicant' end
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Keep the profile email in sync if the user changes it.
create or replace function public.sync_profile_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = lower(new.email) where id = new.id;
  return new;
end $$;
revoke execute on function public.sync_profile_email() from public, anon, authenticated;
drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email) execute function public.sync_profile_email();
