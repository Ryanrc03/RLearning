import { test } from "node:test";
import assert from "node:assert/strict";
import { createRng } from "@/lib/ml/random";
import { softmaxTemperature } from "@/lib/ml/sampling";
import {
  beamSearch,
  DEFAULT_TOP_K,
  DEFAULT_TOP_P,
  DEMO_BEAM_TABLE,
  DEMO_NEXT_LOGITS,
  greedy,
  greedyPath,
  keptMass,
  renormalize,
  sampleFrom,
  temperedTable,
  topK,
  topP,
} from "@/lib/ml/decoding";

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const probs = softmaxTemperature(DEMO_NEXT_LOGITS.logits, 1);

test("the demo distribution has ten tokens sorted by logit", () => {
  assert.equal(DEMO_NEXT_LOGITS.tokens.length, 10);
  assert.equal(DEMO_NEXT_LOGITS.logits.length, 10);
  for (let i = 1; i < 10; i++) assert.ok(DEMO_NEXT_LOGITS.logits[i] < DEMO_NEXT_LOGITS.logits[i - 1]);
});

test("greedy equals argmax", () => {
  assert.equal(greedy(probs), 0);
  assert.equal(greedy([0.1, 0.7, 0.2]), 1);
});

test("top-k keeps exactly k tokens, the k most probable", () => {
  const m = topK(probs, DEFAULT_TOP_K);
  assert.equal(m.filter(Boolean).length, DEFAULT_TOP_K);
  assert.deepEqual(m.slice(0, 3), [true, true, true]);
  assert.ok(m.slice(3).every((x) => !x));
  // unsorted input still keeps the largest ones
  assert.deepEqual(topK([0.1, 0.5, 0.2, 0.2], 2), [false, true, true, false]);
  assert.equal(topK(probs, 50).filter(Boolean).length, 10);
});

test("top-p keeps the minimal prefix whose mass reaches p", () => {
  const m = topP(probs, DEFAULT_TOP_P);
  const k = m.filter(Boolean).length;
  assert.equal(k, 4);
  assert.ok(keptMass(probs, m) >= DEFAULT_TOP_P);
  assert.ok(keptMass(probs, topK(probs, k - 1)) < DEFAULT_TOP_P, "one fewer token would not reach p");
  // the set adapts to the temperature while top-k does not
  assert.equal(topP(softmaxTemperature(DEMO_NEXT_LOGITS.logits, 0.5), DEFAULT_TOP_P).filter(Boolean).length, 2);
  assert.equal(topP(softmaxTemperature(DEMO_NEXT_LOGITS.logits, 2), DEFAULT_TOP_P).filter(Boolean).length, 6);
  assert.equal(topP(probs, 1).filter(Boolean).length, 10);
  assert.equal(topP(probs, 0.01).filter(Boolean).length, 1);
});

test("renormalised masked probabilities sum to 1 and keep their ratios", () => {
  const m = topK(probs, 3);
  const q = renormalize(probs, m);
  close(sum(q), 1);
  assert.ok(q.slice(3).every((x) => x === 0));
  close(q[0] / q[1], probs[0] / probs[1]);
  const one = renormalize(probs, probs.map((_, i) => i === greedy(probs)));
  close(one[0], 1);
  assert.throws(() => renormalize(probs, probs.map(() => false)));
});

test("sampleFrom only returns kept tokens and repeats for the same seed", () => {
  const m = topK(probs, 3);
  const draws = Array.from({ length: 200 }, (_, i) => sampleFrom(createRng(100 + i), probs, m));
  assert.ok(draws.every((d) => m[d]));
  assert.equal(sampleFrom(createRng(7), probs, m), sampleFrom(createRng(7), probs, m));
  const single = probs.map((_, i) => i === 4);
  assert.equal(sampleFrom(createRng(3), probs, single), 4);
});

test("temperature 0.5 sharpens p_max, 2 flattens it", () => {
  const cold = softmaxTemperature(DEMO_NEXT_LOGITS.logits, 0.5);
  const hot = softmaxTemperature(DEMO_NEXT_LOGITS.logits, 2);
  assert.ok(Math.max(...cold) > Math.max(...probs));
  assert.ok(Math.max(...hot) < Math.max(...probs));
  assert.equal(greedy(cold), greedy(hot));
});

test("beam width 2 returns the largest log-prob sum and differs from greedy on the demo table", () => {
  const r = beamSearch(DEMO_BEAM_TABLE, 2);
  assert.equal(r.step1.filter((c) => c.kept).length, 2);
  assert.equal(r.step2.length, 4);
  assert.equal(r.step2.filter((c) => c.kept).length, 2);
  const bestScore = Math.max(...r.step2.map((c) => c.score));
  close(r.best.score, bestScore);
  close(r.best.score, Math.log(0.35) + Math.log(0.92));
  assert.deepEqual(r.best.tokens, ["面", "条"]);
  const g = greedyPath(DEMO_BEAM_TABLE);
  assert.deepEqual(g.tokens, ["火锅", "吧"]);
  assert.notDeepEqual(g.tokens, r.best.tokens);
  assert.ok(r.best.score > g.score);
  // the step-2 scores are sums of the per-step log-probs
  r.step2.forEach((c) => close(c.score, sum(c.logps)));
});

test("tempering the beam table at T = 1 changes nothing; at T = 0.5 and 2 beam still beats greedy", () => {
  const same = temperedTable(DEMO_BEAM_TABLE, 1);
  same.first.forEach((o, i) => close(o.p, DEMO_BEAM_TABLE.first[i].p));
  for (const T of [0.5, 2]) {
    const t = temperedTable(DEMO_BEAM_TABLE, T);
    close(sum(t.first.map((o) => o.p)), 1);
    const r = beamSearch(t, 2);
    assert.deepEqual(r.best.tokens, ["面", "条"]);
    assert.ok(r.best.score > greedyPath(t).score);
  }
});
