/** Pure teaching calculations: one rollout, one PPO ratio, or one reward group. */
function finite(value: number, name: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${name} must be finite`);
}

function unit(value: number, name: string): void {
  finite(value, name);
  if (value < 0 || value > 1) throw new RangeError(`${name} must be in [0, 1]`);
}

function vector(values: number[], name: string): void {
  if (!Array.isArray(values) || !values.length) throw new RangeError(`${name} must be a nonempty array`);
  for (const value of values) finite(value, name);
}

/** No terminal mask within the rollout: split at episode boundaries. For a true
 * terminal state bootstrapValue is zero; a truncated rollout can bootstrap. */
export function computeGae(rewards: number[], values: number[], gamma = 1, lambda = 1, bootstrapValue = 0): { deltas: number[]; advantages: number[]; returns: number[] } {
  vector(rewards, "rewards");
  vector(values, "values");
  if (values.length !== rewards.length) throw new RangeError("rewards and values must have equal length");
  unit(gamma, "gamma");
  unit(lambda, "lambda");
  finite(bootstrapValue, "bootstrapValue");
  const deltas = rewards.map((reward, i) => reward + gamma * (values[i + 1] ?? bootstrapValue) - values[i]);
  const advantages = new Array<number>(rewards.length);
  let nextAdvantage = 0;
  for (let i = rewards.length - 1; i >= 0; i--) {
    advantages[i] = deltas[i] + gamma * lambda * nextAdvantage;
    nextAdvantage = advantages[i];
  }
  return { deltas, advantages, returns: advantages.map((advantage, i) => advantage + values[i]) };
}

/** The maximized clipped surrogate, before any sign flip to a minimized loss. */
export function clipObjective(ratio: number, advantage: number, epsilon: number): { unclipped: number; clipped: number; objective: number } {
  finite(ratio, "ratio");
  finite(advantage, "advantage");
  unit(epsilon, "epsilon");
  if (ratio < 0) throw new RangeError("ratio must be nonnegative");
  const unclipped = ratio * advantage;
  const clipped = Math.min(1 + epsilon, Math.max(1 - epsilon, ratio)) * advantage;
  return { unclipped, clipped, objective: Math.min(unclipped, clipped) };
}

/** Population standard deviation (divide by group size), without an epsilon
 * that would distort small but nonzero signals. Constant groups have zero A. */
export function groupAdvantages(rewards: number[]): { mean: number; std: number; advantages: number[] } {
  vector(rewards, "rewards");
  if (rewards.every(reward => reward === rewards[0])) {
    return { mean: rewards[0], std: 0, advantages: rewards.map(() => 0) };
  }
  const mean = rewards.reduce((sum, reward) => sum + reward / rewards.length, 0);
  const std = rewards.reduce((norm, reward) => Math.hypot(norm, (reward - mean) / Math.sqrt(rewards.length)), 0);
  return { mean, std, advantages: rewards.map(reward => std === 0 ? 0 : (reward - mean) / std) };
}
