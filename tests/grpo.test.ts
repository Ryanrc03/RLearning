import { test } from "node:test";
import assert from "node:assert/strict";
import { firstMixedG, G_MAX, GRPO_PROMPTS, groupAdvantages, sampleRewards, zeroSignalProbability } from "@/lib/ml/grpo";

const close = (a: number, b: number, eps = 1e-4) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("advantages are centred and scaled to unit std inside the group", () => {
  const { mean, std, advantages } = groupAdvantages([1, 0, 1, 1]);
  close(mean, 0.75);
  close(std, Math.sqrt(0.75 * 0.25));
  close(advantages.reduce((a, b) => a + b, 0), 0);
  const varA = advantages.reduce((a, b) => a + b * b, 0) / advantages.length;
  close(varA, 1);
  // A rare right answer gets a big push, a common one only a small push.
  close(advantages[1], -0.75 / std);
  close(advantages[0], 0.25 / std);
});

test("an all-correct or all-wrong group gives zero advantage everywhere", () => {
  for (const r of [[1, 1, 1, 1], [0, 0, 0, 0, 0, 0]]) {
    const { std, advantages } = groupAdvantages(r);
    assert.equal(std, 0);
    assert.ok(advantages.every((a) => a === 0));
  }
  assert.deepEqual(groupAdvantages([]).advantages, []);
});

test("one right answer among eight gets A ≈ 2.65", () => {
  const r = [0, 0, 0, 0, 0, 0, 0, 1];
  close(groupAdvantages(r).advantages[7], (1 - 1 / 8) / Math.sqrt((1 / 8) * (7 / 8)));
});

test("zero-signal probability is p^G + (1 − p)^G and shrinks with G", () => {
  close(zeroSignalProbability(0.5, 4), 0.125);
  close(zeroSignalProbability(0.9, 4), 0.9 ** 4 + 0.1 ** 4);
  assert.ok(zeroSignalProbability(0.9, 16) < zeroSignalProbability(0.9, 4));
  close(zeroSignalProbability(1, 8), 1);
});

test("seeded groups: easy is all right and hard all wrong at G = 4, both mix by G = 8", () => {
  const easy = sampleRewards(GRPO_PROMPTS.easy.p, GRPO_PROMPTS.easy.seed);
  const medium = sampleRewards(GRPO_PROMPTS.medium.p, GRPO_PROMPTS.medium.seed);
  const hard = sampleRewards(GRPO_PROMPTS.hard.p, GRPO_PROMPTS.hard.seed);
  for (const r of [easy, medium, hard]) assert.equal(r.length, G_MAX);
  assert.ok(easy.slice(0, 4).every((r) => r === 1));
  assert.ok(hard.slice(0, 4).every((r) => r === 0));
  assert.ok(firstMixedG(easy) > 4 && firstMixedG(easy) <= 8);
  assert.ok(firstMixedG(hard) > 4 && firstMixedG(hard) <= 8);
  assert.equal(firstMixedG(medium), 2);
  assert.deepEqual(sampleRewards(0.5, 2), medium);
});
