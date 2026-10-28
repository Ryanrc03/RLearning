// Arithmetic for Chapter 01. Sampling keeps every positive and each negative
// independently with the same alpha. Counts shown by the UI are expectations.
export type FusionMode = "sum" | "product";

function probability(p: number) {
  if (!Number.isFinite(p) || p < 0 || p > 1) throw new RangeError("probability must be in [0, 1]");
}
function rate(alpha: number) {
  if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 1) throw new RangeError("alpha must be in (0, 1]");
}
function vectors(values: number[], weights: number[]) {
  if (!values.length || values.length !== weights.length) throw new RangeError("nonempty vectors must have equal lengths");
  values.forEach(probability);
  if (weights.some((w) => !Number.isFinite(w) || w < 0)) throw new RangeError("weights must be finite and nonnegative");
}

export function sampledProbability(p: number, alpha: number): number {
  probability(p); rate(alpha);
  return p / (p + alpha * (1 - p));
}
export function calibrateProbability(p: number, alpha: number): number {
  probability(p); rate(alpha);
  return alpha * p / (1 - p + alpha * p);
}
export function samplingExample(positive: number, negative: number, alpha: number) {
  rate(alpha);
  if (![positive, negative].every((n) => Number.isFinite(n) && n >= 0) || positive + negative === 0) throw new RangeError("counts must be nonnegative with positive total");
  const negativeKept = alpha * negative;
  const sampleSize = positive + negativeKept;
  const original = positive / (positive + negative);
  const sampled = positive / sampleSize;
  return { positive, negative, negativeKept, sampleSize, original, sampled, corrected: calibrateProbability(sampled, alpha) };
}
export function binaryCrossEntropy(y: number, p: number): number {
  if (y !== 0 && y !== 1) throw new RangeError("binary label required");
  probability(p);
  return y === 1 ? -Math.log(p) : -Math.log1p(-p);
}
export function weightedLoss(labels: number[], probabilities: number[], weights: number[]): number {
  vectors(probabilities, weights);
  if (labels.length !== probabilities.length) throw new RangeError("labels must match probabilities");
  return probabilities.reduce((sum, p, i) => {
    const loss = binaryCrossEntropy(labels[i], p);
    return sum + (weights[i] === 0 ? 0 : weights[i] * loss);
  }, 0);
}
export function fusionScore(probabilities: number[], weights: number[], mode: FusionMode, epsilon = 1e-6): number {
  vectors(probabilities, weights);
  if (mode === "sum") return probabilities.reduce((sum, p, i) => sum + weights[i] * p, 0);
  if (!Number.isFinite(epsilon) || epsilon <= 0) throw new RangeError("epsilon must be positive");
  return Math.exp(probabilities.reduce((sum, p, i) => sum + weights[i] * Math.log(p + epsilon), 0));
}
