// Deep Learning Blocks, pages 1 and 2: a two-layer sigmoid network small enough
// to multiply through by hand, and the gradient chain through N plain or
// residual layers. No React here; see tests/backprop.test.ts.

import { createRng } from "./random";

export type Params = {
  /** Hidden layer W⁽¹⁾, shape [hidden][input]: a = W⁽¹⁾ x. */
  w1: number[][];
  /** Logit layer W⁽⁰⁾, length hidden: s = W⁽⁰⁾ᵀ z. */
  w0: number[];
};

export type Forward = {
  a: number[];
  z: number[];
  s: number;
  p: number;
  loss: number;
};

export type Backward = {
  /** ∂L/∂p = −y/p + (1−y)/(1−p); for y = 1 this is −1/p. */
  dLdp: number;
  /** ∂p/∂s = p(1−p). */
  dpds: number;
  /** ∂L/∂s = ∂L/∂p · ∂p/∂s, which simplifies to p − y. */
  dLds: number;
  /** ∂L/∂W⁽⁰⁾ = ∂L/∂s · z. */
  dLdw0: number[];
  /** ∂L/∂z = ∂L/∂s · W⁽⁰⁾. */
  dLdz: number[];
  /** ∂z/∂a = z(1−z). */
  dzda: number[];
  /** ∂L/∂a = ∂L/∂z ⊙ ∂z/∂a. */
  dLda: number[];
  /** ∂L/∂W⁽¹⁾ = ∂L/∂a · xᵀ (outer product). */
  dLdw1: number[][];
};

export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

export function forward(params: Params, x: number[]): Forward {
  const a = params.w1.map((row) => row.reduce((sum, w, j) => sum + w * x[j], 0));
  const z = a.map(sigmoid);
  const s = params.w0.reduce((sum, w, i) => sum + w * z[i], 0);
  const p = sigmoid(s);
  return { a, z, s, p, loss: bce(p, 1) };
}

// Binary cross-entropy for one example; y ∈ {0, 1}.
export function bce(p: number, y: number): number {
  return -(y * Math.log(p) + (1 - y) * Math.log(1 - p));
}

export function backward(params: Params, x: number[], y: number): Backward {
  const f = forward(params, x);
  const { z, p } = f;
  const dLdp = -y / p + (1 - y) / (1 - p);
  const dpds = p * (1 - p);
  // The chain −y/p · p(1−p) collapses to p − y; store the collapsed form so the
  // identity ∂L/∂W⁽⁰⁾ = −(1−p) z holds exactly when y = 1.
  const dLds = p - y;
  const dLdw0 = z.map((zi) => dLds * zi);
  const dLdz = params.w0.map((w) => dLds * w);
  const dzda = z.map((zi) => zi * (1 - zi));
  const dLda = dLdz.map((g, i) => g * dzda[i]);
  const dLdw1 = dLda.map((g) => x.map((xj) => g * xj));
  return { dLdp, dpds, dLds, dLdw0, dLdz, dzda, dLda, dLdw1 };
}

function lossAt(params: Params, x: number[], y: number): number {
  return bce(forward(params, x).p, y);
}

// Central finite differences on every weight: the check that backprop is right.
export function numericGradient(params: Params, x: number[], y: number, eps = 1e-5): { dLdw0: number[]; dLdw1: number[][] } {
  const dLdw0 = params.w0.map((_, i) => {
    const plus = { ...params, w0: params.w0.map((w, k) => (k === i ? w + eps : w)) };
    const minus = { ...params, w0: params.w0.map((w, k) => (k === i ? w - eps : w)) };
    return (lossAt(plus, x, y) - lossAt(minus, x, y)) / (2 * eps);
  });
  const dLdw1 = params.w1.map((row, i) =>
    row.map((_, j) => {
      const bump = (d: number) => ({ ...params, w1: params.w1.map((r, ii) => r.map((w, jj) => (ii === i && jj === j ? w + d : w))) });
      return (lossAt(bump(eps), x, y) - lossAt(bump(-eps), x, y)) / (2 * eps);
    }),
  );
  return { dLdw0, dLdw1 };
}

// The numbers on the page: x = (1.0, 0.5) with label y = 1.
export const DEMO_X = [1.0, 0.5];
export const DEMO_Y = 1;
export const DEMO_PARAMS: Params = {
  w1: [
    [0.8, -0.4],
    [0.3, 0.9],
  ],
  w0: [0.7, -1.1],
};

// ---- Residual Connection -------------------------------------------------

// One ∂f/∂x per layer, drawn uniformly from [−0.4, 0.6] with a fixed seed.
export function layerFactors(seed: number, n: number): number[] {
  const rng = createRng(seed);
  return Array.from({ length: n }, () => -0.4 + rng() * 1.0);
}

// Cumulative |∂L/∂x| after each layer, starting from 1 at the output. A plain
// layer multiplies by ∂f/∂x; a residual layer y = x + f(x) multiplies by 1 + ∂f/∂x.
export function gradientChain(factors: number[], residual: boolean): number[] {
  const out: number[] = [];
  let product = 1;
  for (const f of factors) {
    product *= residual ? 1 + f : f;
    out.push(Math.abs(product));
  }
  return out;
}

export const RESIDUAL_SEED = 8;
export const MAX_DEPTH = 30;
