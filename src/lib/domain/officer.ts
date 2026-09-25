import { between, clamp01, pick, type Rng } from "./random";

/**
 * Officers are sampled from continuous traits rather than a handful of fixed
 * personas, and each new officer is chosen to differ from the user's recent
 * ones. Readiness shifts the distribution toward tougher officers.
 */

export interface OfficerTraits {
  pace: number; // 0 slow .. 1 rapid-fire
  warmth: number; // 0 cold .. 1 friendly
  scepticism: number; // 0 trusting .. 1 probing
  patience: number; // 0 cuts you off .. 1 lets you finish
  silence: number; // 0 never pauses .. 1 long typing silences
}

export interface Officer {
  name: string;
  voice: string;
  traits: OfficerTraits;
}

const TRAIT_KEYS = ["pace", "warmth", "scepticism", "patience", "silence"] as const;

/** Gemini Live prebuilt voices suited to a neutral consular register. */
export const OFFICER_VOICES = ["Charon", "Kore", "Orus", "Fenrir", "Leda", "Puck", "Aoede", "Zephyr"] as const;

const SURNAMES = [
  "Harper", "Collins", "Nguyen", "Reyes", "Whitaker", "Brennan", "Okafor", "Lindqvist",
  "Morales", "Patel", "Donovan", "Kessler", "Alvarez", "Sullivan", "Park", "Hollis",
] as const;

export function traitDistance(a: OfficerTraits, b: OfficerTraits): number {
  let sum = 0;
  for (const k of TRAIT_KEYS) sum += (a[k] - b[k]) ** 2;
  return Math.sqrt(sum / TRAIT_KEYS.length);
}

function sampleTraits(rng: Rng, readiness: number): OfficerTraits {
  // As readiness (0..1) rises, officers get more sceptical, faster and less warm.
  const tough = clamp01(readiness);
  return {
    pace: clamp01(between(rng, 0.2, 0.8) + 0.2 * tough),
    warmth: clamp01(between(rng, 0.2, 0.8) - 0.25 * tough),
    scepticism: clamp01(between(rng, 0.15, 0.75) + 0.3 * tough),
    patience: clamp01(between(rng, 0.25, 0.9) - 0.2 * tough),
    silence: clamp01(between(rng, 0, 0.7)),
  };
}

export function sampleOfficer(
  rng: Rng,
  opts: { readiness: number; recent: readonly Officer[]; candidates?: number },
): Officer {
  const candidates = opts.candidates ?? 12;
  let best: OfficerTraits | null = null;
  let bestScore = -1;
  for (let i = 0; i < candidates; i++) {
    const t = sampleTraits(rng, opts.readiness);
    const score = opts.recent.length
      ? Math.min(...opts.recent.map((o) => traitDistance(t, o.traits)))
      : rng();
    if (score > bestScore) {
      best = t;
      bestScore = score;
    }
  }
  const usedNames = new Set(opts.recent.map((o) => o.name));
  const usedVoices = new Set(opts.recent.slice(0, 2).map((o) => o.voice));
  const names = SURNAMES.filter((n) => !usedNames.has(`Officer ${n}`));
  const voices = OFFICER_VOICES.filter((v) => !usedVoices.has(v));
  return {
    name: `Officer ${pick(rng, names.length ? names : SURNAMES)}`,
    voice: pick(rng, voices.length ? voices : OFFICER_VOICES),
    traits: best!,
  };
}
