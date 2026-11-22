// LLMs, "Attention (I)": the three steps of Bahdanau (additive) attention on a
// four-token source sentence. Score → softmax → weighted sum. No React here;
// see tests/bahdanau.test.ts.

import { softmax } from "./clip";

export const SOURCE_TOKENS = ["I", "love", "machine", "learning"] as const;

/** The constructed scores of the note's softmax example; not a model's output. */
export const EXAMPLE_SCORES = [0, 0, 2, 0];

/** Step 2: scores (any real number) → non-negative weights that sum to 1. */
export function attentionWeights(scores: number[]): number[] {
  return softmax(scores);
}

/** Step 3: c_j = Σ_i α_{j,i} h_i. Every source position takes part. */
export function contextVector(weights: number[], states: number[][]): number[] {
  const dim = states[0]?.length ?? 0;
  const c = new Array<number>(dim).fill(0);
  states.forEach((h, i) => h.forEach((v, d) => { c[d] += weights[i] * v; }));
  return c;
}

/** One set of alignment parameters, used for every source position and every decoder step. */
export type AdditiveParams = {
  /** W_a, shape [n'][decoder hidden]. */
  wa: number[][];
  /** U_a, shape [n'][encoder hidden]. */
  ua: number[][];
  /** v_a, length n'. */
  va: number[];
  /** b_a, length n'. */
  ba: number[];
};

const matVec = (m: number[][], v: number[]) => m.map((row) => row.reduce((acc, w, k) => acc + w * v[k], 0));

/** Step 1: e_{j,i} = v_aᵀ tanh(W_a s_{j−1} + U_a h_i + b_a). */
export function additiveScore(p: AdditiveParams, sPrev: number[], h: number[]): number {
  const ws = matVec(p.wa, sPrev);
  const uh = matVec(p.ua, h);
  return p.va.reduce((acc, v, k) => acc + v * Math.tanh(ws[k] + uh[k] + p.ba[k]), 0);
}

/** The same score written as one linear layer on the concatenation [s_{j−1}; h_i], with W = [W_a U_a]. */
export function additiveScoreConcat(p: AdditiveParams, sPrev: number[], h: number[]): number {
  const w = p.wa.map((row, k) => [...row, ...p.ua[k]]);
  const pre = matVec(w, [...sPrev, ...h]);
  return p.va.reduce((acc, v, k) => acc + v * Math.tanh(pre[k] + p.ba[k]), 0);
}

export type AttentionResult = { scores: number[]; weights: number[]; context: number[] };

/** All three steps for one decoder step: the same params score every h_i against one query. */
export function attend(p: AdditiveParams, sPrev: number[], states: number[][]): AttentionResult {
  const scores = states.map((h) => additiveScore(p, sPrev, h));
  const weights = attentionWeights(scores);
  return { scores, weights, context: contextVector(weights, states) };
}

/** A set of scores whose softmax is exactly `weights` (softmax ignores a constant shift, so the mean is set to 0). */
export function scoresFromWeights(weights: number[]): number[] {
  const logs = weights.map((w) => Math.log(w));
  const mean = logs.reduce((a, b) => a + b, 0) / logs.length;
  return logs.map((l) => l - mean);
}

/** Illustrative 2-d encoder states for the four source tokens. */
export const DEMO_STATES: number[][] = [
  [0.9, 0.1],
  [0.2, 0.8],
  [-0.6, 0.5],
  [-0.3, -0.7],
];

export type DemoStepKey = "a" | "b";

export type DemoStep = {
  key: DemoStepKey;
  /** 1-based index of the target position being generated. */
  j: number;
  /** The target word this step is about to produce. */
  target: string;
  /** Illustrative attention weights over SOURCE_TOKENS; each row sums to 1. */
  weights: number[];
};

/** Two decoder steps of 「我 爱 机器 学习」: teaching values, not a trained model's output. */
export const DEMO_STEPS: Record<DemoStepKey, DemoStep> = {
  a: { key: "a", j: 2, target: "爱", weights: [0.08, 0.7, 0.12, 0.1] },
  b: { key: "b", j: 3, target: "机器", weights: [0.05, 0.1, 0.7, 0.15] },
};

export function demoAttention(key: DemoStepKey): AttentionResult {
  const { weights } = DEMO_STEPS[key];
  return { scores: scoresFromWeights(weights), weights, context: contextVector(weights, DEMO_STATES) };
}

/** Number of alignment scores for a source of length m and a target of length t. */
export function scorePairs(m: number, t: number): number {
  return m * t;
}
