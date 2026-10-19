// CTR / CVR / ESMM arithmetic for the Recommender Systems chapter.
// A seeded impression population on 9 levels of one feature x ("兴趣分"):
// click propensity rises with x at a slope the reader controls, conversion
// propensity rises with x at a fixed slope. Pure functions; see tests/esmm.test.ts.

import { adamMinimize } from "@/lib/ml/adamVec";
import { sigmoid } from "@/lib/ml/linear";
import { createRng } from "@/lib/ml/random";

export const LEVELS = [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2] as const;
export const N_IMPRESSIONS = 20000;
export const SEED = 11;
// pCTR(x) = σ(CTR_BIAS + s·x): about 4% at x = 0.
export const CTR_BIAS = -3.2;
// pCVR(x) = σ(CVR_BIAS + CVR_SLOPE·x): the conversion rate if the impression were clicked.
export const CVR_BIAS = -1.2;
export const CVR_SLOPE = 1.2;

export const trueCtr = (x: number, slope: number) => sigmoid(CTR_BIAS + slope * x);
export const trueCvr = (x: number) => sigmoid(CVR_BIAS + CVR_SLOPE * x);

export type LevelCounts = { x: number; imp: number; click: number; conv: number };

// Each impression draws three uniforms in a fixed order (level, click, convert-if-clicked),
// so moving the slope only changes which impressions are clicked, not who they are.
export function simulateImpressions(slope: number, n = N_IMPRESSIONS, seed = SEED): LevelCounts[] {
  const rng = createRng(seed);
  const weights = LEVELS.map((x) => Math.exp((-x * x) / 2));
  const total = weights.reduce((a, b) => a + b, 0);
  const cum: number[] = [];
  weights.reduce((acc, w, i) => (cum[i] = acc + w / total), 0);
  const rows: LevelCounts[] = LEVELS.map((x) => ({ x, imp: 0, click: 0, conv: 0 }));
  for (let i = 0; i < n; i++) {
    const uLevel = rng();
    const uClick = rng();
    const uConv = rng();
    let k = cum.findIndex((c) => uLevel < c);
    if (k < 0) k = LEVELS.length - 1;
    const row = rows[k];
    row.imp += 1;
    if (uClick < trueCtr(row.x, slope)) {
      row.click += 1;
      if (uConv < trueCvr(row.x)) row.conv += 1;
    }
  }
  return rows;
}

export const sum = (rows: readonly LevelCounts[], key: "imp" | "click" | "conv") => rows.reduce((s, r) => s + r[key], 0);

// What a CVR model trained only on clicked impressions is calibrated to: conversions / clicks.
export function clickSpaceCvr(rows: readonly LevelCounts[]): number {
  const clicks = sum(rows, "click");
  return clicks === 0 ? 0 : sum(rows, "conv") / clicks;
}

// What serving needs: the conversion-if-clicked rate averaged over every impression.
export function impressionSpaceCvr(rows: readonly LevelCounts[], cvr: (x: number) => number = trueCvr): number {
  const n = sum(rows, "imp");
  return n === 0 ? 0 : rows.reduce((s, r) => s + r.imp * cvr(r.x), 0) / n;
}

// Per-level conversions / clicks; null where a level has no clicks to learn from.
export function observedCvrByLevel(rows: readonly LevelCounts[]): (number | null)[] {
  return rows.map((r) => (r.click === 0 ? null : r.conv / r.click));
}

export type EsmmParams = { a: number; b: number; c: number; d: number };
export const esmmCtr = (p: EsmmParams, x: number) => sigmoid(p.a + p.b * x);
export const esmmCvr = (p: EsmmParams, x: number) => sigmoid(p.c + p.d * x);

const EPS = 1e-12;
const logit = (p: number) => Math.log(p / (1 - p));

// ESMM's loss on the impression space, averaged per impression:
// BCE(click, pCTR) + BCE(click ∧ conv, pCTR · pCVR). pCVR never sees a label of its own.
export function esmmLoss(theta: readonly number[], rows: readonly LevelCounts[]): { loss: number; grad: number[] } {
  const [a, b, c, d] = theta;
  const n = sum(rows, "imp");
  let loss = 0;
  const g = [0, 0, 0, 0];
  for (const r of rows) {
    const p1 = sigmoid(a + b * r.x);
    const p2 = sigmoid(c + d * r.x);
    const q = Math.min(1 - EPS, Math.max(EPS, p1 * p2));
    loss -= r.click * Math.log(Math.max(EPS, p1)) + (r.imp - r.click) * Math.log(Math.max(EPS, 1 - p1));
    loss -= r.conv * Math.log(q) + (r.imp - r.conv) * Math.log(1 - q);
    // ∂/∂z1 of the CTR term is imp·p1 − click; the CTCVR term passes (imp·q − conv)/(1 − q) through dq/dz = q'(1 − p).
    const ctcvr = (r.imp * q - r.conv) / (1 - q);
    const gz1 = r.imp * p1 - r.click + ctcvr * (1 - p1);
    const gz2 = ctcvr * (1 - p2);
    g[0] += gz1;
    g[1] += gz1 * r.x;
    g[2] += gz2;
    g[3] += gz2 * r.x;
  }
  return { loss: loss / n, grad: g.map((v) => v / n) };
}

export function trainEsmm(rows: readonly LevelCounts[], steps = 1500, lr = 0.05): { params: EsmmParams; loss: number } {
  const n = sum(rows, "imp");
  const ctr = Math.min(0.99, Math.max(0.01, sum(rows, "click") / n));
  const cvr = Math.min(0.99, Math.max(0.01, clickSpaceCvr(rows)));
  const { theta, loss } = adamMinimize((t) => esmmLoss(t, rows), [logit(ctr), 0, logit(cvr), 0], { steps, lr });
  return { params: { a: theta[0], b: theta[1], c: theta[2], d: theta[3] }, loss };
}

export type EsmmScenario = {
  slope: number;
  rows: LevelCounts[];
  impressions: number;
  clicks: number;
  conversions: number;
  clickSpace: number;
  impressionSpace: number;
  esmm: EsmmParams;
  esmmImpressionSpace: number;
};

export function esmmScenario(slope: number): EsmmScenario {
  const rows = simulateImpressions(slope);
  const { params } = trainEsmm(rows);
  return {
    slope,
    rows,
    impressions: sum(rows, "imp"),
    clicks: sum(rows, "click"),
    conversions: sum(rows, "conv"),
    clickSpace: clickSpaceCvr(rows),
    impressionSpace: impressionSpaceCvr(rows),
    esmm: params,
    esmmImpressionSpace: impressionSpaceCvr(rows, (x) => esmmCvr(params, x)),
  };
}
