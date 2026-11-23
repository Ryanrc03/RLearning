import { sigmoid } from "./rlhf";

export function normalizeWeights(weights: readonly number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!weights.length || weights.some(w => !Number.isFinite(w) || w < 0) || !Number.isFinite(sum) || sum <= 0) throw new Error("Weights must be finite, nonnegative and have positive total");
  return weights.map(w => w / sum);
}

/** softplus(x), avoiding exp overflow and cancellation. */
function softplus(x: number): number {
  return Math.max(0, x) + Math.log1p(Math.exp(-Math.abs(x)));
}

/** Fixed 20-comparison teaching dataset. NLL is a sum, not a per-match mean. */
export function btExample(abilities: readonly [number, number, number]) {
  if (abilities.some(a => !Number.isFinite(a) || a <= 0)) throw new Error("Abilities must be positive");
  const [a, b, c] = abilities.map(Math.log);
  const ab = sigmoid(a-b), ac = sigmoid(a-c);
  const nll = 8*softplus(b-a) + 4*softplus(a-b) + 3*softplus(c-a) + 5*softplus(a-c);
  return { ab, ac, nll, logLikelihood: -nll, likelihood: Math.exp(-nll), difference: a-b };
}

/** Inputs: policy chosen/rejected, then frozen reference chosen/rejected. */
export function dpoPair(logps: readonly [number, number, number, number], beta: number) {
  if (logps.some(p => !Number.isFinite(p)) || !Number.isFinite(beta) || beta <= 0) throw new Error("Finite log probabilities and positive beta required");
  const [pw, pl, rw, rl] = logps;
  const chosenRatio = pw-rw, rejectedRatio = pl-rl;
  const relativeMargin = chosenRatio-rejectedRatio;
  const margin = beta*relativeMargin;
  return { chosenRatio, rejectedRatio, relativeMargin, margin, probability: sigmoid(margin), loss: softplus(-margin) };
}

/** Exact finite-response KL-regularized optimum; NOT an optimizer trajectory. */
export function optimalDistribution(reference: readonly number[], rewards: readonly number[], beta: number): number[] {
  if (reference.length !== rewards.length || rewards.some(r => !Number.isFinite(r)) || !Number.isFinite(beta) || beta <= 0) throw new Error("Matching arrays and positive beta required");
  const ref = normalizeWeights(reference);
  const logits = ref.map((p,i) => p === 0 ? -Infinity : Math.log(p) + rewards[i]/beta);
  const max = Math.max(...logits);
  return normalizeWeights(logits.map(l => Math.exp(l-max)));
}
