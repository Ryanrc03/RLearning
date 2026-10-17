import { test } from "node:test";
import assert from "node:assert/strict";
import { DEMO_RNN, DEMO_RNN_STEPS, demoInputs, matVec, rnnRun, rnnStep, shapeTable } from "@/lib/ml/rnn";

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

test("one step: h = tanh(W_xh x + W_hh h_prev), y = softmax(W_hy h), with every intermediate exposed", () => {
  const { params } = DEMO_RNN;
  const hPrev = [0.2, -0.4, 0.6];
  const x = [1, -0.5];
  const s = rnnStep(params, hPrev, x);
  assert.deepEqual(s.xProj, matVec(params.wxh, x));
  assert.deepEqual(s.hProj, matVec(params.whh, hPrev));
  s.pre.forEach((v, i) => close(v, s.xProj[i] + s.hProj[i]));
  s.h.forEach((v, i) => close(v, Math.tanh(s.pre[i])));
  // Hand-computed first unit: 0.8·1 + (−0.5)(−0.5) = 1.05; 0.5·0.2 + (−0.3)(−0.4) + 0.2·0.6 = 0.34.
  close(s.xProj[0], 1.05);
  close(s.hProj[0], 0.34);
  close(s.h[0], Math.tanh(1.39));
  assert.deepEqual(s.logits, matVec(params.why, s.h));
  close(sum(s.y), 1);
});

test("the unrolled demo run: 10 steps, h_t in (−1, 1), y_t sums to 1, h_{t−1} carried forward", () => {
  const run = rnnRun(DEMO_RNN.params, DEMO_RNN.inputs);
  assert.equal(run.length, DEMO_RNN_STEPS);
  assert.deepEqual(run[0].hPrev, [0, 0, 0]);
  run.forEach((s, i) => {
    assert.equal(s.t, i + 1);
    assert.equal(s.h.length, 3);
    assert.ok(s.h.every((v) => v > -1 && v < 1), `h_${s.t} = ${s.h}`);
    close(sum(s.y), 1);
    assert.ok(s.y.every((p) => p > 0 && p < 1));
    if (i > 0) assert.deepEqual(s.hPrev, run[i - 1].h);
  });
  // The hidden state really moves: no two consecutive h_t are identical.
  for (let i = 1; i < run.length; i++) assert.notDeepEqual(run[i].h, run[i - 1].h);
});

test("the run is deterministic: same seed, same inputs, same history", () => {
  assert.deepEqual(demoInputs(23, 10, 2), demoInputs(23, 10, 2));
  assert.deepEqual(DEMO_RNN.inputs, demoInputs(23, 10, 2));
  assert.notDeepEqual(demoInputs(23, 10, 2), demoInputs(24, 10, 2));
  assert.deepEqual(rnnRun(DEMO_RNN.params, DEMO_RNN.inputs), rnnRun(DEMO_RNN.params, DEMO_RNN.inputs));
  assert.ok(DEMO_RNN.inputs.every((x) => x.length === 2 && x.every((v) => v >= -1 && v <= 1)));
});

test("zero weights give h = 0 at every step and a uniform y", () => {
  const zero = {
    wxh: [[0, 0], [0, 0], [0, 0]],
    whh: [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
    why: [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
  };
  const run = rnnRun(zero, DEMO_RNN.inputs);
  run.forEach((s) => {
    assert.deepEqual(s.h, [0, 0, 0]);
    s.y.forEach((p) => close(p, 1 / 3));
  });
});

test("shapeTable(32, 10, 50, 100) lists the three shapes from the notes", () => {
  const rows = shapeTable(32, 10, 50, 100);
  assert.deepEqual(
    rows.map((r) => r.shape),
    [
      [32, 10, 50],
      [32, 10, 100],
      [32, 10, 100],
    ],
  );
  assert.deepEqual(rows.map((r) => r.symbol), ["x", "h", "y"]);
  assert.ok(rows.every((r) => r.axes.length === 3));
  assert.deepEqual(shapeTable(32, 10, 50, 100, 7)[2].shape, [32, 10, 7]);
});

test("matVec rejects a shape mismatch", () => {
  assert.throws(() => matVec([[1, 2, 3]], [1, 2]));
});
