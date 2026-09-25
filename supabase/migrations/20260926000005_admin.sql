-- Admin dashboard support: an audit log for sensitive admin actions
-- (viewing a user's case facts, refunds, comped passes). Service role only.
create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  admin_id uuid not null references auth.users (id),
  action text not null check (action in ('view_case_facts', 'refund_pass', 'grant_pass', 'set_role')),
  target_id uuid,
  reason text not null check (length(reason) between 5 and 500),
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index admin_audit_log_created_idx on public.admin_audit_log (created_at desc);
alter table public.admin_audit_log enable row level security;
-- No policies: the admin pages read and write it with the service role after checking the role.

-- Make someone an admin (run in the SQL editor; the role guard only blocks signed-in users):
--   update public.profiles set role = 'admin' where phone_e164 = '+233…';
