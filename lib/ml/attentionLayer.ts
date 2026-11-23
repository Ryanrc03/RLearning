// LLMs, "Attention (III)": attention as a stand-alone layer. Cross-attention
// takes two inputs (X gives keys and values, X' gives queries); self-attention
// is the same layer with X' = X. No React here; see tests/attention-layer.test.ts.

import { softmax } from "./clip";

export type Matrix = number[][];
export type Shape = [rows: number, cols: number];

export const transpose = (m: Matrix): Matrix => (m[0] ?? []).map((_, c) => m.map((row) => row[c]));

export function matmul(a: Matrix, b: Matrix): Matrix {
  if ((a[0]?.length ?? 0) !== b.length) throw new Error(`shape mismatch: ${a.length}×${a[0]?.length} · ${b.length}×${b[0]?.length}`);
  return a.map((row) => (b[0] ?? []).map((_, c) => row.reduce((acc, v, k) => acc + v * b[k][c], 0)));
}

/** Shape of a product (r×k)(k×c) = r×c; throws when the inner sizes differ. */
export function matmulShape(a: Shape, b: Shape): Shape {
  if (a[1] !== b[0]) throw new Error(`shape mismatch: ${a[0]}×${a[1]} · ${b[0]}×${b[1]}`);
  return [a[0], b[1]];
}

/**
 * Row convention (one token per row, the one NumPy / PyTorch code uses):
 * A = softmax over each row of Q Kᵀ, C = A V. A[j][i] is the weight query j
 * puts on key i. Unscaled dot product, as in the lecture.
 */
export function attentionRows(q: Matrix, k: Matrix, v: Matrix): { weights: Matrix; context: Matrix } {
  const weights = matmul(q, transpose(k)).map((row) => softmax(row));
  return { weights, context: matmul(weights, v) };
}

/**
 * Column convention of the lecture for one query: keys and values are the
 * columns of K and V, α_{:j} = softmax(Kᵀ q_j), c_j = V α_{:j}.
 */
export function attentionColumn(kCols: Matrix, vCols: Matrix, q: number[]): { weights: number[]; context: number[] } {
  const scores = transpose(kCols).map((key) => key.reduce((acc, x, d) => acc + x * q[d], 0));
  const weights = softmax(scores);
  return { weights, context: vCols.map((row) => row.reduce((acc, x, i) => acc + x * weights[i], 0)) };
}

export type LayerDims = {
  /** Number of key / value tokens (rows of X). */
  m: number;
  /** Number of query tokens (rows of X'); equals m for self-attention. */
  t: number;
  /** Width of the key / value input X. */
  dSrc: number;
  /** Width of the query input X'. */
  dTgt: number;
  dK: number;
  dV: number;
};

export type LayerShapes = {
  x: Shape; xQuery: Shape;
  wQ: Shape; wK: Shape; wV: Shape;
  q: Shape; k: Shape; kT: Shape; v: Shape;
  scores: Shape; a: Shape; c: Shape;
};

/** Every shape of the layer in the row convention, derived by multiplying shapes. */
export function layerShapes(d: LayerDims): LayerShapes {
  const x: Shape = [d.m, d.dSrc];
  const xQuery: Shape = [d.t, d.dTgt];
  const wQ: Shape = [d.dTgt, d.dK];
  const wK: Shape = [d.dSrc, d.dK];
  const wV: Shape = [d.dSrc, d.dV];
  const q = matmulShape(xQuery, wQ);
  const k = matmulShape(x, wK);
  const v = matmulShape(x, wV);
  const kT: Shape = [k[1], k[0]];
  const scores = matmulShape(q, kT);
  return { x, xQuery, wQ, wK, wV, q, k, kT, v, scores, a: scores, c: matmulShape(scores, v) };
}

export type LayerMode = "cross" | "self";

/** The note's two running examples. */
export const LAYER_DIMS: Record<LayerMode, LayerDims> = {
  cross: { m: 4, t: 5, dSrc: 128, dTgt: 128, dK: 64, dV: 32 },
  self: { m: 4, t: 4, dSrc: 128, dTgt: 128, dK: 64, dV: 32 },
};

export const CROSS_KEYS = ["I", "love", "machine", "learning"] as const;
export const SELF_TOKENS = ["The", "cat", "eats", "fish"] as const;

/**
 * Constructed weights, already normalised: row j is query j, column i is key i,
 * so A[j][i] is the lecture's α_{ij}. Teaching data, not a model's output.
 */
export const A_CROSS: Matrix = [
  [0.65, 0.15, 0.1, 0.1],
  [0.1, 0.7, 0.1, 0.1],
  [0.05, 0.1, 0.6, 0.25],
  [0.1, 0.1, 0.3, 0.5],
  [0.2, 0.15, 0.15, 0.5],
];

export const A_SELF: Matrix = [
  [0.6, 0.2, 0.1, 0.1],
  [0.15, 0.55, 0.2, 0.1],
  [0.05, 0.35, 0.35, 0.25],
  [0.1, 0.1, 0.6, 0.2],
];

export const LAYER_WEIGHTS: Record<LayerMode, Matrix> = { cross: A_CROSS, self: A_SELF };

export const shapeText = (s: Shape) => `${s[0]} × ${s[1]}`;
