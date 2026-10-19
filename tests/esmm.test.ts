import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clickSpaceCvr,
  esmmLoss,
  esmmScenario,
  impressionSpaceCvr,
  N_IMPRESSIONS,
  observedCvrByLevel,
  simulateImpressions,
  sum,
  trueCvr,
} from "@/lib/ml/esmm";

const close = (a: number, b: number, eps: number) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("simulation is deterministic and keeps the same impressions across slopes", () => {
  assert.deepEqual(simulateImpressions(1), simulateImpressions(1));
  const flat = simulateImpressions(0);
  const steep = simulateImpressions(2);
  assert.deepEqual(flat.map((r) => r.imp), steep.map((r) => r.imp));
  assert.equal(sum(flat, "imp"), N_IMPRESSIONS);
  for (const r of steep) assert.ok(r.conv <= r.click && r.click <= r.imp);
  // Level x = 0 has pCTR independent of the slope, so its clicks do not move.
  assert.equal(flat[4].click, steep[4].click);
});

test("clicks are sparse: a few percent of impressions carry a CVR label", () => {
  const rows = simulateImpressions(0);
  const ctr = sum(rows, "click") / sum(rows, "imp");
  assert.ok(ctr > 0.03 && ctr < 0.06, `ctr ${ctr}`);
});

test("with no selection, the clicked-only CVR matches the impression-space CVR", () => {
  const rows = simulateImpressions(0);
  close(clickSpaceCvr(rows), impressionSpaceCvr(rows), 0.03);
});

test("selection on x inflates the clicked-only CVR; the impression-space truth does not move", () => {
  const flat = simulateImpressions(0);
  const steep = simulateImpressions(2.5);
  close(impressionSpaceCvr(flat), impressionSpaceCvr(steep), 1e-12);
  assert.ok(clickSpaceCvr(steep) > impressionSpaceCvr(steep) + 0.2);
  assert.ok(clickSpaceCvr(simulateImpressions(1)) > clickSpaceCvr(flat));
});

test("observed per-level CVR is null only where a level has no clicks", () => {
  const rows = simulateImpressions(2.5);
  const obs = observedCvrByLevel(rows);
  rows.forEach((r, i) => assert.equal(obs[i] === null, r.click === 0));
});

test("ESMM gradient matches finite differences", () => {
  const rows = simulateImpressions(1.5);
  const theta = [-2.5, 0.7, -0.4, 0.3];
  const { grad } = esmmLoss(theta, rows);
  const h = 1e-5;
  for (let i = 0; i < 4; i++) {
    const up = [...theta];
    const dn = [...theta];
    up[i] += h;
    dn[i] -= h;
    const num = (esmmLoss(up, rows).loss - esmmLoss(dn, rows).loss) / (2 * h);
    close(grad[i], num, 1e-6);
  }
});

test("ESMM recovers both towers and the impression-space CVR from impression labels alone", () => {
  for (const slope of [0, 1, 2.5]) {
    const s = esmmScenario(slope);
    close(s.esmm.b, slope, 0.2);
    close(s.esmm.d, 1.2, 0.25);
    close(s.esmmImpressionSpace, s.impressionSpace, 0.02);
    for (const x of [-1, 0, 1]) close(1 / (1 + Math.exp(-(s.esmm.c + s.esmm.d * x))), trueCvr(x), 0.05);
  }
});
