// LLMs, BERT fine-tuning: everything the MacBERT three-class fine-tuning page
// computes. Character tokenization into a padded batch, the classification
// head's softmax / cross-entropy / gradient, the warmup + linear-decay
// learning-rate schedule, a seeded toy training run on 2-D stand-ins for the
// [CLS] vectors, and multi-class metrics from a confusion matrix.
// Pure functions, no React; see tests/finetune.test.ts.

import { createRng, randomNormal, type Rng } from "@/lib/ml/random";

export const LABELS = ["负面", "中性", "正面"] as const;
export type Label = 0 | 1 | 2;

// ---------------------------------------------------------------- tokenization

/** Real ids of the special tokens in the bert-base-chinese vocab, which MacBERT reuses. */
export const SPECIAL_IDS = { "[PAD]": 0, "[UNK]": 100, "[CLS]": 101, "[SEP]": 102 } as const;

/**
 * Illustrative ids for ordinary characters. The real vocab has 21,128 rows; these
 * numbers only need to be stable, so they are derived from the code point.
 */
export function demoCharId(ch: string): number {
  return 1000 + ((ch.codePointAt(0)! * 7919) % 20000);
}

export type Encoded = {
  tokens: string[];
  inputIds: number[];
  attentionMask: number[];
  tokenTypeIds: number[];
  /** Characters dropped by truncation. */
  truncated: number;
};

/** Split into characters, truncate to fit [CLS] … [SEP] in maxLen, then pad to padTo (≥ the encoded length). */
export function encode(text: string, maxLen: number, padTo?: number): Encoded {
  const chars = Array.from(text);
  const keep = Math.max(0, Math.min(chars.length, maxLen - 2));
  const tokens = ["[CLS]", ...chars.slice(0, keep), "[SEP]"];
  const real = tokens.length;
  const target = Math.max(real, padTo ?? real);
  while (tokens.length < target) tokens.push("[PAD]");
  const inputIds = tokens.map((t) => (t in SPECIAL_IDS ? SPECIAL_IDS[t as keyof typeof SPECIAL_IDS] : demoCharId(t)));
  return {
    tokens,
    inputIds,
    attentionMask: tokens.map((_, i) => (i < real ? 1 : 0)),
    tokenTypeIds: tokens.map(() => 0),
    truncated: chars.length - keep,
  };
}

/** Dynamic padding: every row is padded to the longest row of this batch (capped by maxLen). */
export function encodeBatch(texts: string[], maxLen: number): Encoded[] {
  const longest = Math.max(...texts.map((t) => Math.min(Array.from(t).length + 2, maxLen)));
  return texts.map((t) => encode(t, maxLen, longest));
}

// ---------------------------------------------------------------- head and loss

