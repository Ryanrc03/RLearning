// DAE-Fuse project walkthrough (arXiv 2409.10080v3). The tables are copied from
// the paper (Tables I–IV); everything else is a small, deterministic toy the
// figures compute live: a 24 × 16 infrared / visible scene, the fusion losses
// and metrics on it, a frequency split, cross-attention, the GAN and VAE
// losses, and IoU / NMS for the detection figure.
// No React here; see tests/daefuse.test.ts.

/* ------------------------------------------------------------------ */
/* Toy images                                                          */
/* ------------------------------------------------------------------ */

/** A grayscale image as rows of values in [0, 1]. */
export type Img = number[][];

export const TOY_W = 24;
export const TOY_H = 16;

// Where the two objects sit in the toy scene, shared by the detection figure.
export const TOY_PERSON = { x0: 4, x1: 6, y0: 6, y1: 14 }; // inclusive pixel ranges
export const TOY_CAR = { x0: 14, x1: 21, y0: 9, y1: 13 };

const inBox = (x: number, y: number, b: { x0: number; x1: number; y0: number; y1: number }) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;

/**
 * Infrared frame: smooth warm-to-cool background, a hot person, a car that is
 * barely warmer than the road (its tyres a little warmer). No texture.
 */
export function toyInfrared(): Img {
  return Array.from({ length: TOY_H }, (_, y) =>
    Array.from({ length: TOY_W }, (_, x) => {
      if (inBox(x, y, TOY_PERSON)) return y === TOY_PERSON.y0 ? 0.85 : 0.95;
      if (inBox(x, y, TOY_CAR)) return y === TOY_CAR.y1 && (x === 15 || x === 20) ? 0.55 : 0.4;
      return 0.18 + 0.12 * (y / (TOY_H - 1));
    }),
  );
}

/**
 * Visible frame at dusk: a brick wall (high-frequency texture) above a road,
 * a bright car with dark windows, and a person who almost disappears into the
 * road (0.36 on a 0.45 road).
 */
export function toyVisible(): Img {
  return Array.from({ length: TOY_H }, (_, y) =>
    Array.from({ length: TOY_W }, (_, x) => {
      if (inBox(x, y, TOY_PERSON)) return 0.36;
      if (inBox(x, y, TOY_CAR)) return y === TOY_CAR.y0 && x >= 16 && x <= 19 ? 0.2 : 0.9;
      if (y < 8) {
        const mortar = y % 3 === 2 || (x + (Math.floor(y / 3) % 2) * 3) % 6 === 0;
        return mortar ? 0.42 : 0.7;
      }
      return 0.45 + ((x * 7 + y * 3) % 5 === 0 ? 0.06 : 0);
    }),
  );
}

export const mapImg = (a: Img, f: (v: number, x: number, y: number) => number): Img => a.map((row, y) => row.map((v, x) => f(v, x, y)));
export const zipImg = (a: Img, b: Img, f: (u: number, v: number) => number): Img => a.map((row, y) => row.map((u, x) => f(u, b[y][x])));
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export type FusionRule = "ir" | "vis" | "weighted" | "max";

/** Hand-made fusion rules the loss figure compares: one source, w · IR + (1 − w) · VIS, or the per-pixel max. */
export function fuse(ir: Img, vis: Img, rule: FusionRule, w = 0.5): Img {
  if (rule === "ir") return ir.map((r) => [...r]);
  if (rule === "vis") return vis.map((r) => [...r]);
  if (rule === "max") return zipImg(ir, vis, Math.max);
  return zipImg(ir, vis, (a, b) => w * a + (1 - w) * b);
}

/** 3 × 3 box blur with edge clamping: the low-frequency part of an image. */
export function blur3(a: Img): Img {
  const H = a.length;
  const W = a[0].length;
  return mapImg(a, (_, x, y) => {
    let s = 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) s += a[Math.min(H - 1, Math.max(0, y + dy))][Math.min(W - 1, Math.max(0, x + dx))];
    return s / 9;
  });
}

