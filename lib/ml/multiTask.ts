// Recommender Systems: multi-task ranking and score fusion. The toy draws click
// and like labels that are almost unrelated (as in KuaiRand, corr 0.08) and
// fuses two heads as score = log p_click + w · log p_like (kurec/fusion.py).
// Real Day 4 numbers from kuairank docs/MTL.zh-CN.md §7 sit next to it.
// No React here; see tests/multi-task.test.ts.

import { gauc, type UserScored } from "./gauc";
import { createRng, randomNormal } from "./random";

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export const FUSION_TOY = { users: 80, items: 40, rho: 0.1, clickBias: -0.5, likeBias: -2.6, clickSlope: 1.5, likeSlope: 1.8, headNoise: 0.6, seed: 2023 };

export type ToyRow = { user: number; click: boolean; like: boolean; pClick: number; pLike: number };

// Per item: latent click appetite a and like appetite b = ρ·a + √(1−ρ²)·e; labels from those, each head sees its own latent plus noise.
export function fusionToy(cfg = FUSION_TOY): ToyRow[] {
  const rng = createRng(cfg.seed);
  const rows: ToyRow[] = [];
  for (let u = 0; u < cfg.users; u++) {
    for (let i = 0; i < cfg.items; i++) {
      const a = randomNormal(rng);
      const b = cfg.rho * a + Math.sqrt(1 - cfg.rho ** 2) * randomNormal(rng);
      const click = rng() < sigmoid(cfg.clickBias + cfg.clickSlope * a);
      const like = rng() < sigmoid(cfg.likeBias + cfg.likeSlope * b);
      const pClick = sigmoid(cfg.clickBias + cfg.clickSlope * (a + cfg.headNoise * randomNormal(rng)));
      const pLike = sigmoid(cfg.likeBias + cfg.likeSlope * (b + cfg.headNoise * randomNormal(rng)));
      rows.push({ user: u, click, like, pClick, pLike });
    }
  }
  return rows;
}

// Multiplicative fusion: Σ_t w_t log p_t. Multiplying a head by a constant shifts every score equally, so only weight ratios matter.
export function fuse(ps: readonly number[], ws: readonly number[]): number {
  return ps.reduce((s, p, t) => s + ws[t] * Math.log(Math.max(p, 1e-7)), 0);
}

export function fusedGauc(rows: readonly ToyRow[], wLike: number) {
  const scored = rows.map((r) => fuse([r.pClick, r.pLike], [1, wLike]));
  const as = (label: "click" | "like"): UserScored[] => rows.map((r, i) => ({ user: r.user, score: scored[i], label: r[label] }));
  const click = gauc(as("click"));
  const like = gauc(as("like"));
  return { click, like, mean: (click + like) / 2 };
}

export function pearson(xs: readonly number[], ys: readonly number[]): number {
  const n = xs.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return num / Math.sqrt(dx * dy);
}

// --- real numbers, kuairank docs/MTL.zh-CN.md §7 (PLE #31's four heads, test tab1 and random) ---

export type FusionSetting = { label: string; w: [number, number, number]; tab1: [number, number, number]; random: [number, number, number] };
export const REAL_FUSION: FusionSetting[] = [
  { label: "只用 click 头", w: [1, 0, 0], tab1: [0.6616, 0.6631, 0.4933], random: [0.6366, 0.6509, 0.4605] },
  { label: "valid 上选出", w: [1, 0.5, 0.25], tab1: [0.6496, 0.6593, 0.5351], random: [0.6196, 0.637, 0.5009] },
  { label: "random 上选出", w: [1, 0, 0.25], tab1: [0.6317, 0.6215, 0.5776], random: [0.6044, 0.612, 0.5484] },
];

export const fusionMean = (g: readonly number[]) => g.reduce((s, v) => s + v, 0) / g.length;

// Paired GAUC differences against the single-task model with the same input, test tab1 (null = interval not reported).
export type Diff = { d: number; lo: number | null; hi: number | null };
export const MTL_LABELS = ["click", "long_view", "like", "follow"] as const;
export const SINGLE_TASK: Record<(typeof MTL_LABELS)[number], number> = { click: 0.6614, long_view: 0.6845, like: 0.6606, follow: 0.6344 };
export const MTL_DIFFS: { arch: string; run: number; diffs: Diff[] }[] = [
  { arch: "shared-bottom", run: 30, diffs: [{ d: -0.0003, lo: null, hi: null }, { d: -0.0013, lo: -0.0016, hi: -0.0009 }, { d: -0.0128, lo: -0.0226, hi: -0.0023 }, { d: 0.0006, lo: null, hi: null }] },
  { arch: "MMoE", run: 27, diffs: [{ d: 0.0008, lo: 0.0004, hi: 0.0012 }, { d: -0.0003, lo: null, hi: null }, { d: -0.0163, lo: -0.0258, hi: -0.0069 }, { d: -0.0007, lo: null, hi: null }] },
  { arch: "PLE", run: 31, diffs: [{ d: 0.0002, lo: null, hi: null }, { d: 0.0001, lo: null, hi: null }, { d: -0.0104, lo: -0.02, hi: -0.001 }, { d: 0.0182, lo: -0.0077, hi: 0.0448 }] },
];
