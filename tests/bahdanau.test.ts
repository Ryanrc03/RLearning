import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_STATES,
  DEMO_STEPS,
  EXAMPLE_SCORES,
  additiveScore,
  additiveScoreConcat,
  attend,
  attentionWeights,
  contextVector,
  demoAttention,
  scorePairs,
  scoresFromWeights,
  type AdditiveParams,
} from "@/lib/ml/bahdanau";

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

const params: AdditiveParams = {
  wa: [[0.5, -0.2], [0.1, 0.4], [-0.3, 0.6]],
  ua: [[0.7, 0.2], [-0.4, 0.9], [0.3, -0.5]],
  va: [1.2, -0.8, 0.5],
  ba: [0.1, 0, -0.2],
};

test("softmax of [0, 0, 2, 0] is about [0.096, 0.096, 0.711, 0.096]", () => {
  const w = attentionWeights(EXAMPLE_SCORES);
  assert.deepEqual(w.map((x) => x.toFixed(3)), ["0.096", "0.096", "0.711", "0.096"]);
  close(w.reduce((a, b) => a + b, 0), 1);
});

test("weights stay non-negative and normalized when scores are negative", () => {
  const w = attentionWeights([-3, -1, -2]);
  assert.ok(w.every((x) => x > 0));
  close(w.reduce((a, b) => a + b, 0), 1);
});

test("the context vector is a weighted sum of all states, not the top one", () => {
  const c = contextVector([0.25, 0.75], [[4, 0], [0, 8]]);
  assert.deepEqual(c, [1, 6]);
});

test("the additive score equals one linear layer on the concatenation [s; h]", () => {
  const s = [0.3, -0.7];
  for (const h of DEMO_STATES) close(additiveScore(params, s, h), additiveScoreConcat(params, s, h), 1e-12);
});

test("one parameter set gives different weights for different decoder states", () => {
  const a = attend(params, [1, 0], DEMO_STATES);
  const b = attend(params, [-1, 2], DEMO_STATES);
  close(a.weights.reduce((x, y) => x + y, 0), 1);
  close(b.weights.reduce((x, y) => x + y, 0), 1);
  assert.ok(a.weights.some((w, i) => Math.abs(w - b.weights[i]) > 0.01));
  assert.equal(a.context.length, 2);
});

test("the two demo steps sum to 1 and peak on love, then machine", () => {
  for (const step of Object.values(DEMO_STEPS)) close(step.weights.reduce((a, b) => a + b, 0), 1);
  assert.equal(DEMO_STEPS.a.weights.indexOf(Math.max(...DEMO_STEPS.a.weights)), 1);
  assert.equal(DEMO_STEPS.b.weights.indexOf(Math.max(...DEMO_STEPS.b.weights)), 2);
});

test("the demo scores reproduce the demo weights through softmax", () => {
  for (const step of Object.values(DEMO_STEPS)) {
    const back = attentionWeights(scoresFromWeights(step.weights));
    back.forEach((w, i) => close(w, step.weights[i], 1e-12));
    const { context } = demoAttention(step.key);
    assert.ok(context.every(Number.isFinite));
  }
});

test("m source states and t decoder steps need m × t scores", () => {
  assert.equal(scorePairs(4, 4), 16);
  assert.equal(scorePairs(50, 40), 2000);
});
