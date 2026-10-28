import { test } from "node:test";
import assert from "node:assert/strict";
import { DAILY, DATASET, dailySeries, LABELS, labelCell, negPerPos, SET_ORDER, SETS, splitRateTab1 } from "@/lib/ml/kuairandOverview";

const close = (a: number, b: number, eps = 1e-4) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test("rates and negatives per positive", () => {
  close(labelCell("train", "click").rate, 0.38056);
  close(labelCell("train", "like").negPerPos, 65.23, 0.01);
  close(labelCell("testTab1", "follow").negPerPos, 979.1, 0.1);
  assert.equal(negPerPos(0, 10), Infinity);
});

test("random exposure is far sparser than the recommended feed", () => {
  assert.ok(labelCell("random", "click").rate < labelCell("testTab1", "click").rate / 2);
  assert.equal(labelCell("random", "follow").pos, 8);
});

test("every count is consistent: positives ≤ rows, users with a positive ≤ users", () => {
  for (const s of SET_ORDER)
    for (const l of LABELS) {
      assert.ok(SETS[s].pos[l.key] <= SETS[s].n);
      assert.ok(SETS[s].usersWithPos[l.key] <= SETS[s].users);
    }
});

test("daily counts add up to the split totals of standard exposures", () => {
  const train = DAILY.filter(([d]) => d <= "04-21").reduce((s, r) => s + r[1], 0);
  assert.equal(train, SETS.train.n);
  const valid = DAILY.filter(([d]) => d > "04-21" && d <= "04-28").reduce((s, r) => s + r[1], 0);
  assert.equal(valid, SETS.valid.n);
  const test1 = DAILY.filter(([d]) => d > "04-28").reduce((s, r) => s + r[2], 0);
  assert.equal(test1, SETS.testTab1.n);
  assert.equal(dailySeries().length, 31);
  assert.equal(DATASET.rows, DAILY.reduce((s, r) => s + r[1], 0) + DATASET.randomRows);
});

test("tab-1 like rate drifts up in the test weeks (May Day), click rate does not", () => {
  close(splitRateTab1("train", "like"), 0.01833, 1e-4);
  close(splitRateTab1("test", "like"), 0.02123, 1e-4);
  assert.ok(Math.abs(splitRateTab1("test", "click") - splitRateTab1("train", "click")) < 0.01);
});
