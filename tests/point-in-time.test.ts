import { test } from "node:test";
import assert from "node:assert/strict";
import {
  countedRows,
  DAY_LABELS,
  featureAuc,
  smoothedRate,
  splitOfDay,
  splitTotals,
  toyExposures,
  videoFeature,
} from "@/lib/ml/pointInTime";

test("daily counts add up to the split sizes in kuairank docs/EDA.zh-CN.md §1", () => {
  const t = splitTotals();
  assert.equal(t.train, 5055984);
  assert.equal(t.valid, 2524980);
  assert.equal(t.test, 4132081);
  assert.equal(t.randomValid, 10214);
  assert.equal(t.randomTest, 32814);
  assert.equal(t.randomValid + t.randomTest, 43028);
});

test("the calendar and split boundaries follow PLAN §4", () => {
  assert.equal(DAY_LABELS[0], "4/08");
  assert.equal(DAY_LABELS[13], "4/21");
  assert.equal(DAY_LABELS[30], "5/08");
  assert.equal(splitOfDay(13), "train");
  assert.equal(splitOfDay(14), "valid");
  assert.equal(splitOfDay(20), "valid");
  assert.equal(splitOfDay(21), "test");
});

test("strict counts only earlier rows; ≤ t adds the sample itself; monthly sees the future", () => {
  const rows = toyExposures();
  const s = rows.find((r) => r.t > 22 && countedRows(rows, r, "strict").length > 2);
  assert.ok(s);
  const strict = countedRows(rows, s, "strict");
  assert.ok(strict.every((r) => r.t < s.t && r.video === s.video));
  assert.ok(countedRows(rows, s, "same-time").some((r) => r.id === s.id));
  assert.ok(videoFeature(rows, s, "same-time").includesSelf);
  assert.ok(!videoFeature(rows, s, "strict").includesSelf);
  assert.ok(countedRows(rows, s, "monthly").some((r) => r.t > s.t));
});

test("smoothing pulls an unseen video to the prior", () => {
  assert.equal(smoothedRate(0, 0), 0.38);
  assert.ok(Math.abs(smoothedRate(5, 5) - (5 + 5 * 0.38) / 10) < 1e-12);
});

test("leaky features look better offline than the point-in-time one", () => {
  const rows = toyExposures();
  const strict = featureAuc(rows, "strict");
  assert.ok(featureAuc(rows, "same-time") > strict + 0.05);
  assert.ok(featureAuc(rows, "monthly") > strict + 0.05);
  assert.deepEqual(toyExposures(), rows, "same seed, same toy");
});
