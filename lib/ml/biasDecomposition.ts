// Recommender Systems: where the gap between the biased test set and the random-
// exposure set comes from. Real numbers from kuairank Day 5: the tab1-vs-random
// GAUC of 26 learned click models (docs/figures/day5_bias_points.json), the
// item-pool vs selection decomposition (docs/DEBIAS.zh-CN.md §5.2) and the IPS
// popularity weights (kurec/models/deep.py: popularity_weights).
// No React here; see tests/bias-decomposition.test.ts.

export type Stage = "Day 1" | "Day 2" | "Day 3" | "Day 4" | "Day 5";
export type BiasPoint = { run: number; stage: Stage; model: string; features: string; tab1: number; random: number; lo: number; hi: number; calibRandom: number; calibTab1: number };

// The 26 learned is_click models of Day 1–5 (column baselines and long_view runs left out, as in DEBIAS §5.1).
export const BIAS_POINTS: BiasPoint[] = [
  { run: 5, stage: "Day 1", model: "lgbm", features: "F1", tab1: 0.652321, random: 0.617961, lo: 0.606821, hi: 0.628991, calibRandom: 2.7044, calibTab1: 1.0292 },
  { run: 7, stage: "Day 2", model: "deep", features: "F1", tab1: 0.654546, random: 0.621971, lo: 0.610503, hi: 0.632696, calibRandom: 2.6583, calibTab1: 1.0127 },
  { run: 8, stage: "Day 2", model: "deep", features: "F1", tab1: 0.652907, random: 0.622267, lo: 0.610418, hi: 0.63275, calibRandom: 2.6965, calibTab1: 1.023 },
  { run: 9, stage: "Day 2", model: "deep", features: "F1", tab1: 0.653562, random: 0.625245, lo: 0.614241, hi: 0.635824, calibRandom: 2.6062, calibTab1: 1.0001 },
  { run: 11, stage: "Day 2", model: "deep", features: "F1+uid", tab1: 0.654839, random: 0.624924, lo: 0.613328, hi: 0.635912, calibRandom: 2.5922, calibTab1: 1.0285 },
  { run: 12, stage: "Day 2", model: "deep", features: "F1+uid+aid", tab1: 0.653625, random: 0.625315, lo: 0.613652, hi: 0.635606, calibRandom: 2.6197, calibTab1: 1.008 },
  { run: 13, stage: "Day 2", model: "deep", features: "F1+uid+aid+vid", tab1: 0.653231, random: 0.626671, lo: 0.61493, hi: 0.637271, calibRandom: 2.6427, calibTab1: 1.0094 },
  { run: 14, stage: "Day 2", model: "deep", features: "F1", tab1: 0.653248, random: 0.624135, lo: 0.61298, hi: 0.634921, calibRandom: 2.7064, calibTab1: 1.0248 },
  { run: 15, stage: "Day 2", model: "deep", features: "F1", tab1: 0.654399, random: 0.626268, lo: 0.615319, hi: 0.636614, calibRandom: 2.5988, calibTab1: 1.0251 },
  { run: 16, stage: "Day 3", model: "seq", features: "F1+vid+aid+tag", tab1: 0.652769, random: 0.62824, lo: 0.616946, hi: 0.638626, calibRandom: 2.6213, calibTab1: 0.9935 },
  { run: 17, stage: "Day 3", model: "seq", features: "F2[all,N=50,vid+aid+tag]", tab1: 0.659011, random: 0.633098, lo: 0.621891, hi: 0.643566, calibRandom: 2.7293, calibTab1: 1.0269 },
  { run: 18, stage: "Day 3", model: "seq", features: "F2[all,N=50,vid+aid+tag]", tab1: 0.660485, random: 0.635621, lo: 0.624709, hi: 0.645657, calibRandom: 2.6787, calibTab1: 1.0283 },
  { run: 19, stage: "Day 3", model: "seq", features: "F2[all,N=10,vid+aid+tag]", tab1: 0.661308, random: 0.634328, lo: 0.623235, hi: 0.644546, calibRandom: 2.6953, calibTab1: 1.0103 },
  { run: 20, stage: "Day 3", model: "seq", features: "F2[all,N=200,vid+aid+tag]", tab1: 0.651714, random: 0.632428, lo: 0.621382, hi: 0.642688, calibRandom: 2.914, calibTab1: 1.14 },
  { run: 21, stage: "Day 3", model: "seq", features: "F2[all,N=200,vid+aid+tag]", tab1: 0.652547, random: 0.632998, lo: 0.62204, hi: 0.642872, calibRandom: 2.9039, calibTab1: 1.1234 },
  { run: 22, stage: "Day 3", model: "seq", features: "F2[clicked,N=50,vid+aid+tag]", tab1: 0.643312, random: 0.611853, lo: 0.600739, hi: 0.622295, calibRandom: 2.7531, calibTab1: 1.048 },
  { run: 23, stage: "Day 3", model: "seq", features: "F2[all,N=50,aid+tag]", tab1: 0.662296, random: 0.635299, lo: 0.623893, hi: 0.644697, calibRandom: 2.6867, calibTab1: 1.0285 },
  { run: 24, stage: "Day 3", model: "seq", features: "F2[all,N=10,aid+tag]", tab1: 0.661376, random: 0.63497, lo: 0.623794, hi: 0.645254, calibRandom: 2.6533, calibTab1: 1.0167 },
  { run: 25, stage: "Day 3", model: "seq", features: "F2[all,N=10,aid+tag]", tab1: 0.661416, random: 0.634584, lo: 0.622895, hi: 0.64476, calibRandom: 2.644, calibTab1: 1.014 },
  { run: 27, stage: "Day 4", model: "mtl", features: "F2[all,N=10,aid+tag]", tab1: 0.66219, random: 0.635744, lo: 0.624342, hi: 0.645995, calibRandom: 2.6358, calibTab1: 1.0061 },
  { run: 30, stage: "Day 4", model: "mtl", features: "F2[all,N=10,aid+tag]", tab1: 0.661116, random: 0.635429, lo: 0.624893, hi: 0.645111, calibRandom: 2.6247, calibTab1: 0.9943 },
  { run: 31, stage: "Day 4", model: "mtl", features: "F2[all,N=10,aid+tag]", tab1: 0.661557, random: 0.636623, lo: 0.625345, hi: 0.647066, calibRandom: 2.6522, calibTab1: 1.0115 },
  { run: 32, stage: "Day 4", model: "mtl", features: "F2[all,N=10,aid+tag]", tab1: 0.660755, random: 0.635592, lo: 0.624927, hi: 0.645619, calibRandom: 2.657, calibTab1: 1.018 },
  { run: 33, stage: "Day 5", model: "seq", features: "F2[all,N=10,aid+tag] + IPS α=0.5", tab1: 0.660748, random: 0.635272, lo: 0.624912, hi: 0.645448, calibRandom: 2.6382, calibTab1: 1.0034 },
  { run: 34, stage: "Day 5", model: "seq", features: "F2[all,N=10,aid+tag] + IPS α=1", tab1: 0.659345, random: 0.631081, lo: 0.620103, hi: 0.641545, calibRandom: 2.5833, calibTab1: 0.9721 },
  { run: 35, stage: "Day 3", model: "seq", features: "F2[all,N=200,aid+tag]", tab1: 0.65218, random: 0.633558, lo: 0.623005, hi: 0.643788, calibRandom: 2.88, calibTab1: 1.1441 },
];

