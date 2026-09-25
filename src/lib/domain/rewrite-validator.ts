import type { CaseProfile } from "./case";

/**
 * "Your answer, stronger" may only use facts the user confirmed. This check is
 * deliberately strict: any number or proper noun in the rewrite that is not
 * in the confirmed profile (or the user's own transcript) blocks the rewrite.
 */

const ALWAYS_ALLOWED = new Set(
  [
    "I", "I'm", "I'll", "I've", "I'd", "US", "USA", "America", "American", "United", "States", "Ghana", "Ghanaian",
    "Accra", "Kumasi", "DS-160", "I-20", "DS-2019", "SEVIS", "F-1", "B1", "B2", "B1/B2", "OK", "Okay", "Yes", "No",
    "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November",
    "December", "Fall", "Spring", "Summer", "Winter", "Master's", "Masters", "Bachelor's", "PhD", "MBA", "MS", "BSc",
    "MSc", "BA", "MA",
  ].map((w) => w.toLowerCase()),
);

function numbersIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/\$?\d[\d,]*(?:\.\d+)?\s*(k|thousand|million)?/gi)) {
    let n = Number(m[0].replace(/[^\d.]/g, ""));
    const unit = m[1]?.toLowerCase();
    if (unit === "k" || unit === "thousand") n *= 1_000;
    if (unit === "million") n *= 1_000_000;
    if (!Number.isNaN(n)) out.push(n);
  }
  return out;
}

/** Capitalised words that aren't at the start of a sentence. */
function properNouns(text: string): string[] {
  const words: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  for (const s of sentences) {
    const tokens = s.split(/\s+/).map((t) => t.replace(/^[“"'(]+|[”"'),.:;!?]+$/g, ""));
    tokens.forEach((t, i) => {
      if (i > 0 && /^[A-Z][\w'’/-]*$/.test(t)) words.push(t);
    });
  }
  return words;
}

export interface RewriteCheck {
  ok: boolean;
  unsupported: string[];
}

export function validateRewrite(rewrite: string, profile: CaseProfile, ownWords = ""): RewriteCheck {
  const source = `${JSON.stringify(profile)} ${ownWords}`;
  const sourceLower = source.toLowerCase();
  const sourceNumbers = new Set(numbersIn(source));
  // Profile numbers are stored raw (41000); allow "$41,000", "41k", and rounded thousands.
  const unsupported: string[] = [];

  for (const n of numbersIn(rewrite)) {
    const supported =
      sourceNumbers.has(n) || [...sourceNumbers].some((s) => s >= 1000 && Math.abs(s - n) / s < 0.02);
    if (!supported && n > 12) unsupported.push(String(n));
  }
  for (const w of properNouns(rewrite)) {
    const lw = w.toLowerCase().replace(/[’']s$/, "");
    if (ALWAYS_ALLOWED.has(lw)) continue;
    if (!sourceLower.includes(lw)) unsupported.push(w);
  }
  return { ok: unsupported.length === 0, unsupported: [...new Set(unsupported)] };
}