/** Image minus its blur: the high-frequency detail. */
export function detail(a: Img): Img {
  const b = blur3(a);
  return zipImg(a, b, (u, v) => u - v);
}

/** Sobel gradient magnitude |∇I| with edge clamping. */
export function sobel(a: Img): Img {
  const H = a.length;
  const W = a[0].length;
  const p = (x: number, y: number) => a[Math.min(H - 1, Math.max(0, y))][Math.min(W - 1, Math.max(0, x))];
  return mapImg(a, (_, x, y) => {
    const gx = p(x + 1, y - 1) + 2 * p(x + 1, y) + p(x + 1, y + 1) - p(x - 1, y - 1) - 2 * p(x - 1, y) - p(x - 1, y + 1);
    const gy = p(x - 1, y + 1) + 2 * p(x, y + 1) + p(x + 1, y + 1) - p(x - 1, y - 1) - 2 * p(x, y - 1) - p(x + 1, y - 1);
    return Math.sqrt(gx * gx + gy * gy);
  });
}

const flat = (a: Img) => a.flat();
const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;

/** Eq. 14: L_int = (1/HW) ‖I_f − max(α, β)‖₁. */
export function lossInt(f: Img, ir: Img, vis: Img): number {
  return mean(flat(zipImg(f, zipImg(ir, vis, Math.max), (u, v) => Math.abs(u - v))));
}

/**
 * Eq. 13: L_text = (1/HW) ‖∇I_f − max(|∇α|, |∇β|)‖₁, with ∇ the Sobel
 * magnitude (the paper follows SeAFusion, which uses Sobel).
 */
export function lossText(f: Img, ir: Img, vis: Img): number {
  const target = zipImg(sobel(ir), sobel(vis), Math.max);
  return mean(flat(zipImg(sobel(f), target, (u, v) => Math.abs(u - v))));
}

/* ------------------------------------------------------------------ */
/* No-reference fusion metrics on 8-bit values                         */
/* ------------------------------------------------------------------ */

const to8 = (a: Img) => flat(a).map((v) => Math.round(clamp01(v) * 255));

/** EN: Shannon entropy (bits) of the 256-bin gray-level histogram. */
export function entropy(a: Img): number {
  const v = to8(a);
  const hist = new Array(256).fill(0);
  v.forEach((g) => hist[g]++);
  return -hist.filter((c) => c > 0).reduce((s, c) => s + (c / v.length) * Math.log2(c / v.length), 0);
}

/** SD: standard deviation of the 8-bit values (contrast). */
export function stdDev(a: Img): number {
  const v = to8(a);
  const m = mean(v);
  return Math.sqrt(mean(v.map((g) => (g - m) ** 2)));
}

/** SF: spatial frequency √(RF² + CF²) from horizontal and vertical first differences. */
export function spatialFrequency(a: Img): number {
  const g = a.map((row) => row.map((v) => clamp01(v) * 255));
  const H = g.length;
  const W = g[0].length;
  let rf = 0;
  let cf = 0;
  for (let y = 0; y < H; y++) for (let x = 1; x < W; x++) rf += (g[y][x] - g[y][x - 1]) ** 2;
  for (let y = 1; y < H; y++) for (let x = 0; x < W; x++) cf += (g[y][x] - g[y - 1][x]) ** 2;
  return Math.sqrt(rf / (H * W) + cf / (H * W));
}

