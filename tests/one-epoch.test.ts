import { test } from "node:test";
import assert from "node:assert/strict";
import { bestCheckpoint, dropFromBest, ID_COVERAGE, ID_RUNS } from "@/lib/ml/oneEpoch";

const run = (key: string) => {
  const r = ID_RUNS.find((x) => x.key === key);
  assert.ok(r, key);
  return r;
};

test("every run has 12 evaluations, one per quarter epoch", () => {
  for (const r of ID_RUNS) {
    assert.equal(r.history.length, 12);
    r.history.forEach((p, i) => assert.ok(Math.abs(p.epoch - 0.25 * (i + 1)) < 1e-9));
  }
});

test("best checkpoints match metrics.json best_epoch", () => {
  assert.equal(bestCheckpoint(run("f1").history).epoch, 1.5);
  assert.equal(bestCheckpoint(run("uid").history).epoch, 1.0);
  assert.equal(bestCheckpoint(run("aid").history).epoch, 1.0);
  assert.equal(bestCheckpoint(run("vid").history).epoch, 1.0);
});

test("the numbers quoted in EXPERIMENT_LOG #12 / #13", () => {
  assert.equal(run("aid").history[4].validAuc.toFixed(3), "0.781");
  assert.equal(run("vid").history[4].validAuc.toFixed(3), "0.764");
  assert.equal(run("vid").history[3].trainLoss.toFixed(2), "0.51");
  assert.equal(run("vid").history[11].trainLoss.toFixed(2), "0.28");
  assert.ok(dropFromBest(run("vid").history, 2.5) > 0.09);
  assert.ok(dropFromBest(run("f1").history, 3) < 0.001);
});

test("coverage table: video ids barely reach the biased test set", () => {
  assert.equal(ID_COVERAGE[1].test, 0.115);
  assert.equal(ID_COVERAGE[1].random, 0.509);
});
