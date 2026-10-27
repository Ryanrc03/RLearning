// Causal Inference chapter: Pearson correlation, ordinary least squares in one
// and several variables, and difference-in-differences. Pure functions; see
// tests/causal.test.ts.

import { normalCdf } from "@/lib/ml/abtest";
import { randomNormal, type Rng } from "@/lib/ml/random";

// ---- Moments and correlation ---------------------------------------------

export function mean(xs: readonly number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

// Sample covariance with the n − 1 denominator.
export function covariance(xs: readonly number[], ys: readonly number[]): number {
  if (xs.length !== ys.length || xs.length < 2) throw new Error("need two equally long samples");
  const mx = mean(xs);
  const my = mean(ys);
  let s = 0;
  for (let i = 0; i < xs.length; i++) s += (xs[i] - mx) * (ys[i] - my);
  return s / (xs.length - 1);
}

export function variance(xs: readonly number[]): number {
  return covariance(xs, xs);
}

export function sd(xs: readonly number[]): number {
  return Math.sqrt(variance(xs));
}

// Pearson's r = cov(x, y) / (s_x s_y); 0 when either sample is constant.
export function pearson(xs: readonly number[], ys: readonly number[]): number {
  const sx = sd(xs);
  const sy = sd(ys);
  if (sx === 0 || sy === 0) return 0;
  return covariance(xs, ys) / (sx * sy);
}

// Correlation of x and y after regressing both on z: what is left once z is held fixed.
export function partialCorrelation(xs: readonly number[], ys: readonly number[], zs: readonly number[]): number {
  const rxy = pearson(xs, ys);
  const rxz = pearson(xs, zs);
  const ryz = pearson(ys, zs);
  const den = Math.sqrt((1 - rxz * rxz) * (1 - ryz * ryz));
  return den === 0 ? 0 : (rxy - rxz * ryz) / den;
}

// ---- Simple linear regression --------------------------------------------

export type Fit = { slope: number; intercept: number; r: number; r2: number; sse: number };

// Least squares line y = intercept + slope · x. slope = cov / var = r · s_y / s_x.
export function olsFit(xs: readonly number[], ys: readonly number[]): Fit {
  const vx = variance(xs);
  const slope = vx === 0 ? 0 : covariance(xs, ys) / vx;
  const intercept = mean(ys) - slope * mean(xs);
  const r = pearson(xs, ys);
  return { slope, intercept, r, r2: r * r, sse: sse(xs, ys, slope, intercept) };
}

// Sum of squared residuals of an arbitrary line.
export function sse(xs: readonly number[], ys: readonly number[], slope: number, intercept: number): number {
  let s = 0;
  for (let i = 0; i < xs.length; i++) {
    const e = ys[i] - (intercept + slope * xs[i]);
    s += e * e;
  }
  return s;
}

// The intercept that keeps a line of the given slope through (x̄, ȳ); OLS always passes there.
export function interceptThroughMean(xs: readonly number[], ys: readonly number[], slope: number): number {
  return mean(ys) - slope * mean(xs);
}

// ---- Multiple regression (small, dense normal equations) ------------------

// Solve A x = b by Gaussian elimination with partial pivoting.
export function solveLinear(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-12) throw new Error("singular design matrix");
    [M[col], M[piv]] = [M[piv], M[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

// OLS on rows of regressors (no intercept column added; pass a 1 yourself).
export function olsMulti(X: readonly (readonly number[])[], y: readonly number[]): number[] {
  const p = X[0].length;
  const XtX = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  const Xty = new Array<number>(p).fill(0);
  for (let i = 0; i < X.length; i++) {
    for (let a = 0; a < p; a++) {
      Xty[a] += X[i][a] * y[i];
      for (let b = 0; b < p; b++) XtX[a][b] += X[i][a] * X[i][b];
    }
  }
  return solveLinear(XtX, Xty);
}

// ---- Difference-in-differences -------------------------------------------

export type DidCells = { treatBefore: number; treatAfter: number; ctrlBefore: number; ctrlAfter: number };

export type DidEstimate = {
  /** Treated after − treated before: absorbs whatever happened to everyone. */
  beforeAfter: number;
  /** Treated after − control after: absorbs the groups' permanent gap. */
  crossSection: number;
  /** Control's change, the stand-in for what the treated group would have done anyway. */
  controlTrend: number;
  /** Where the treated group would have been without treatment. */
  counterfactual: number;
  did: number;
};

export function didEstimate(c: DidCells): DidEstimate {
  const beforeAfter = c.treatAfter - c.treatBefore;
  const crossSection = c.treatAfter - c.ctrlAfter;
  const controlTrend = c.ctrlAfter - c.ctrlBefore;
  const counterfactual = c.treatBefore + controlTrend;
  return { beforeAfter, crossSection, controlTrend, counterfactual, did: beforeAfter - controlTrend };
}

export type DidRow = { treated: 0 | 1; post: 0 | 1; y: number };

// y = β0 + β1·treated + β2·post + β3·treated×post; β3 is the DiD estimate.
export function didRegression(rows: readonly DidRow[]): { b0: number; b1: number; b2: number; b3: number } {
  const X = rows.map((r) => [1, r.treated, r.post, r.treated * r.post]);
  const [b0, b1, b2, b3] = olsMulti(X, rows.map((r) => r.y));
  return { b0, b1, b2, b3 };
}

// Two-sided p-value for an estimate with a reported standard error, normal approximation.
export function waldTest(estimate: number, se: number): { t: number; p: number } {
  const t = estimate / se;
  return { t, p: Math.min(1, 2 * (1 - normalCdf(Math.abs(t)))) };
}

// ---- Synthetic data for the figures --------------------------------------

export type XY = { xs: number[]; ys: number[] };

// n points with population correlation r: x ~ N(0,1), y = r x + √(1 − r²) ε, then scaled.
export function makeCorrelated(rng: Rng, n: number, r: number, scale: { mx: number; sx: number; my: number; sy: number }): XY {
  const xs: number[] = [];
  const ys: number[] = [];
  const k = Math.sqrt(Math.max(0, 1 - r * r));
  for (let i = 0; i < n; i++) {
    const x = randomNormal(rng);
    const y = r * x + k * randomNormal(rng);
    xs.push(scale.mx + scale.sx * x);
    ys.push(scale.my + scale.sy * y);
  }
  return { xs, ys };
}

// Correlation standardises the noise the same way for every target r, so that
// dragging r only rotates the cloud instead of redrawing it.
export function rotateToCorrelation(base: { u: number[]; e: number[] }, r: number, scale: { mx: number; sx: number; my: number; sy: number }): XY {
  const k = Math.sqrt(Math.max(0, 1 - r * r));
  return {
    xs: base.u.map((u) => scale.mx + scale.sx * u),
    ys: base.u.map((u, i) => scale.my + scale.sy * (r * u + k * base.e[i])),
  };
}

// A U shape: strongly dependent, nearly zero Pearson r.
export function makeUShape(rng: Rng, n: number): XY {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = -2 + 4 * ((i + 0.5) / n);
    xs.push(x);
    ys.push(x * x + randomNormal(rng, 0, 0.35));
  }
  return { xs, ys };
}

// Ice cream and drownings both driven by temperature z (°C, clipped to a plausible range).
export function makeConfounded(rng: Rng, n: number): { xs: number[]; ys: number[]; zs: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];
  const zs: number[] = [];
  for (let i = 0; i < n; i++) {
    const z = Math.min(38, Math.max(10, randomNormal(rng, 24, 6)));
    zs.push(z);
    xs.push(150 + 8 * (z - 24) + randomNormal(rng, 0, 20)); // ice creams sold that day
    ys.push(5 + 0.3 * (z - 24) + randomNormal(rng, 0, 1.0)); // drownings that day
  }
  return { xs, ys, zs };
}