/** Mutual information (bits) between two images on a `bins`-level joint histogram. */
export function mutualInfo(a: Img, b: Img, bins = 16): number {
  const qa = flat(a).map((v) => Math.min(bins - 1, Math.floor(clamp01(v) * bins)));
  const qb = flat(b).map((v) => Math.min(bins - 1, Math.floor(clamp01(v) * bins)));
  const n = qa.length;
  const joint = new Map<number, number>();
  const pa = new Array(bins).fill(0);
  const pb = new Array(bins).fill(0);
  for (let i = 0; i < n; i++) {
    joint.set(qa[i] * bins + qb[i], (joint.get(qa[i] * bins + qb[i]) ?? 0) + 1);
    pa[qa[i]]++;
    pb[qb[i]]++;
  }
  let mi = 0;
  joint.forEach((c, k) => {
    const pxy = c / n;
    mi += pxy * Math.log2(pxy / ((pa[Math.floor(k / bins)] / n) * (pb[k % bins] / n)));
  });
  return mi;
}

/** The paper's MI metric for fusion: MI(F, IR) + MI(F, VIS). */
export const fusionMI = (f: Img, ir: Img, vis: Img) => mutualInfo(f, ir) + mutualInfo(f, vis);

/** Global SSIM over the whole image (one window), values in [0, 1]. */
export function ssimGlobal(a: Img, b: Img): number {
  const x = flat(a);
  const y = flat(b);
  const mx = mean(x);
  const my = mean(y);
  const vx = mean(x.map((v) => (v - mx) ** 2));
  const vy = mean(y.map((v) => (v - my) ** 2));
  const cov = mean(x.map((v, i) => (v - mx) * (y[i] - my)));
  const C1 = 0.01 ** 2;
  const C2 = 0.03 ** 2;
  return ((2 * mx * my + C1) * (2 * cov + C2)) / ((mx * mx + my * my + C1) * (vx + vy + C2));
}

export const mse = (a: Img, b: Img) => mean(flat(zipImg(a, b, (u, v) => (u - v) ** 2)));

/** Eq. 11: ‖α − D(α)‖²₂ (as a per-pixel mean) + (1 − SSIM). */
export function contentLoss(a: Img, rec: Img) {
  const m = mse(a, rec);
  const s = ssimGlobal(a, rec);
  return { mse: m, ssim: s, total: m + (1 - s) };
}

/** Blur an image `k` times with the 3 × 3 box: a stand-in for a reconstruction that lost detail. */
export function blurTimes(a: Img, k: number): Img {
  let out = a;
  for (let i = 0; i < k; i++) out = blur3(out);
  return out;
}

/* ------------------------------------------------------------------ */
/* Frequency split and the correlation decomposition loss              */
/* ------------------------------------------------------------------ */

/** Moving average of a 1-D signal with window `k` (odd), edges clamped. */
export function movingAverage(s: number[], k: number): number[] {
  const h = Math.floor(k / 2);
  return s.map((_, i) => {
    let acc = 0;
    for (let j = -h; j <= h; j++) acc += s[Math.min(s.length - 1, Math.max(0, i + j))];
    return acc / (2 * h + 1);
  });
}

/**
 * One scan line for the frequency figure (64 samples): slow illumination
 * (low frequency), a car-sized step, and a brick texture on the left third
 * (high frequency).
 */
export function toySignal(): number[] {
  return Array.from({ length: 64 }, (_, i) => {
    const light = 0.35 + 0.15 * Math.sin((2 * Math.PI * i) / 64);
    const car = i >= 36 && i <= 50 ? 0.3 : 0;
    const brick = i < 24 ? (i % 4 < 2 ? 0.08 : -0.08) : 0;
    return light + car + brick;
  });
}

/** 1-D convolution with a small kernel, edges clamped (centre-aligned). */
export function conv1d(s: number[], k: number[]): number[] {
  const h = Math.floor(k.length / 2);
  return s.map((_, i) => k.reduce((acc, w, j) => acc + w * s[Math.min(s.length - 1, Math.max(0, i + j - h))], 0));
}

/** Pearson correlation coefficient. */
export function corr(a: number[], b: number[]): number {
  const ma = mean(a);
  const mb = mean(b);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da === 0 || db === 0 ? 0 : num / Math.sqrt(da * db);
}

