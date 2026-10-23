// Recommender Systems: DIN target attention over a user's behaviour sequence,
// and how kuairank stores that sequence without a (samples × N) matrix.
// historyIndex mirrors kurec/seq.history_index; the 2-D attention toy uses a
// hand-set activation (示意) so the geometry can be drawn. No React here; see
// tests/din.test.ts.

import { createRng } from "./random";

// ---------------------------------------------------------------- storage

// Last n events of [lo, hi), right-aligned: idx = hi − n + j, valid when idx ≥ lo; padding gets index 0.
export function historyIndex(lo: number, hi: number, n: number): { idx: number[]; mask: boolean[] } {
  const idx: number[] = [];
  const mask: boolean[] = [];
  for (let j = 0; j < n; j++) {
    const i = hi - n + j;
    const ok = i >= lo;
    idx.push(ok ? i : 0);
    mask.push(ok);
  }
  return { idx, mask };
}

export const GB = 1e9;
export const MB = 1e6;

// A materialised history: every sample stores n events × cols int32 columns.
export const materialisedBytes = (samples: number, n: number, cols: number, bytes = 4) => samples * n * cols * bytes;
// The pointer layout: every sample stores (all_lo, all_hi, pos_lo, pos_hi) as int32.
export const pointerBytes = (samples: number, pointers = 4, bytes = 4) => samples * pointers * bytes;

// The model's tensor shapes for one batch (kurec/models/din.py, d = 16, item fields vid/aid/tag, 27 base fields, 61 dense).
export const DIN_DIMS = { batch: 4096, n: 50, d: 16, itemFields: 3, baseFields: 27, dense: 61, attnHidden: [64, 32], cross: 3, tower: [512, 256, 128] };

export function dinShapes(dims = DIN_DIMS) {
  const item = dims.itemFields * dims.d;
  const elem = item + dims.d;
  const attnIn = 4 * item + dims.d;
  const x0 = dims.baseFields * dims.d + dims.dense + item + elem;
  return { item, elem, attnIn, x0 };
}

// ---------------------------------------------------------------- 2-D attention toy (示意)

export type Feedback = "skip" | "click" | "long";
export const TAGS = ["萌宠", "美食", "搞笑", "游戏", "汽车"] as const;
export type Tag = (typeof TAGS)[number];
// Each tag is a unit vector; neighbouring tags are partly similar.
export const TAG_ANGLE: Record<Tag, number> = { 萌宠: 0, 美食: 70, 搞笑: 140, 游戏: 200, 汽车: 270 };
// Sign and size of a history element along its tag direction: a skip pushes away, a long view pulls hardest.
export const FB_SIGN: Record<Feedback, number> = { skip: -0.6, click: 1, long: 1.4 };
// How much the feedback type raises the attention weight (stands in for e_fb inside the MLP).
export const FB_ATTN: Record<Feedback, number> = { skip: 0.5, click: 1, long: 1.3 };
export const FB_LABEL: Record<Feedback, string> = { skip: "划走", click: "点击", long: "长播" };

export type Vec = [number, number];
export type HistEvent = { tag: Tag; fb: Feedback };

export function tagVec(tag: Tag): Vec {
  const a = (TAG_ANGLE[tag] * Math.PI) / 180;
  return [Math.cos(a), Math.sin(a)];
}

const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1];

// History element e_i = s(fb_i) · k_i.
export function elementVec(e: HistEvent): Vec {
  const k = tagVec(e.tag);
  const s = FB_SIGN[e.fb];
  return [s * k[0], s * k[1]];
}

// 示意 activation unit: w_i = max(0, cos(q, k_i)) · ω(fb_i). The real one is MLP([q, k, q − k, q ⊙ k, e_fb]).
export function attentionWeight(target: Tag, e: HistEvent): number {
  return Math.max(0, dot(tagVec(target), tagVec(e.tag))) * FB_ATTN[e.fb];
}

export type Pooled = { weights: number[]; vec: Vec; score: number };

// DIN: Σ w_i e_i, weights not normalised. score = ⟨pooled, q⟩.
export function dinPool(target: Tag, history: readonly HistEvent[]): Pooled {
  const q = tagVec(target);
  const weights = history.map((e) => attentionWeight(target, e));
  const vec: Vec = [0, 0];
  history.forEach((e, i) => {
    const v = elementVec(e);
    vec[0] += weights[i] * v[0];
    vec[1] += weights[i] * v[1];
  });
  return { weights, vec, score: dot(vec, q) };
}

