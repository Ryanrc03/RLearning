// Tree Models chapter: entropy splits for a decision tree, bagging / boosting /
// stacking arithmetic, one-dimensional GBDT stumps, and the level-wise /
// leaf-wise growth orders plus LightGBM's three shortcuts. Pure functions, no
// React; see tests/trees.test.ts.

import { createRng, randomNormal, type Rng } from "@/lib/ml/random";

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
const mean = (xs: readonly number[]) => (xs.length === 0 ? 0 : sum(xs) / xs.length);

// ---------------------------------------------------------------------------
// Decision tree: entropy, information gain, candidate splits, greedy growth.

export type Label = 0 | 1;
export type LabeledPoint = { x: number; y: number; label: Label };
export type Feature = "x" | "y";
export type Counts = [number, number];

/** Shannon entropy in bits of a class-count vector; an empty vector is 0. */
export function entropy(counts: readonly number[]): number {
  const n = sum(counts);
  if (n === 0) return 0;
  let h = 0;
  for (const c of counts) {
    if (c === 0) continue;
    const p = c / n;
    h -= p * Math.log2(p);
  }
  return h;
}

/** Parent entropy minus the size-weighted entropy of the children. */
export function informationGain(parent: readonly number[], children: readonly (readonly number[])[]): number {
  const n = sum(parent);
  if (n === 0) return 0;
  let weighted = 0;
  for (const c of children) weighted += (sum(c) / n) * entropy(c);
  return entropy(parent) - weighted;
}

export function countLabels(points: readonly LabeledPoint[]): Counts {
  const c: Counts = [0, 0];
  for (const p of points) c[p.label] += 1;
  return c;
}

export function majorityLabel(counts: Counts): Label {
  return counts[1] > counts[0] ? 1 : 0;
}

export type SplitCandidate = {
  feature: Feature;
  threshold: number;
  gain: number;
  left: Counts;
  right: Counts;
};

/** Midpoints between consecutive distinct values of a feature. */
export function thresholdsOf(values: readonly number[]): number[] {
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  const out: number[] = [];
  for (let i = 1; i < sorted.length; i++) out.push((sorted[i - 1] + sorted[i]) / 2);
  return out;
}

/** Every (feature, threshold) cut with its information gain, best first. */
export function candidateSplits(points: readonly LabeledPoint[], features: readonly Feature[] = ["x", "y"]): SplitCandidate[] {
  const parent = countLabels(points);
  const out: SplitCandidate[] = [];
  for (const feature of features) {
    for (const threshold of thresholdsOf(points.map((p) => p[feature]))) {
      const left = countLabels(points.filter((p) => p[feature] <= threshold));
      const right = countLabels(points.filter((p) => p[feature] > threshold));
      out.push({ feature, threshold, gain: informationGain(parent, [left, right]), left, right });
    }
  }
  // Stable sort by gain so ties keep feature order x before y, then smaller threshold.
  return out
    .map((c, i) => ({ c, i }))
    .sort((a, b) => b.c.gain - a.c.gain || a.i - b.i)
    .map(({ c }) => c);
}

export function bestSplit(points: readonly LabeledPoint[], features?: readonly Feature[]): SplitCandidate | null {
  const cands = candidateSplits(points, features);
  return cands.length > 0 && cands[0].gain > 1e-12 ? cands[0] : null;
}

export type TreeLeaf = { kind: "leaf"; depth: number; counts: Counts; label: Label; points: LabeledPoint[] };
export type TreeSplit = {
  kind: "split";
  depth: number;
  counts: Counts;
  points: LabeledPoint[];
  feature: Feature;
  threshold: number;
  gain: number;
  candidates: SplitCandidate[];
  left: DecisionNode;
  right: DecisionNode;
};
export type DecisionNode = TreeLeaf | TreeSplit;

