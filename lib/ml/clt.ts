// A/B Testing chapter: the central limit theorem, one-sample hypothesis tests,
// rejection regions and power, and the exact binomial test behind the gacha
// example. Pure functions; see tests/clt.test.ts.

import { normalCdf, normalQuantile } from "@/lib/ml/abtest";
import { randomNormal, type Rng } from "@/lib/ml/random";
import { logGamma } from "@/lib/ml/ttest";

export type Alternative = "two-sided" | "less" | "greater";

export function normalPdf(x: number, mean = 0, sd = 1): number {
  const z = (x - mean) / sd;
  return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI));
}

// ---- Populations for the CLT figure --------------------------------------

export type PopulationKey = "dice" | "delivery" | "ratings";

export type Population = {
  key: PopulationKey;
  label: string;
  unit: string;
  mean: number;
  sd: number;
  /** Where the figure draws the population and the means. */
  domain: [number, number];
  /** Bin width for the population histogram. */
  bin: number;
  draw: (rng: Rng) => number;
};

// A fair die: uniform on 1..6, mean 3.5, variance 35/12.
const dice: Population = {
  key: "dice",
  label: "掷一个骰子",
  unit: "点",
  mean: 3.5,
  sd: Math.sqrt(35 / 12),
  domain: [0.5, 6.5],
  bin: 1,
  draw: (rng) => 1 + Math.floor(rng() * 6),
};

// Delivery time in minutes: 20 + Exp(mean 15), strongly right-skewed, mean 35, sd 15.
const delivery: Population = {
  key: "delivery",
  label: "外卖送达时间",
  unit: "分钟",
  mean: 35,
  sd: 15,
  domain: [15, 95],
  bin: 4,
  draw: (rng) => 20 - 15 * Math.log(1 - rng()),
};

// App-store ratings when people only bother at the extremes: 60% give 5, 30% give 1, 10% give 3.
const RATING_P = [0.3, 0, 0.1, 0, 0.6];
const RATING_MEAN = RATING_P.reduce((s, p, i) => s + p * (i + 1), 0);
const RATING_SD = Math.sqrt(RATING_P.reduce((s, p, i) => s + p * (i + 1 - RATING_MEAN) ** 2, 0));
const ratings: Population = {
  key: "ratings",
  label: "应用商店评分",
  unit: "星",
  mean: RATING_MEAN,
  sd: RATING_SD,
  domain: [0.5, 5.5],
  bin: 1,
  draw: (rng) => {
    const u = rng();
    let acc = 0;
    for (let i = 0; i < RATING_P.length; i++) {
      acc += RATING_P[i];
      if (u < acc) return i + 1;
    }
    return 5;
  },
};

export const POPULATIONS: Record<PopulationKey, Population> = { dice, delivery, ratings };

// reps sample means, each the average of n draws.
export function sampleMeans(rng: Rng, pop: Population, n: number, reps: number): number[] {
  const out: number[] = [];
  for (let r = 0; r < reps; r++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += pop.draw(rng);
    out.push(s / n);
  }
  return out;
}

export type Histogram = { edges: number[]; counts: number[]; density: number[] };

// Fixed-width bins over [lo, hi); values outside are dropped. density integrates to ≤ 1.
export function histogram(values: readonly number[], lo: number, hi: number, binWidth: number): Histogram {
  const k = Math.max(1, Math.round((hi - lo) / binWidth));
  const counts = new Array<number>(k).fill(0);
  for (const v of values) {
    const i = Math.floor((v - lo) / binWidth);
    if (i >= 0 && i < k) counts[i]++;
  }
  const edges = Array.from({ length: k + 1 }, (_, i) => lo + i * binWidth);
  const total = values.length || 1;
  return { edges, counts, density: counts.map((c) => c / (total * binWidth)) };
}

// Largest gap between the empirical CDF of the values and N(mean, sd): the
// Kolmogorov distance, how far the picture still is from the normal.
export function maxCdfGap(values: readonly number[], mean: number, sd: number): number {
  const xs = [...values].sort((a, b) => a - b);
  const n = xs.length;
  let gap = 0;
  for (let i = 0; i < n; i++) {
    const f = normalCdf((xs[i] - mean) / sd);
    gap = Math.max(gap, Math.abs(f - i / n), Math.abs(f - (i + 1) / n));
  }
  return gap;
}

export function skewness(values: readonly number[]): number {
  const n = values.length;
  const mean = values.reduce((s, x) => s + x, 0) / n;
  const m2 = values.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
  const m3 = values.reduce((s, x) => s + (x - mean) ** 3, 0) / n;
  return m2 === 0 ? 0 : m3 / Math.pow(m2, 1.5);
}

// ---- One-sample z test and the rejection region --------------------------

export type ZTest = { z: number; se: number; p: number };

