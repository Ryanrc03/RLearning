import assert from "node:assert/strict";
import { test } from "node:test";
import { clipObjective, computeGae, groupAdvantages } from "../lib/ml/ppo";

const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} ≉ ${expected}`);
const closeArray = (actual: number[], expected: number[]) => {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, i) => close(value, expected[i]));
};

test("GAE at λ=1 recovers terminal Monte Carlo returns", () => {
  const rewards = [0, 0, 1], values = [0.4, 0.6, 0.8];
  const result = computeGae(rewards, values);
  closeArray(result.deltas, [0.2, 0.2, 0.2]);
  closeArray(result.advantages, [0.6, 0.4, 0.2]);
  closeArray(result.returns, [1, 1, 1]);
  assert.deepEqual(rewards, [0, 0, 1]);
  assert.deepEqual(values, [0.4, 0.6, 0.8]);
});

test("λ=0 gives one-step TD targets; intermediate λ mixes future residuals", () => {
  const zero = computeGae([0, 0, 1], [0.4, 0.6, 0.8], 1, 0);
  closeArray(zero.advantages, [0.2, 0.2, 0.2]);
  closeArray(zero.returns, [0.6, 0.8, 1]);
  closeArray(computeGae([0, 0, 1], [0.4, 0.6, 0.8], 1, 0.5).advantages, [0.35, 0.3, 0.2]);
});

test("discounted truncated rollout bootstraps from its last next-state value", () => {
  const result = computeGae([1, 2], [0.5, 1], 0.9, 1, 3);
  closeArray(result.deltas, [1.4, 3.7]);
  closeArray(result.returns, [5.23, 4.7]);
  closeArray(computeGae([1, 2], [0.5, 1], 0, 0.7, 3).returns, [1, 2]);
});

test("PPO clips only the improving direction for each advantage sign", () => {
  assert.equal(clipObjective(1.5, 1, 0.2).objective, 1.2);
  assert.equal(clipObjective(0.6, -1, 0.2).objective, -0.8);
  close(clipObjective(1.5, 2, 0.2).objective, 2.4);
  close(clipObjective(0.5, 2, 0.2).objective, 1);
  close(clipObjective(0.5, -2, 0.2).objective, -1.6);
  close(clipObjective(1.5, -2, 0.2).objective, -3);
  assert.deepEqual(clipObjective(1, 0, 0.2), { unclipped: 0, clipped: 0, objective: 0 });
  close(clipObjective(0, -1, 0).objective, -1);
});

test("group-relative advantages use population std and preserve tiny nonzero signals", () => {
  assert.deepEqual(groupAdvantages([1, 1, 0, 0]), { mean: 0.5, std: 0.5, advantages: [1, 1, -1, -1] });
  const result = groupAdvantages([0, 0, 0, 1]);
  close(result.mean, 0.25);
  close(result.std, Math.sqrt(3) / 4);
  closeArray(result.advantages, [-1 / Math.sqrt(3), -1 / Math.sqrt(3), -1 / Math.sqrt(3), Math.sqrt(3)]);
  closeArray(groupAdvantages([3, 3, 3]).advantages, [0, 0, 0]);
  assert.deepEqual(groupAdvantages(Array(7).fill(0.1)), { mean: 0.1, std: 0, advantages: Array(7).fill(0) });
  closeArray(groupAdvantages([0, 1e-10]).advantages, [-1, 1]);
});

test("invalid arrays, nonfinite inputs and invalid parameter ranges are rejected", () => {
  assert.throws(() => computeGae([], []));
  assert.throws(() => computeGae([1], [0, 1]));
  assert.throws(() => computeGae([NaN], [0]));
  assert.throws(() => computeGae([1], [Infinity]));
  assert.throws(() => computeGae([1], [0], -0.1));
  assert.throws(() => computeGae([1], [0], 1.01));
  assert.throws(() => computeGae([1], [0], 1, -0.1));
  assert.throws(() => computeGae([1], [0], 1, 1.01));
  assert.throws(() => computeGae([1], [0], 1, 1, Infinity));
  for (const args of [[-1, 1, 0.2], [1, NaN, 0.2], [1, 1, -0.1], [1, 1, 1.1], [Infinity, 1, 0.2]]) {
    assert.throws(() => clipObjective(args[0], args[1], args[2]));
  }
  assert.throws(() => groupAdvantages([]));
  assert.throws(() => groupAdvantages([Infinity]));
  assert.throws(() => computeGae([1, , 2] as number[], [0, 0, 0]));
});
