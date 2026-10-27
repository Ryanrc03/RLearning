// Toy models the DAE-Fuse background section trains for real, so the
// "training dynamics" and "experiment" figures plot computed curves rather
// than drawings: a tiny CNN, an MLP baseline, a one-layer attention model
// (the smallest ViT), a 1-D GAN, an AE / VAE pair and a grid detector in the
// YOLO style. Gradients are written out by hand; every run is seeded, so the
// server render and the browser draw the same thing.
// No React here; see tests/daefuse-train.test.ts.

import { createRng, randomNormal, type Rng } from "./random";

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

export type Params = Record<string, number[]>;

const sigmoid = (t: number) => 1 / (1 + Math.exp(-t));
const zerosLike = (p: Params): Params => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v.map(() => 0)]));
const clone = (p: Params): Params => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, [...v]]));
const randn = (rng: Rng, n: number, sd: number) => Array.from({ length: n }, () => randomNormal(rng, 0, sd));

/** Adam over a dictionary of flat parameter arrays. */
export class Adam {
  private m: Params;
  private v: Params;
  private t = 0;
  constructor(p: Params, private lr: number, private b1 = 0.9, private b2 = 0.999) {
    this.m = zerosLike(p);
    this.v = zerosLike(p);
  }
  step(p: Params, g: Params) {
    this.t++;
    for (const k of Object.keys(p)) {
      const pk = p[k];
      const gk = g[k];
      const mk = this.m[k];
      const vk = this.v[k];
      for (let i = 0; i < pk.length; i++) {
        mk[i] = this.b1 * mk[i] + (1 - this.b1) * gk[i];
        vk[i] = this.b2 * vk[i] + (1 - this.b2) * gk[i] * gk[i];
        const mh = mk[i] / (1 - this.b1 ** this.t);
        const vh = vk[i] / (1 - this.b2 ** this.t);
        pk[i] -= (this.lr * mh) / (Math.sqrt(vh) + 1e-8);
      }
    }
  }
}

/** Two-class softmax cross-entropy: probabilities, loss and ∂L/∂logits. */
function ce2(o: number[], y: number) {
  const m = Math.max(o[0], o[1]);
  const e0 = Math.exp(o[0] - m);
  const e1 = Math.exp(o[1] - m);
  const p = [e0 / (e0 + e1), e1 / (e0 + e1)];
  return { p, loss: -Math.log(Math.max(p[y], 1e-12)), d: [p[0] - (y === 0 ? 1 : 0), p[1] - (y === 1 ? 1 : 0)] };
}

/* ------------------------------------------------------------------ */
/* Image classification data (8 × 8)                                   */
/* ------------------------------------------------------------------ */

export type Sample = { x: number[]; y: 0 | 1 };
export const SIDE = 8;

/**
 * Bars: a length-4 bar, horizontal (y = 0) or vertical (y = 1), anywhere in the
 * 8 × 8 frame, on a faint noisy background.
 */
export function barData(n: number, seed: number): Sample[] {
  const rng = createRng(seed);
  return Array.from({ length: n }, (_, i) => {
    const y = (i % 2) as 0 | 1;
    const a = Math.floor(rng() * SIDE);
    const b = Math.floor(rng() * (SIDE - 3));
    return { x: barImage(y, a, b, rng), y };
  });
}

function barImage(y: 0 | 1, a: number, b: number, rng: Rng): number[] {
  const x = Array.from({ length: SIDE * SIDE }, () => Math.max(0, randomNormal(rng, 0.08, 0.06)));
  for (let k = 0; k < 4; k++) {
    const r = y === 0 ? a : b + k;
    const c = y === 0 ? b + k : a;
    x[r * SIDE + c] = 0.9 + randomNormal(rng, 0, 0.04);
  }
  return x;
}

/** Every bar position once per orientation (2 × 8 × 5 = 80 images): the test set. */
export function barTestSet(seed: number): Sample[] {
  const rng = createRng(seed);
  const out: Sample[] = [];
  for (const y of [0, 1] as const) for (let a = 0; a < SIDE; a++) for (let b = 0; b <= SIDE - 4; b++) out.push({ x: barImage(y, a, b, rng), y });
  return out;
}

