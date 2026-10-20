import { test } from "node:test";
import assert from "node:assert/strict";
import { routeToken, trainToyBatch } from "@/lib/ml/deepseek-moe";

const close = (actual: number, expected: number) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≉ ${expected}`);

test("top-k routes only selected expert outputs while shared output always contributes", () => {
  const result = routeToken({ scores: [Math.log(4), Math.log(2), 0, 0], expertOutputs: [2, 4, 100, 100], sharedOutput: 1, topK: 2, target: 1 });
  assert.deepEqual(result.selected, [0, 1]);
  close(result.gates[0], 0.5);
  close(result.gates[1], 0.25);
  close(result.gates[2], 0);
  close(result.gates[3], 0);
  close(result.output, 3);
  close(result.probability, 1 / (1 + Math.exp(-3)));
  close(result.loss, Math.log(1 + Math.exp(-3)));
  close(result.expertOutputGradients[0], 0.5 * (result.probability - 1));
  close(result.expertOutputGradients[1], 0.25 * (result.probability - 1));
  close(result.expertOutputGradients[2], 0);
  close(result.sharedOutputGradient, result.probability - 1);
});

test("routing changes with scores; bad expert inputs are rejected", () => {
  const result = routeToken({ scores: [0, 0, 3, 2], expertOutputs: [1, 1, 3, 2], sharedOutput: 0.5, topK: 2, target: 0 });
  assert.deepEqual(result.selected, [2, 3]);
  assert.ok(result.loss > 0);
  assert.throws(() => routeToken({ scores: [0], expertOutputs: [1, 2], sharedOutput: 0, topK: 1, target: 1 }));
  assert.throws(() => routeToken({ scores: [0], expertOutputs: [1], sharedOutput: 0, topK: 0, target: 1 }));
});

const firstScores = [Math.log(4), Math.log(2), 0, 0];
const secondScores = [0, 0, Math.log(4), Math.log(2)];

test("two tokens train different experts and the shared expert through three-class cross-entropy", () => {
  const result = trainToyBatch({
    scoresByToken: [firstScores, secondScores],
    expertOutputs: [2, 4, 2, 4],
    sharedOutput: 1,
    targetIndices: [0, 1],
    outputClassIndices: [0, 1],
    vocabularySize: 3,
    topK: 2,
    balanceAlpha: 0.01,
    learningRate: 0.1,
  });
  const p = Math.exp(3) / (Math.exp(3) + 2);
  const q = 1 - p;
  assert.deepEqual(result.tokens.map((token) => token.selected), [[0, 1], [2, 3]]);
  result.tokens.forEach((token) => {
    close(token.output, 3);
    close(token.targetProbability, p);
    close(token.loss, Math.log(1 + 2 * Math.exp(-3)));
  });
  close(result.meanLanguageLoss, Math.log(1 + 2 * Math.exp(-3)));
  assert.deepEqual(result.selectionCounts, [1, 1, 1, 1]);
  close(result.balanceLoss, 0.01);
  close(result.totalLoss, result.meanLanguageLoss + 0.01);
  close(result.sharedGradient, -q);
  close(result.expertGradients[0], -q / 4);
  close(result.expertGradients[1], -q / 8);
  close(result.expertGradients[2], -q / 4);
  close(result.expertGradients[3], -q / 8);
  close(result.updatedSharedOutput, 1 + 0.1 * q);
  close(result.updatedExpertOutputs[0], 2 + 0.1 * q / 4);
});

test("router collapse raises the auxiliary balance penalty", () => {
  const result = trainToyBatch({
    scoresByToken: [firstScores, firstScores],
    expertOutputs: [2, 4, 2, 4],
    sharedOutput: 1,
    targetIndices: [0, 1],
    outputClassIndices: [0, 1],
    vocabularySize: 3,
    topK: 2,
    balanceAlpha: 0.01,
    learningRate: 0.1,
  });
  assert.deepEqual(result.selectionCounts, [2, 2, 0, 0]);
  close(result.balanceLoss, 0.015);
  close(result.expertGradients[2], 0);
  close(result.expertGradients[3], 0);
});

test("a wrong predicted class raises cross-entropy and pushes its logit down", () => {
  const result = trainToyBatch({
    scoresByToken: [firstScores],
    expertOutputs: [2, 4, 2, 4],
    sharedOutput: 1,
    targetIndices: [1],
    outputClassIndices: [0],
    vocabularySize: 3,
    topK: 2,
    balanceAlpha: 0,
    learningRate: 0.1,
  });
  const pWrong = Math.exp(3) / (Math.exp(3) + 2);
  close(result.tokens[0].targetProbability, 1 / (Math.exp(3) + 2));
  close(result.tokens[0].loss, Math.log(Math.exp(3) + 2));
  close(result.sharedGradient, pWrong);
  assert.ok(result.updatedSharedOutput < 1);
});
