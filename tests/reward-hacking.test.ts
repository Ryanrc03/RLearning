import { test } from "node:test";
import assert from "node:assert/strict";
import { answerReward, expectedReward, HACK, reasoningBenefit, simulateTraining, trueAccuracy } from "@/lib/ml/rewardHacking";

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("reasoning helps up to the useful length, then rambling dilutes it", () => {
  close(reasoningBenefit(HACK.usefulLength), 1);
  assert.ok(reasoningBenefit(150) < 1 && reasoningBenefit(900) < 1);
  assert.ok(trueAccuracy(0, 300) > trueAccuracy(0, 120));
  assert.ok(trueAccuracy(0, 1500) < trueAccuracy(0, 300) / 4);
});

test("additive reward pays for length even on a wrong answer; gated does not", () => {
  close(answerReward("additive", 0, 800), 0.8);
  close(answerReward("gated", 0, 800), 0);
  close(answerReward("gated", 1, 800), 1 + HACK.alpha * HACK.cap / 1000);
  close(answerReward("gated", 1, 800), answerReward("gated", 1, HACK.cap));
  // Same skill, a padded answer scores higher than a sensible one under additive only.
  assert.ok(expectedReward("additive", 0, 1500) > expectedReward("additive", 0, 300));
  assert.ok(expectedReward("gated", 0, 1500) < expectedReward("gated", 0, 300));
});

test("additive: reward keeps rising while true accuracy peaks and collapses", () => {
  const run = simulateTraining("additive");
  assert.equal(run.length, HACK.steps + 1);
  const peak = run.reduce((m, p) => (p.accuracy > m.accuracy ? p : m));
  const end = run[run.length - 1];
  assert.ok(peak.step > 30 && peak.step < 120, `peak at ${peak.step}`);
  assert.ok(end.accuracy < 0.15, `end accuracy ${end.accuracy}`);
  assert.ok(end.length > HACK.maxLength);
  assert.ok(end.reward > run[0].reward + 0.7);
  assert.ok(end.fillerTokens > 1000);
});

test("gated: length settles near the cap and accuracy keeps improving", () => {
  const run = simulateTraining("gated");
  const end = run[run.length - 1];
  assert.ok(end.length > HACK.usefulLength && end.length < HACK.cap * 1.1, `length ${end.length}`);
  assert.ok(end.accuracy > 0.85);
  assert.ok(end.reward > run[0].reward);
});

test("the same seed draws the same run; other seeds tell the same story", () => {
  assert.deepEqual(simulateTraining("additive"), simulateTraining("additive"));
  for (const seed of [1, 2, 42]) {
    const a = simulateTraining("additive", HACK.steps, seed);
    const g = simulateTraining("gated", HACK.steps, seed);
    assert.ok(a[a.length - 1].accuracy < 0.15 && g[g.length - 1].accuracy > 0.85);
  }
  for (const p of simulateTraining("gated")) assert.ok(Number.isFinite(p.reward) && Number.isFinite(p.accuracy));
});
