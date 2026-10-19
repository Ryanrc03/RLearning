import { test } from "node:test";
import assert from "node:assert/strict";
import { attemptStats, HARNESS_PRESETS, harnessYield, PAGE_MIX, yieldCurve } from "@/lib/ml/harness";

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("one attempt through rules then VLM", () => {
  const a = attemptStats(PAGE_MIX, HARNESS_PRESETS.layered);
  // good 0.6 · 0.95 + subtle 0.15 · 0.2; every rule defect is caught.
  close(a.accept, 0.6);
  close(a.acceptByClass.ruleBad, 0);
  close(a.precision, 0.95);
  // The VLM only runs on the 75% that passed the rules.
  close(a.stages[0].reached, 1);
  close(a.stages[0].passRate, 0.75);
  close(a.stages[1].reached, 0.75);
  close(a.cost, 1 + 0.01 + 0.75 * 0.3);
});

test("no gates means no retries help: yield stays at the raw 60%", () => {
  for (const k of [0, 1, 5]) {
    const r = harnessYield(PAGE_MIX, HARNESS_PRESETS.none, k);
    close(r.goodYield, 0.6);
    close(r.expectedAttempts, 1);
  }
});

test("layered gate with 2 retries lifts good yield from 60% to about 89%", () => {
  close(harnessYield(PAGE_MIX, HARNESS_PRESETS.layered, 0).goodYield, 0.6);
  const r = harnessYield(PAGE_MIX, HARNESS_PRESETS.layered, 2);
  close(r.passedWithin, 1 - 0.4 ** 3);
  close(r.goodYield, 0.936 * 0.95 + 0.064 * 0.075);
  close(r.expectedAttempts, 1 + 0.4 + 0.16);
  close(r.costPerGood, (r.expectedAttempts * r.cost) / r.goodYield);
  // The curve rises with diminishing returns and never passes the gate's precision.
  const curve = yieldCurve(PAGE_MIX, HARNESS_PRESETS.layered, 6).map((x) => x.goodYield);
  for (let i = 1; i < curve.length; i++) {
    assert.ok(curve[i] > curve[i - 1]);
    if (i > 1) assert.ok(curve[i] - curve[i - 1] < curve[i - 1] - curve[i - 2]);
  }
  assert.ok(curve[6] < 0.95);
});

test("VLM alone is both pricier per attempt and lower in yield than rules first", () => {
  const layered = harnessYield(PAGE_MIX, HARNESS_PRESETS.layered, 2);
  const vlm = harnessYield(PAGE_MIX, HARNESS_PRESETS.vlmOnly, 2);
  assert.ok(vlm.cost > layered.cost);
  assert.ok(vlm.precision < layered.precision);
  assert.ok(vlm.goodYield < layered.goodYield - 0.05, `${vlm.goodYield} vs ${layered.goodYield}`);
  assert.ok(vlm.costPerGood > layered.costPerGood);
});
