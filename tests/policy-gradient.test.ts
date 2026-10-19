import { test } from "node:test";
import assert from "node:assert/strict";
import { clipStatus, PG_PRESETS, PG_START_LOGITS, policyGradientStep, sampleWeights, softmax } from "@/lib/ml/policyGradient";

const close = (a: number, b: number, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const closeVec = (a: number[], b: number[], eps = 1e-3) => a.forEach((v, i) => close(v, b[i], eps));

test("softmax of equal logits is uniform and sums to 1", () => {
  closeVec(softmax([0, 0, 0]), [1 / 3, 1 / 3, 1 / 3]);
  close(softmax([2, -1, 0.5]).reduce((a, b) => a + b, 0), 1, 1e-9);
});

test("weights: raw reward, minus mean, then divided by std", () => {
  const r = [95, 90, 93, 90];
  assert.deepEqual(sampleWeights(r, "reinforce"), r);
  closeVec(sampleWeights(r, "baseline"), [3, -2, 1, -2]);
  const std = Math.sqrt(4.5);
  closeVec(sampleWeights(r, "grpo"), [3 / std, -2 / std, 1 / std, -2 / std]);
  assert.deepEqual(sampleWeights([1, 1, 1], "grpo"), [0, 0, 0]);
});

test("worked example on the page: 0/1 rewards, GRPO, lr = 1", () => {
  const s = policyGradientStep(PG_START_LOGITS, PG_PRESETS.binary.samples, "grpo", 1);
  closeVec(s.weights, [1, -1, 1, -1]);
  closeVec(s.pushes[0], [2 / 3, -1 / 3, -1 / 3]);
  closeVec(s.pushes[1], [1 / 3, -2 / 3, 1 / 3]);
  closeVec(s.grad, [0.5, -0.25, -0.25]);
  closeVec(s.logitsAfter, [0.5, -0.25, -0.25]);
  close(s.probsAfter[0], 0.514);
  close(s.probsAfter[1], 0.243);
});

test("each push sums to zero: probability moves between answers, never created", () => {
  for (const mode of ["reinforce", "baseline", "grpo"] as const) {
    const s = policyGradientStep(PG_START_LOGITS, PG_PRESETS.score.samples, mode, 1);
    for (const p of s.pushes) close(p.reduce((a, b) => a + b, 0), 0, 1e-9);
  }
});

test("without a baseline, score rewards push every sampled answer up and the step explodes", () => {
  const raw = policyGradientStep(PG_START_LOGITS, PG_PRESETS.score.samples, "reinforce", 1);
  assert.ok(raw.weights.every((w) => w > 0));
  closeVec(raw.grad, [16.333, -8.167, -8.167]);
  assert.ok(raw.stepNorm > 20);
  const base = policyGradientStep(PG_START_LOGITS, PG_PRESETS.score.samples, "baseline", 1);
  closeVec(base.grad, [1, -0.5, -0.5]);
  const grpo = policyGradientStep(PG_START_LOGITS, PG_PRESETS.score.samples, "grpo", 1);
  assert.ok(grpo.stepNorm < 1);
});

test("GRPO's step does not depend on the reward scale", () => {
  const scaled = PG_PRESETS.binary.samples.map((s) => ({ ...s, reward: s.reward * 100 + 7 }));
  closeVec(
    policyGradientStep(PG_START_LOGITS, scaled, "grpo", 1).grad,
    policyGradientStep(PG_START_LOGITS, PG_PRESETS.binary.samples, "grpo", 1).grad,
  );
});

test("clip: a ratio past 1 ± ε in the advantage's direction stops the gradient", () => {
  assert.equal(clipStatus(1.54, 1), "clipped");
  assert.equal(clipStatus(1.1, 1), "active");
  assert.equal(clipStatus(0.73, -1), "clipped");
  assert.equal(clipStatus(1.54, -1), "active");
});
