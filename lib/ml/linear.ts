// Logistic regression and softmax / cross-entropy arithmetic for the
// Classifiers chapter. Pure functions; see tests/linear.test.ts.

import { logSumExp, softmax } from "@/lib/ml/clip";
import { clamp, createRng, randomNormal } from "@/lib/ml/random";

const EPS = 1e-12;

export function sigmoid(z: number): number {
  return z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));
}

// Binary cross-entropy for one prediction p of label y ∈ {0, 1}.
export function bce(p: number, y: 0 | 1): number {
  const q = clamp(p, EPS, 1 - EPS);
  return y === 1 ? -Math.log(q) : -Math.log(1 - q);
}

export type Point = { x: number; y: number; label: 0 | 1 };
export type Params = { w1: number; w2: number; b: number };

export function logit(params: Params, pt: { x: number; y: number }): number {
  return params.w1 * pt.x + params.w2 * pt.y + params.b;
}

export function predictProb(params: Params, pt: { x: number; y: number }): number {
  return sigmoid(logit(params, pt));
}

export function meanBce(params: Params, data: readonly Point[]): number {
  return data.reduce((s, pt) => s + bce(predictProb(params, pt), pt.label), 0) / data.length;
}

export function accuracyOf(params: Params, data: readonly Point[]): number {
  return data.filter((pt) => (predictProb(params, pt) >= 0.5 ? 1 : 0) === pt.label).length / data.length;
}

// Gradient of the mean BCE: (1/n) Σ (p − y) · [x, y, 1].
export function logisticGrad(params: Params, data: readonly Point[]): Params {
  let g1 = 0;
  let g2 = 0;
  let gb = 0;
  for (const pt of data) {
    const err = predictProb(params, pt) - pt.label;
    g1 += err * pt.x;
    g2 += err * pt.y;
    gb += err;
  }
  const n = data.length;
  return { w1: g1 / n, w2: g2 / n, b: gb / n };
}

export type TrainStep = { step: number; params: Params; loss: number; accuracy: number };

// Batch gradient descent from a fixed start. history[0] is the initial state,
// history[k] the state after k updates; length steps + 1.
export function trainLogistic(data: readonly Point[], lr: number, steps: number, init: Params = { w1: 0, w2: 1, b: 0 }): TrainStep[] {
  let params = { ...init };
  const history: TrainStep[] = [{ step: 0, params, loss: meanBce(params, data), accuracy: accuracyOf(params, data) }];
  for (let k = 1; k <= steps; k++) {
    const g = logisticGrad(params, data);
    params = { w1: params.w1 - lr * g.w1, w2: params.w2 - lr * g.w2, b: params.b - lr * g.b };
    history.push({ step: k, params, loss: meanBce(params, data), accuracy: accuracyOf(params, data) });
  }
  return history;
}

// Two Gaussian blobs of n points each; label 0 upper-left, label 1 lower-right, slightly overlapping.
export function makeBlobs(seed: number, n = 16): Point[] {
  const rng = createRng(seed);
  const pts: Point[] = [];
  const centres: { x: number; y: number; label: 0 | 1 }[] = [
    { x: -1.3, y: 1.0, label: 0 },
    { x: 1.3, y: -1.0, label: 1 },
  ];
  for (const c of centres) {
    for (let i = 0; i < n; i++) {
      pts.push({ x: clamp(randomNormal(rng, c.x, 1.0), -3.8, 3.8), y: clamp(randomNormal(rng, c.y, 1.0), -3.8, 3.8), label: c.label });
    }
  }
  return pts;
}

// Where the line w1 x + w2 y + b = 0 crosses the box; null if there is no line (w = 0)
// or it misses the box entirely.
export function boundarySegment(params: Params, xDomain: [number, number], yDomain: [number, number]): [[number, number], [number, number]] | null {
  const { w1, w2, b } = params;
  if (Math.abs(w1) < EPS && Math.abs(w2) < EPS) return null;
  const hits: [number, number][] = [];
  const inside = (x: number, y: number) => x >= xDomain[0] - 1e-9 && x <= xDomain[1] + 1e-9 && y >= yDomain[0] - 1e-9 && y <= yDomain[1] + 1e-9;
  if (Math.abs(w2) > EPS) {
    for (const x of xDomain) {
      const y = -(w1 * x + b) / w2;
      if (inside(x, y)) hits.push([x, y]);
    }
  }
  if (Math.abs(w1) > EPS) {
    for (const y of yDomain) {
      const x = -(w2 * y + b) / w1;
      if (inside(x, y)) hits.push([x, y]);
    }
  }
  const unique = hits.filter((h, i) => hits.findIndex((o) => Math.abs(o[0] - h[0]) < 1e-9 && Math.abs(o[1] - h[1]) < 1e-9) === i);
  if (unique.length < 2) return null;
  return [unique[0], unique[1]];
}

// The point whose probability of its own class moves the most between two parameter
// sets: the one worth watching on the sigmoid curve while training runs.
export function pickShowcasePoint(data: readonly Point[], before: Params, after: Params): number {
  let best = 0;
  let bestGain = -Infinity;
  data.forEach((pt, i) => {
    const own = (p: number) => (pt.label === 1 ? p : 1 - p);
    const gain = own(predictProb(after, pt)) - own(predictProb(before, pt));
    if (gain > bestGain) {
      bestGain = gain;
      best = i;
    }
  });
  return best;
}

// Multi-class cross-entropy with a one-hot target: −log p_true.
export function crossEntropy(probs: readonly number[], trueIdx: number): number {
  if (trueIdx < 0 || trueIdx >= probs.length) throw new Error("trueIdx out of range");
  return -Math.log(clamp(probs[trueIdx], EPS, 1));
}

// The logit the target class needs so that softmax gives it probability p,
// given the other classes' logits stay fixed: z = logSumExp(others) + log(p / (1 − p)).
export function logitsForTarget(p: number, others: readonly number[]): number {
  if (!(p > 0 && p < 1)) throw new Error("p must be in (0, 1)");
  return logSumExp([...others]) + Math.log(p / (1 - p));
}

export { softmax };
