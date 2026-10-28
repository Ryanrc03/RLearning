import { test } from "node:test";
import assert from "node:assert/strict";
import { samplingExample, calibrateProbability, sampledProbability, binaryCrossEntropy, weightedLoss, fusionScore } from "@/lib/ml/ranking";

const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`);

test("down-sampling example restores the original CTR without rounding", () => {
  const e = samplingExample(100, 900, 0.1);
  assert.equal(e.negativeKept, 90);
  assert.equal(e.sampleSize, 190);
  close(e.sampled, 10 / 19);
  close(e.corrected, 0.1);
  close(e.original, 0.1);
  close(samplingExample(100, 900, 0.01).sampled, 100 / 109);
});

test("calibration is identity at full retention and preserves boundary probabilities", () => {
  for (const p of [0, 0.01, 0.1, 0.5, 0.99, 1]) {
    close(calibrateProbability(p, 1), p);
    close(calibrateProbability(sampledProbability(p, 0.1), 0.1), p);
  }
  assert.equal(calibrateProbability(0, 0.1), 0);
  assert.equal(calibrateProbability(1, 0.1), 1);
});

test("fixed-alpha correction preserves rank and has the stated logit shift", () => {
  const probs = [0.01, 0.1, 0.5, 0.9, 0.99].map((p) => calibrateProbability(p, 0.1));
  for (let i = 1; i < probs.length; i++) assert.ok(probs[i] > probs[i - 1]);
  const p = calibrateProbability(0.7, 0.1);
  close(Math.log(p / (1 - p)) - Math.log(0.7 / 0.3), Math.log(0.1));
});

test("weighted BCE penalizes false positives and applies training weights", () => {
  close(binaryCrossEntropy(1, 0.8), 0.2231435513142097);
  close(binaryCrossEntropy(0, 0.2), 0.2231435513142097);
  close(weightedLoss([1, 0], [0.8, 0.5], [2, 1]), 1.1394342831883648);
  assert.equal(binaryCrossEntropy(0, 0), 0);
  assert.equal(binaryCrossEntropy(1, 0), Infinity);
  assert.equal(weightedLoss([1], [0], [0]), 0);
});

test("fusion implements sum and stabilized product, with a change of ranking", () => {
  close(fusionScore([0.8, 0.01], [0.5, 0.5], "sum"), 0.405);
  close(fusionScore([0.8, 0.01], [0.5, 0.5], "product", 0.001), Math.sqrt(0.008811));
  assert.ok(fusionScore([0.8, 0.01], [0.5, 0.5], "sum") > fusionScore([0.3, 0.3], [0.5, 0.5], "sum"));
  assert.ok(fusionScore([0.8, 0.01], [0.5, 0.5], "product") < fusionScore([0.3, 0.3], [0.5, 0.5], "product"));
  close(fusionScore([0, 0.2], [0, 1], "product", 0.001), 0.201);
  close(fusionScore([0.1, 0.2, 0.3, 0.4], [0.4, 0.3, 0.2, 0.1], "sum"), 0.2);
});

test("invalid rates, probabilities, counts and vector shapes cannot yield misleading charts", () => {
  for (const a of [0, -1, 1.1, NaN, Infinity]) assert.throws(() => calibrateProbability(0.5, a));
  for (const p of [-0.1, 1.1, NaN]) assert.throws(() => sampledProbability(p, 0.1));
  assert.throws(() => samplingExample(0, 0, 0.1));
  assert.throws(() => samplingExample(-1, 900, 0.1));
  assert.throws(() => weightedLoss([1], [0.5], []));
  assert.throws(() => fusionScore([], [], "sum"));
  assert.throws(() => fusionScore([0.5], [-1], "sum"));
  assert.throws(() => fusionScore([0.5], [1], "product", 0));
});
