// Classification metrics for the Evaluation chapter. Pure functions; every
// number the figures show comes from here and is covered by tests/metrics.test.ts.

import { clamp, createRng, randomNormal } from "@/lib/ml/random";

export type Confusion = { tp: number; fp: number; fn: number; tn: number };
export type Scored = { score: number; label: boolean };

const ratio = (num: number, den: number) => (den === 0 ? 0 : num / den);

export function confusion(labels: readonly boolean[], preds: readonly boolean[]): Confusion {
  if (labels.length !== preds.length) throw new Error("labels and preds differ in length");
  const c = { tp: 0, fp: 0, fn: 0, tn: 0 };
  labels.forEach((y, i) => {
    const p = preds[i];
    if (y && p) c.tp++;
    else if (!y && p) c.fp++;
    else if (y && !p) c.fn++;
    else c.tn++;
  });
  return c;
}

export const accuracy = (c: Confusion) => ratio(c.tp + c.tn, c.tp + c.tn + c.fp + c.fn);
export const precision = (c: Confusion) => ratio(c.tp, c.tp + c.fp);
export const recall = (c: Confusion) => ratio(c.tp, c.tp + c.fn);
export const specificity = (c: Confusion) => ratio(c.tn, c.tn + c.fp);
export const fpr = (c: Confusion) => ratio(c.fp, c.fp + c.tn);
export const f1 = (c: Confusion) => ratio(2 * c.tp, 2 * c.tp + c.fp + c.fn);

export function confusionAtThreshold(items: readonly Scored[], threshold: number): Confusion {
  return confusion(
    items.map((x) => x.label),
    items.map((x) => x.score >= threshold),
  );
}

function byScoreDesc(items: readonly Scored[]): Scored[] {
  return [...items].sort((a, b) => b.score - a.score);
}

// Probability that a random positive outscores a random negative; ties count 0.5.
export function auc(items: readonly Scored[]): number {
  const pos = items.filter((x) => x.label).map((x) => x.score);
  const neg = items.filter((x) => !x.label).map((x) => x.score);
  if (pos.length === 0 || neg.length === 0) return 0;
  let wins = 0;
  for (const p of pos) for (const n of neg) wins += p > n ? 1 : p === n ? 0.5 : 0;
  return wins / (pos.length * neg.length);
}

export type RocPoint = { fpr: number; tpr: number; threshold: number };

// Sweep the threshold down through every distinct score; starts at (0,0), ends at (1,1).
export function rocPoints(items: readonly Scored[]): RocPoint[] {
  const sorted = byScoreDesc(items);
  const nPos = sorted.filter((x) => x.label).length;
  const nNeg = sorted.length - nPos;
  const pts: RocPoint[] = [{ fpr: 0, tpr: 0, threshold: Infinity }];
  let tp = 0;
  let fp = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].label) tp++;
    else fp++;
    const last = i === sorted.length - 1 || sorted[i + 1].score !== sorted[i].score;
    if (last) pts.push({ fpr: ratio(fp, nNeg), tpr: ratio(tp, nPos), threshold: sorted[i].score });
  }
  return pts;
}

export type PrPoint = { recall: number; precision: number; threshold: number };

// Precision–recall curve, same sweep. Starts at recall 0 with the precision of the top item.
export function prPoints(items: readonly Scored[]): PrPoint[] {
  const sorted = byScoreDesc(items);
  const nPos = sorted.filter((x) => x.label).length;
  const pts: PrPoint[] = [];
  let tp = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].label) tp++;
    const last = i === sorted.length - 1 || sorted[i + 1].score !== sorted[i].score;
    if (last) pts.push({ recall: ratio(tp, nPos), precision: ratio(tp, i + 1), threshold: sorted[i].score });
  }
  const first = pts[0] ?? { recall: 0, precision: 1, threshold: Infinity };
  return [{ recall: 0, precision: first.precision, threshold: Infinity }, ...pts];
}

// Area under the PR curve with step interpolation: Σ (R_i − R_{i−1}) · P_i.
export function averagePrecision(items: readonly Scored[]): number {
  const pts = prPoints(items);
  let area = 0;
  for (let i = 1; i < pts.length; i++) area += (pts[i].recall - pts[i - 1].recall) * pts[i].precision;
  return area;
}

export function precisionAtK(items: readonly Scored[], k: number): number {
  const top = byScoreDesc(items).slice(0, k);
  return ratio(top.filter((x) => x.label).length, top.length);
}

export function trapezoid(points: readonly (readonly [number, number])[]): number {
  let area = 0;
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    area += ((x1 - x0) * (y0 + y1)) / 2;
  }
  return area;
}

// Scores drawn from two normals and clipped to [0, 1]; the same seed gives the same set.
export function makeScoredDataset(opts: { seed: number; nPos: number; nNeg: number; posMean: number; negMean: number; sd: number }): Scored[] {
  const rng = createRng(opts.seed);
  const items: Scored[] = [];
  for (let i = 0; i < opts.nPos; i++) items.push({ score: clamp(randomNormal(rng, opts.posMean, opts.sd), 0, 1), label: true });
  for (let i = 0; i < opts.nNeg; i++) items.push({ score: clamp(randomNormal(rng, opts.negMean, opts.sd), 0, 1), label: false });
  return items;
}

// The example from the handwritten notes: 10 animals, 6 dogs then 4 cats, and
// the model's dog/cat guesses. Positive class is "dog".
export const DOG_CAT = {
  labels: [true, true, true, true, true, true, false, false, false, false],
  preds: [true, true, true, true, false, false, true, true, true, false],
} as const;

// The same 10 animals with a dog score each, arranged so threshold 0.5 reproduces the matrix above.
export const DOG_CAT_SCORED: Scored[] = [
  { score: 0.92, label: true },
  { score: 0.85, label: true },
  { score: 0.71, label: true },
  { score: 0.62, label: true },
  { score: 0.45, label: true },
  { score: 0.3, label: true },
  { score: 0.78, label: false },
  { score: 0.66, label: false },
  { score: 0.55, label: false },
  { score: 0.2, label: false },
];