/** Eq. 10: L_corr = CC(high_α, high_β)² / (CC(low_α, low_β) + ε), ε = 1.01. */
export const corrLoss = (ccHigh: number, ccLow: number, eps = 1.01) => (ccHigh * ccHigh) / (ccLow + eps);

/**
 * Split each image into low (k-blurred) and high (residual) parts and score
 * the pair with Eq. 10. A hand-made "encoder output", not a learned one.
 */
export function splitScore(ir: Img, vis: Img, blurs = 2) {
  const lowIr = blurTimes(ir, blurs);
  const lowVis = blurTimes(vis, blurs);
  const highIr = zipImg(ir, lowIr, (u, v) => u - v);
  const highVis = zipImg(vis, lowVis, (u, v) => u - v);
  const ccLow = corr(flat(lowIr), flat(lowVis));
  const ccHigh = corr(flat(highIr), flat(highVis));
  return { ccLow, ccHigh, loss: corrLoss(ccHigh, ccLow) };
}

/* ------------------------------------------------------------------ */
/* Receptive field and attention                                       */
/* ------------------------------------------------------------------ */

/** Side of the receptive field after `layers` stride-1 k × k convolutions: 1 + L(k − 1). */
export const receptiveField = (layers: number, k = 3) => 1 + layers * (k - 1);

export function softmax(v: number[]): number[] {
  const m = Math.max(...v);
  const e = v.map((x) => Math.exp(x - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / s);
}

/** Mean of each `p × p` patch of an image, row-major: the ViT token grid. */
export function patchMeans(a: Img, p: number): number[][] {
  const rows = Math.floor(a.length / p);
  const cols = Math.floor(a[0].length / p);
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => {
      let s = 0;
      for (let y = 0; y < p; y++) for (let x = 0; x < p; x++) s += a[r * p + y][c * p + x];
      return s / (p * p);
    }),
  );
}

/**
 * Toy self-attention over patch tokens: each token is (brightness, contrast),
 * the score is −‖q − k‖² / τ, so similar-looking patches attend to each other
 * regardless of distance.
 */
export function toyAttentionRow(tokens: number[][], query: number, tau = 0.02): number[] {
  const q = tokens[query];
  return softmax(tokens.map((k) => -((q[0] - k[0]) ** 2 + (q[1] - k[1]) ** 2) / tau));
}

/** One cross-attention row: softmax(q · Kᵀ / √d) and the weighted sum of V. */
export function crossAttend(q: number[], K: number[][], V: number[][]) {
  const d = q.length;
  const scores = K.map((k) => k.reduce((s, kv, i) => s + kv * q[i], 0) / Math.sqrt(d));
  const weights = softmax(scores);
  const out = V[0].map((_, j) => V.reduce((s, v, i) => s + weights[i] * v[j], 0));
  return { scores, weights, out };
}

export const matVec = (W: number[][], x: number[]) => W.map((row) => row.reduce((s, w, i) => s + w * x[i], 0));

/* ------------------------------------------------------------------ */
/* GAN losses                                                          */
/* ------------------------------------------------------------------ */

/**
 * Eq. 12 for one discriminator, and the generator's two common forms:
 * the paper's minimax term log(1 − D(G)) (Eq. 9) and the non-saturating −log D(G).
 */
export function ganLosses(dReal: number, dFake: number) {
  const eps = 1e-6;
  const r = Math.min(1 - eps, Math.max(eps, dReal));
  const f = Math.min(1 - eps, Math.max(eps, dFake));
  return {
    disc: -Math.log(r) - Math.log(1 - f),
    genMinimax: Math.log(1 - f),
    genNonSat: -Math.log(f),
    // d/dD(G) of each generator loss: how hard the generator is pushed.
    gradMinimax: -1 / (1 - f),
    gradNonSat: -1 / f,
  };
}

/* ------------------------------------------------------------------ */
/* AE vs VAE                                                           */
/* ------------------------------------------------------------------ */

