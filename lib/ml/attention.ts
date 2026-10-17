// Mask helpers for the attention-mask explorer. Additive mask convention:
// M_ij = 0 means query i may read key j, M_ij = −∞ means it may not.

import { scale, softmax, transpose, type Matrix } from "@/lib/ml/clip";

export type MaskKind = "causal" | "bidirectional";

export function buildCausalMask(n: number): Matrix {
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (j <= i ? 0 : -Infinity)));
}

export function buildBidirectionalMask(n: number): Matrix {
  return Array.from({ length: n }, () => Array.from({ length: n }, () => 0));
}

export function buildMask(kind: MaskKind, n: number): Matrix {
  return kind === "causal" ? buildCausalMask(n) : buildBidirectionalMask(n);
}

// softmax(scores / sqrt(d_k) + M), row by row.
export function maskedAttention(scores: Matrix, mask: Matrix, dK: number): Matrix {
  const s = Math.sqrt(dK);
  return scores.map((row, i) => softmax(row.map((x, j) => x / s + mask[i][j])));
}

// Toy raw scores QK^T for the 4-token demo sentence; illustrative only.
export const DEMO_SCORES: Matrix = [
  [2.0, 0.4, 1.1, 0.6],
  [1.2, 2.2, 0.3, 0.9],
  [0.5, 1.6, 2.4, 1.0],
  [0.4, 1.8, 1.5, 2.6],
];

// ---- Attention: Q, K, V (LLMs page 3) -------------------------------------
// Everything below is the forward pass of one self-attention layer on a tiny
// example, with every intermediate exposed so the figure can print it.
// Shapes for one sequence: X (T, d) → Q, K, V (T, d_k) → S, A (T, T) → out (T, d_v).


export function matmul(a: Matrix, b: Matrix): Matrix {
  const inner = b.length;
  return a.map((row) => {
    if (row.length !== inner) throw new Error(`matmul: ${row.length} columns × ${inner} rows`);
    return b[0].map((_, j) => row.reduce((sum, x, k) => sum + x * b[k][j], 0));
  });
}

export function addMatrix(a: Matrix, b: Matrix): Matrix {
  return a.map((row, i) => row.map((x, j) => x + b[i][j]));
}

// X W: one linear projection, e.g. Q = X W_Q. X is (T, d), W is (d, d_k).
export function project(X: Matrix, W: Matrix): Matrix {
  return matmul(X, W);
}

// S = Q Kᵀ / √d_k, where d_k is the width of Q.
export function scaledScores(Q: Matrix, K: Matrix): Matrix {
  const dK = Q[0].length;
  return scale(matmul(Q, transpose(K)), 1 / Math.sqrt(dK));
}

// A = softmax(S) row by row: query i's weights over every key, summing to 1.
export function attentionWeights(S: Matrix): Matrix {
  return S.map(softmax);
}

// out = A V: row i is Σ_j A_ij V_j, the weighted mix of values query i reads.
export function attend(A: Matrix, V: Matrix): Matrix {
  return matmul(A, V);
}

export type AttentionParams = { wq: Matrix; wk: Matrix; wv: Matrix };

export type SelfAttentionResult = {
  X: Matrix;
  Q: Matrix;
  K: Matrix;
  V: Matrix;
  /** Q Kᵀ / √d_k */
  S: Matrix;
  /** softmax(S) per row */
  A: Matrix;
  /** A V: the ΔE for every token */
  out: Matrix;
  /** X + out: the residual update E' = E + ΔE (only when d_v = d). */
  updated: Matrix | null;
  dK: number;
};

export function selfAttention(X: Matrix, params: AttentionParams): SelfAttentionResult {
  const Q = project(X, params.wq);
  const K = project(X, params.wk);
  const V = project(X, params.wv);
  const S = scaledScores(Q, K);
  const A = attentionWeights(S);
  const out = attend(A, V);
  const updated = out[0].length === X[0].length ? addMatrix(X, out) : null;
  return { X, Q, K, V, S, A, out, updated, dK: Q[0].length };
}

export type ParamCount = { wq: number; wk: number; wv: number; total: number };

// Parameter count of one head's projections: W_Q and W_K are d_emb × d_k, W_V is
// d_emb × d_v. The notes' GPT-3 sketch: 12,288 × 128 for W_Q and W_K, and a full
// 12,288 × 12,288 for W_V.
export function paramCount(dEmb: number, dK: number, dV = dK): ParamCount {
  const wq = dEmb * dK;
  const wk = dEmb * dK;
  const wv = dEmb * dV;
  return { wq, wk, wv, total: wq + wk + wv };
}

export const DEMO_TOKENS = ["Hi", "I", "am", "Ryan"] as const;

