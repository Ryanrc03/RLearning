// Feature-crossing arithmetic for the Recommender Systems chapter.
// Five age groups × five ad types, one-hot encoded. The true click logit has
// main effects plus a rank-1 interaction p_user · q_ad, so "young × game" clicks
// far more than either feature alone predicts. One cell (50+ × 游戏) is never
// shown in training. Four small models are trained on the other 24 cells:
// LR, LR + hand-made crosses, FM (k = 2), and a one-layer DCN cross network on
// the same 2-dim embeddings.
// Pure functions; see tests/featureCross.test.ts.

import { adamMinimize } from "@/lib/ml/adamVec";
import { sigmoid } from "@/lib/ml/linear";
import { createRng, randomNormal } from "@/lib/ml/random";

export const USERS = ["18–24", "25–30", "31–40", "41–50", "50+"] as const;
export const ADS = ["游戏", "美妆", "电商", "汽车", "理财"] as const;
const NU = USERS.length;
const NA = ADS.length;
export const IMPRESSIONS_PER_CELL = 20000;
export const HELD_OUT = { user: 4, ad: 0 } as const;
export const FM_K = 2;
const SEED = 5;

const BASE = -3.0;
const U_MAIN = [0.1, 0.2, 0.1, 0, -0.2];
const A_MAIN = [0, 0.1, 0.2, -0.3, -0.2];
const P = [1.2, 0.6, 0, -0.6, -1.2];
const Q = [1.2, 0.5, 0, -0.5, -0.9];

export const trueLogit = (i: number, j: number) => BASE + U_MAIN[i] + A_MAIN[j] + P[i] * Q[j];
export const trueCtr = (i: number, j: number) => sigmoid(trueLogit(i, j));

export type Cell = { user: number; ad: number; imp: number; click: number; heldOut: boolean };

// Seeded binomial clicks for every cell; the held-out cell is generated too but never trained on.
export function makeCells(seed = SEED): Cell[] {
  const rng = createRng(seed);
  const cells: Cell[] = [];
  for (let i = 0; i < NU; i++) {
    for (let j = 0; j < NA; j++) {
      const p = trueCtr(i, j);
      let click = 0;
      for (let k = 0; k < IMPRESSIONS_PER_CELL; k++) if (rng() < p) click++;
      cells.push({ user: i, ad: j, imp: IMPRESSIONS_PER_CELL, click, heldOut: i === HELD_OUT.user && j === HELD_OUT.ad });
    }
  }
  return cells;
}

export type ModelName = "lr" | "cross" | "fm" | "dcn";
export const MODEL_NAMES: ModelName[] = ["lr", "cross", "fm", "dcn"];

// Parameter layout. Every model starts with the LR part: w0, one weight per user group, one per ad type.
const LR_SIZE = 1 + NU + NA;
const IDS = NU + NA; // one-hot width
const X0 = 2 * FM_K; // DCN input: [e_user ; e_ad]
export function paramSize(model: ModelName): number {
  if (model === "lr") return LR_SIZE;
  if (model === "cross") return LR_SIZE + NU * NA;
  if (model === "fm") return LR_SIZE + IDS * FM_K;
  return LR_SIZE + IDS * FM_K + 3 * X0; // DCN: embeddings, cross weight w, cross bias b, output weights u
}

// The logit for user i, ad j and its gradient with respect to every parameter.
export function logitAndGrad(model: ModelName, theta: readonly number[], i: number, j: number): { z: number; g: number[] } {
  const g = new Array<number>(theta.length).fill(0);
  const ui = 1 + i;
  const aj = 1 + NU + j;
  let z = theta[0] + theta[ui] + theta[aj];
  g[0] = 1;
  g[ui] = 1;
  g[aj] = 1;
  // FM and DCN both give every id a k-dim vector; user i's starts at ei, ad j's at ej.
  const ei = LR_SIZE + i * FM_K;
  const ej = LR_SIZE + (NU + j) * FM_K;
  if (model === "cross") {
    const c = LR_SIZE + i * NA + j;
    z += theta[c];
    g[c] = 1;
  } else if (model === "fm") {
    // ⟨v_i, v_j⟩ between the user group's vector and the ad type's vector.
    for (let f = 0; f < FM_K; f++) {
      z += theta[ei + f] * theta[ej + f];
      g[ei + f] = theta[ej + f];
      g[ej + f] = theta[ei + f];
    }
  } else if (model === "dcn") {
    // x0 = [e_i ; e_j]; one cross layer x1 = x0 (x0ᵀ w) + b + x0; logit += uᵀ x1.
    const W = LR_SIZE + IDS * FM_K;
    const B = W + X0;
    const Uo = B + X0;
    const src = (k: number) => (k < FM_K ? ei + k : ej + k - FM_K);
    const x0 = Array.from({ length: X0 }, (_, k) => theta[src(k)]);
    const s = x0.reduce((acc, v, k) => acc + v * theta[W + k], 0);
    const ux0 = x0.reduce((acc, v, k) => acc + v * theta[Uo + k], 0);
    for (let k = 0; k < X0; k++) {
      const x1 = x0[k] * s + theta[B + k] + x0[k];
      z += theta[Uo + k] * x1;
      g[Uo + k] = x1;
      g[B + k] = theta[Uo + k];
      g[W + k] = ux0 * x0[k];
      // ∂(uᵀx1)/∂x0_k = u_k (s + 1) + (uᵀx0) w_k
      g[src(k)] += theta[Uo + k] * (s + 1) + ux0 * theta[W + k];
    }
  }
  return { z, g };
}