/**
 * Corners: the image is 16 patches of 2 × 2; each patch is lit or dark. The
 * label is 1 only when BOTH the top-left and the bottom-right patch are lit,
 * two places 6 pixels apart. Half the samples are positive.
 */
export function cornerData(n: number, seed: number): Sample[] {
  const rng = createRng(seed);
  return Array.from({ length: n }, (_, i) => {
    const y = (i % 2) as 0 | 1;
    let lit = Array.from({ length: 16 }, () => rng() < 0.45);
    if (y === 1) {
      lit[0] = true;
      lit[15] = true;
    } else while (lit[0] && lit[15]) lit = Array.from({ length: 16 }, () => rng() < 0.45);
    const x = new Array(SIDE * SIDE).fill(0);
    for (let p = 0; p < 16; p++) {
      const pr = Math.floor(p / 4);
      const pc = p % 4;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) x[(pr * 2 + dy) * SIDE + pc * 2 + dx] = (lit[p] ? 0.85 : 0.1) + randomNormal(rng, 0, 0.04);
    }
    return { x, y };
  });
}

/* ------------------------------------------------------------------ */
/* CNN: K kernels 3 × 3 → ReLU → global average pool → linear → softmax */
/* ------------------------------------------------------------------ */

export const CNN_K = 2;
const FM = SIDE - 2; // 6 × 6 feature maps ("valid" convolution)

export function cnnInit(seed: number, K = CNN_K): Params {
  const rng = createRng(seed);
  return { W: randn(rng, K * 9, 0.35), b: new Array(K).fill(0), V: randn(rng, 2 * K, 0.5), c: [0, 0] };
}

export function cnnForward(p: Params, x: number[]) {
  const K = p.b.length;
  const maps: number[][] = [];
  const h: number[] = [];
  for (let k = 0; k < K; k++) {
    const m = new Array(FM * FM);
    let s = 0;
    for (let i = 0; i < FM; i++)
      for (let j = 0; j < FM; j++) {
        let a = p.b[k];
        for (let u = 0; u < 3; u++) for (let v = 0; v < 3; v++) a += p.W[k * 9 + u * 3 + v] * x[(i + u) * SIDE + j + v];
        m[i * FM + j] = a > 0 ? a : 0;
        s += m[i * FM + j];
      }
    maps.push(m);
    h.push(s / (FM * FM));
  }
  const o = [0, 1].map((c) => p.c[c] + h.reduce((s, hk, k) => s + p.V[c * K + k] * hk, 0));
  return { maps, h, o };
}

export function cnnGrad(p: Params, batch: Sample[]) {
  const K = p.b.length;
  const g = zerosLike(p);
  let loss = 0;
  let correct = 0;
  for (const { x, y } of batch) {
    const f = cnnForward(p, x);
    const { p: pr, loss: l, d } = ce2(f.o, y);
    loss += l;
    if ((pr[1] > 0.5 ? 1 : 0) === y) correct++;
    for (let c = 0; c < 2; c++) {
      g.c[c] += d[c];
      for (let k = 0; k < K; k++) g.V[c * K + k] += d[c] * f.h[k];
    }
    for (let k = 0; k < K; k++) {
      const dh = (d[0] * p.V[k] + d[1] * p.V[K + k]) / (FM * FM);
      for (let i = 0; i < FM; i++)
        for (let j = 0; j < FM; j++) {
          if (f.maps[k][i * FM + j] <= 0) continue;
          g.b[k] += dh;
          for (let u = 0; u < 3; u++) for (let v = 0; v < 3; v++) g.W[k * 9 + u * 3 + v] += dh * x[(i + u) * SIDE + j + v];
        }
    }
  }
  for (const k of Object.keys(g)) g[k] = g[k].map((v) => v / batch.length);
  return { loss: loss / batch.length, acc: correct / batch.length, g };
}

/* ------------------------------------------------------------------ */
/* MLP baseline: 64 → H (ReLU) → 2                                     */
/* ------------------------------------------------------------------ */

export function mlpInit(seed: number, H = 16): Params {
  const rng = createRng(seed);
  return { W1: randn(rng, H * 64, 0.15), b1: new Array(H).fill(0), W2: randn(rng, 2 * H, 0.3), b2: [0, 0] };
}

