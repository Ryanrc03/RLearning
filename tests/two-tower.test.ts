import { test } from "node:test";
import assert from "node:assert/strict";
import { batchMatrix, correctedLogits, ITEM_VECTORS, listwise, pairwise, pointwise, samplingDistribution, TIMELINE_LENGTH, trainingTimeline, USER_VECTORS, cosineScore } from "@/lib/ml/twoTower";

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9);

test("training examples match their formulas and large logits remain stable", () => {
  const scores = ITEM_VECTORS.slice(0, 4).map((b) => cosineScore(USER_VECTORS[0], b));
  scores.forEach((s, i) => close(s, [0.6, 0.5, 0.2, -0.3][i]));
  close(pointwise(scores[0], 5, 1).loss, Math.log1p(Math.exp(-3)));
  close(pairwise(0.6, 0.5, 0.2, 5).hinge, 0.1);
  close(listwise(scores.map((s) => s / 0.2)).loss, Math.log(1 + Math.exp(-0.5) + Math.exp(-2) + Math.exp(-4.5)));
  assert.ok(Number.isFinite(listwise([-1000, 1000]).loss));
});

test("sampling probabilities normalize and LogQ offsets by inverse sampling probability", () => {
  assert.deepEqual(samplingDistribution(0), [1 / 3, 1 / 3, 1 / 3]);
  for (const alpha of [0.25, 0.75, 1]) close(samplingDistribution(alpha).reduce((a, b) => a + b, 0), 1);
  const q = [0.8, 0.15, 0.05];
  const logits = [1, 0.8, 0.6];
  const corrected = listwise(correctedLogits(logits, q));
  const weights = logits.map((logit, i) => Math.exp(logit) / q[i]);
  close(corrected.probabilities[0], weights[0] / weights.reduce((a, b) => a + b, 0));
});

test("batch matrix preserves diagonal targets while masking duplicates and known positives", () => {
  for (const n of [3, 4, 5, 6]) {
    const matrix = batchMatrix(n, false);
    assert.equal(matrix.flat().filter(({ kind }) => kind === "negative").length, n * (n - 1));
  }
  const matrix = batchMatrix(4, true);
  assert.ok(matrix.every((row, i) => row[i].kind === "positive"));
  assert.equal(matrix[0][1].kind, "masked");
  assert.equal(matrix[0][2].kind, "masked");
  assert.equal(matrix[1][0].kind, "masked");
});

test("timeline replays the same multiset and updates parameters with actual SGD", () => {
  const chronological = trainingTimeline(false, 0.1);
  const shuffled = trainingTimeline(true, 0.1);
  assert.equal(chronological.length, TIMELINE_LENGTH + 1);
  close(chronological[1].w, 0.2);
  for (const trace of [chronological, shuffled]) {
    for (let i = 1; i < trace.length; i++) {
      close(trace[i].w, trace[i - 1].w - 0.2 * (trace[i - 1].w - trace[i].sample!.target));
    }
  }
  const samples = (trace: typeof chronological) => trace.slice(1).map(({ sample }) => JSON.stringify(sample)).sort();
  assert.deepEqual(samples(chronological), samples(shuffled));
  assert.notEqual(chronological.at(-1)?.w, shuffled.at(-1)?.w);
});