// Hand-made d = 4 embeddings, not outputs of a real model.
export const DEMO_E: Matrix = [
  [1.0, 0.2, -0.3, 0.5],
  [0.1, 1.0, 0.4, -0.2],
  [-0.4, 0.3, 1.0, 0.2],
  [0.3, 0.8, -0.2, 1.0],
];

export const DEMO_WQ: Matrix = [
  [-1.1, 0.0, -0.1, 0.7],
  [0.3, 1.2, -0.7, 0.0],
  [-0.5, -0.1, -0.1, 1.2],
  [1.3, 0.1, -1.4, -1.5],
];

export const DEMO_WK: Matrix = [
  [0.2, 0.1, 0.9, 0.8],
  [-0.4, 1.5, 0.5, -0.7],
  [-1.4, -1.4, -0.1, -0.7],
  [-1.4, 0.1, 0.6, 0.0],
];

export const DEMO_WV: Matrix = [
  [0.1, 0.2, -0.1, 0.4],
  [0.9, -1.0, 0.0, -0.4],
  [-0.4, 0.6, 0.9, -0.9],
  [-0.1, -0.8, -0.2, 0.2],
];

export const DEMO_ATTENTION: AttentionParams = { wq: DEMO_WQ, wk: DEMO_WK, wv: DEMO_WV };

// ---- Multi-head attention (LLMs page 4) ------------------------------------

export type MultiHeadParams = {
  dModel: number;
  heads: number;
  dK: number;
  /** One head's W_Q (= W_K = W_V): d_model × d_k. */
  perHead: number;
  /** All heads together, per projection type: h × d_model × d_k = d_model². */
  wq: number;
  wk: number;
  wv: number;
  /** Output projection W^O: (h · d_k) × d_model = d_model². */
  wo: number;
  /** 4 d_model², independent of h. */
  total: number;
};

export function multiHeadParams(dModel: number, heads: number): MultiHeadParams {
  if (!(heads >= 1) || dModel % heads !== 0) throw new Error(`d_model ${dModel} is not divisible by ${heads} heads`);
  const dK = dModel / heads;
  const perHead = dModel * dK;
  const wq = heads * perHead;
  const wo = heads * dK * dModel;
  return { dModel, heads, dK, perHead, wq, wk: wq, wv: wq, wo, total: 3 * wq + wo };
}

export type HeadSlice = { head: number; start: number; end: number; width: number };

// Which columns of the d_model-wide vector head i owns after Concat.
export function splitHeads(dModel: number, heads: number): HeadSlice[] {
  const { dK } = multiHeadParams(dModel, heads);
  return Array.from({ length: heads }, (_, i) => ({ head: i, start: i * dK, end: (i + 1) * dK, width: dK }));
}

export type MultiHeadResult = {
  heads: SelfAttentionResult[];
  /** Concat(head_1, …, head_h): (T, h · d_v) */
  concat: Matrix;
  /** Concat · W^O: (T, d_model) */
  out: Matrix;
};

// head_i = Att(X W_q,i, X W_k,i, X W_v,i); the outputs are concatenated along
// the feature axis and mixed back to d_model by W^O.
export function multiHeadAttention(X: Matrix, headParams: AttentionParams[], WO: Matrix): MultiHeadResult {
  const heads = headParams.map((p) => selfAttention(X, p));
  const concat = X.map((_, t) => heads.flatMap((h) => h.out[t]));
  return { heads, concat, out: matmul(concat, WO) };
}

// Two toy heads on the d = 4 demo: d_k = d_v = 2 each, so Concat is 4 wide
// again. Chosen so that for "Ryan" head 1 looks mostly at "I" and head 2 at "am".
export const DEMO_HEADS: AttentionParams[] = [
  {
    wq: [
      [1.2, 1.1],
      [-0.8, 1.3],
      [-0.8, -1.0],
      [-0.9, 1.0],
    ],
    wk: [
      [1.4, 1.5],
      [-0.8, 1.0],
      [0.6, 1.4],
      [1.1, 0.5],
    ],
    wv: [
      [-0.2, 0.0],
      [0.5, -0.5],
      [0.8, 0.7],
      [-0.3, -0.8],
    ],
  },
  {
    wq: [
      [0.3, -0.1],
      [0.6, 0.6],
      [0.3, 0.1],
      [-1.0, 1.1],
    ],
    wk: [
      [0.3, -0.3],
      [1.2, -1.1],
      [0.0, 0.2],
      [-0.2, -0.5],
    ],
    wv: [
      [0.7, -0.4],
      [-0.4, -0.2],
      [-0.5, 0.3],
      [-0.9, -0.6],
    ],
  },
];

export const DEMO_WO: Matrix = [
  [0.5, 0.1, -0.2, 0.3],
  [-0.1, 0.6, 0.2, 0.0],
  [0.2, -0.3, 0.5, 0.1],
  [0.3, 0.2, 0.0, 0.6],
];
