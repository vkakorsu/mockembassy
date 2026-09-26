-- "In my folder" ticks on the What to bring list: the physical originals the
-- applicant has packed. Independent of uploads (a practice copy isn't the paper).
alter table public.cases add column checklist_packed text[] not null default '{}';
