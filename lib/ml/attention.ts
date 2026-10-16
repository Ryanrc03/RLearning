// Mask helpers for the attention-mask explorer. Additive mask convention:
// M_ij = 0 means query i may read key j, M_ij = −∞ means it may not.

import { softmax, type Matrix } from "@/lib/ml/clip";

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