// H0: μ = mu0 against the given alternative, population sd known (or n large).
export function oneSampleZTest(xbar: number, mu0: number, sd: number, n: number, alternative: Alternative = "two-sided"): ZTest {
  const se = sd / Math.sqrt(n);
  const z = (xbar - mu0) / se;
  return { z, se, p: zTailProbability(z, alternative) };
}

// P(Z at least as extreme as z) under N(0, 1), the p-value for a standardised statistic.
export function zTailProbability(z: number, alternative: Alternative = "two-sided"): number {
  if (alternative === "greater") return 1 - normalCdf(z);
  if (alternative === "less") return normalCdf(z);
  return Math.min(1, 2 * (1 - normalCdf(Math.abs(z))));
}

export type RejectionRegion = { lower: number | null; upper: number | null };

// Critical z values whose tail area is exactly alpha: reject when z is beyond them.
export function rejectionRegion(alpha: number, alternative: Alternative = "two-sided"): RejectionRegion {
  if (alternative === "less") return { lower: normalQuantile(alpha), upper: null };
  if (alternative === "greater") return { lower: null, upper: normalQuantile(1 - alpha) };
  const c = normalQuantile(1 - alpha / 2);
  return { lower: -c, upper: c };
}

export function isRejected(z: number, region: RejectionRegion): boolean {
  return (region.lower !== null && z <= region.lower) || (region.upper !== null && z >= region.upper);
}

// Power when the true standardised effect is delta = (μ1 − μ0) / se: the
// probability that a draw from N(delta, 1) lands in the rejection region.
export function power(delta: number, alpha: number, alternative: Alternative = "two-sided"): number {
  const r = rejectionRegion(alpha, alternative);
  let p = 0;
  if (r.lower !== null) p += normalCdf(r.lower - delta);
  if (r.upper !== null) p += 1 - normalCdf(r.upper - delta);
  return Math.min(1, p);
}

// ---- Binomial: exact and normal-approximated tests on a proportion --------

export function binomialLogPmf(k: number, n: number, p: number): number {
  if (k < 0 || k > n) return -Infinity;
  if (p === 0) return k === 0 ? 0 : -Infinity;
  if (p === 1) return k === n ? 0 : -Infinity;
  return logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1) + k * Math.log(p) + (n - k) * Math.log(1 - p);
}

export function binomialPmf(k: number, n: number, p: number): number {
  return Math.exp(binomialLogPmf(k, n, p));
}

// P(X ≤ k)
export function binomialCdf(k: number, n: number, p: number): number {
  if (k < 0) return 0;
  if (k >= n) return 1;
  let s = 0;
  for (let i = 0; i <= k; i++) s += binomialPmf(i, n, p);
  return Math.min(1, s);
}

export type ProportionTest = { k: number; n: number; pHat: number; pExact: number; pNormal: number; z: number; se: number };

// Observed k successes in n trials against H0: p = p0. pExact sums binomial
// probabilities; pNormal is the CLT shortcut z = (p̂ − p0) / √(p0(1 − p0)/n).
export function proportionTest(k: number, n: number, p0: number, alternative: Alternative = "less"): ProportionTest {
  const pHat = k / n;
  const se = Math.sqrt((p0 * (1 - p0)) / n);
  const z = (pHat - p0) / se;
  let pExact: number;
  if (alternative === "less") pExact = binomialCdf(k, n, p0);
  else if (alternative === "greater") pExact = 1 - binomialCdf(k - 1, n, p0);
  else {
    // Two-sided: sum every outcome at most as likely as the observed one.
    const obs = binomialPmf(k, n, p0);
    pExact = 0;
    for (let i = 0; i <= n; i++) {
      const pi = binomialPmf(i, n, p0);
      if (pi <= obs * (1 + 1e-9)) pExact += pi;
    }
    pExact = Math.min(1, pExact);
  }
  return { k, n, pHat, pExact, pNormal: zTailProbability(z, alternative), z, se };
}

// Largest k with P(X ≤ k) ≤ alpha under H0: the lower-tail rejection region in counts.
export function binomialCriticalLow(n: number, p0: number, alpha: number): number {
  let acc = 0;
  for (let k = 0; k <= n; k++) {
    acc += binomialPmf(k, n, p0);
    if (acc > alpha) return k - 1;
  }
  return n;
}

// Bernoulli stream so the figure can grow n without redrawing what is already shown.
export function drawPulls(rng: Rng, n: number, rate: number): boolean[] {
  return Array.from({ length: n }, () => rng() < rate);
}

export function countTrue(pulls: readonly boolean[], n: number): number {
  let k = 0;
  for (let i = 0; i < n && i < pulls.length; i++) if (pulls[i]) k++;
  return k;
}

export { normalCdf, normalQuantile, randomNormal };