export function softmax(z: readonly number[]): number[] {
  const m = Math.max(...z);
  const e = z.map((v) => Math.exp(v - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
}

/** −log p_y. */
export function crossEntropy(p: readonly number[], y: number): number {
  return -Math.log(p[y]);
}

/** ∂L/∂z for softmax + cross-entropy: p − onehot(y). */
export function logitGrad(p: readonly number[], y: number): number[] {
  return p.map((v, k) => v - (k === y ? 1 : 0));
}

/** Parameters of a Linear(hidden → classes) head. */
export const headParams = (hidden: number, classes: number) => hidden * classes + classes;

/** bert-base-uncased BertModel (with pooler) has 109,482,240 parameters; swapping its 30,522-row vocab for the 21,128-row Chinese one gives the MacBERT-base body. */
export const BERT_BASE_UNCASED_PARAMS = 109_482_240;
export const CHINESE_BASE_PARAMS = BERT_BASE_UNCASED_PARAMS - (30_522 - 21_128) * 768;

// ---------------------------------------------------------------- schedule

/** Linear warmup from 0 to peak over warmupSteps, then linear decay to 0 at totalSteps (the transformers default). */
export function lrAt(step: number, totalSteps: number, warmupSteps: number, peak: number): number {
  if (step < warmupSteps) return (peak * step) / Math.max(1, warmupSteps);
  return peak * Math.max(0, (totalSteps - step) / Math.max(1, totalSteps - warmupSteps));
}

// ---------------------------------------------------------------- toy training run

export type Point = { x: number; y: number; label: Label };

/** Class centres of the 2-D stand-in for [CLS] before fine-tuning (overlapping) and where full fine-tuning pulls them. */
const START: [number, number][] = [[-0.9, -0.25], [0, 0.45], [0.9, -0.25]];
const END: [number, number][] = [[-1.5, -0.8], [0, 1.25], [1.5, -0.8]];
const SPREAD = 0.75;
/** Where every cluster drifts when the encoder is pushed too hard: one blob, class information gone. */
const COLLAPSE: [number, number] = [0, 0.1];

function sample(rng: Rng, perClass: number): Point[] {
  const pts: Point[] = [];
  for (let k = 0; k < 3; k++) for (let i = 0; i < perClass; i++) pts.push({ x: randomNormal(rng, START[k][0], SPREAD), y: randomNormal(rng, START[k][1], SPREAD), label: k as Label });
  return pts;
}

/**
 * Where a point sits after spending s units of the default learning-rate budget.
 * For s ∈ [0, 1] its class cluster moves toward END and tightens: the encoder is
 * learning features for the task. Beyond 1 (a learning rate larger than the
 * default) the cluster centres drift toward one shared blob, the pretrained
 * features being washed out. A stylised picture of the encoder being updated
 * too (示意), not a simulation of a transformer.
 */
export function movePoint(p: Point, s: number): Point {
  const [cx, cy] = START[p.label];
  const learn = Math.min(1, s);
  const damage = collapseOf(s);
  const tx = END[p.label][0] * (1 - damage) + COLLAPSE[0] * damage;
  const ty = END[p.label][1] * (1 - damage) + COLLAPSE[1] * damage;
  const shrink = 1 - 0.35 * learn;
  return { x: cx + (p.x - cx) * shrink + learn * (tx - cx), y: cy + (p.y - cy) * shrink + learn * (ty - cy), label: p.label };
}

/** How much of the class structure is lost: 0 up to the default budget, 1 at four times it. */
export const collapseOf = (s: number) => Math.min(1, Math.max(0, (s - 1) / 3));

export type Head = { W: number[][]; b: number[] };

export const logitsOf = (h: Head, p: { x: number; y: number }) => h.W.map((w, k) => w[0] * p.x + w[1] * p.y + h.b[k]);

function meanLoss(h: Head, pts: Point[]): number {
  return pts.reduce((s, p) => s + crossEntropy(softmax(logitsOf(h, p)), p.label), 0) / pts.length;
}

function accuracyOf(h: Head, pts: Point[]): number {
  return pts.filter((p) => {
    const z = logitsOf(h, p);
    return z.indexOf(Math.max(...z)) === p.label;
  }).length / pts.length;
}

export type TrainState = {
  step: number;
  epoch: number;
  lr: number;
  /** Learning-rate budget spent so far, in units of the default run's total. */
  budget: number;
  head: Head;
  train: Point[];
  val: Point[];
  trainLoss: number;
  valLoss: number;
  valAcc: number;
};

export type RunConfig = { peakLr: number; epochs: number; batchSize: number; warmupRatio: number; seed: number };

export const DEFAULT_RUN: RunConfig = { peakLr: 2e-5, epochs: 4, batchSize: 8, warmupRatio: 0.1, seed: 7 };

/** The head's step size per unit of real learning rate: maps 2e-5 to an SGD step that suits the 2-D toy. */
const HEAD_GAIN = 0.9 / 2e-5;

/**
 * Mini-batch SGD on the head over the moving points, with the warmup + decay schedule.
 * Returns one state per step, state 0 being the freshly initialised head (std 0.02, like transformers).
 */
export function simulateRun(cfg: RunConfig = DEFAULT_RUN): TrainState[] {
  const rng = createRng(cfg.seed);
  const train0 = sample(rng, 20);
  const val0 = sample(rng, 20);
  const head: Head = { W: [0, 1, 2].map(() => [randomNormal(rng, 0, 0.02), randomNormal(rng, 0, 0.02)]), b: [0, 0, 0] };
  const perEpoch = Math.ceil(train0.length / cfg.batchSize);
  const total = perEpoch * cfg.epochs;
  const warmup = Math.round(total * cfg.warmupRatio);
  const lrs = Array.from({ length: total }, (_, t) => lrAt(t + 1, total, warmup, cfg.peakLr));
  // Budget is measured against the default peak so a larger learning rate moves the encoder further.
  const budgetUnit = Array.from({ length: total }, (_, t) => lrAt(t + 1, total, warmup, DEFAULT_RUN.peakLr)).reduce((a, b) => a + b, 0);

  const snapshot = (step: number, epoch: number, lr: number, spent: number): TrainState => {
    const s = spent / budgetUnit;
    const train = train0.map((p) => movePoint(p, s));
    const val = val0.map((p) => movePoint(p, s));
    const h: Head = { W: head.W.map((r) => [...r]), b: [...head.b] };
    return { step, epoch, lr, budget: s, head: h, train, val, trainLoss: meanLoss(h, train), valLoss: meanLoss(h, val), valAcc: accuracyOf(h, val) };
  };

  const states: TrainState[] = [snapshot(0, 0, 0, 0)];
  let spent = 0;
  let step = 0;
  for (let e = 0; e < cfg.epochs; e++) {
    const order = train0.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    for (let start = 0; start < order.length; start += cfg.batchSize) {
      const lr = lrs[step];
      const s = spent / budgetUnit;
      const batch = order.slice(start, start + cfg.batchSize).map((i) => movePoint(train0[i], s));
      const gW = [[0, 0], [0, 0], [0, 0]];
      const gb = [0, 0, 0];
      for (const p of batch) {
        const g = logitGrad(softmax(logitsOf(head, p)), p.label);
        g.forEach((gk, k) => {
          gW[k][0] += (gk * p.x) / batch.length;
          gW[k][1] += (gk * p.y) / batch.length;
          gb[k] += gk / batch.length;
        });
      }
      const eta = lr * HEAD_GAIN;
      for (let k = 0; k < 3; k++) {
        head.W[k][0] -= eta * gW[k][0];
        head.W[k][1] -= eta * gW[k][1];
        head.b[k] -= eta * gb[k];
      }
      spent += lr;
      step++;
      states.push(snapshot(step, e + 1, lr, spent));
    }
  }
  return states;
}

// ---------------------------------------------------------------- evaluation

/** Rows are true labels, columns predictions (示意 counts on a 600-sentence dev set). */
export const DEMO_CONFUSION: number[][] = [
  [220, 20, 10],
  [30, 52, 18],
  [8, 17, 225],
];

export type ClassMetrics = { precision: number; recall: number; f1: number; support: number };

export function perClass(cm: number[][]): ClassMetrics[] {
  return cm.map((row, k) => {
    const tp = row[k];
    const support = row.reduce((a, b) => a + b, 0);
    const predicted = cm.reduce((s, r) => s + r[k], 0);
    const precision = predicted ? tp / predicted : 0;
    const recall = support ? tp / support : 0;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
    return { precision, recall, f1, support };
  });
}

export function summary(cm: number[][]) {
  const pc = perClass(cm);
  const total = pc.reduce((s, c) => s + c.support, 0);
  const correct = cm.reduce((s, row, k) => s + row[k], 0);
  return {
    accuracy: correct / total,
    macroF1: pc.reduce((s, c) => s + c.f1, 0) / pc.length,
    weightedF1: pc.reduce((s, c) => s + c.f1 * c.support, 0) / total,
    total,
  };
}
