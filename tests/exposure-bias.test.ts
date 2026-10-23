import { test } from "node:test";
import assert from "node:assert/strict";
import { groupAuc, policyProbs, simulateBias } from "@/lib/ml/exposureBias";

test("policy probabilities are a softmax and λ = 0 is uniform", () => {
  policyProbs([0, 1, 2], 0).forEach((v) => assert.ok(Math.abs(v - 1 / 3) < 1e-12));
  const q = policyProbs([0, 1, 2], 1);
  assert.ok(Math.abs(q.reduce((a, b) => a + b, 0) - 1) < 1e-12);
  assert.ok(q[2] > q[1] && q[1] > q[0]);
});

test("group AUC skips single-class users", () => {
  const g = groupAuc([
    { user: 0, score: 0.9, label: true },
    { user: 0, score: 0.1, label: false },
    { user: 1, score: 0.5, label: true },
  ]);
  assert.equal(g, 1);
});

test("with no selection the two test sets look alike", () => {
  const r = simulateBias(0);
  assert.ok(Math.abs(r.ctrStandard - r.ctrRandom) < 0.03);
  assert.ok(Math.abs(r.gaucStandard - r.gaucRandom) < 0.03);
  assert.ok(Math.abs(r.calibRandom - 1) < 0.1);
});

test("a selective recommender raises the logged click rate and the gap between biased and random GAUC", () => {
  const r = simulateBias(1.5);
  assert.ok(r.ctrStandard > 2 * r.ctrRandom);
  assert.ok(r.gaucStandard - r.gaucRandom > 0.1);
  assert.ok(r.coverageStandard > r.coverageRandom + 0.3);
  assert.ok(r.calibRandom > 2);
});

test("the random set does not depend on λ", () => {
  assert.equal(simulateBias(0.5).ctrRandom, simulateBias(2).ctrRandom);
});
