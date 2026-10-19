// Post-training, page 2: LoRA. Parameter counts for one layer and for a whole
// Llama-style 8B model, a rough training-memory estimate, and how well a
// rank-r matrix can approximate an update ΔW (truncated SVD, Eckart–Young).
// Pure functions, no React; see tests/lora.test.ts.

import { createRng, randomNormal } from "@/lib/ml/random";

/** Full fine-tuning of a d × k weight trains every entry. */
export function fullParams(d: number, k: number): number {
  return d * k;
}

/** LoRA trains B (d × r) and A (r × k): r · (d + k) numbers instead of d · k. */
export function loraParams(d: number, k: number, r: number): number {
  if (r < 0 || !Number.isInteger(r)) throw new Error(`rank must be a non-negative integer: ${r}`);
  return r * (d + k);
}

/** The scale applied to BA in the forward pass, h = Wx + (α / r) · BAx. */
export function loraScale(alpha: number, r: number): number {
  if (r <= 0) throw new Error("rank must be positive");
  return alpha / r;
}

/**
 * Shapes of a Llama-3-8B-like decoder: 32 layers, hidden 4096, grouped-query
 * attention with 8 KV heads (so k and v project 4096 → 1024), SwiGLU MLP with
 * intermediate 14336, vocabulary 128256, untied input / output embeddings.
 */
export const LLAMA_8B = {
  layers: 32,
  hidden: 4096,
  kvDim: 1024,
  intermediate: 14336,
  vocab: 128256,
} as const;

export type LinearName = "q" | "k" | "v" | "o" | "gate" | "up" | "down";

/** [in, out] of every linear layer inside one decoder block. */
export function blockLinears(m = LLAMA_8B): Record<LinearName, [number, number]> {
  return {
    q: [m.hidden, m.hidden],
    k: [m.hidden, m.kvDim],
    v: [m.hidden, m.kvDim],
    o: [m.hidden, m.hidden],
    gate: [m.hidden, m.intermediate],
    up: [m.hidden, m.intermediate],
    down: [m.intermediate, m.hidden],
  };
}

/** Every parameter of the model: linears, two RMSNorms per block, final norm, embeddings and LM head. */
export function totalParams(m = LLAMA_8B): number {
  const lin = Object.values(blockLinears(m)).reduce((s, [a, b]) => s + a * b, 0);
  const perBlock = lin + 2 * m.hidden;
  return m.layers * perBlock + m.hidden + 2 * m.vocab * m.hidden;
}

export const TARGET_PRESETS: Record<"qv" | "all", { label: string; targets: LinearName[] }> = {
  qv: { label: "只加在 q、v", targets: ["q", "v"] },
  all: { label: "全部线性层", targets: ["q", "k", "v", "o", "gate", "up", "down"] },
};

/** Trainable parameters when every block gets a rank-r adapter on each target linear. */
export function loraModelParams(r: number, targets: LinearName[], m = LLAMA_8B): number {
  const shapes = blockLinears(m);
  const perBlock = targets.reduce((s, t) => s + loraParams(shapes[t][0], shapes[t][1], r), 0);
  return m.layers * perBlock;
}

/**
 * Rough training memory in GB (1e9 bytes), weights and optimizer only, no
 * activations. Frozen weights sit in bf16 (2 bytes). A trainable parameter
 * with mixed-precision Adam costs 16 bytes: bf16 weight 2 + bf16 grad 2 +
 * fp32 master copy 4 + Adam m and v 4 + 4.
 */
export function trainingMemoryGB(total: number, trainable: number): number {
  const frozen = total - trainable;
  return (frozen * 2 + trainable * 16) / 1e9;
}

// ---------------------------------------------------------------------------
// Low-rank approximation.

export type Matrix = number[][];

