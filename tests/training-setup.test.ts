import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bce,
  bestCheckpoint,
  EXAMPLE,
  exampleLosses,
  logitGrad,
  norm,
  paramCounts,
  stepsPerEpoch,
  TABLE_NORMS,
  touchedEmbedding,
  x0Dim,
} from "@/lib/ml/trainingSetup";

const close = (a: number, b: number, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test("x0 is 27 × 16 + 61 = 493", () => {
  assert.equal(x0Dim(), 493);
});

test("parameter counts match the PyTorch model (15,536 / 384,256 / 132,100)", () => {
  const p = paramCounts();
  assert.equal(p.embedding, 15_536);
  assert.equal(p.bottom, 384_256);
  assert.equal(p.towers, 132_100);
  assert.equal(p.total, 531_892);
  assert.equal(paramCounts(1).total, 432_817);
});

test("BCE of the example row: the like head pays most, follow almost nothing", () => {
  const { per, total } = exampleLosses();
  close(per[0], -Math.log(0.8811));
  close(per[3], -Math.log(1 - 0.019));
  assert.ok(per[2] > per[0] && per[2] > per[1] && per[2] > per[3]);
  close(total, per.reduce((s, v) => s + v, 0), 1e-12);
  close(bce(0.5, 1), Math.log(2));
});

test("the error signal is p − y", () => {
  close(logitGrad(EXAMPLE.predictions[2], 1), 0.4287 - 1, 1e-12);
});

test("one row touches 432 of 15,536 embedding numbers", () => {
  const t = touchedEmbedding();
  assert.equal(t.touched, 432);
  close(t.share, 432 / 15_536, 1e-12);
});

test("the trained tag row is over 10× longer than at initialisation, like the table medians", () => {
  const ratio = norm(EXAMPLE.tagRowTrained) / norm(EXAMPLE.tagRowInit);
  assert.ok(ratio > 10 && ratio < 20, `${ratio}`);
  assert.ok(TABLE_NORMS.trainedMedian / TABLE_NORMS.initMedian > 5);
});

test("1,226 steps per epoch; the best of 12 evaluations is at epoch 2.5", () => {
  assert.equal(stepsPerEpoch(), 1_226);
  assert.deepEqual(bestCheckpoint(), { epoch: 2.5, gauc: 0.7118, evals: 12 });
});
