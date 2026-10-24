// Recommender Systems: GAUC and the paired user bootstrap. GAUC averages one AUC
// per user, weighted by the user's sample count, so a per-user constant shift
// in the scores cannot move it. The paired bootstrap resamples users once and
// scores both models on the same draw. No React here; see tests/gauc.test.ts.

import { auc, type Scored } from "./metrics";
import { clamp, createRng, randomNormal } from "./random";

export type UserScored = Scored & { user: number };

export type UserAuc = { user: number; auc: number; n: number; nPos: number };

// One AUC per user that has both classes; single-class users are skipped (as in kurec/metrics.py).
export function perUserAuc(items: readonly UserScored[]): UserAuc[] {
  const byUser = new Map<number, UserScored[]>();
  for (const it of items) {
    const list = byUser.get(it.user) ?? [];
    list.push(it);
    byUser.set(it.user, list);
  }
  const out: UserAuc[] = [];
  for (const [user, list] of [...byUser.entries()].sort((a, b) => a[0] - b[0])) {
    const nPos = list.filter((x) => x.label).length;
    if (nPos === 0 || nPos === list.length) continue;
    out.push({ user, auc: auc(list), n: list.length, nPos });
  }
  return out;
}

export function weightedMean(values: readonly number[], weights: readonly number[]): number {
  let num = 0;
  let den = 0;
  values.forEach((v, i) => {
    num += v * weights[i];
    den += weights[i];
  });
  return den === 0 ? 0 : num / den;
}

// Σ_u n_u · AUC_u / Σ_u n_u over users with both classes.
export function gauc(items: readonly UserScored[]): number {
  const per = perUserAuc(items);
  return weightedMean(per.map((p) => p.auc), per.map((p) => p.n));
}

const logit = (p: number) => Math.log(p / (1 - p));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

// Six users whose own click rates span the real p5–p95 range (0.17–0.79, EDA §4).
export const GAUC_USERS = [0.17, 0.3, 0.45, 0.6, 0.7, 0.79];
export const ITEMS_PER_USER = 30;

export type GaucToyItem = UserScored & { latent: number };

// Labels: p = σ(logit(base_u) + latent), latent ~ N(0, 1). Same seed, same 180 exposures.
export function gaucToyData(seed = 7): { user: number; latent: number; noise: number; label: boolean }[] {
  const rng = createRng(seed);
  const out: { user: number; latent: number; noise: number; label: boolean }[] = [];
  GAUC_USERS.forEach((base, u) => {
    for (let i = 0; i < ITEMS_PER_USER; i++) {
      const latent = randomNormal(rng);
      const noise = randomNormal(rng, 0, 0.8);
      const label = rng() < sigmoid(logit(base) + latent);
      out.push({ user: u, latent, noise, label });
    }
  });
  return out;
}

// Score = σ(β · logit(base_u) + γ · (latent + noise)). β is how much the score knows "who the user is",
// γ = 1 means it also ranks inside the user, γ = 0 means it knows only the user.
export function gaucToyScores(beta: number, withinUser: boolean, seed = 7): GaucToyItem[] {
  const g = withinUser ? 1 : 0;
  return gaucToyData(seed).map((d) => ({
    user: d.user,
    latent: d.latent,
    label: d.label,
    score: sigmoid(beta * logit(GAUC_USERS[d.user]) + g * (d.latent + d.noise)),
  }));
}

export type Interval = { point: number; lo: number; hi: number };

function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const i = Math.floor(pos);
  const f = pos - i;
  return i + 1 < sorted.length ? sorted[i] * (1 - f) + sorted[i + 1] * f : sorted[i];
}

// Resample users with replacement; per-user AUCs stay fixed (gauc_bootstrap in kurec/metrics.py).
export function bootstrapGauc(aucs: readonly number[], weights: readonly number[], nBoot: number, seed: number): Interval {
  const rng = createRng(seed);
  const k = aucs.length;
  const vals: number[] = [];
  for (let b = 0; b < nBoot; b++) {
    let num = 0;
    let den = 0;
    for (let j = 0; j < k; j++) {
      const i = Math.floor(rng() * k);
      num += aucs[i] * weights[i];
      den += weights[i];
    }
    vals.push(num / den);
  }
  vals.sort((a, b) => a - b);
  return { point: weightedMean(aucs, weights), lo: quantile(vals, 0.025), hi: quantile(vals, 0.975) };
}

// Paired: one resample of users per draw, the difference AUC_a − AUC_b per user (gauc_diff_bootstrap).
export function pairedDiffBootstrap(a: readonly number[], b: readonly number[], weights: readonly number[], nBoot: number, seed: number): Interval {
  return bootstrapGauc(a.map((v, i) => v - b[i]), weights, nBoot, seed);
}

// The toy for the paired figure: 80 users with very different per-user AUCs (sd 0.1) and sample counts;
// model B is model A plus a true per-user gain δ plus a little per-user noise (sd 0.02).
export const PAIRED_USERS = 80;

export function pairedToy(delta: number, seed = 31): { a: number[]; b: number[]; w: number[] } {
  // The jitter is centred (weighted) so the average per-user gain is exactly δ.
  const rng = createRng(seed);
  const a: number[] = [];
  const w: number[] = [];
  const jitter: number[] = [];
  for (let u = 0; u < PAIRED_USERS; u++) {
    a.push(clamp(randomNormal(rng, 0.62, 0.1), 0.3, 0.95));
    jitter.push(randomNormal(rng, 0, 0.02));
    w.push(Math.max(2, Math.round(Math.exp(randomNormal(rng, 3, 0.8)))));
  }
  const mj = weightedMean(jitter, w);
  const b = a.map((v, u) => v + delta + jitter[u] - mj);
  return { a, b, w };
}

export function pairedToyIntervals(delta: number, nBoot = 1000) {
  const { a, b, w } = pairedToy(delta);
  return {
    a: bootstrapGauc(a, w, nBoot, 101),
    b: bootstrapGauc(b, w, nBoot, 202),
    diff: pairedDiffBootstrap(b, a, w, nBoot, 303),
  };
}

// Numbers from kuairank docs/EXPERIMENT_LOG.md, random set, is_click: run #5 (LightGBM F1) and #9 (DCN-v2 F1).
export const REAL_RANDOM_CI = {
  lightgbm: { point: 0.618, lo: 0.6068, hi: 0.629 },
  dcnv2: { point: 0.6252, lo: 0.6142, hi: 0.6358 },
  diff: { point: 0.0073, lo: 0.0012, hi: 0.0131 },
};
