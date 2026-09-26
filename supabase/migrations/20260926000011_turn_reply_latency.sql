-- How long the officer took to reply after each answer (measured in the browser).
alter table public.turns add column reply_latency_ms integer check (reply_latency_ms between 0 and 600000);
