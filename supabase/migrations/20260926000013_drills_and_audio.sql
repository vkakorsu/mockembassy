-- One-question drills, and a second transcript from the session recording.
alter table public.sessions drop constraint if exists sessions_mode_check;
alter table public.sessions add constraint sessions_mode_check check (mode in ('real', 'practice', 'dress_rehearsal', 'drill'));

-- Verbatim transcript of each answer from the saved recording (after the session).
-- Precedence for grading: user_transcript_corrected, then this, then the live transcript.
alter table public.turns add column user_transcript_asr text;

-- Users may still change only their correction; protect the new columns too.
create or replace function public.guard_turn_update() returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null and (
    new.session_id is distinct from old.session_id or new.seq is distinct from old.seq or
    new.probe_id is distinct from old.probe_id or new.officer_text is distinct from old.officer_text or
    new.user_transcript_raw is distinct from old.user_transcript_raw or new.scores is distinct from old.scores or
    new.red_flags is distinct from old.red_flags or new.started_ms is distinct from old.started_ms or
    new.ended_ms is distinct from old.ended_ms or new.reply_latency_ms is distinct from old.reply_latency_ms or
    new.user_transcript_asr is distinct from old.user_transcript_asr
  ) then
    raise exception 'only user_transcript_corrected can be changed by the user';
  end if;
  return new;
end $$;
