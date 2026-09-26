-- Coarse, privacy-preserving client fingerprint per live session (hash of the
-- /24 network + user agent), used only to flag possible account sharing.
alter table public.sessions add column if not exists client_fp text;
create index if not exists sessions_client_fp_idx on public.sessions (case_id, client_fp);