/** KL(N(μ, σ²) ‖ N(0, 1)) for one latent dimension. */
export const klGauss = (mu: number, sigma: number) => 0.5 * (mu * mu + sigma * sigma - 1 - Math.log(sigma * sigma));

const gauss = (z: number, mu: number, s: number) => Math.exp(-((z - mu) ** 2) / (2 * s * s));

/**
 * Two training rows (a step edge at different places) are encoded to μ₁, μ₂
 * with the same σ. Under an MSE (Gaussian) decoder the best output for a code z
 * is the posterior-weighted average of the rows that could have produced z.
 * Returns the expected reconstruction of row 1 when z is sampled around μ₁.
 */
export function vaeExpectedRecon(rows: number[][], mus: number[], sigma: number, samples = 41): number[] {
  const out = new Array(rows[0].length).fill(0);
  let wsum = 0;
  for (let i = 0; i < samples; i++) {
    const z = mus[0] + sigma * (-3 + (6 * i) / (samples - 1));
    const pz = gauss(z, mus[0], sigma);
    const post = mus.map((m) => gauss(z, m, sigma));
    const ps = post.reduce((a, b) => a + b, 0);
    for (let j = 0; j < out.length; j++) out[j] += pz * rows.reduce((s, r, k) => s + (post[k] / ps) * r[j], 0);
    wsum += pz;
  }
  return out.map((v) => v / wsum);
}

/**
 * How far a reconstruction of row `a` drifted toward row `b`:
 * Σ|rec − a| / Σ|b − a|. 0 = exactly a, 0.5 = the plain average of a and b.
 */
export function mixRatio(rec: number[], a: number[], b: number[]): number {
  const num = rec.reduce((s, v, i) => s + Math.abs(v - a[i]), 0);
  const den = a.reduce((s, v, i) => s + Math.abs(b[i] - v), 0);
  return den === 0 ? 0 : num / den;
}

/** Largest jump between neighbours: 1 for a perfect step, smaller when blurred. */
export const edgeSharpness = (row: number[]) => Math.max(...row.slice(1).map((v, i) => Math.abs(v - row[i])));

/* ------------------------------------------------------------------ */
/* Detection: IoU, NMS, TP / FP                                        */
/* ------------------------------------------------------------------ */

export type Box = { x: number; y: number; w: number; h: number };
export type Det = Box & { cls: "person" | "car"; score: number };

export function iou(a: Box, b: Box): number {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const inter = ix * iy;
  return inter / (a.w * a.h + b.w * b.h - inter);
}

/** Per-class NMS: keep the best box, drop same-class boxes overlapping it by ≥ thr, repeat. */
export function nms(dets: Det[], thr: number): Det[] {
  const sorted = [...dets].sort((a, b) => b.score - a.score);
  const kept: Det[] = [];
  for (const d of sorted) if (!kept.some((k) => k.cls === d.cls && iou(k, d) >= thr)) kept.push(d);
  return kept;
}

/** Match detections to ground truth at IoU ≥ 0.5 (AP@50 rule), highest score first. */
export function matchAt50(dets: Det[], gts: (Box & { cls: Det["cls"] })[]) {
  const used = new Set<number>();
  const tp = [...dets]
    .sort((a, b) => b.score - a.score)
    .map((d) => {
      let best = -1;
      let bestIou = 0.5;
      gts.forEach((g, i) => {
        if (g.cls !== d.cls || used.has(i)) return;
        const v = iou(d, g);
        if (v >= bestIou) {
          best = i;
          bestIou = v;
        }
      });
      if (best >= 0) used.add(best);
      return { det: d, tp: best >= 0, iou: best >= 0 ? bestIou : Math.max(0, ...gts.filter((g) => g.cls === d.cls).map((g) => iou(d, g))) };
    });
  return { matches: tp, missed: gts.filter((_, i) => !used.has(i)) };
}