export const L2 = 1e-5;

// Mean log loss per impression over the training cells, plus a small L2 so the
// over-parameterised models have one answer.
export function trainingLoss(model: ModelName, theta: readonly number[], cells: readonly Cell[]): { loss: number; grad: number[] } {
  const train = cells.filter((c) => !c.heldOut);
  const n = train.reduce((s, c) => s + c.imp, 0);
  let loss = 0;
  const grad = new Array<number>(theta.length).fill(0);
  for (const c of train) {
    const { z, g } = logitAndGrad(model, theta, c.user, c.ad);
    const p = sigmoid(z);
    loss -= c.click * Math.log(Math.max(1e-12, p)) + (c.imp - c.click) * Math.log(Math.max(1e-12, 1 - p));
    const r = c.imp * p - c.click;
    for (let k = 0; k < g.length; k++) grad[k] += r * g[k];
  }
  loss /= n;
  for (let k = 0; k < theta.length; k++) {
    grad[k] = grad[k] / n + 2 * L2 * theta[k];
    loss += L2 * theta[k] * theta[k];
  }
  return { loss, grad };
}

function initTheta(model: ModelName, cells: readonly Cell[]): number[] {
  const train = cells.filter((c) => !c.heldOut);
  const ctr = train.reduce((s, c) => s + c.click, 0) / train.reduce((s, c) => s + c.imp, 0);
  const rng = createRng(SEED + MODEL_NAMES.indexOf(model) + 1);
  const theta = new Array<number>(paramSize(model)).fill(0);
  theta[0] = Math.log(ctr / (1 - ctr));
  // Factor models need a nonzero start or every vector stays at 0.
  if (model === "fm" || model === "dcn") for (let k = LR_SIZE; k < theta.length; k++) theta[k] = randomNormal(rng, 0, 0.1);
  return theta;
}

export type FitResult = {
  model: ModelName;
  theta: number[];
  /** Predicted CTR, [user][ad]. */
  pred: number[][];
  trainLogLoss: number;
  /** Mean |pred − true| CTR over the training cells. */
  trainAbsErr: number;
  heldOutPred: number;
  heldOutTrue: number;
  params: number;
};

export function fitModel(model: ModelName, cells: readonly Cell[] = makeCells(), steps = 3000, lr = 0.05): FitResult {
  const { theta } = adamMinimize((t) => trainingLoss(model, t, cells), initTheta(model, cells), { steps, lr });
  const pred = USERS.map((_, i) => ADS.map((__, j) => sigmoid(logitAndGrad(model, theta, i, j).z)));
  const train = cells.filter((c) => !c.heldOut);
  const n = train.reduce((s, c) => s + c.imp, 0);
  const trainLogLoss =
    -train.reduce((s, c) => {
      const p = pred[c.user][c.ad];
      return s + c.click * Math.log(p) + (c.imp - c.click) * Math.log(1 - p);
    }, 0) / n;
  const trainAbsErr = train.reduce((s, c) => s + Math.abs(pred[c.user][c.ad] - trueCtr(c.user, c.ad)), 0) / train.length;
  return {
    model,
    theta,
    pred,
    trainLogLoss,
    trainAbsErr,
    heldOutPred: pred[HELD_OUT.user][HELD_OUT.ad],
    heldOutTrue: trueCtr(HELD_OUT.user, HELD_OUT.ad),
    params: theta.length,
  };
}

// Weights needed at production scale: hand-made user × ad crosses grow with the product,
// FM with the sum (each id gets one k-dim vector).
export const crossWeightsAtScale = (nUsers: number, nAds: number) => nUsers * nAds;
export const fmWeightsAtScale = (nUsers: number, nAds: number, k: number) => (nUsers + nAds) * k;

// DCN: a cross layer turns degree-l polynomials of x0 into degree-(l + 1); L layers reach L + 1.
export const dcnMaxOrder = (layers: number) => layers + 1;
