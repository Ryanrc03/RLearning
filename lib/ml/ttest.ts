// t-test arithmetic for the Evaluation chapter: Student's t distribution via the
// regularized incomplete beta, Welch / Student / paired tests on raw samples.
// Pure functions; see tests/ttest.test.ts.

import { normalCdf } from "@/lib/ml/abtest";
import { randomNormal, type Rng } from "@/lib/ml/random";

// Lanczos approximation (g = 7, n = 9); ~15 significant digits for x > 0.
const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

export function logGamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  const z = x - 1;
  let a = LANCZOS[0];
  const t = z + 7.5;
  for (let i = 1; i < 9; i++) a += LANCZOS[i] / (z + i);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

// Continued fraction for the incomplete beta (modified Lentz, Numerical Recipes betacf).
function betaContinuedFraction(x: number, a: number, b: number): number {
  const TINY = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < TINY) d = TINY;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-14) break;
  }
  return h;
}

// I_x(a, b), the regularized incomplete beta function.
export function regularizedIncompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  // The continued fraction converges fast only below the mean; use the symmetry otherwise.
  if (x < (a + 1) / (a + b + 2)) return (front * betaContinuedFraction(x, a, b)) / a;
  return 1 - (front * betaContinuedFraction(1 - x, b, a)) / b;
}

export function studentTPdf(t: number, df: number): number {
  const logC = logGamma((df + 1) / 2) - logGamma(df / 2) - 0.5 * Math.log(df * Math.PI);
  return Math.exp(logC - ((df + 1) / 2) * Math.log(1 + (t * t) / df));
}

// P(T ≤ t) for Student's t with df degrees of freedom (df may be fractional, as Welch's is).
export function studentTCdf(t: number, df: number): number {
  if (!Number.isFinite(df) || df > 1e7) return normalCdf(t);
  const tail = 0.5 * regularizedIncompleteBeta(df / (df + t * t), df / 2, 0.5);
  return t > 0 ? 1 - tail : tail;
}

// Inverse CDF by bisection: the critical value t* that the figure draws next to z* = 1.96.
export function studentTQuantile(p: number, df: number): number {
  if (p <= 0 || p >= 1) throw new Error("p must be in (0, 1)");
  let lo = -1e3;
  let hi = 1e3;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (studentTCdf(mid, df) < p) lo = mid;
    else hi = mid;
    if (hi - lo < 1e-10) break;
  }
  return (lo + hi) / 2;
}

export type Alternative = "two-sided" | "greater" | "less";

// p-value of an observed t under H0; "greater" means H1 says the difference is positive.
export function tPValue(t: number, df: number, alternative: Alternative = "two-sided"): number {
  if (alternative === "greater") return 1 - studentTCdf(t, df);
  if (alternative === "less") return studentTCdf(t, df);
  return Math.min(1, 2 * (1 - studentTCdf(Math.abs(t), df)));
}

export type SampleStats = { n: number; mean: number; variance: number; sd: number };

// Mean and the unbiased (n − 1) sample variance.
export function sampleStats(xs: readonly number[]): SampleStats {
  const n = xs.length;
  if (n < 2) throw new Error("need at least two observations");
  const mean = xs.reduce((s, x) => s + x, 0) / n;
  const variance = xs.reduce((s, x) => s + (x - mean) * (x - mean), 0) / (n - 1);
  return { n, mean, variance, sd: Math.sqrt(variance) };
}

export type TTestResult = { diff: number; se: number; t: number; df: number; p: number };

function finish(diff: number, se: number, df: number, alternative: Alternative): TTestResult {
  const t = se === 0 ? 0 : diff / se;
  return { diff, se, t, df, p: tPValue(t, df, alternative) };
}

// Welch's t test for mean(b) − mean(a); does not assume equal variances.
export function welchTTest(a: readonly number[], b: readonly number[], alternative: Alternative = "two-sided"): TTestResult {
  const sa = sampleStats(a);
  const sb = sampleStats(b);
  const va = sa.variance / sa.n;
  const vb = sb.variance / sb.n;
  const se = Math.sqrt(va + vb);
  // Welch–Satterthwaite: effective degrees of freedom of the combined variance estimate.
  const df = va + vb === 0 ? sa.n + sb.n - 2 : ((va + vb) * (va + vb)) / ((va * va) / (sa.n - 1) + (vb * vb) / (sb.n - 1));
  return finish(sb.mean - sa.mean, se, df, alternative);
}

// Student's pooled-variance t test; correct only when both groups share one variance.
export function studentTTest(a: readonly number[], b: readonly number[], alternative: Alternative = "two-sided"): TTestResult {
  const sa = sampleStats(a);
  const sb = sampleStats(b);
  const df = sa.n + sb.n - 2;
  const pooled = ((sa.n - 1) * sa.variance + (sb.n - 1) * sb.variance) / df;
  const se = Math.sqrt(pooled * (1 / sa.n + 1 / sb.n));
  return finish(sb.mean - sa.mean, se, df, alternative);
}

// Paired t test for after − before on the same units: a one-sample t test on the differences.
export function pairedTTest(before: readonly number[], after: readonly number[], alternative: Alternative = "two-sided"): TTestResult {
  if (before.length !== after.length) throw new Error("paired samples need equal length");
  const d = sampleStats(after.map((x, i) => x - before[i]));
  return finish(d.mean, d.sd / Math.sqrt(d.n), d.n - 1, alternative);
}

// The same statistic read off the normal instead of t: what a z test would wrongly report on small n.
export function zPValue(t: number, alternative: Alternative = "two-sided"): number {
  if (alternative === "greater") return 1 - normalCdf(t);
  if (alternative === "less") return normalCdf(t);
  return Math.min(1, 2 * (1 - normalCdf(Math.abs(t))));
}

// Independent groups: n units per arm, each arm with its own mean and spread.
export function drawIndependent(rng: Rng, n: number, a: { mean: number; sd: number }, b: { mean: number; sd: number }) {
  const xa: number[] = [];
  const xb: number[] = [];
  for (let i = 0; i < n; i++) {
    xa.push(randomNormal(rng, a.mean, a.sd));
    xb.push(randomNormal(rng, b.mean, b.sd));
  }
  return { a: xa, b: xb };
}

// Paired units: each unit has its own level (prime time vs late night), measured before and after a change.
export function drawPaired(rng: Rng, n: number, opts: { level: number; levelSd: number; effect: number; noiseSd: number }) {
  const before: number[] = [];
  const after: number[] = [];
  for (let i = 0; i < n; i++) {
    const level = randomNormal(rng, opts.level, opts.levelSd);
    before.push(level + randomNormal(rng, 0, opts.noiseSd));
    after.push(level + opts.effect + randomNormal(rng, 0, opts.noiseSd));
  }
  return { before, after };
}
