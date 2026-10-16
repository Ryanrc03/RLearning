// Least-squares polynomial fits for the Bias / Variance page: a seeded noisy
// sine, a fit of any degree, and train / test mean squared error. The fit is
// solved in a Chebyshev basis on [xMin, xMax] so degree 12 stays numerically
// sane; the function space is the same as plain monomials. No React here;
// see tests/polyfit.test.ts.

import { createRng, randomNormal } from "./random";

export type Dataset = { xs: number[]; ys: number[] };

export type PolyFit = {
  degree: number;
  /** Chebyshev coefficients c₀ … c_degree on t = 2 (x − xMin) / (xMax − xMin) − 1. */
  coef: number[];
  xMin: number;
  xMax: number;
};

/** y = sin(2πx) is the curve the noisy points are drawn from. */
export function trueCurve(x: number): number {
  return Math.sin(2 * Math.PI * x);
}

// n points on [0, 1], one in each of n equal bins so no gap is huge, y = sin(2πx) + N(0, sd²).
export function makeSineData(seed: number, n: number, noiseSd: number): Dataset {
  const rng = createRng(seed);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = (i + rng()) / n;
    xs.push(x);
    ys.push(trueCurve(x) + randomNormal(rng, 0, noiseSd));
  }
  return { xs, ys };
}

function chebyshevRow(t: number, degree: number): number[] {
  const row = [1];
  if (degree >= 1) row.push(t);
  for (let k = 2; k <= degree; k++) row.push(2 * t * row[k - 1] - row[k - 2]);
  return row;
}

// Gaussian elimination with partial pivoting; A is square and modified in place.
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const x = b.slice();
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    [A[col], A[piv]] = [A[piv], A[col]];
    [x[col], x[piv]] = [x[piv], x[col]];
    const d = A[col][col];
    if (d === 0) throw new Error("singular normal equations");
    for (let r = col + 1; r < n; r++) {
      const f = A[r][col] / d;
      if (f === 0) continue;
      for (let c = col; c < n; c++) A[r][c] -= f * A[col][c];
      x[r] -= f * x[col];
    }
  }
  for (let r = n - 1; r >= 0; r--) {
    let s = x[r];
    for (let c = r + 1; c < n; c++) s -= A[r][c] * x[c];
    x[r] = s / A[r][r];
  }
  return x;
}

// Least squares of degree `degree` through the normal equations XᵀX c = Xᵀy with a
// tiny ridge so an over-parameterised fit (degree ≥ n − 1) still has one answer.
export function polyfit(xs: number[], ys: number[], degree: number, ridge = 1e-9): PolyFit {
  if (xs.length !== ys.length || xs.length === 0) throw new Error("xs and ys must have the same non-zero length");
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const span = xMax - xMin || 1;
  const p = degree + 1;
  const A: number[][] = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  const b = new Array<number>(p).fill(0);
  for (let i = 0; i < xs.length; i++) {
    const row = chebyshevRow((2 * (xs[i] - xMin)) / span - 1, degree);
    for (let r = 0; r < p; r++) {
      b[r] += row[r] * ys[i];
      for (let c = 0; c < p; c++) A[r][c] += row[r] * row[c];
    }
  }
  for (let r = 0; r < p; r++) A[r][r] += ridge;
  return { degree, coef: solve(A, b), xMin, xMax };
}

export function polyval(fit: PolyFit, x: number): number {
  const span = fit.xMax - fit.xMin || 1;
  const row = chebyshevRow((2 * (x - fit.xMin)) / span - 1, fit.degree);
  let y = 0;
  for (let k = 0; k < row.length; k++) y += fit.coef[k] * row[k];
  return y;
}

export function mse(ys: number[], preds: number[]): number {
  if (ys.length !== preds.length || ys.length === 0) throw new Error("ys and preds must have the same non-zero length");
  let s = 0;
  for (let i = 0; i < ys.length; i++) s += (ys[i] - preds[i]) ** 2;
  return s / ys.length;
}

export function fitMse(fit: PolyFit, d: Dataset): number {
  return mse(d.ys, d.xs.map((x) => polyval(fit, x)));
}

export type DegreeError = { degree: number; train: number; test: number };

// Train and test MSE for every degree from 1 to maxDegree, fitting on `train` only.
export function errorByDegree(train: Dataset, test: Dataset, maxDegree: number): DegreeError[] {
  const out: DegreeError[] = [];
  for (let d = 1; d <= maxDegree; d++) {
    const fit = polyfit(train.xs, train.ys, d);
    out.push({ degree: d, train: fitMse(fit, train), test: fitMse(fit, test) });
  }
  return out;
}

// The degree with the lowest test error: left of it is underfitting, right of it overfitting.
export function bestDegree(errors: DegreeError[]): number {
  let best = errors[0];
  for (const e of errors) if (e.test < best.test) best = e;
  return best.degree;
}
