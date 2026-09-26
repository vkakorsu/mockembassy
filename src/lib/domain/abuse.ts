/**
 * Limits that bound what one account (or one person with many accounts) can
 * cost us in Gemini calls. Each is far above what a real applicant needs.
 * See docs/PRICING.md, "Abuse".
 */

/** Live tokens per session: the first, plus reconnects after a dropped line. */
export const TOKENS_PER_SESSION = 3;
/** Documents on an account at once. */
export const MAX_DOCUMENTS = 25;
/** Document reads (uploads and re-reads) per account per 24 hours. */
export const DOCUMENT_READS_PER_DAY = 40;
/** Free sessions (mocks and drills) started across all accounts per 24 hours: a ceiling on a sign-up flood. */
export const DEFAULT_FREE_SESSIONS_PER_DAY = 300;

/**
 * The inbox an address really reaches: name+tag@ and, on Gmail, dots in the
 * name all go to one person. Mirrors public.canonical_email (migration 17).
 */
export function canonicalEmail(email: string): string {
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at < 1) return e;
  let local = e.slice(0, at).split("+")[0];
  let domain = e.slice(at + 1);
  if (domain === "gmail.com" || domain === "googlemail.com") {
    local = local.replace(/\./g, "");
    domain = "gmail.com";
  }
  return `${local}@${domain}`;
}

/** Throwaway inbox services: fine for newsletters, not for a free interview. */
const DISPOSABLE = new Set([
  "mailinator.com", "guerrillamail.com", "guerrillamail.net", "guerrillamail.org", "guerrillamail.biz", "guerrillamail.de",
  "guerrillamailblock.com", "sharklasers.com", "grr.la", "pokemail.net", "spam4.me", "10minutemail.com", "10minutemail.net",
  "temp-mail.org", "temp-mail.io", "tempmail.com", "tempmail.net", "tempmail.dev", "tempmailo.com", "tempr.email", "tmpmail.org",
  "tmpmail.net", "yopmail.com", "yopmail.net", "yopmail.fr", "trashmail.com", "trashmail.de", "getnada.com", "nada.email",
  "dispostable.com", "maildrop.cc", "throwawaymail.com", "fakeinbox.com", "mintemail.com", "mohmal.com", "emailondeck.com",
  "burnermail.io", "moakt.com", "mail.tm", "1secmail.com", "1secmail.net", "1secmail.org", "mytemp.email", "inboxkitten.com",
  "dropmail.me", "emailfake.com", "mailnesia.com", "mailcatch.com", "spambox.us", "tempinbox.com", "getairmail.com",
  "fakemail.net", "mailpoof.com", "tempail.com", "emltmp.com", "linshiyouxiang.net", "discard.email", "spamgourmet.com",
  "harakirimail.com", "mailforspam.com", "tempmailaddress.com", "33mail.com", "anonaddy.me", "mailsac.com", "inboxbear.com",
  "minuteinbox.com", "tempm.com", "vomoto.com", "wegwerfmail.de", "einrot.com", "cuvox.de", "armyspy.com", "dayrep.com",
  "fleckens.hu", "gustr.com", "jourrapide.com", "rhyta.com", "superrito.com", "teleworm.us",
]);

export function isDisposableEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@").pop() ?? "";
  // Subdomains of a listed service count too (e.g. x.mailinator.com).
  return [...DISPOSABLE].some((d) => domain === d || domain.endsWith(`.${d}`));
}

/** Can a session still get a Live token? Pure, for the token route. */
export function tokenAllowed(input: {
  startedAt: Date | null;
  tokensIssued: number;
  tokenLifetimeSec: number;
  now: Date;
}): { ok: true } | { ok: false; reason: string } {
  if (input.tokensIssued >= TOKENS_PER_SESSION) {
    return { ok: false, reason: "This interview has reconnected too many times. Start a new one." };
  }
  // Reconnects only within the interview's own time: after that it's over.
  if (input.startedAt && input.now.getTime() - input.startedAt.getTime() > input.tokenLifetimeSec * 1000) {
    return { ok: false, reason: "This interview's time has run out. Start a new one." };
  }
  return { ok: true };
}