function mlpForward(p: Params, x: number[]) {
  const H = p.b1.length;
  const h = new Array(H);
  for (let j = 0; j < H; j++) {
    let a = p.b1[j];
    for (let i = 0; i < 64; i++) a += p.W1[j * 64 + i] * x[i];
    h[j] = a > 0 ? a : 0;
  }
  const o = [0, 1].map((c) => p.b2[c] + h.reduce((s: number, hj: number, j: number) => s + p.W2[c * H + j] * hj, 0));
  return { h, o };
}

export function mlpGrad(p: Params, batch: Sample[]) {
  const H = p.b1.length;
  const g = zerosLike(p);
  let loss = 0;
  let correct = 0;
  for (const { x, y } of batch) {
    const f = mlpForward(p, x);
    const { p: pr, loss: l, d } = ce2(f.o, y);
    loss += l;
    if ((pr[1] > 0.5 ? 1 : 0) === y) correct++;
    for (let c = 0; c < 2; c++) {
      g.b2[c] += d[c];
      for (let j = 0; j < H; j++) g.W2[c * H + j] += d[c] * f.h[j];
    }
    for (let j = 0; j < H; j++) {
      if (f.h[j] <= 0) continue;
      const dh = d[0] * p.W2[j] + d[1] * p.W2[H + j];
      g.b1[j] += dh;
      for (let i = 0; i < 64; i++) g.W1[j * 64 + i] += dh * x[i];
    }
  }
  for (const k of Object.keys(g)) g[k] = g[k].map((v) => v / batch.length);
  return { loss: loss / batch.length, acc: correct / batch.length, g };
}

/* ------------------------------------------------------------------ */
/* Smallest ViT: 2 × 2 patches → linear embedding + position → one     */
/* attention read-out from a learned [CLS] query → linear head         */
/* ------------------------------------------------------------------ */

export const VIT_D = 4;
const NP = 16; // patches
const PD = 4; // values per patch

export function patchify(x: number[]): number[][] {
  return Array.from({ length: NP }, (_, p) => {
    const pr = Math.floor(p / 4);
    const pc = p % 4;
    return [x[pr * 2 * SIDE + pc * 2], x[pr * 2 * SIDE + pc * 2 + 1], x[(pr * 2 + 1) * SIDE + pc * 2], x[(pr * 2 + 1) * SIDE + pc * 2 + 1]];
  });
}

export function vitInit(seed: number): Params {
  const rng = createRng(seed);
  const d = VIT_D;
  return {
    We: randn(rng, d * PD, 0.5),
    be: new Array(d).fill(0),
    pos: randn(rng, NP * d, 0.5),
    q: randn(rng, d, 0.5),
    Wk: randn(rng, d * d, 0.5),
    Wv: randn(rng, d * d, 0.5),
    Wo: randn(rng, 2 * d, 0.5),
    bo: [0, 0],
  };
}

const mv = (W: number[], x: number[], rows: number) => Array.from({ length: rows }, (_, r) => x.reduce((s, xi, i) => s + W[r * x.length + i] * xi, 0));

export function vitForward(p: Params, x: number[]) {
  const d = VIT_D;
  const P = patchify(x);
  const e = P.map((pt, i) => mv(p.We, pt, d).map((v, j) => v + p.be[j] + p.pos[i * d + j]));
  const k = e.map((ei) => mv(p.Wk, ei, d));
  const v = e.map((ei) => mv(p.Wv, ei, d));
  const s = k.map((ki) => ki.reduce((acc, kij, j) => acc + kij * p.q[j], 0) / Math.sqrt(d));
  const m = Math.max(...s);
  const ex = s.map((si) => Math.exp(si - m));
  const Z = ex.reduce((a, b) => a + b, 0);
  const a = ex.map((t) => t / Z);
  const z = Array.from({ length: d }, (_, j) => v.reduce((acc, vi, i) => acc + a[i] * vi[j], 0));
  const o = [0, 1].map((c) => p.bo[c] + z.reduce((acc, zj, j) => acc + p.Wo[c * d + j] * zj, 0));
  return { P, e, k, v, a, z, o };
}