/** Greedy ID3-style growth: at every node take the max-gain cut, stop when pure or at maxDepth. */
export function growTree(points: readonly LabeledPoint[], maxDepth: number, features?: readonly Feature[], depth = 0): DecisionNode {
  const pts = [...points];
  const counts = countLabels(pts);
  const leaf = (): TreeLeaf => ({ kind: "leaf", depth, counts, label: majorityLabel(counts), points: pts });
  if (depth >= maxDepth || entropy(counts) === 0) return leaf();
  const candidates = candidateSplits(pts, features);
  const best = candidates[0];
  if (!best || best.gain <= 1e-12) return leaf();
  const leftPts = pts.filter((p) => p[best.feature] <= best.threshold);
  const rightPts = pts.filter((p) => p[best.feature] > best.threshold);
  return {
    kind: "split",
    depth,
    counts,
    points: pts,
    feature: best.feature,
    threshold: best.threshold,
    gain: best.gain,
    candidates,
    left: growTree(leftPts, maxDepth, features, depth + 1),
    right: growTree(rightPts, maxDepth, features, depth + 1),
  };
}

export function classify(node: DecisionNode, p: { x: number; y: number }): Label {
  let cur = node;
  while (cur.kind === "split") cur = p[cur.feature] <= cur.threshold ? cur.left : cur.right;
  return cur.label;
}

export function treeDepth(node: DecisionNode): number {
  return node.kind === "leaf" ? 0 : 1 + Math.max(treeDepth(node.left), treeDepth(node.right));
}

/** The 12 hand-placed points of the Decision Tree figure: the best first cut is on x (at 5), the best second cuts are on y. */
export const DT_POINTS: readonly LabeledPoint[] = [
  { x: 1.0, y: 2.0, label: 0 },
  { x: 2.0, y: 5.0, label: 0 },
  { x: 3.5, y: 3.5, label: 0 },
  { x: 1.5, y: 7.0, label: 0 },
  { x: 4.0, y: 6.0, label: 0 },
  { x: 7.5, y: 1.5, label: 0 },
  { x: 6.0, y: 6.5, label: 1 },
  { x: 7.0, y: 8.5, label: 1 },
  { x: 8.5, y: 4.5, label: 1 },
  { x: 9.0, y: 7.5, label: 1 },
  { x: 6.5, y: 3.0, label: 1 },
  { x: 3.0, y: 9.0, label: 1 },
];

// ---------------------------------------------------------------------------
// Ensembles: bootstrap draws, votes, residual chains, feature subsets.

/** n indices in [0, n) drawn with replacement (a bootstrap sample). */
export function bootstrapSample(rng: Rng, n: number): number[] {
  return Array.from({ length: n }, () => Math.floor(rng() * n));
}

export type Tally<T> = { label: T; count: number };