/* ------------------------------------------------------------------ */
/* Paper tables                                                        */
/* ------------------------------------------------------------------ */

export const DF_METHODS = ["DIDFuse", "U2Fusion", "RFN-Nest", "DDcGAN", "TarDAL", "CDDFuse", "DDFM", "DAE-Fuse"] as const;
export type DfMethod = (typeof DF_METHODS)[number];

export const DF_METHOD_KIND: Record<DfMethod, "AE" | "GAN" | "AE（双分支）" | "Diffusion" | "Ours"> = {
  DIDFuse: "AE",
  U2Fusion: "AE",
  "RFN-Nest": "AE",
  DDcGAN: "GAN",
  TarDAL: "GAN",
  CDDFuse: "AE（双分支）",
  DDFM: "Diffusion",
  "DAE-Fuse": "Ours",
};

export const DF_METRICS = ["EN", "SD", "SF", "MI", "SCD", "VIF", "Qabf"] as const;
export type DfMetric = (typeof DF_METRICS)[number];
export type DfDataset = "TNO" | "MSRS" | "RoadScene" | "MRI-CT";
export const DF_DATASETS: DfDataset[] = ["TNO", "MSRS", "RoadScene", "MRI-CT"];

// Tables I and II, rows in DF_METHODS order, columns in DF_METRICS order.
export const DF_TABLE: Record<DfDataset, number[][]> = {
  TNO: [
    [6.97, 45.12, 12.59, 1.7, 1.71, 0.6, 0.4],
    [6.83, 34.55, 11.52, 1.37, 1.71, 0.58, 0.44],
    [6.83, 34.5, 15.71, 1.2, 1.67, 0.51, 0.39],
    [6.78, 46.33, 9.12, 1.78, 1.72, 0.48, 0.35],
    [6.84, 45.63, 8.68, 1.86, 1.52, 0.53, 0.32],
    [7.12, 46.0, 13.15, 2.19, 1.76, 0.77, 0.54],
    [7.06, 51.42, 13.03, 2.21, 1.66, 0.81, 0.49],
    [7.17, 46.63, 13.31, 2.23, 1.89, 0.79, 0.57],
  ],
  MSRS: [
    [4.27, 31.49, 10.15, 1.61, 1.11, 0.31, 0.2],
    [5.37, 25.52, 9.07, 1.4, 1.24, 0.54, 0.42],
    [5.56, 24.09, 11.98, 1.3, 1.13, 0.51, 0.43],
    [6.54, 41.33, 7.68, 2.36, 1.47, 0.48, 0.57],
    [5.28, 25.22, 5.98, 1.49, 0.71, 0.42, 0.18],
    [6.7, 43.38, 11.56, 3.47, 1.62, 1.05, 0.69],
    [6.88, 40.75, 11.65, 2.35, 1.62, 0.81, 0.58],
    [6.86, 44.05, 12.26, 3.48, 1.75, 0.98, 0.72],
  ],
  RoadScene: [
    [7.43, 51.58, 14.66, 2.11, 1.7, 0.58, 0.48],
    [7.09, 38.12, 13.25, 1.87, 1.7, 0.6, 0.51],
    [7.21, 41.25, 16.19, 1.68, 1.73, 0.54, 0.45],
    [7.2, 38.32, 11.68, 2.25, 1.56, 0.48, 0.31],
    [7.17, 47.44, 10.83, 2.14, 1.55, 0.54, 0.4],
    [7.44, 54.67, 16.36, 2.3, 1.81, 0.69, 0.52],
    [7.41, 52.61, 13.57, 2.35, 1.66, 0.75, 0.65],
    [7.57, 56.05, 17.12, 2.32, 1.85, 0.76, 0.68],
  ],
  "MRI-CT": [
    [4.37, 58.34, 34.64, 1.71, 0.69, 0.41, 0.38],
    [4.21, 61.98, 32.54, 2.08, 0.75, 0.37, 0.46],
    [4.97, 70.36, 33.42, 1.98, 0.68, 0.43, 0.52],
    [4.26, 62.56, 30.61, 1.72, 0.65, 0.38, 0.42],
    [4.35, 61.14, 28.38, 1.94, 0.92, 0.32, 0.56],
    [4.49, 71.36, 34.02, 2.16, 1.18, 0.44, 0.56],
    [4.77, 69.35, 32.77, 1.98, 1.03, 0.41, 0.54],
    [4.83, 76.19, 35.56, 2.2, 1.21, 0.49, 0.57],
  ],
};

