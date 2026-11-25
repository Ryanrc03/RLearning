// Numbers behind the ML System Design notes: probability calibration (reliability
// bins, ECE, Brier, isotonic regression by PAVA), the Recall@Precision operating
// point, the view-weighted loss weight, a two-stage cascade and eCPM.
// No React here; see tests/calibration.test.ts.

import { createRng, randomNormal, clamp } from "./random";
import type { Scored } from "./metrics";

// ---------- reliability bins ----------

/** One bucket of a reliability diagram: mean predicted probability, observed positive rate, sample count. */
export type Bin = { conf: number; acc: number; n: number };

/** The teaching data of the calibration note: six score buckets of 100 posts each. */
export const RELIABILITY_BINS: Bin[] = [
  { conf: 0.1, acc: 0.05, n: 100 },
  { conf: 0.3, acc: 0.15, n: 100 },
  { conf: 0.5, acc: 0.3, n: 100 },
  { conf: 0.7, acc: 0.5, n: 100 },
  { conf: 0.9, acc: 0.75, n: 100 },
  { conf: 0.95, acc: 0.85, n: 100 },
];

/** ECE = Σ |B_m| / N · |acc(B_m) − conf(B_m)|. */
export function ece(bins: readonly Bin[]): number {
  const total = bins.reduce((s, b) => s + b.n, 0);
  if (total === 0) return 0;
  return bins.reduce((s, b) => s + (b.n / total) * Math.abs(b.acc - b.conf), 0);
}

export type Prediction = { p: number; label: boolean };

/** Equal-width buckets over [0, 1]; empty buckets are dropped. */
export function binPredictions(items: readonly Prediction[], nBins: number): Bin[] {
  const sums = Array.from({ length: nBins }, () => ({ p: 0, pos: 0, n: 0 }));
  for (const it of items) {
    const i = Math.min(nBins - 1, Math.floor(it.p * nBins));
    sums[i].p += it.p;
    sums[i].pos += it.label ? 1 : 0;
    sums[i].n += 1;
  }
  return sums.filter((s) => s.n > 0).map((s) => ({ conf: s.p / s.n, acc: s.pos / s.n, n: s.n }));
}

/** Brier score = mean (p − y)². */
export function brier(items: readonly Prediction[]): number {
  if (items.length === 0) return 0;
  return items.reduce((s, it) => s + (it.p - (it.label ? 1 : 0)) ** 2, 0) / items.length;
}

/** Brier score of bucketed data where every sample in a bucket shares the bucket's prediction. */
export function brierFromBins(bins: readonly Bin[]): number {
  const total = bins.reduce((s, b) => s + b.n, 0);
  if (total === 0) return 0;
  // Per bucket: acc · (conf − 1)² + (1 − acc) · conf².
  return bins.reduce((s, b) => s + (b.n / total) * (b.acc * (b.conf - 1) ** 2 + (1 - b.acc) * b.conf ** 2), 0);
}

// ---------- isotonic regression (PAVA) ----------

/** A pooled run of adjacent inputs sharing one fitted value. */
export type Block = { start: number; end: number; weight: number; value: number };

export type PavaStep = {
  /** Blocks after this step. */
  blocks: Block[];
  /** Index (in the previous step's blocks) of the left block of the pair that was pooled; undefined for the first step. */
  pooled?: number;
};

/**
 * Pool Adjacent Violators on values already sorted by score. Returns every
 * intermediate state: step 0 is one block per input, each later step pools the
 * leftmost adjacent pair whose values decrease.
 */
export function pavaSteps(values: readonly number[], weights?: readonly number[]): PavaStep[] {
  let blocks: Block[] = values.map((v, i) => ({ start: i, end: i, weight: weights?.[i] ?? 1, value: v }));
  const steps: PavaStep[] = [{ blocks }];
  for (;;) {
    const i = blocks.findIndex((b, k) => k < blocks.length - 1 && b.value > blocks[k + 1].value);
    if (i < 0) break;
    const a = blocks[i];
    const b = blocks[i + 1];
    const weight = a.weight + b.weight;
    const merged: Block = { start: a.start, end: b.end, weight, value: (a.weight * a.value + b.weight * b.value) / weight };
    blocks = [...blocks.slice(0, i), merged, ...blocks.slice(i + 2)];
    steps.push({ blocks, pooled: i });
  }
  return steps;
}