// Mean pooling: every valid position gets 1/N, whatever the target.
export function meanPool(target: Tag, history: readonly HistEvent[]): Pooled {
  const q = tagVec(target);
  const n = history.length;
  const weights = history.map(() => (n === 0 ? 0 : 1 / n));
  const vec: Vec = [0, 0];
  history.forEach((e, i) => {
    const v = elementVec(e);
    vec[0] += weights[i] * v[0];
    vec[1] += weights[i] * v[1];
  });
  return { weights, vec, score: dot(vec, q) };
}

// 示意 head: p = σ(b + c · score), and the binary cross-entropy against the label.
export const HEAD = { bias: -1, slope: 1.2 };
export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
export function bce(p: number, y: 0 | 1): number {
  const q = Math.min(1 - 1e-7, Math.max(1e-7, p));
  return -(y * Math.log(q) + (1 - y) * Math.log(1 - q));
}

// The worked example: ten recent events of one user, oldest first.
export const DEMO_HISTORY: HistEvent[] = [
  { tag: "游戏", fb: "skip" },
  { tag: "萌宠", fb: "long" },
  { tag: "美食", fb: "click" },
  { tag: "游戏", fb: "skip" },
  { tag: "汽车", fb: "skip" },
  { tag: "萌宠", fb: "click" },
  { tag: "搞笑", fb: "click" },
  { tag: "游戏", fb: "skip" },
  { tag: "萌宠", fb: "long" },
  { tag: "美食", fb: "skip" },
];

// Three candidates and what the user actually did with them (示意 labels).
export const DEMO_CANDIDATES: { tag: Tag; label: 0 | 1 }[] = [
  { tag: "萌宠", label: 1 },
  { tag: "美食", label: 1 },
  { tag: "游戏", label: 0 },
];

export function scoreCandidate(target: Tag, label: 0 | 1, history = DEMO_HISTORY) {
  const din = dinPool(target, history);
  const mean = meanPool(target, history);
  const pDin = sigmoid(HEAD.bias + HEAD.slope * din.score);
  const pMean = sigmoid(HEAD.bias + HEAD.slope * mean.score);
  return { din, mean, pDin, pMean, lossDin: bce(pDin, label), lossMean: bce(pMean, label) };
}

// ---------------------------------------------------------------- long history: mean dilutes, DIN does not

export const LONG_HISTORY_LEN = 200;
export const RECENT_BURST = 12;

// How often the user engages with each tag in the older history; engaged → click or long view, else skip.
export const OLDER_LIKE: Record<Tag, number> = { 萌宠: 0.7, 美食: 0.5, 搞笑: 0.4, 游戏: 0.1, 汽车: 0.1 };

// 188 older events with mixed tags (萌宠 rare), then a recent burst of 12 events where the user binges 萌宠.
export function longHistory(seed = 1706): HistEvent[] {
  const rng = createRng(seed);
  const older: Tag[] = ["美食", "搞笑", "游戏", "汽车", "美食", "搞笑", "游戏", "汽车", "美食", "搞笑", "游戏", "汽车", "萌宠"];
  const out: HistEvent[] = [];
  for (let i = 0; i < LONG_HISTORY_LEN - RECENT_BURST; i++) {
    const tag = older[Math.floor(rng() * older.length)];
    const engaged = rng() < OLDER_LIKE[tag];
    out.push({ tag, fb: engaged ? (rng() < 0.5 ? "click" : "long") : "skip" });
  }
  for (let i = 0; i < RECENT_BURST; i++) {
    out.push(i % 3 === 2 ? { tag: "搞笑", fb: "skip" } : { tag: "萌宠", fb: i % 2 === 0 ? "long" : "click" });
  }
  return out;
}

// How far apart the pooled score puts a matching target (萌宠) and a non-matching one (游戏), using the last n events.
export function separationAt(history: readonly HistEvent[], n: number, pool: "mean" | "din", a: Tag = "萌宠", b: Tag = "游戏"): number {
  const last = history.slice(Math.max(0, history.length - n));
  const f = pool === "mean" ? meanPool : dinPool;
  return f(a, last).score - f(b, last).score;
}