export const dfValue = (ds: DfDataset, m: DfMethod, metric: DfMetric) => DF_TABLE[ds][DF_METHODS.indexOf(m)][DF_METRICS.indexOf(metric)];

/** 1-based rank of a method on one dataset and metric (higher is better; ties share the better rank). */
export function dfRank(ds: DfDataset, m: DfMethod, metric: DfMetric): number {
  const v = dfValue(ds, m, metric);
  return 1 + DF_METHODS.filter((o) => dfValue(ds, o, metric) > v).length;
}

/** How many of the 7 metrics a method is 1st / 2nd on, for one dataset. */
export function dfPodium(ds: DfDataset, m: DfMethod) {
  const ranks = DF_METRICS.map((k) => dfRank(ds, m, k));
  return { first: ranks.filter((r) => r === 1).length, second: ranks.filter((r) => r === 2).length, ranks };
}

// Table III: AP@50 on M3FD with YOLOv8n, columns People, Car, Lamp, Bus, Motorcycle, Truck, then mAP.
export const DF_DET_CLASSES = ["People", "Car", "Lamp", "Bus", "Motor", "Truck"] as const;
export const DF_DET: { name: string; ap: number[]; map: number }[] = [
  { name: "Infrared", ap: [0.804, 0.886, 0.712, 0.802, 0.725, 0.743], map: 0.779 },
  { name: "Visible", ap: [0.721, 0.865, 0.848, 0.811, 0.794, 0.791], map: 0.805 },
  { name: "DIDFuse", ap: [0.791, 0.924, 0.857, 0.833, 0.787, 0.788], map: 0.83 },
  { name: "U2Fusion", ap: [0.802, 0.922, 0.87, 0.839, 0.783, 0.786], map: 0.833 },
  { name: "RFN-Nest", ap: [0.813, 0.915, 0.851, 0.829, 0.813, 0.875], map: 0.849 },
  { name: "DDcGAN", ap: [0.797, 0.908, 0.832, 0.895, 0.805, 0.872], map: 0.851 },
  { name: "TarDAL", ap: [0.835, 0.947, 0.854, 0.928, 0.811, 0.874], map: 0.874 },
  { name: "CDDFuse", ap: [0.846, 0.928, 0.864, 0.931, 0.813, 0.891], map: 0.878 },
  { name: "DDFM", ap: [0.837, 0.926, 0.869, 0.927, 0.809, 0.882], map: 0.875 },
  { name: "DAE-Fuse", ap: [0.855, 0.931, 0.874, 0.949, 0.822, 0.89], map: 0.887 },
];

// Table IV (captioned TNO): EN, SD, VIF, Qabf.
export const DF_ABLATION_METRICS = ["EN", "SD", "VIF", "Qabf"] as const;
export const DF_ABLATION: { key: string; label: string; vals: number[] }[] = [
  { key: "noD1", label: "去掉 Phase 1 的判别器", vals: [6.81, 43.2, 0.91, 0.63] },
  { key: "noD2", label: "去掉 Phase 2 的判别器", vals: [6.78, 45.31, 0.83, 0.61] },
  { key: "noCA", label: "去掉 cross-attention（只拼接）", vals: [6.78, 43.79, 0.89, 0.62] },
  { key: "full", label: "完整 DAE-Fuse", vals: [6.86, 44.05, 0.98, 0.68] },
];
