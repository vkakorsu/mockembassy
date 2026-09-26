/**
 * Cleaning live transcripts. The Live model occasionally speaks a function
 * call as text ("log_probe(probe_id='f1.career.after', quality='weak')"); it
 * never belongs in the officer's words.
 */
export function stripToolText(text: string): string {
  return text
    .replace(/\b[a-z]+_[a-z_]+\s*\([^)]*\)\s*(?:\.{3}|…)?/gi, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s*\n\s*/g, " ")
    .trim();
}

/** "What?", "Sorry?", "Can you repeat that?": asking for the question again, not answering it. */
export function isRepeatRequest(answer: string): boolean {
  const a = answer.trim().toLowerCase().replace(/[.?!,]+/g, " ").replace(/\s+/g, " ").trim();
  if (!a || a.split(" ").length > 8) return false;
  return /^(what|sorry|pardon|excuse me|come again|huh|say that again|i beg your pardon|(sorry )?(can|could) you (please )?(repeat|say)( that| the question| it)?( again)?( please)?)( sir| ma'?am| please)?$/.test(a);
}