/** Eigenvalues of a symmetric matrix by cyclic Jacobi rotations, sorted descending. */
export function symmetricEigenvalues(S: Matrix, sweeps = 30, tol = 1e-12): number[] {
  const n = S.length;
  const a = S.map((row) => row.slice());
  for (let sweep = 0; sweep < sweeps; sweep++) {
    let off = 0;
    let diag = 0;
    for (let p = 0; p < n; p++) {
      diag += a[p][p] * a[p][p];
      for (let q = p + 1; q < n; q++) off += a[p][q] * a[p][q];
    }
    if (off <= tol * diag) break;
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = a[p][q];
        if (Math.abs(apq) < 1e-300) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * apq);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = a[k][p];
          const akq = a[k][q];
          a[k][p] = c * akp - s * akq;
          a[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p][k];
          const aqk = a[q][k];
          a[p][k] = c * apk - s * aqk;
          a[q][k] = s * apk + c * aqk;
        }
      }
    }
  }
  return a.map((row, i) => row[i]).sort((x, y) => y - x);
}

/** Singular values of M (rows × cols), descending, via the eigenvalues of MᵀM. */
export function singularValues(M: Matrix): number[] {
  const rows = M.length;
  const cols = M[0].length;
  const G: Matrix = Array.from({ length: cols }, () => new Array(cols).fill(0));
  for (let i = 0; i < cols; i++)
    for (let j = i; j < cols; j++) {
      let s = 0;
      for (let k = 0; k < rows; k++) s += M[k][i] * M[k][j];
      G[i][j] = s;
      G[j][i] = s;
    }
  return symmetricEigenvalues(G).map((l) => Math.sqrt(Math.max(0, l)));
}

/**
 * Relative Frobenius error of the best rank-r approximation, for r = 0 … n:
 * ‖M − M_r‖_F / ‖M‖_F = sqrt(Σ_{i>r} σ_i²) / sqrt(Σ σ_i²). By Eckart–Young no
 * rank-r matrix (so no BA with inner size r) does better.
 */
export function lowRankErrorCurve(sigmas: number[]): number[] {
  const sq = sigmas.map((s) => s * s);
  const total = sq.reduce((s, v) => s + v, 0);
  const out: number[] = [];
  let tail = total;
  out.push(total === 0 ? 0 : 1);
  for (const v of sq) {
    tail -= v;
    out.push(total === 0 ? 0 : Math.sqrt(Math.max(0, tail) / total));
  }
  return out;
}

/** A seeded rows × cols Gaussian matrix. */
export function gaussianMatrix(rows: number, cols: number, seed: number, sd = 1): Matrix {
  const rng = createRng(seed);
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => randomNormal(rng, 0, sd)));
}

/**
 * A toy fine-tuning update: a product of two thin random matrices (intrinsic
 * rank `rank`) plus small full-rank noise, scaled so its Frobenius norm is the
 * same order as the noise-free part. This mimics the LoRA paper's observation
 * that ΔW has a few dominant directions.
 */
export function toyLowRankUpdate(n: number, rank: number, noise: number, seed: number): Matrix {
  const U = gaussianMatrix(n, rank, seed);
  const V = gaussianMatrix(rank, n, seed + 1);
  const E = gaussianMatrix(n, n, seed + 2, noise);
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      let s = 0;
      for (let k = 0; k < rank; k++) s += U[i][k] * V[k][j];
      return s / Math.sqrt(rank) + E[i][j];
    }),
  );
}

/** Size of the toy matrices in the figure. */
export const TOY_N = 128;

/** Error curves for the figure: a toy ΔW (intrinsic rank 8 + noise) and a plain Gaussian matrix with no structure. */
export function demoErrorCurves(): { update: number[]; random: number[] } {
  return {
    update: lowRankErrorCurve(singularValues(toyLowRankUpdate(TOY_N, 8, 0.15, 11))),
    random: lowRankErrorCurve(singularValues(gaussianMatrix(TOY_N, TOY_N, 29))),
  };
}
