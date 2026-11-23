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

/** log π(y|x) = Σ_t log π(y_t | x, y_<t): per-token conditional probabilities of the response tokens. */
export function sequenceLogProb(tokenProbs: readonly number[]): number {
  if (!tokenProbs.length || tokenProbs.some(p => !Number.isFinite(p) || p <= 0 || p > 1)) throw new Error("Token probabilities must be in (0, 1]");
  return tokenProbs.reduce((sum, p) => sum + Math.log(p), 0);
}

/** The worked example: policy chosen/rejected, reference chosen/rejected. Hand-set teaching values. */
export const PPT_EXAMPLE: readonly [number, number, number, number] = [-5, -7, -6, -7];
export const PPT_BETA = 0.1;

/** Hypothetical policy states that all lower the loss of PPT_EXAMPLE; not an optimizer trajectory. */
export const PPT_CASES: readonly { key: string; label: string; policy: readonly [number, number]; note: string }[] = [
  { key: "init", label: "初始", policy: [-5, -7], note: "起点" },
  { key: "a", label: "情况 A", policy: [-4, -7], note: "只抬高 chosen" },
  { key: "b", label: "情况 B", policy: [-5, -8], note: "只压低 rejected" },
  { key: "c", label: "情况 C", policy: [-5.5, -9], note: "两者都降，rejected 降得更多" },
];

/**
 * Chain rule for one pair. With z = β[(a − b) − (c − d)] and L = −log σ(z):
 * ∂L/∂z = −σ(−z), ∂L/∂a = −βσ(−z), ∂L/∂b = +βσ(−z). The reference terms get no gradient.
 */
export function dpoGradients(logps: readonly [number, number, number, number], beta: number) {
  const { margin } = dpoPair(logps, beta);
  const dz = -sigmoid(-margin);
  return { dz, dChosen: beta * dz, dRejected: -beta * dz };
}

/**
 * One-parameter toy policy for the gradient demo: a(θ) = −5 + θ, b(θ) = −7 − θ, frozen reference (−6, −7).
 * A local illustration only; it is not a normalised language-model distribution.
 */
export function toyDpo(theta: number, beta: number = PPT_BETA) {
  const chosen = PPT_EXAMPLE[0] + theta, rejected = PPT_EXAMPLE[1] - theta;
  const pair = dpoPair([chosen, rejected, PPT_EXAMPLE[2], PPT_EXAMPLE[3]], beta);
  // ∂a/∂θ = 1, ∂b/∂θ = −1, so ∂L/∂θ = ∂L/∂a − ∂L/∂b = −2βσ(−z).
  const grad = -2 * beta * sigmoid(-pair.margin);
  return { theta, chosen, rejected, policyMargin: chosen - rejected, ...pair, grad };
}

/** Plain SGD on the toy model: θ ← θ − lr · ∂L/∂θ. Returns the states at steps 0 … steps. */
export function toySgd(steps: number, lr: number, beta: number = PPT_BETA, theta0 = 0) {
  const states = [toyDpo(theta0, beta)];
  for (let i = 0; i < steps; i++) { const s = states[states.length - 1]; states.push(toyDpo(s.theta - lr * s.grad, beta)); }
  return states;
}
