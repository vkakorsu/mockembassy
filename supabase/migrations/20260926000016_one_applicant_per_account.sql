-- One account is one applicant (docs/PRICING.md). The database refuses a
-- second case for the same account, whoever inserts it; someone else
-- practising signs up themselves. Credits, the free mock and the identity
-- lock all follow from this: the account's case is the account.
create unique index if not exists cases_one_per_account on public.cases (user_id);