export function vitGrad(p: Params, batch: Sample[]) {
  const d = VIT_D;
  const g = zerosLike(p);
  let loss = 0;
  let correct = 0;
  const sq = Math.sqrt(d);
  for (const { x, y } of batch) {
    const f = vitForward(p, x);
    const { p: pr, loss: l, d: dO } = ce2(f.o, y);
    loss += l;
    if ((pr[1] > 0.5 ? 1 : 0) === y) correct++;
    const dz = new Array(d).fill(0);
    for (let c = 0; c < 2; c++) {
      g.bo[c] += dO[c];
      for (let j = 0; j < d; j++) {
        g.Wo[c * d + j] += dO[c] * f.z[j];
        dz[j] += dO[c] * p.Wo[c * d + j];
      }
    }
    const da = f.v.map((vi) => vi.reduce((acc, vij, j) => acc + vij * dz[j], 0));
    const avg = da.reduce((acc, dai, i) => acc + f.a[i] * dai, 0);
    const ds = f.a.map((ai, i) => ai * (da[i] - avg));
    for (let i = 0; i < NP; i++) {
      const dv = dz.map((dzj) => f.a[i] * dzj);
      const dk = p.q.map((qj) => (ds[i] * qj) / sq);
      for (let j = 0; j < d; j++) g.q[j] += (ds[i] * f.k[i][j]) / sq;
      const de = new Array(d).fill(0);
      for (let r = 0; r < d; r++)
        for (let c = 0; c < d; c++) {
          g.Wv[r * d + c] += dv[r] * f.e[i][c];
          g.Wk[r * d + c] += dk[r] * f.e[i][c];
          de[c] += p.Wv[r * d + c] * dv[r] + p.Wk[r * d + c] * dk[r];
        }
      for (let j = 0; j < d; j++) {
        g.be[j] += de[j];
        g.pos[i * d + j] += de[j];
        for (let c = 0; c < PD; c++) g.We[j * PD + c] += de[j] * f.P[i][c];
      }
    }
  }
  for (const k of Object.keys(g)) g[k] = g[k].map((v) => v / batch.length);
  return { loss: loss / batch.length, acc: correct / batch.length, g };
}

/* ------------------------------------------------------------------ */
/* Generic classifier training with snapshots                          */
/* ------------------------------------------------------------------ */

export type ClsModel = "cnn" | "mlp" | "vit";
export type ClsSnap = { step: number; loss: number; trainAcc: number; testAcc: number; params: Params };

const GRAD = { cnn: cnnGrad, mlp: mlpGrad, vit: vitGrad };

export function accuracy(model: ClsModel, p: Params, data: Sample[]): number {
  const fwd = model === "cnn" ? cnnForward : model === "mlp" ? mlpForward : vitForward;
  return data.filter((s) => {
    const o = fwd(p, s.x).o;
    return (o[1] > o[0] ? 1 : 0) === s.y;
  }).length / data.length;
}

export function trainClassifier(model: ClsModel, train: Sample[], test: Sample[], opts: { steps: number; lr: number; batch: number; seed: number; every: number; init?: Params }): ClsSnap[] {
  const p = opts.init ? clone(opts.init) : model === "cnn" ? cnnInit(opts.seed) : model === "mlp" ? mlpInit(opts.seed) : vitInit(opts.seed);
  const opt = new Adam(p, opts.lr);
  const rng = createRng(opts.seed + 7);
  const snaps: ClsSnap[] = [];
  const record = (step: number) => {
    const full = GRAD[model](p, train);
    snaps.push({ step, loss: full.loss, trainAcc: full.acc, testAcc: accuracy(model, p, test), params: clone(p) });
  };
  record(0);
  for (let t = 1; t <= opts.steps; t++) {
    const batch = opts.batch >= train.length ? train : Array.from({ length: opts.batch }, () => train[Math.floor(rng() * train.length)]);
    opt.step(p, GRAD[model](p, batch).g);
    if (t % opts.every === 0) record(t);
  }
  return snaps;
}

/* ------------------------------------------------------------------ */
/* 1-D GAN: G(z) = a·z + b, D(x) = σ(w₂x² + w₁x + w₀)                   */
/* ------------------------------------------------------------------ */

export const GAN_REAL = { mean: 2, sd: 0.5 };
export type GanLoss = "minimax" | "nonsat";
export type GanSnap = { step: number; a: number; b: number; w: number[]; lossD: number; lossG: number; dReal: number; dFake: number };

