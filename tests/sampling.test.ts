import { test } from "node:test";
import assert from "node:assert/strict";
import { softmax } from "@/lib/ml/clip";
import { createRng } from "@/lib/ml/random";
import { acceptableMass, DEMO_LOGITS, sampleTokens, softmaxTemperature, wrongCount } from "@/lib/ml/sampling";

const logits = DEMO_LOGITS.tokens.map((t) => t.logit);
const mask = DEMO_LOGITS.tokens.map((t) => t.acceptable);
const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("the demo vocabulary has ten tokens, the correct one on top", () => {
  assert.equal(DEMO_LOGITS.tokens.length, 10);
  assert.equal(DEMO_LOGITS.tokens[0].text, "8848");
  assert.ok(DEMO_LOGITS.tokens[0].acceptable);
  assert.ok(logits.every((z, i) => i === 0 || z < logits[0]));
  assert.equal(mask.filter(Boolean).length, 2);
});

test("T = 0.1 concentrates on the top logit, T = 2 flattens the distribution", () => {
  const cold = softmaxTemperature(logits, 0.1);
  assert.ok(Math.max(...cold) > 0.95, `p_max ${Math.max(...cold)}`);
  const hot = softmaxTemperature(logits, 2);
  assert.ok(Math.max(...hot) < 0.5, `p_max ${Math.max(...hot)}`);
  assert.ok(acceptableMass(hot, mask) < acceptableMass(cold, mask));
});

test("probabilities sum to 1 at every temperature and T = 1 is plain softmax", () => {
  for (const T of [0.1, 0.5, 1, 1.5, 2]) {
    const p = softmaxTemperature(logits, T);
    close(p.reduce((s, x) => s + x, 0), 1);
    assert.ok(p.every((x) => x > 0 && x < 1));
  }
  assert.deepEqual(softmaxTemperature(logits, 1), softmax(logits));
  assert.throws(() => softmaxTemperature(logits, 0));
});

test("sample counts sum to n and repeat for the same seed", () => {
  const p = softmaxTemperature(logits, 1);
  const a = sampleTokens(createRng(7), p, 20);
  const b = sampleTokens(createRng(7), p, 20);
  assert.deepEqual(a, b);
  assert.equal(a.length, p.length);
  assert.equal(a.reduce((s, x) => s + x, 0), 20);
  assert.ok(a.every((x) => x >= 0));
  assert.equal(wrongCount(a, mask) + a[0] + a[1], 20);
});

test("hotter sampling lands on wrong tokens more often", () => {
  const n = 2000;
  const cold = sampleTokens(createRng(3), softmaxTemperature(logits, 0.1), n);
  const hot = sampleTokens(createRng(3), softmaxTemperature(logits, 2), n);
  assert.equal(wrongCount(cold, mask), 0);
  assert.ok(wrongCount(hot, mask) > n * 0.2);
});
