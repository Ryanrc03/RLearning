import { test } from "node:test";
import assert from "node:assert/strict";
import { attentionWeights } from "@/lib/ml/bahdanau";
import {
  C2_EXAMPLE_SCORES,
  READING_STEPS,
  READING_WEIGHTS,
  SENTENCE,
  readingStep,
  rnnStep,
  scoreCount,
  unroll,
  type SimpleRnnParams,
} from "@/lib/ml/rnnSelfAttention";

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

const params: SimpleRnnParams = {
  a: [[0.6, -0.3, 0.5, 0.2], [-0.4, 0.7, 0.1, -0.6]],
  b: [0.05, -0.1],
};
const dot = (q: number[], k: number[]) => q.reduce((acc, v, d) => acc + v * k[d], 0);

test("softmax of [1.2, 0.4] is about [0.690, 0.310]", () => {
  const w = attentionWeights(C2_EXAMPLE_SCORES);
  assert.deepEqual(w.map((x) => x.toFixed(3)), ["0.690", "0.310"]);
  close(sum(w), 1);
});

test("every simulated reading step covers exactly the t − 1 earlier tokens and sums to 1", () => {
  for (const t of READING_STEPS) {
    const step = readingStep(t);
    assert.equal(step.weights.length, t - 1);
    assert.deepEqual(step.history, SENTENCE.slice(0, t - 1));
    assert.equal(step.token, SENTENCE[t - 1]);
    close(sum(step.weights), 1);
    attentionWeights(step.scores).forEach((w, i) => close(w, step.weights[i], 1e-12));
  }
  assert.deepEqual(Object.keys(READING_WEIGHTS).map(Number), [...READING_STEPS]);
});

test("a sequence of length n needs n(n − 1)/2 alignment scores", () => {
  assert.equal(scoreCount(1), 0);
  assert.equal(scoreCount(3), 3);
  assert.equal(scoreCount(6), 15);
  assert.equal(scoreCount(6), [0, 1, 2, 3, 4, 5].reduce((a, b) => a + b, 0));
});

test("h_1 reads the zero context c_0, and c_1 equals h_1", () => {
  const steps = unroll(params, [[1, 0], [0, 1], [1, 1]], dot);
  assert.deepEqual(steps[0].cPrev, [0, 0]);
  assert.deepEqual(steps[0].h, rnnStep(params, [1, 0], [0, 0]));
  assert.deepEqual(steps[0].weights, [1]);
  steps[0].c.forEach((v, d) => close(v, steps[0].h[d]));
});

test("h_3 is tanh(A [x_3; c_2] + b) and c_2 only mixes h_1 and h_2", () => {
  const xs = [[1, 0], [0, 1], [1, 1]];
  const steps = unroll(params, xs, dot);
  assert.equal(steps[1].weights.length, 2);
  close(sum(steps[1].weights), 1);
  const c2 = steps[1].c;
  c2.forEach((v, d) => close(v, steps[1].weights[0] * steps[0].h[d] + steps[1].weights[1] * steps[1].h[d]));
  assert.deepEqual(steps[2].cPrev, c2);
  assert.deepEqual(steps[2].h, rnnStep(params, xs[2], c2));
  // Changing x_3 must leave c_2 untouched: no edge runs from h_3 back to c_2.
  const other = unroll(params, [xs[0], xs[1], [-2, 5]], dot);
  assert.deepEqual(other[1].c, c2);
});
