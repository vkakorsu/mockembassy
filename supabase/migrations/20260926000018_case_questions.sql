-- Transcripts, certificates and test score reports (grades, WASSCE, TOEFL/IELTS/SAT/GRE).
alter table public.documents drop constraint if exists documents_kind_check;
alter table public.documents add constraint documents_kind_check check (kind in (
  'ds160', 'i20', 'ds2019', 'admission_letter', 'scholarship_letter', 'academic_record', 'bank_statement', 'sponsor_letter',
  'employment_letter', 'business_registration', 'property', 'invitation_letter',
  'refusal_letter', 'appointment_confirmation', 'passport_travel_page', 'other'
));

-- Questions written for this applicant from their confirmed facts (src/lib/domain/case-questions.ts):
-- { profileVersion, generatedAt, questions: [{ id, question, goal, category, facts[] }] }.
-- Written by the server only; the owner can read them through the existing cases policies.
alter table public.cases add column if not exists case_questions jsonb not null default '{}'::jsonb;

-- Users may update their own case row (interview date, checklist), but these questions go into the
-- officer's instructions, so only the server (service role) may write them.
create function public.guard_case_questions() returns trigger language plpgsql set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and (
    (tg_op = 'INSERT' and new.case_questions is distinct from '{}'::jsonb) or
    (tg_op = 'UPDATE' and new.case_questions is distinct from old.case_questions)
  ) then
    raise exception 'case questions are written by the server';
  end if;
  return new;
end $$;
revoke execute on function public.guard_case_questions() from public, anon, authenticated;
create trigger cases_questions_guard before insert or update on public.cases
  for each row execute function public.guard_case_questions();
