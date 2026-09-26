const DAY = 24 * 60 * 60 * 1000;

/** Whole days from today (Accra time is UTC) to the interview day. */
export function daysUntil(iso: string, now = Date.now()): number {
  const day = (t: number) => Math.floor(t / DAY);
  return day(new Date(iso).getTime()) - day(now);
}

export function countdownLabel(days: number): string {
  if (days < 0) return "Interview done";
  if (days === 0) return "Interview today";
  if (days === 1) return "Interview tomorrow";
  return `${days} days to go`;
}