export const STAGE_LABEL: Record<Stage, string> = { "Day 1": "Day 1 GBDT", "Day 2": "Day 2 深度 CTR", "Day 3": "Day 3 序列", "Day 4": "Day 4 多任务", "Day 5": "Day 5 IPS" };

// Average ranks (ties share the mean rank), 1-based.
export function ranks(xs: readonly number[]): number[] {
  const idx = xs.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const r = new Array<number>(xs.length);
  for (let i = 0; i < idx.length; ) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
    i = j + 1;
  }
  return r;
}

function pearson(a: readonly number[], b: readonly number[]): number {
  const n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return num / Math.sqrt(da * db);
}

export const spearman = (a: readonly number[], b: readonly number[]) => pearson(ranks(a), ranks(b));

// Kendall tau-b (same as scipy.stats.kendalltau's default).
export function kendall(a: readonly number[], b: readonly number[]): number {
  let c = 0;
  let d = 0;
  let ta = 0;
  let tb = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = i + 1; j < a.length; j++) {
      const x = Math.sign(a[i] - a[j]);
      const y = Math.sign(b[i] - b[j]);
      if (x === 0 && y === 0) continue;
      if (x === 0) ta++;
      else if (y === 0) tb++;
      else if (x === y) c++;
      else d++;
    }
  }
  return (c - d) / Math.sqrt((c + d + ta) * (c + d + tb));
}

// Rank of each model (1 = best) on a set.
export function rankOrder(points: readonly BiasPoint[], key: "tab1" | "random"): Map<number, number> {
  const sorted = [...points].sort((p, q) => q[key] - p[key]);
  return new Map(sorted.map((p, i) => [p.run, i + 1]));
}

// docs/DEBIAS.zh-CN.md §5.2: the same model on tab1, on the tab1 rows whose video is in the random pool, and on random.
export type DecompRow = { model: string; run: number; gauc: [number, number, number]; calib: [number | null, number | null, number | null] };
export const DECOMP_SETS = ["tab1 全部", "tab1 ∩ random 池视频", "random"] as const;
export const DECOMP: DecompRow[] = [
  { model: "LightGBM", run: 5, gauc: [0.6523, 0.6187, 0.618], calib: [1.03, 1.06, 2.7] },
  { model: "DCN-v2", run: 9, gauc: [0.6536, 0.6273, 0.6252], calib: [null, null, null] },
  { model: "DIN", run: 24, gauc: [0.6614, 0.6395, 0.635], calib: [1.02, 1.05, 2.65] },
];
export const DECOMP_CLICK_RATE: [number, number, number] = [0.442, 0.489, 0.174];
export const POOL_ROWS = { rows: 4693, users: 505, videos: 1803 };

// Share of each set's gap that the random-pool subset already shows: (tab1 − pool) / (tab1 − random).
export function gapExplainedByPool(r: DecompRow): number {
  return (r.gauc[0] - r.gauc[1]) / (r.gauc[0] - r.gauc[2]);
}

// IPS with a popularity propensity: w ∝ n^−α, normalised to mean 1, clipped at `clip` × mean (kurec popularity_weights).
export function popularityWeights(counts: readonly number[], alpha: number, clip = 10): number[] {
  let w = counts.map((n) => n ** -alpha);
  const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
  let m = mean(w);
  w = w.map((x) => x / m);
  for (let k = 0; k < 50; k++) {
    w = w.map((x) => Math.min(x, clip));
    m = mean(w);
    w = w.map((x) => x / m);
    if (Math.max(...w) <= clip + 1e-9) break;
  }
  return w;
}

// Effective sample size ratio (Σw)² / (n Σw²).
export function essRatio(w: readonly number[]): number {
  const s = w.reduce((a, b) => a + b, 0);
  const s2 = w.reduce((a, b) => a + b * b, 0);
  return (s * s) / (w.length * s2);
}