export const dOf = (w: number[], x: number) => sigmoid(w[2] * x * x + w[1] * x + w[0]);

export function trainGan(opts: { steps: number; every: number; seed: number; loss: GanLoss; preTrainD?: number; lrG?: number; lrD?: number; dSteps?: number; sgdG?: boolean }): GanSnap[] {
  const rng = createRng(opts.seed);
  const G: Params = { ab: [0.4, -1] };
  const D: Params = { w: [0, 0, 0] };
  const optG = new Adam(G, opts.lrG ?? 0.02, 0.5);
  const optD = new Adam(D, opts.lrD ?? 0.02, 0.5);
  const N = 64;
  const snaps: GanSnap[] = [];
  const dStep = () => {
    const g = { w: [0, 0, 0] };
    let lossD = 0;
    let dr = 0;
    let df = 0;
    for (let i = 0; i < N; i++) {
      const xr = randomNormal(rng, GAN_REAL.mean, GAN_REAL.sd);
      const xf = G.ab[0] * randomNormal(rng, 0, 1) + G.ab[1];
      const pr = dOf(D.w, xr);
      const pf = dOf(D.w, xf);
      lossD += -Math.log(Math.max(pr, 1e-9)) - Math.log(Math.max(1 - pf, 1e-9));
      dr += pr;
      df += pf;
      const feats = (x: number) => [1, x, x * x];
      feats(xr).forEach((fv, j) => (g.w[j] += ((pr - 1) * fv) / N));
      feats(xf).forEach((fv, j) => (g.w[j] += (pf * fv) / N));
    }
    optD.step(D, g);
    return { lossD: lossD / N, dReal: dr / N, dFake: df / N };
  };
  const gStep = () => {
    const g = { ab: [0, 0] };
    let lossG = 0;
    for (let i = 0; i < N; i++) {
      const z = randomNormal(rng, 0, 1);
      const x = G.ab[0] * z + G.ab[1];
      const t = D.w[2] * x * x + D.w[1] * x + D.w[0];
      const pf = sigmoid(t);
      // ∂loss/∂t for log(1 − D) is −D; for −log D it is D − 1.
      const dt = opts.loss === "minimax" ? -pf : pf - 1;
      lossG += opts.loss === "minimax" ? Math.log(Math.max(1 - pf, 1e-9)) : -Math.log(Math.max(pf, 1e-9));
      const dx = dt * (2 * D.w[2] * x + D.w[1]);
      g.ab[0] += (dx * z) / N;
      g.ab[1] += dx / N;
    }
    // Plain SGD keeps the raw gradient size, which is what separates the two losses; Adam would rescale it away.
    if (opts.sgdG) G.ab = G.ab.map((v, j) => v - (opts.lrG ?? 0.02) * g.ab[j]);
    else optG.step(G, g);
    return lossG / N;
  };
  for (let i = 0; i < (opts.preTrainD ?? 0); i++) dStep();
  let last = { lossD: 0, dReal: 0, dFake: 0 };
  let lossG = 0;
  const push = (step: number) => snaps.push({ step, a: G.ab[0], b: G.ab[1], w: [...D.w], lossD: last.lossD, lossG, dReal: last.dReal, dFake: last.dFake });
  last = dStep();
  push(0);
  for (let t = 1; t <= opts.steps; t++) {
    for (let k = 0; k < (opts.dSteps ?? 1); k++) last = dStep();
    lossG = gStep();
    if (t % opts.every === 0) push(t);
  }
  return snaps;
}

/* ------------------------------------------------------------------ */
/* AE / VAE on 12-pixel edge rows, 2-D latent                          */
/* ------------------------------------------------------------------ */

export const ROW = 12;
export const EDGE_POS = [2, 3, 4, 5, 6, 7, 8, 9];
export const edgeRow = (pos: number) => Array.from({ length: ROW }, (_, i) => (i < pos ? 0.1 : 0.9));

export function edgeData(seed: number): { x: number[]; pos: number }[] {
  const rng = createRng(seed);
  const out: { x: number[]; pos: number }[] = [];
  for (let rep = 0; rep < 3; rep++) for (const pos of EDGE_POS) out.push({ x: edgeRow(pos).map((v) => v + randomNormal(rng, 0, 0.03)), pos });
  return out;
}