/** One fitted value per input position. */
export function expandBlocks(blocks: readonly Block[]): number[] {
  const out: number[] = [];
  for (const b of blocks) for (let i = b.start; i <= b.end; i++) out[i] = b.value;
  return out;
}

/** The isotonic (non-decreasing) least-squares fit of `values`, in the input order. */
export function pava(values: readonly number[], weights?: readonly number[]): number[] {
  const steps = pavaSteps(values, weights);
  return expandBlocks(steps[steps.length - 1].blocks);
}

/**
 * Stack-based PAVA: one pass, each input is pushed once and popped at most once,
 * so the fit is linear in the number of (sorted) inputs. Same answer as `pava`.
 */
export function pavaStack(values: readonly number[], weights?: readonly number[]): number[] {
  const stack: Block[] = [];
  values.forEach((v, i) => {
    let cur: Block = { start: i, end: i, weight: weights?.[i] ?? 1, value: v };
    while (stack.length && stack[stack.length - 1].value > cur.value) {
      const top = stack.pop()!;
      const weight = top.weight + cur.weight;
      cur = { start: top.start, end: cur.end, weight, value: (top.weight * top.value + cur.weight * cur.value) / weight };
    }
    stack.push(cur);
  });
  return expandBlocks(stack);
}

/**
 * Serve-time lookup the way scikit-learn does it: linear interpolation between
 * the fitted knots, clipped to the first / last fitted value outside their range.
 */
export function isotonicPredict(xs: readonly number[], fitted: readonly number[], x: number): number {
  if (xs.length === 0) return NaN;
  if (x <= xs[0]) return fitted[0];
  const last = xs.length - 1;
  if (x >= xs[last]) return fitted[last];
  let i = 1;
  while (xs[i] < x) i++;
  const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
  return fitted[i - 1] + t * (fitted[i] - fitted[i - 1]);
}

/** The hand-computed PAVA example: five score buckets of 100 samples each. */
export const PAVA_EXAMPLE = {
  scores: [0.1, 0.3, 0.5, 0.7, 0.9],
  rates: [0.05, 0.35, 0.25, 0.65, 0.85],
  weights: [100, 100, 100, 100, 100],
};

// ---------- Recall@Precision ----------

export type OperatingPoint = { threshold: number; precision: number; recall: number; flagged: number };

/** Precision and recall of "flag when score ≥ threshold", for every distinct score, highest threshold first. */
export function operatingPoints(items: readonly Scored[]): OperatingPoint[] {
  const sorted = [...items].sort((a, b) => b.score - a.score);
  const nPos = sorted.filter((x) => x.label).length;
  const pts: OperatingPoint[] = [];
  let tp = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].label) tp++;
    const last = i === sorted.length - 1 || sorted[i + 1].score !== sorted[i].score;
    if (last) pts.push({ threshold: sorted[i].score, precision: tp / (i + 1), recall: nPos === 0 ? 0 : tp / nPos, flagged: i + 1 });
  }
  return pts;
}

/** Among thresholds whose precision meets the floor, the one with the highest recall; null when none qualifies. */
export function recallAtPrecision(items: readonly Scored[], minPrecision: number): OperatingPoint | null {
  let best: OperatingPoint | null = null;
  for (const pt of operatingPoints(items)) {
    if (pt.precision >= minPrecision && (!best || pt.recall > best.recall)) best = pt;
  }
  return best;
}

// ---------- view-weighted loss ----------

/** w = 1 + min(log(1 + V), c): the example sample weight of the harmful-content note. */
export function viewWeight(views: number, cap: number): number {
  return 1 + Math.min(Math.log(1 + Math.max(0, views)), cap);
}

export function bce(p: number, y: 0 | 1): number {
  const q = clamp(p, 1e-12, 1 - 1e-12);
  return y === 1 ? -Math.log(q) : -Math.log(1 - q);
}

// ---------- two-stage cascade ----------

export type CascadePost = { harmful: boolean; s1: number; s2: number };

