// LLMs, page 7: five ways to pick the next token from one distribution.
// greedy / sampling / top-k / top-p on a ten-token next-token distribution,
// beam search on a tiny fixed two-step table, temperature through
// softmaxTemperature. Pure functions, no React; see tests/decoding.test.ts.

import { argmax } from "@/lib/ml/clip";
import type { Rng } from "@/lib/ml/random";
import { softmaxTemperature } from "@/lib/ml/sampling";

/** The prompt 「今天 很 想 吃」 and ten candidate next tokens with fixed logits, highest first. */
export const DEMO_NEXT_LOGITS: { prompt: string[]; tokens: string[]; logits: number[] } = {
  prompt: ["今天", "很", "想", "吃"],
  tokens: ["火锅", "面", "烧烤", "饭", "寿司", "水果", "东西", "什么", "的", "。"],
  logits: [3.0, 2.6, 2.2, 1.7, 1.2, 0.6, 0.3, 0.0, -0.8, -1.5],
};

export const DEFAULT_TOP_K = 3;
export const DEFAULT_TOP_P = 0.8;

/** Index of the most probable token. */
export function greedy(probs: number[]): number {
  return argmax(probs);
}

/** Keep exactly the k most probable tokens (ties broken by lower index). */
export function topK(probs: number[], k: number): boolean[] {
  if (!(k >= 1)) throw new Error("k must be ≥ 1");
  const order = probs.map((p, i) => i).sort((a, b) => probs[b] - probs[a] || a - b);
  const keep = new Set(order.slice(0, Math.min(k, probs.length)));
  return probs.map((_, i) => keep.has(i));
}

/** Keep the smallest prefix of the sorted distribution whose cumulative mass reaches p. */
export function topP(probs: number[], p: number): boolean[] {
  if (!(p > 0 && p <= 1)) throw new Error("p must be in (0, 1]");
  const order = probs.map((_, i) => i).sort((a, b) => probs[b] - probs[a] || a - b);
  const keep = new Set<number>();
  let acc = 0;
  for (const i of order) {
    keep.add(i);
    acc += probs[i];
    if (acc >= p - 1e-12) break;
  }
  return probs.map((_, i) => keep.has(i));
}

/** Zero the dropped tokens and rescale the kept ones to sum to 1. */
export function renormalize(probs: number[], mask: boolean[]): number[] {
  const kept = probs.reduce((s, x, i) => s + (mask[i] ? x : 0), 0);
  if (kept <= 0) throw new Error("mask keeps no probability mass");
  return probs.map((x, i) => (mask[i] ? x / kept : 0));
}

/** One draw from the renormalised distribution by inverse CDF. */
export function sampleFrom(rng: Rng, probs: number[], mask: boolean[]): number {
  const q = renormalize(probs, mask);
  const u = rng();
  let acc = 0;
  let last = -1;
  for (let i = 0; i < q.length; i++) {
    if (q[i] <= 0) continue;
    last = i;
    acc += q[i];
    if (u < acc) return i;
  }
  return last;
}

/** Probability mass the mask keeps, before renormalising. */
export function keptMass(probs: number[], mask: boolean[]): number {
  return probs.reduce((s, x, i) => s + (mask[i] ? x : 0), 0);
}

// ---------------------------------------------------------------------------
// Beam search on a two-step table.

export type StepOption = { token: string; p: number };
export type BeamTable = {
  /** Distribution over the first token. */
  first: StepOption[];
  /** For each first token, the distribution over the second. */
  second: Record<string, StepOption[]>;
};

export type BeamCandidate = {
  tokens: string[];
  /** log p of each step. */
  logps: number[];
  /** Σ log p. */
  score: number;
  kept: boolean;
};

export type BeamResult = {
  /** Every first-token candidate, `kept` marks the `width` survivors. */
  step1: BeamCandidate[];
  /** Every expansion of the survivors, `kept` marks the `width` best sums. */
  step2: BeamCandidate[];
  best: BeamCandidate;
};

/**
 * After 「今天 很 想 吃」: 火锅 is the single most likely next token, but 面 is
 * almost always followed by 条, so the two-step sum favours 面 条. Greedy and
 * beam therefore disagree on this table.
 */
export const DEMO_BEAM_TABLE: BeamTable = {
  first: [
    { token: "火锅", p: 0.4 },
    { token: "面", p: 0.35 },
    { token: "烧烤", p: 0.25 },
  ],
  second: {
    火锅: [
      { token: "吧", p: 0.52 },
      { token: "了", p: 0.48 },
    ],
    面: [
      { token: "条", p: 0.92 },
      { token: "吧", p: 0.08 },
    ],
    烧烤: [
      { token: "吧", p: 0.6 },
      { token: "了", p: 0.4 },
    ],
  },
};

/** Apply temperature to a step's probabilities: softmax(log p / T). T = 1 leaves them unchanged. */
export function temperedOptions(options: StepOption[], T: number): StepOption[] {
  const q = softmaxTemperature(options.map((o) => Math.log(o.p)), T);
  return options.map((o, i) => ({ token: o.token, p: q[i] }));
}

export function temperedTable(table: BeamTable, T: number): BeamTable {
  return {
    first: temperedOptions(table.first, T),
    second: Object.fromEntries(Object.entries(table.second).map(([k, opts]) => [k, temperedOptions(opts, T)])),
  };
}

const byScore = (a: BeamCandidate, b: BeamCandidate) => b.score - a.score;

/** Beam search with `width` beams over the two steps; returns every candidate so the tree can be drawn. */
export function beamSearch(table: BeamTable, width: number): BeamResult {
  if (!(width >= 1)) throw new Error("width must be ≥ 1");
  const step1: BeamCandidate[] = table.first.map((o) => ({ tokens: [o.token], logps: [Math.log(o.p)], score: Math.log(o.p), kept: false }));
  [...step1].sort(byScore).slice(0, width).forEach((c) => (c.kept = true));
  const step2: BeamCandidate[] = step1
    .filter((c) => c.kept)
    .flatMap((c) =>
      (table.second[c.tokens[0]] ?? []).map((o) => ({
        tokens: [...c.tokens, o.token],
        logps: [...c.logps, Math.log(o.p)],
        score: c.score + Math.log(o.p),
        kept: false,
      })),
    );
  const ranked = [...step2].sort(byScore);
  ranked.slice(0, width).forEach((c) => (c.kept = true));
  return { step1, step2, best: ranked[0] };
}

/** Greedy on the same table: the best first token, then its best continuation. */
export function greedyPath(table: BeamTable): BeamCandidate {
  const first = table.first.reduce((b, o) => (o.p > b.p ? o : b), table.first[0]);
  const nexts = table.second[first.token];
  const second = nexts.reduce((b, o) => (o.p > b.p ? o : b), nexts[0]);
  const logps = [Math.log(first.p), Math.log(second.p)];
  return { tokens: [first.token, second.token], logps, score: logps[0] + logps[1], kept: true };
}
