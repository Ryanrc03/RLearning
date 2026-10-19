import { test } from "node:test";
import assert from "node:assert/strict";
import {
  correctedCvr,
  DEMO_CONVERTERS,
  DEMO_IMPRESSIONS,
  demoDelays,
  drawDelays,
  empiricalCdf,
  erf,
  JOIN_WINDOWS,
  joinWithWindow,
  lognormalCdf,
  stateRows,
} from "@/lib/ml/sampleJoin";

const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("a conversion inside the window is a positive, one after it a false negative", () => {
  const r = joinWithWindow([0.5, 3, 30], 30, 4);
  assert.equal(r.labelled, 2);
  assert.equal(r.falseNegatives, 1);
  close(r.trueCvr, 3 / 30);
  close(r.measuredCvr, 2 / 30);
  close(r.capture, 2 / 3);
});

test("the boundary is inclusive and empty inputs give 0, not NaN", () => {
  assert.equal(joinWithWindow([4], 10, 4).labelled, 1);
  const r = joinWithWindow([], 0, 4);
  assert.equal(r.trueCvr, 0);
  assert.equal(r.measuredCvr, 0);
  assert.equal(r.capture, 0);
});

test("delays are seeded, sorted and clamped", () => {
  const a = drawDelays(7, 50, 2, 1.3);
  assert.deepEqual(a, drawDelays(7, 50, 2, 1.3));
  for (let i = 1; i < a.length; i++) assert.ok(a[i] >= a[i - 1]);
  assert.ok(a.every((d) => d >= 0.1 && d <= 300));
});

test("measured CVR only grows with the window and reaches the true CVR", () => {
  for (const kind of ["order", "pay"] as const) {
    const d = demoDelays(kind);
    assert.equal(d.length, DEMO_CONVERTERS);
    let prev = -1;
    for (const w of JOIN_WINDOWS) {
      const r = joinWithWindow(d, DEMO_IMPRESSIONS, w);
      assert.ok(r.measuredCvr >= prev);
      assert.ok(r.measuredCvr <= r.trueCvr);
      prev = r.measuredCvr;
    }
    close(joinWithWindow(d, DEMO_IMPRESSIONS, 1000).measuredCvr, 0.1);
  }
});

test("a short window badly undercounts the slow conversion type", () => {
  const order = joinWithWindow(demoDelays("order"), DEMO_IMPRESSIONS, 2);
  const pay = joinWithWindow(demoDelays("pay"), DEMO_IMPRESSIONS, 2);
  assert.ok(pay.capture < 0.25, `pay capture ${pay.capture}`);
  assert.ok(order.capture > pay.capture);
});

test("erf and the lognormal CDF match known values", () => {
  close(erf(0), 0, 1e-7);
  close(erf(1), 0.8427007929, 1e-6);
  close(erf(-1), -0.8427007929, 1e-6);
  close(lognormalCdf(20, 20, 1), 0.5);
  close(lognormalCdf(20 * Math.E, 20, 1), 0.8413447, 1e-6);
  assert.equal(lognormalCdf(0, 20, 1), 0);
});

test("the empirical capture tracks the model CDF on many draws", () => {
  const d = drawDelays(11, 5000, 2, 1.3);
  for (const w of [1, 2, 8]) {
    const got = joinWithWindow(d, 5000, w).capture;
    assert.ok(Math.abs(got - lognormalCdf(w, 2, 1.3)) < 0.03, `w=${w}: ${got}`);
  }
});

test("dividing by the expected capture recovers the true CVR on average", () => {
  const d = drawDelays(11, 5000, 2, 1.3);
  const r = joinWithWindow(d, 50000, 2);
  close(correctedCvr(r.measuredCvr, lognormalCdf(2, 2, 1.3)), 0.1, 0.004);
  assert.equal(correctedCvr(0.05, 0), 0);
});

test("empirical CDF ends at 1 and state grows linearly with the window", () => {
  const pts = empiricalCdf([3, 1, 2]);
  assert.deepEqual(pts, [[1, 1 / 3], [2, 2 / 3], [3, 1]]);
  assert.equal(stateRows(1000, 24), 24000);
});
