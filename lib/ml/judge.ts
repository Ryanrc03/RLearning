// GSB (Good / Same / Bad) side-by-side evaluation and an LLM judge with position
// bias, for the LLM-as-judge page. Pure functions; see tests/judge.test.ts.

import { normalQuantile } from "@/lib/ml/abtest";
import { createRng, randomNormal } from "@/lib/ml/random";

export type Verdict = "G" | "S" | "B";
export type Gsb = { G: number; S: number; B: number };

export type GsbScores = {
  n: number;
  /** (G − B) / (G + S + B): ties count, range −1…1. */
  net: number;
  /** G / (G + B): ties dropped, range 0…1. */
  winRate: number;
  /** (G + S) / N: "not worse" rate. */
  notWorse: number;
};

export function gsbScores({ G, S, B }: Gsb): GsbScores {
  const n = G + S + B;
  return {
    n,
    net: n === 0 ? 0 : (G - B) / n,
    winRate: G + B === 0 ? 0.5 : G / (G + B),
    notWorse: n === 0 ? 0 : (G + S) / n,
  };
}

export function countVerdicts(vs: readonly Verdict[]): Gsb {
  const c: Gsb = { G: 0, S: 0, B: 0 };
  for (const v of vs) c[v]++;
  return c;
}

function logFactorial(n: number): number {
  let s = 0;
  for (let i = 2; i <= n; i++) s += Math.log(i);
  return s;
}

// Exact two-sided sign test: under H0 a non-tie is G or B with probability ½ each.
export function signTestP(g: number, b: number): number {
  const n = g + b;
  if (n === 0) return 1;
  const k = Math.max(g, b);
  if (2 * k === n) return 1;
  const lfN = logFactorial(n);
  let tail = 0;
  for (let i = k; i <= n; i++) tail += Math.exp(lfN - logFactorial(i) - logFactorial(n - i) - n * Math.LN2);
  return Math.min(1, 2 * tail);
}

// Wilson score interval for a proportion x / n (used for G / (G + B)).
export function wilsonInterval(x: number, n: number, level = 0.95): [number, number] {
  if (n === 0) return [0, 1];
  const z = normalQuantile(1 - (1 - level) / 2);
  const p = x / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return [Math.max(0, center - half), Math.min(1, center + half)];
}

// Normal interval for the net score: each pair scores +1 / 0 / −1, take the mean.
export function netInterval({ G, S, B }: Gsb, level = 0.95): [number, number] {
  const n = G + S + B;
  if (n === 0) return [-1, 1];
  const z = normalQuantile(1 - (1 - level) / 2);
  const mean = (G - B) / n;
  const variance = (G + B) / n - mean * mean;
  const half = z * Math.sqrt(Math.max(0, variance) / n);
  return [Math.max(-1, mean - half), Math.min(1, mean + half)];
}

// ---- A simulated judge ------------------------------------------------------

export type JudgeScenario = {
  pairs: number;
  /** Mean true quality gap (new − old) and its spread across prompts. */
  gapMean: number;
  gapSd: number;
  /** How much the judge favours whichever answer it reads first. */
  positionBias: number;
  /** Judge noise per call, and human-label noise. */
  judgeNoise: number;
  humanNoise: number;
  /** |score| below this is called Same. */
  tie: number;
  seed: number;
};

export type JudgePair = {
  gap: number;
  human: Verdict;
  /** Verdict about the new model when it is shown first (A) or second (B). */
  newFirst: Verdict;
  newSecond: Verdict;
  /** Judge both orders and average the two preference scores: the position term cancels. */
  swapped: Verdict;
  consistent: boolean;
};

export type JudgeMode = "newFirst" | "newSecond" | "swapped" | "human";

export function verdictFromScore(score: number, tie: number): Verdict {
  return score > tie ? "G" : score < -tie ? "B" : "S";
}

export function simulateJudge(s: JudgeScenario): JudgePair[] {
  const rng = createRng(s.seed);
  const out: JudgePair[] = [];
  for (let i = 0; i < s.pairs; i++) {
    const gap = randomNormal(rng, s.gapMean, s.gapSd);
    const human = verdictFromScore(gap + randomNormal(rng, 0, s.humanNoise), s.tie);
    // The judge's preference score for the new answer; whichever is read first gets +bias.
    const scoreFirst = gap + s.positionBias + randomNormal(rng, 0, s.judgeNoise);
    const scoreSecond = gap - s.positionBias + randomNormal(rng, 0, s.judgeNoise);
    const newFirst = verdictFromScore(scoreFirst, s.tie);
    const newSecond = verdictFromScore(scoreSecond, s.tie);
    const swapped = verdictFromScore((scoreFirst + scoreSecond) / 2, s.tie);
    out.push({ gap, human, newFirst, newSecond, swapped, consistent: newFirst === newSecond });
  }
  return out;
}

export function verdictsFor(pairs: readonly JudgePair[], mode: JudgeMode): Verdict[] {
  return pairs.map((p) => p[mode]);
}

// Share of pairs where the judge in this mode gives the same verdict as the human label.
export function agreementWithHuman(pairs: readonly JudgePair[], mode: JudgeMode): number {
  if (pairs.length === 0) return 0;
  let hit = 0;
  for (const p of pairs) if (p[mode] === p.human) hit++;
  return hit / pairs.length;
}

const BASE = { pairs: 120, gapSd: 0.7, positionBias: 0.4, judgeNoise: 0.3, humanNoise: 0.25, tie: 0.4, seed: 7 };

export const JUDGE_SCENARIOS = {
  better: { ...BASE, gapMean: 0.55 },
  equal: { ...BASE, gapMean: 0 },
} satisfies Record<string, JudgeScenario>;
