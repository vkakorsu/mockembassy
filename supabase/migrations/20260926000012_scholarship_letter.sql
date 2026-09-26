-- Scholarship and financial aid award letters: what the award covers, renewal and conditions.
alter table public.documents drop constraint if exists documents_kind_check;
alter table public.documents add constraint documents_kind_check check (kind in (
  'ds160', 'i20', 'ds2019', 'admission_letter', 'scholarship_letter', 'bank_statement', 'sponsor_letter',
  'employment_letter', 'business_registration', 'property', 'invitation_letter',
  'refusal_letter', 'appointment_confirmation', 'passport_travel_page', 'other'
));
