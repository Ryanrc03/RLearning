// Two-proportion A/B test arithmetic for the Evaluation chapter. Pure functions;
// see tests/abtest.test.ts.

import type { Rng } from "@/lib/ml/random";

// Abramowitz & Stegun 7.1.26: |error| < 1.5e-7, plenty for a figure.
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
  return sign * y;
}

export function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

// Acklam's rational approximation of the inverse normal CDF (relative error ~1e-9).
export function normalQuantile(p: number): number {
  if (p <= 0 || p >= 1) throw new Error("p must be in (0, 1)");
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const low = 0.02425;
  const high = 1 - low;
  let q: number;
  if (p < low) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > high) {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

export type ZTestResult = { pA: number; pB: number; diff: number; se: number; z: number; p: number };

// Pooled two-sided z test for "treatment rate ≠ control rate".
export function zTestTwoProportions(xA: number, nA: number, xB: number, nB: number): ZTestResult {
  const pA = xA / nA;
  const pB = xB / nB;
  const pooled = (xA + xB) / (nA + nB);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / nA + 1 / nB));
  const diff = pB - pA;
  const z = se === 0 ? 0 : diff / se;
  const p = 2 * (1 - normalCdf(Math.abs(z)));
  return { pA, pB, diff, se, z, p: Math.min(1, p) };
}

// Power of the two-sided test at per-group size n when the true rates are pA and pB.
export function powerTwoProportions(pA: number, pB: number, n: number, alpha = 0.05): number {
  const zAlpha = normalQuantile(1 - alpha / 2);
  const pBar = (pA + pB) / 2;
  const se0 = Math.sqrt((2 * pBar * (1 - pBar)) / n);
  const se1 = Math.sqrt((pA * (1 - pA) + pB * (1 - pB)) / n);
  const delta = Math.abs(pB - pA);
  return 1 - normalCdf((zAlpha * se0 - delta) / se1) + normalCdf((-zAlpha * se0 - delta) / se1);
}

// Per-group sample size for the usual α / power pair (the "power analysis" step of the notes).
export function requiredSampleSize(pA: number, pB: number, alpha = 0.05, power = 0.8): number {
  const zAlpha = normalQuantile(1 - alpha / 2);
  const zBeta = normalQuantile(power);
  const pBar = (pA + pB) / 2;
  const num = zAlpha * Math.sqrt(2 * pBar * (1 - pBar)) + zBeta * Math.sqrt(pA * (1 - pA) + pB * (1 - pB));
  return Math.ceil((num * num) / ((pB - pA) * (pB - pA)));
}

// Draw n users per group with the given true conversion rates.
export function simulateAB(rng: Rng, pA: number, pB: number, n: number): { xA: number; xB: number } {
  let xA = 0;
  let xB = 0;
  for (let i = 0; i < n; i++) {
    if (rng() < pA) xA++;
    if (rng() < pB) xB++;
  }
  return { xA, xB };
}