const H_AE = 10;
export function aeInit(seed: number): Params {
  const rng = createRng(seed);
  return {
    W1: randn(rng, H_AE * ROW, 0.4),
    b1: new Array(H_AE).fill(0),
    W2: randn(rng, 2 * H_AE, 0.4),
    b2: [0, 0],
    W3: randn(rng, 2 * H_AE, 0.1),
    b3: [-1, -1],
    W4: randn(rng, H_AE * 2, 0.6),
    b4: new Array(H_AE).fill(0),
    W5: randn(rng, ROW * H_AE, 0.4),
    b5: new Array(ROW).fill(0),
  };
}

export function aeEncode(p: Params, x: number[]) {
  const h1 = mv(p.W1, x, H_AE).map((v, j) => Math.tanh(v + p.b1[j]));
  const mu = mv(p.W2, h1, 2).map((v, j) => v + p.b2[j]);
  const lv = mv(p.W3, h1, 2).map((v, j) => v + p.b3[j]);
  return { h1, mu, lv };
}

export function aeDecode(p: Params, z: number[]) {
  const h2 = mv(p.W4, z, H_AE).map((v, j) => Math.tanh(v + p.b4[j]));
  const out = mv(p.W5, h2, ROW).map((v, j) => sigmoid(v + p.b5[j]));
  return { h2, out };
}

export type AeSnap = { step: number; recon: number; kl: number; params: Params };

export function trainAe(opts: { vae: boolean; beta?: number; steps: number; every: number; seed: number; lr?: number }): AeSnap[] {
  const data = edgeData(opts.seed);
  const p = aeInit(opts.seed + 1);
  const opt = new Adam(p, opts.lr ?? 0.02);
  const rng = createRng(opts.seed + 2);
  const beta = opts.beta ?? 1;
  const snaps: AeSnap[] = [];
  const pass = (learn: boolean) => {
    const g = zerosLike(p);
    let recon = 0;
    let kl = 0;
    for (const { x } of data) {
      const { h1, mu, lv } = aeEncode(p, x);
      const eps = opts.vae ? [randomNormal(rng, 0, 1), randomNormal(rng, 0, 1)] : [0, 0];
      const sd = lv.map((l) => Math.exp(0.5 * l));
      const z = opts.vae ? mu.map((m, j) => m + sd[j] * eps[j]) : mu;
      const { h2, out } = aeDecode(p, z);
      recon += out.reduce((s, o, i) => s + (o - x[i]) ** 2, 0);
      if (opts.vae) kl += mu.reduce((s, m, j) => s + 0.5 * (m * m + Math.exp(lv[j]) - 1 - lv[j]), 0);
      if (!learn) continue;
      const dpre5 = out.map((o, i) => 2 * (o - x[i]) * o * (1 - o));
      const dh2 = new Array(H_AE).fill(0);
      for (let i = 0; i < ROW; i++) {
        g.b5[i] += dpre5[i];
        for (let j = 0; j < H_AE; j++) {
          g.W5[i * H_AE + j] += dpre5[i] * h2[j];
          dh2[j] += p.W5[i * H_AE + j] * dpre5[i];
        }
      }
      const dpre4 = dh2.map((v, j) => v * (1 - h2[j] * h2[j]));
      const dz = [0, 0];
      for (let j = 0; j < H_AE; j++) {
        g.b4[j] += dpre4[j];
        for (let c = 0; c < 2; c++) {
          g.W4[j * 2 + c] += dpre4[j] * z[c];
          dz[c] += p.W4[j * 2 + c] * dpre4[j];
        }
      }
      const dmu = opts.vae ? dz.map((v, c) => v + beta * mu[c]) : dz;
      const dlv = opts.vae ? dz.map((v, c) => v * eps[c] * 0.5 * sd[c] + beta * 0.5 * (Math.exp(lv[c]) - 1)) : [0, 0];
      const dh1 = new Array(H_AE).fill(0);
      for (let c = 0; c < 2; c++) {
        g.b2[c] += dmu[c];
        g.b3[c] += dlv[c];
        for (let j = 0; j < H_AE; j++) {
          g.W2[c * H_AE + j] += dmu[c] * h1[j];
          g.W3[c * H_AE + j] += dlv[c] * h1[j];
          dh1[j] += p.W2[c * H_AE + j] * dmu[c] + p.W3[c * H_AE + j] * dlv[c];
        }
      }
      for (let j = 0; j < H_AE; j++) {
        const dpre1 = dh1[j] * (1 - h1[j] * h1[j]);
        g.b1[j] += dpre1;
        for (let i = 0; i < ROW; i++) g.W1[j * ROW + i] += dpre1 * x[i];
      }
    }
    for (const k of Object.keys(g)) g[k] = g[k].map((v) => v / data.length);
    return { g, recon: recon / data.length, kl: kl / data.length };
  };
  const record = (step: number) => {
    const r = pass(false);
    snaps.push({ step, recon: r.recon, kl: r.kl, params: clone(p) });
  };
  record(0);
  for (let t = 1; t <= opts.steps; t++) {
    opt.step(p, pass(true).g);
    if (t % opts.every === 0) record(t);
  }
  return snaps;
}