/**
 * A synthetic day of posts: a cheap first-stage score that separates the classes
 * loosely and an expensive second-stage score that separates them well.
 */
export function makeCascadePosts(opts: { seed: number; n: number; harmfulRate: number }): CascadePost[] {
  const rng = createRng(opts.seed);
  const nPos = Math.round(opts.n * opts.harmfulRate);
  const posts: CascadePost[] = [];
  for (let i = 0; i < opts.n; i++) {
    const harmful = i < nPos;
    posts.push({
      harmful,
      s1: clamp(randomNormal(rng, harmful ? 0.62 : 0.3, 0.17), 0, 1),
      s2: clamp(randomNormal(rng, harmful ? 0.8 : 0.22, 0.12), 0, 1),
    });
  }
  return posts;
}

export type CascadeResult = {
  /** Share of all posts that reach the second stage. */
  passRate: number;
  /** Share of harmful posts that survive stage 1. */
  stage1Recall: number;
  /** Share of the harmful posts reaching stage 2 that stage 2 flags. */
  stage2Recall: number;
  /** Share of all harmful posts the whole system flags. */
  systemRecall: number;
  /** Share of flagged posts that are harmful. */
  systemPrecision: number;
  /** Harmful posts dropped by stage 1; stage 2 never sees them. */
  missedAtStage1: number;
  flagged: number;
};

export function runCascade(posts: readonly CascadePost[], t1: number, t2: number): CascadeResult {
  const harmful = posts.filter((p) => p.harmful).length;
  const passed = posts.filter((p) => p.s1 >= t1);
  const passedHarmful = passed.filter((p) => p.harmful).length;
  const flagged = passed.filter((p) => p.s2 >= t2);
  const tp = flagged.filter((p) => p.harmful).length;
  const div = (a: number, b: number) => (b === 0 ? 0 : a / b);
  return {
    passRate: div(passed.length, posts.length),
    stage1Recall: div(passedHarmful, harmful),
    stage2Recall: div(tp, passedHarmful),
    systemRecall: div(tp, harmful),
    systemPrecision: div(tp, flagged.length),
    missedAtStage1: harmful - passedHarmful,
    flagged: flagged.length,
  };
}

// ---------- importance sampling for labelled online evaluation ----------

export type Stratum = { name: string; population: number; sampled: number; harmfulInSample: number };

/**
 * Estimated harmful rate of the whole population from a stratified review sample:
 * every reviewed post stands for population / sampled posts of its stratum.
 */
export function weightedHarmfulRate(strata: readonly Stratum[]): number {
  const total = strata.reduce((s, x) => s + x.population, 0);
  const harmful = strata.reduce((s, x) => s + (x.sampled === 0 ? 0 : (x.population / x.sampled) * x.harmfulInSample), 0);
  return total === 0 ? 0 : harmful / total;
}

/** What you would get by pooling the reviewed posts and forgetting how they were sampled. */
export function naiveHarmfulRate(strata: readonly Stratum[]): number {
  const sampled = strata.reduce((s, x) => s + x.sampled, 0);
  return sampled === 0 ? 0 : strata.reduce((s, x) => s + x.harmfulInSample, 0) / sampled;
}

// ---------- ads ----------

/** eCPM = 1000 × pCTR × CPC bid. */
export function ecpm(pCtr: number, bidCpc: number): number {
  return 1000 * pCtr * bidCpc;
}

// ---------- same ranking, different calibration ----------

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
const logit = (p: number) => Math.log(p / (1 - p));

/** A perfectly calibrated model by construction: each label is a coin flip with the predicted probability. */
export function makeCalibratedSample(opts: { seed: number; n: number }): Prediction[] {
  const rng = createRng(opts.seed);
  const items: Prediction[] = [];
  for (let i = 0; i < opts.n; i++) {
    const p = clamp(sigmoid(randomNormal(rng, -0.4, 1.6)), 0.001, 0.999);
    items.push({ p, label: rng() < p });
  }
  return items;
}

/** Temperature on the logit: T < 1 sharpens (overconfident), T > 1 flattens. Strictly monotone, so the ranking is unchanged. */
export function temper(p: number, temperature: number): number {
  return sigmoid(logit(clamp(p, 1e-9, 1 - 1e-9)) / temperature);
}
