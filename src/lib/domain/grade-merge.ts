/**
 * LLM graders are noisy run to run. We grade twice and merge: scores are
 * averaged, a red flag is kept only if both runs raised it, and the mean
 * score gap is recorded so drift can be monitored (docs/PLAN.md §7).
 */

type Scores = { directness: number; specificity: number; consistency: number; conciseness: number };

export interface GradeTurn {
  seq: number;
  scores: Scores;
  red_flags: string[];
}
export interface GradeRun<T extends GradeTurn> {
  turns: T[];
}

const KEYS: (keyof Scores)[] = ["directness", "specificity", "consistency", "conciseness"];
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();

export function mergeGrades<T extends GradeTurn, R extends GradeRun<T>>(a: R, b: R | null): { merged: R; agreement: number | null } {
  if (!b) return { merged: a, agreement: null };
  let gap = 0;
  let n = 0;
  const turns = a.turns.map((ta) => {
    const tb = b.turns.find((x) => x.seq === ta.seq);
    if (!tb) return ta;
    const scores = { ...ta.scores };
    for (const k of KEYS) {
      gap += Math.abs(ta.scores[k] - tb.scores[k]);
      n++;
      scores[k] = Math.round((ta.scores[k] + tb.scores[k]) / 2);
    }
    const inB = new Set(tb.red_flags.map(norm));
    return { ...ta, scores, red_flags: ta.red_flags.filter((f) => inB.has(norm(f))) };
  });
  // 1 = identical scores, 0 = maximally different (a 4-point gap on every score).
  const agreement = n ? Math.round((1 - gap / n / 4) * 100) / 100 : null;
  return { merged: { ...a, turns }, agreement };
}