/** How much a decoded row looks like a clean step edge: 1 − (distance to the nearest clean edge) / (worst case). */
export function edgeLikeness(row: number[]): number {
  let best = Infinity;
  for (let pos = 0; pos <= ROW; pos++) best = Math.min(best, edgeRow(pos).reduce((s, v, i) => s + Math.abs(v - row[i]), 0));
  return 1 - best / (0.4 * ROW);
}

/** Fixed draws from the prior N(0, I), shared by the AE and the VAE so the comparison is fair. */
export function priorDraws(n: number, seed: number): number[][] {
  const rng = createRng(seed);
  return Array.from({ length: n }, () => [randomNormal(rng, 0, 1), randomNormal(rng, 0, 1)]);
}

/* ------------------------------------------------------------------ */
/* A YOLO-style grid detector                                           */
/* ------------------------------------------------------------------ */

export const GRID = 4; // 4 × 4 cells of 2 × 2 pixels
export type Box = { x: number; y: number; w: number; h: number };
export type DetSample = { x: number[]; box: Box };

export function detData(n: number, seed: number): DetSample[] {
  const rng = createRng(seed);
  return Array.from({ length: n }, () => {
    const w = 2 + Math.floor(rng() * 3);
    const h = 2 + Math.floor(rng() * 3);
    const bx = Math.floor(rng() * (SIDE - w + 1));
    const by = Math.floor(rng() * (SIDE - h + 1));
    const x = Array.from({ length: SIDE * SIDE }, (_, i) => {
      const r = Math.floor(i / SIDE);
      const c = i % SIDE;
      const inside = c >= bx && c < bx + w && r >= by && r < by + h;
      return (inside ? 0.85 : 0.1) + randomNormal(rng, 0, 0.05);
    });
    return { x, box: { x: bx, y: by, w, h } };
  });
}

const H_DET = 12;
const WIN = 16; // a cell's 2 × 2 pixels plus a 1-pixel border

function cellWindow(x: number[], row: number, col: number): number[] {
  const out: number[] = [];
  for (let dy = -1; dy < 3; dy++)
    for (let dx = -1; dx < 3; dx++) {
      const r = row * 2 + dy;
      const c = col * 2 + dx;
      out.push(r < 0 || c < 0 || r >= SIDE || c >= SIDE ? 0 : x[r * SIDE + c]);
    }
  return out;
}

export function detInit(seed: number): Params {
  const rng = createRng(seed);
  return { W1: randn(rng, H_DET * WIN, 0.3), b1: new Array(H_DET).fill(0), W2: randn(rng, 5 * H_DET, 0.3), b2: [-2, 0, 0, 0, 0] };
}

export type CellPred = { obj: number; box: Box; t: number[]; h: number[]; win: number[] };