/** Winner by count; ties go to the label seen first. */
export function majorityVote<T extends string | number>(votes: readonly T[]): { winner: T; tally: Tally<T>[] } {
  if (votes.length === 0) throw new Error("majorityVote needs at least one vote");
  const order: T[] = [];
  const counts = new Map<T, number>();
  for (const v of votes) {
    if (!counts.has(v)) order.push(v);
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const tally = order.map((label) => ({ label, count: counts.get(label) ?? 0 }));
  let winner = tally[0];
  for (const t of tally) if (t.count > winner.count) winner = t;
  return { winner: winner.label, tally };
}

/** Residual left after each stage: target − (p₁ + … + p_k). The notes' 180 → [160, 10, 10] gives [20, 10, 0]. */
export function residualChain(target: number, predictions: readonly number[]): number[] {
  const out: number[] = [];
  let r = target;
  for (const p of predictions) {
    r -= p;
    out.push(r);
  }
  return out;
}

/** m distinct feature indices out of M, sorted (Random Forest's per-tree column sample). */
export function featureSubset(rng: Rng, m: number, M: number): number[] {
  if (m > M) throw new Error("m must not exceed M");
  const pool = Array.from({ length: M }, (_, i) => i);
  for (let i = 0; i < m; i++) {
    const j = i + Math.floor(rng() * (M - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, m).sort((a, b) => a - b);
}

/** A linear meta model: Σ wᵢ · outputᵢ + bias (the stacking combiner). */
export function weightedCombine(outputs: readonly number[], weights: readonly number[], bias = 0): number {
  if (outputs.length !== weights.length) throw new Error("outputs and weights differ in length");
  let s = bias;
  for (let i = 0; i < outputs.length; i++) s += outputs[i] * weights[i];
  return s;
}

/** A one-feature classification stump: the max-gain cut on x and the majority label on each side. */
export type ClassStump = { threshold: number; leftLabel: Label; rightLabel: Label; gain: number };

export function fitClassStump(points: readonly LabeledPoint[]): ClassStump {
  const best = bestSplit(points, ["x"]);
  if (!best) {
    const label = majorityLabel(countLabels(points));
    return { threshold: Infinity, leftLabel: label, rightLabel: label, gain: 0 };
  }
  return { threshold: best.threshold, leftLabel: majorityLabel(best.left), rightLabel: majorityLabel(best.right), gain: best.gain };
}

export function classStumpPredict(s: ClassStump, x: number): Label {
  return x <= s.threshold ? s.leftLabel : s.rightLabel;
}

/** Ten one-feature samples for the bagging tab: label 1 past x = 7, with two noisy points (x = 5 and x = 7). */
export const BAGGING_SAMPLES: readonly LabeledPoint[] = [0, 0, 0, 0, 1, 0, 0, 1, 1, 1].map((label, i) => ({ x: i + 1, y: 0, label: label as Label }));

// ---------------------------------------------------------------------------
// GBDT on one feature: regression stumps fitted to residuals, shrunk by a learning rate.

export type Stump = { threshold: number; left: number; right: number; sse: number };

/** The depth-1 regression tree that minimises squared error on (xs, rs): left / right are leaf means. */
export function fitStump(xs: readonly number[], rs: readonly number[]): Stump {
  if (xs.length !== rs.length) throw new Error("xs and rs differ in length");
  const thresholds = thresholdsOf(xs);
  if (thresholds.length === 0) {
    const m = mean(rs);
    return { threshold: Infinity, left: m, right: m, sse: sum(rs.map((r) => (r - m) ** 2)) };
  }
  let best: Stump | null = null;
  for (const t of thresholds) {
    const l = rs.filter((_, i) => xs[i] <= t);
    const r = rs.filter((_, i) => xs[i] > t);
    const lm = mean(l);
    const rm = mean(r);
    const sse = sum(l.map((v) => (v - lm) ** 2)) + sum(r.map((v) => (v - rm) ** 2));
    if (!best || sse < best.sse - 1e-12) best = { threshold: t, left: lm, right: rm, sse };
  }
  return best!;
}

export function stumpPredict(s: Stump, x: number): number {
  return x <= s.threshold ? s.left : s.right;
}

export type XY = { x: number; y: number };
export type GbdtRound = {
  round: number;
  /** null in round 0, where the model is just the mean. */
  stump: Stump | null;
  F: number[];
  residuals: number[];
  mse: number;
};

/** Round 0 is F₀ = mean(y); each later round fits a stump to the residuals and adds lr × stump. */
export function gbdtRun(points: readonly XY[], lr: number, rounds: number): GbdtRound[] {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const f0 = mean(ys);
  let F = ys.map(() => f0);
  const out: GbdtRound[] = [];
  const record = (round: number, stump: Stump | null) => {
    const residuals = ys.map((y, i) => y - F[i]);
    out.push({ round, stump, F: [...F], residuals, mse: mean(residuals.map((r) => r * r)) });
  };
  record(0, null);
  for (let m = 1; m <= rounds; m++) {
    const residuals = ys.map((y, i) => y - F[i]);
    const stump = fitStump(xs, residuals);
    F = F.map((f, i) => f + lr * stumpPredict(stump, xs[i]));
    record(m, stump);
  }
  return out;
}

export function gbdtPredict(f0: number, stumps: readonly Stump[], lr: number, x: number): number {
  let f = f0;
  for (const s of stumps) f += lr * stumpPredict(s, x);
  return f;
}

/** Points of the piecewise-constant F(x) for a step curve: one point per breakpoint. */
export function gbdtStepCurve(f0: number, stumps: readonly Stump[], lr: number, xMin: number, xMax: number): [number, number][] {
  const breaks = [...new Set(stumps.map((s) => s.threshold).filter((t) => t > xMin && t < xMax))].sort((a, b) => a - b);
  const pts: [number, number][] = [[xMin, gbdtPredict(f0, stumps, lr, xMin)]];
  for (const b of breaks) pts.push([b, gbdtPredict(f0, stumps, lr, b + 1e-9)]);
  pts.push([xMax, gbdtPredict(f0, stumps, lr, xMax)]);
  return pts;
}

/** Sixteen seeded points: x spread over [0, 1], y a bumpy curve plus Gaussian noise. */
export function makeGbdtPoints(seed: number, n = 16): XY[] {
  const rng = createRng(seed);
  const pts: XY[] = [];
  for (let i = 0; i < n; i++) {
    const x = Math.round(((i + 0.5) / n + (rng() - 0.5) * 0.03) * 1000) / 1000;
    const f = 1.2 * Math.sin(2 * Math.PI * x) + 0.5 * Math.cos(6 * Math.PI * x) + 0.6;
    pts.push({ x, y: Math.round((f + randomNormal(rng, 0, 0.15)) * 100) / 100 });
  }
  return pts;
}

export const GBDT_POINTS: readonly XY[] = makeGbdtPoints(7);

// ---------------------------------------------------------------------------
// XGBoost / LightGBM: growth orders over a fixed gain table, histogram bins,
// exclusive feature bundling, gradient-based one-side sampling.

/** Heap-indexed node ids: root 1, children of i are 2i and 2i + 1. */
export const nodeDepth = (id: number) => Math.floor(Math.log2(id));

/**
 * The split gain every node would get if it were split. One branch
 * (1 → 2 → 4 → 8 → 16 → 32) stays worth splitting as it deepens; the rest
 * run out of gain within a level or two.
 */
export const GAIN_TABLE: Readonly<Record<number, number>> = {
  1: 100,
  2: 60, 3: 25,
  4: 40, 5: 8, 6: 10, 7: 6,
  8: 30, 9: 5, 10: 4, 11: 3, 12: 5, 13: 3, 14: 2, 15: 2,
  16: 20, 17: 4, 18: 2, 19: 2, 20: 2, 21: 2, 22: 2, 23: 2, 24: 2, 25: 2, 26: 2, 27: 2, 28: 2, 29: 2, 30: 2, 31: 2,
  32: 12, 33: 3,
};

export type Growth = {
  /** Split node ids in the order they were split. */
  splits: number[];
  leaves: number[];
  totalGain: number;
  depth: number;
  /** The leaf that would be split next (leaf-wise only); null when nothing is left to split. */
  next: number | null;
};

const gainOf = (gains: Readonly<Record<number, number>>, id: number) => gains[id] ?? 0;

function finish(gains: Readonly<Record<number, number>>, splits: number[], leaves: number[], next: number | null): Growth {
  return {
    splits,
    leaves: [...leaves].sort((a, b) => a - b),
    totalGain: sum(splits.map((id) => gainOf(gains, id))),
    depth: Math.max(0, ...leaves.map(nodeDepth)),
    next,
  };
}

function splitLeaf(leaves: number[], id: number) {
  const i = leaves.indexOf(id);
  if (i < 0) throw new Error(`node ${id} is not a leaf`);
  leaves.splice(i, 1, 2 * id, 2 * id + 1);
}

/** Level-wise (XGBoost's default): every step splits all leaves on the deepest level at once. */
export function growLevelWise(gains: Readonly<Record<number, number>>, steps: number): Growth {
  const splits: number[] = [];
  const leaves = [1];
  for (let level = 0; level < steps; level++) {
    const frontier = leaves.filter((id) => nodeDepth(id) === level && gainOf(gains, id) > 0).sort((a, b) => a - b);
    if (frontier.length === 0) break;
    for (const id of frontier) {
      splitLeaf(leaves, id);
      splits.push(id);
    }
  }
  const nextLevel = leaves.length ? Math.max(...leaves.map(nodeDepth)) : 0;
  const more = leaves.some((id) => nodeDepth(id) === nextLevel && gainOf(gains, id) > 0);
  return finish(gains, splits, leaves, more ? leaves.filter((id) => nodeDepth(id) === nextLevel)[0] : null);
}

/** The leaf with the largest gain, smallest id on ties; null when no leaf has positive gain. */
export function bestLeaf(gains: Readonly<Record<number, number>>, leaves: readonly number[]): number | null {
  let best: number | null = null;
  for (const id of [...leaves].sort((a, b) => a - b)) {
    const g = gainOf(gains, id);
    if (g > 0 && (best === null || g > gainOf(gains, best))) best = id;
  }
  return best;
}

/** Leaf-wise (LightGBM): every step splits only the one leaf with the largest gain. */
export function growLeafWise(gains: Readonly<Record<number, number>>, steps: number): Growth {
  const splits: number[] = [];
  const leaves = [1];
  for (let s = 0; s < steps; s++) {
    const id = bestLeaf(gains, leaves);
    if (id === null) break;
    splitLeaf(leaves, id);
    splits.push(id);
  }
  return finish(gains, splits, leaves, bestLeaf(gains, leaves));
}

export type Histogram = { edges: number[]; counts: number[]; bin: number[] };

/** Equal-width bins over [min, max]; `bin[i]` is the bucket of values[i]. */
export function histogramBins(values: readonly number[], nBins: number): Histogram {
  if (values.length === 0 || nBins < 1) return { edges: [], counts: [], bin: [] };
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const width = hi === lo ? 1 : (hi - lo) / nBins;
  const edges = Array.from({ length: nBins + 1 }, (_, i) => lo + i * width);
  const counts = new Array<number>(nBins).fill(0);
  const bin = values.map((v) => Math.min(nBins - 1, Math.floor((v - lo) / width)));
  for (const b of bin) counts[b] += 1;
  return { edges, counts, bin };
}

/** Thirty-two seeded feature values in [0, 100) for the histogram card. */
export function makeHistogramValues(seed: number, n = 32): number[] {
  const rng = createRng(seed);
  return Array.from({ length: n }, () => Math.round(rng() * 100 * 10) / 10);
}

export type Bundle = { merged: number[]; offset: number };

/**
 * Exclusive Feature Bundling: two columns that are never non-zero on the same
 * row fold into one; B's values are shifted past A's range so they stay apart.
 */
export function bundleExclusive(colA: readonly number[], colB: readonly number[]): Bundle {
  if (colA.length !== colB.length) throw new Error("columns differ in length");
  for (let i = 0; i < colA.length; i++) {
    if (colA[i] !== 0 && colB[i] !== 0) throw new Error(`columns are not exclusive: both non-zero at row ${i}`);
  }
  const offset = Math.max(0, ...colA);
  const merged = colA.map((a, i) => (a !== 0 ? a : colB[i] !== 0 ? colB[i] + offset : 0));
  return { merged, offset };
}

export function unbundleExclusive(b: Bundle): { colA: number[]; colB: number[] } {
  const colA = b.merged.map((v) => (v !== 0 && v <= b.offset ? v : 0));
  const colB = b.merged.map((v) => (v > b.offset ? v - b.offset : 0));
  return { colA, colB };
}

export type Goss = { top: number[]; sampled: number[]; dropped: number[]; weight: number };

/**
 * Gradient-based One-Side Sampling: keep every sample in the top `topFrac` by
 * |gradient|, draw `otherFrac` of the rest at random and up-weight them by
 * (1 − topFrac) / otherFrac so the gradient sum stays unbiased.
 */
export function gossSelect(gradients: readonly number[], topFrac: number, otherFrac: number, rng: Rng): Goss {
  const n = gradients.length;
  const order = gradients.map((g, i) => ({ g: Math.abs(g), i })).sort((a, b) => b.g - a.g || a.i - b.i).map((o) => o.i);
  const nTop = Math.min(n, Math.ceil(topFrac * n));
  const top = order.slice(0, nTop);
  const rest = order.slice(nTop);
  const nSample = Math.min(rest.length, Math.round(otherFrac * rest.length));
  const pool = [...rest];
  for (let i = 0; i < nSample; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const sampled = pool.slice(0, nSample).sort((a, b) => a - b);
  const sampledSet = new Set(sampled);
  const dropped = rest.filter((i) => !sampledSet.has(i)).sort((a, b) => a - b);
  return { top: top.sort((a, b) => a - b), sampled, dropped, weight: otherFrac > 0 ? (1 - topFrac) / otherFrac : 0 };
}

/** Twenty seeded gradients for the GOSS card: a few large ones, most small. */
export function makeGradients(seed: number, n = 20): number[] {
  const rng = createRng(seed);
  return Array.from({ length: n }, () => {
    const big = rng() < 0.2;
    return Math.round(randomNormal(rng, 0, big ? 0.8 : 0.12) * 100) / 100;
  });
}
