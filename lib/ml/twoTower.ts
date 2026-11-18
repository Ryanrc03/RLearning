import { logSumExp, softmax } from "@/lib/ml/clip";
import { sigmoid } from "@/lib/ml/linear";
import { createRng } from "@/lib/ml/random";

export const VIDEO_NAMES = ["Python Tutorial", "ML Interview", "Basketball Highlights", "Travel Guide", "Git Basics", "City Walk"];
export const USER_TOPICS = ["ML / Programming", "Sports", "Travel"];
export const ITEM_VECTORS = [0.6, 0.5, 0.2, -0.3, 0.7, -0.4].map((x) => [x, Math.sqrt(1 - x * x)]);
export const USER_VECTORS = [[1, 0], [0, 1], [-1, 0], [0.6, 0.8], [0.8, 0.6], [-0.6, 0.8]];
export const BATCH_ITEMS = [0, 1, 2, 3, 4, 5];
export const CLICK_COUNTS = [1000, 100, 10];

export function cosineScore(a: number[], b: number[]) {
  const norm = Math.hypot(...a) * Math.hypot(...b);
  return norm ? a.reduce((sum, x, i) => sum + x * b[i], 0) / norm : 0;
}

function softplus(z: number) {
  return Math.max(0, z) + Math.log1p(Math.exp(-Math.abs(z)));
}

export function pointwise(score: number, scale: number, label: number) {
  const logit = score * scale;
  return { logit, probability: sigmoid(logit), loss: softplus(label === 1 ? -logit : logit) };
}

export function pairwise(positive: number, negative: number, margin: number, scale: number) {
  const gap = positive - negative;
  return { gap, hinge: Math.max(0, margin - gap), logistic: softplus(-scale * gap) };
}

export function listwise(logits: number[]) {
  return { probabilities: softmax(logits), loss: logSumExp(logits) - logits[0] };
}

export function samplingDistribution(alpha: number) {
  const weights = CLICK_COUNTS.map((count) => count ** alpha);
  const sum = weights.reduce((total, weight) => total + weight, 0);
  return weights.map((weight) => weight / sum);
}

export function correctedLogits(logits: number[], probabilities: number[]) {
  return logits.map((s, i) => s - Math.log(probabilities[i]));
}

export function batchMatrix(size: number, noise: boolean) {
  const items = BATCH_ITEMS.slice(0, size);
  if (noise) items[1] = items[0];
  return items.map((positive, u) => items.map((item, i) => ({
    item, score: cosineScore(USER_VECTORS[u], ITEM_VECTORS[item]),
    kind: u === i ? "positive" : item === positive || (noise && u === 0 && item === 2) ? "masked" : "negative",
  } as const)));
}

export const WINDOWS = [
  { label: "上午", weights: [0.7, 0.2, 0.1] },
  { label: "下午", weights: [0.2, 0.6, 0.2] },
  { label: "晚上", weights: [0.15, 0.25, 0.6] },
];
export const TOPICS = ["科技", "娱乐", "体育"];
const TARGETS = [1, 0, -1];
const STREAM = WINDOWS.flatMap(({ label, weights }) => weights.flatMap((weight, topic) =>
  Array.from({ length: Math.round(20 * weight) }, () => ({ label, topic, target: TARGETS[topic] })),
));
export const TIMELINE_LENGTH = STREAM.length;

export function trainingTimeline(shuffled: boolean, rate: number) {
  const samples = [...STREAM];
  if (shuffled) {
    const rng = createRng(37);
    for (let i = samples.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [samples[i], samples[j]] = [samples[j], samples[i]];
    }
  }
  const evaluate = (w: number, weights: number[]) =>
    weights.reduce((sum, weight, i) => sum + weight * (w - TARGETS[i]) ** 2, 0);
  const all = TARGETS.map((_, i) => WINDOWS.reduce((sum, window) => sum + window.weights[i], 0) / WINDOWS.length);
  const state = (w: number, sample: typeof samples[number] | null) =>
    ({ w, sample, full: evaluate(w, all), recent: evaluate(w, WINDOWS[2].weights) });
  const trajectory = [state(0, null)];
  for (const sample of samples) {
    const w = trajectory[trajectory.length - 1].w;
    trajectory.push(state(w - rate * 2 * (w - sample.target), sample));
  }
  return trajectory;
}