/** One shared head on every cell, like a 1 × 1 conv over a feature map: [objectness, tx, ty, tw, th]. */
export function detForward(p: Params, x: number[]): CellPred[] {
  const out: CellPred[] = [];
  for (let row = 0; row < GRID; row++)
    for (let col = 0; col < GRID; col++) {
      const win = cellWindow(x, row, col);
      const h = mv(p.W1, win, H_DET).map((v, j) => Math.max(0, v + p.b1[j]));
      const t = mv(p.W2, h, 5).map((v, j) => v + p.b2[j]);
      const s = t.map(sigmoid);
      const cx = (col + s[1]) * 2;
      const cy = (row + s[2]) * 2;
      const w = SIDE * s[3];
      const hh = SIDE * s[4];
      out.push({ obj: s[0], box: { x: cx - w / 2, y: cy - hh / 2, w, h: hh }, t, h, win });
    }
  return out;
}

export function boxIou(a: Box, b: Box): number {
  const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const inter = ix * iy;
  return inter / (a.w * a.h + b.w * b.h - inter);
}

/** Which cell owns the object (its centre falls inside it) and the targets for that cell. */
export function detTarget(box: Box) {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const col = Math.min(GRID - 1, Math.floor(cx / 2));
  const row = Math.min(GRID - 1, Math.floor(cy / 2));
  return { cell: row * GRID + col, tgt: [cx / 2 - col, cy / 2 - row, box.w / SIDE, box.h / SIDE] };
}

export type DetSnap = { step: number; lossObj: number; lossBox: number; meanIou: number; hit50: number; params: Params };
const LAMBDA_COORD = 5;

export function trainDetector(opts: { steps: number; every: number; seed: number; batch?: number; lr?: number }): DetSnap[] {
  const train = detData(160, opts.seed);
  const test = detData(60, opts.seed + 100);
  const p = detInit(opts.seed + 1);
  const opt = new Adam(p, opts.lr ?? 0.01);
  const rng = createRng(opts.seed + 2);
  const snaps: DetSnap[] = [];
  const grad = (batch: DetSample[], learn: boolean) => {
    const g = zerosLike(p);
    let lossObj = 0;
    let lossBox = 0;
    for (const { x, box } of batch) {
      const preds = detForward(p, x);
      const { cell, tgt } = detTarget(box);
      preds.forEach((pr, ci) => {
        const y = ci === cell ? 1 : 0;
        lossObj += -(y * Math.log(Math.max(pr.obj, 1e-9)) + (1 - y) * Math.log(Math.max(1 - pr.obj, 1e-9)));
        const dt = [pr.obj - y, 0, 0, 0, 0];
        if (ci === cell) {
          for (let k = 0; k < 4; k++) {
            const s = sigmoid(pr.t[k + 1]);
            lossBox += LAMBDA_COORD * (s - tgt[k]) ** 2;
            dt[k + 1] = LAMBDA_COORD * 2 * (s - tgt[k]) * s * (1 - s);
          }
        }
        if (!learn) return;
        const dh = new Array(H_DET).fill(0);
        for (let o = 0; o < 5; o++) {
          g.b2[o] += dt[o];
          for (let j = 0; j < H_DET; j++) {
            g.W2[o * H_DET + j] += dt[o] * pr.h[j];
            dh[j] += p.W2[o * H_DET + j] * dt[o];
          }
        }
        for (let j = 0; j < H_DET; j++) {
          if (pr.h[j] <= 0) continue;
          g.b1[j] += dh[j];
          for (let i = 0; i < WIN; i++) g.W1[j * WIN + i] += dh[j] * pr.win[i];
        }
      });
    }
    for (const k of Object.keys(g)) g[k] = g[k].map((v) => v / batch.length);
    return { g, lossObj: lossObj / batch.length, lossBox: lossBox / batch.length };
  };
  const record = (step: number) => {
    const r = grad(train, false);
    const ious = test.map(({ x, box }) => {
      const preds = detForward(p, x);
      const best = preds.reduce((a, b) => (b.obj > a.obj ? b : a));
      return boxIou(best.box, box);
    });
    snaps.push({ step, lossObj: r.lossObj, lossBox: r.lossBox, meanIou: ious.reduce((a, b) => a + b, 0) / ious.length, hit50: ious.filter((v) => v >= 0.5).length / ious.length, params: clone(p) });
  };
  record(0);
  const B = opts.batch ?? 8;
  for (let t = 1; t <= opts.steps; t++) {
    const batch = Array.from({ length: B }, () => train[Math.floor(rng() * train.length)]);
    opt.step(p, grad(batch, true).g);
    if (t % opts.every === 0) record(t);
  }
  return snaps;
}
