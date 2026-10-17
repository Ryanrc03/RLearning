// Pure numeric helpers for the CLIP contrastive-learning lab. No React here, so
// every number the UI shows can be unit-tested (see tests/clip.test.ts).

export type Matrix = number[][];

export function l2Normalize(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
  if (norm === 0) throw new Error("cannot normalize a zero vector");
  return v.map((x) => x / norm);
}

export function dot(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error("dimension mismatch");
  return a.reduce((sum, x, i) => sum + x * b[i], 0);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  return dot(l2Normalize(a), l2Normalize(b));
}

// log(Σ e^x) without overflow: shift by the max first.
export function logSumExp(xs: number[]): number {
  const finite = xs.filter((x) => x !== -Infinity);
  if (finite.length === 0) return -Infinity;
  const max = Math.max(...finite);
  return max + Math.log(finite.reduce((sum, x) => sum + Math.exp(x - max), 0));
}

// Stable softmax; -Infinity entries get exactly 0 weight.
export function softmax(xs: number[]): number[] {
  const lse = logSumExp(xs);
  return xs.map((x) => (x === -Infinity ? 0 : Math.exp(x - lse)));
}

export function transpose(m: Matrix): Matrix {
  return m[0].map((_, j) => m.map((row) => row[j]));
}

export function scale(m: Matrix, k: number): Matrix {
  return m.map((row) => row.map((x) => x * k));
}

// Linear blend between two same-shaped matrices; t = 0 → a, t = 1 → b.
export function lerpMatrix(a: Matrix, b: Matrix, t: number): Matrix {
  return a.map((row, i) => row.map((x, j) => x + (b[i][j] - x) * t));
}

export function subMatrix(m: Matrix, n: number): Matrix {
  return m.slice(0, n).map((row) => row.slice(0, n));
}

export type ClipResult = {
  logits: Matrix; // Z_ij = S_ij / τ
  probI2T: Matrix; // row i: softmax over texts for image i
  probT2I: Matrix; // stored as [text j][image i]: softmax over column j of Z
  rowLossI2T: number[]; // −log P(text i | image i)
  rowLossT2I: number[]; // −log P(image j | text j)
  lossI2T: number;
  lossT2I: number;
  loss: number;
};

// Symmetric InfoNCE as in CLIP: rows give image→text, columns give text→image.
export function clipLoss(similarity: Matrix, tau: number): ClipResult {
  if (!(tau > 0)) throw new Error("temperature must be > 0");
  const n = similarity.length;
  if (similarity.some((row) => row.length !== n)) throw new Error("similarity must be square");
  const logits = scale(similarity, 1 / tau);
  const columns = transpose(logits);
  const probI2T = logits.map(softmax);
  const probT2I = columns.map(softmax);
  const rowLossI2T = logits.map((row, i) => logSumExp(row) - row[i]);
  const rowLossT2I = columns.map((col, j) => logSumExp(col) - col[j]);
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const lossI2T = mean(rowLossI2T);
  const lossT2I = mean(rowLossT2I);
  return { logits, probI2T, probT2I, rowLossI2T, rowLossT2I, lossI2T, lossT2I, loss: (lossI2T + lossT2I) / 2 };
}

// Multi-positive variant for one row: −log Σ_{p ∈ positives} softmax(row)_p.
export function multiPositiveRowLoss(row: number[], positives: number[]): number {
  return logSumExp(row) - logSumExp(positives.map((j) => row[j]));
}

export function argmax(xs: number[]): number {
  return xs.reduce((best, x, i) => (x > xs[best] ? i : best), 0);
}

// Hand-made teaching values, not outputs of a real CLIP model. The 3×3 top-left
// block is the case from the handoff; the 4th pair (bicycle) extends it for batch-size demos.
export const CLIP_PAIRS = [
  { image: "猫", emoji: "🐱", text: "一只猫在沙发上" },
  { image: "狗", emoji: "🐶", text: "一只狗在草地上" },
  { image: "飞机", emoji: "✈️", text: "一架飞机在空中飞行" },
  { image: "自行车", emoji: "🚲", text: "一辆自行车停在路边" },
] as const;

export const S_BEFORE: Matrix = [
  [0.3, 0.35, 0.25, 0.19],
  [0.36, 0.32, 0.18, 0.23],
  [0.21, 0.24, 0.28, 0.29],
  [0.22, 0.27, 0.26, 0.31],
];

export const S_AFTER: Matrix = [
  [0.83, 0.2, 0.1, 0.11],
  [0.18, 0.86, 0.16, 0.15],
  [0.09, 0.22, 0.88, 0.24],
  [0.12, 0.17, 0.21, 0.84],
];

// A batch where the 4th pair is a second cat photo with its own caption, so
// (image 1, text 4) and (image 4, text 1) are semantically correct but sit off the diagonal.
export const DUP_PAIRS = [
  CLIP_PAIRS[0],
  CLIP_PAIRS[1],
  CLIP_PAIRS[2],
  { image: "另一只猫", emoji: "🐈", text: "一只猫趴在窗台上" },
] as const;

export const S_DUP: Matrix = [
  [0.83, 0.2, 0.1, 0.74],
  [0.18, 0.86, 0.16, 0.19],
  [0.09, 0.22, 0.88, 0.08],
  [0.71, 0.17, 0.07, 0.85],
];
