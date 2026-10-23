import { test } from "node:test";
import assert from "node:assert/strict";
import {
  attentionWeight,
  DEMO_CANDIDATES,
  DEMO_HISTORY,
  dinPool,
  dinShapes,
  historyIndex,
  longHistory,
  materialisedBytes,
  meanPool,
  pointerBytes,
  scoreCandidate,
  separationAt,
} from "@/lib/ml/din";

test("historyIndex right-aligns the last n events and pads on the left (kurec/seq.history_index)", () => {
  assert.deepEqual(historyIndex(3, 6, 5), { idx: [0, 0, 3, 4, 5], mask: [false, false, true, true, true] });
  assert.deepEqual(historyIndex(0, 9, 3), { idx: [6, 7, 8], mask: [true, true, true] });
  assert.deepEqual(historyIndex(4, 4, 2), { idx: [0, 0], mask: [false, false] });
});

test("memory: a materialised 5M × 200 × 3 int32 history is 12 GB, the pointers 80 MB", () => {
  assert.equal(materialisedBytes(5e6, 200, 3), 12e9);
  assert.equal(pointerBytes(5e6), 80e6);
});

test("tensor widths of the DIN block (kurec/models/din.py, d = 16)", () => {
  assert.deepEqual(dinShapes(), { item: 48, elem: 64, attnIn: 208, x0: 605 });
});

test("attention depends on the target and the feedback; mean pooling does not", () => {
  assert.ok(attentionWeight("萌宠", { tag: "萌宠", fb: "long" }) > attentionWeight("萌宠", { tag: "萌宠", fb: "skip" }));
  assert.equal(attentionWeight("萌宠", { tag: "游戏", fb: "long" }), 0);
  assert.deepEqual(meanPool("萌宠", DEMO_HISTORY).weights, meanPool("游戏", DEMO_HISTORY).weights);
  assert.notDeepEqual(dinPool("萌宠", DEMO_HISTORY).weights, dinPool("游戏", DEMO_HISTORY).weights);
});

test("on the worked example DIN separates the candidates better than the mean", () => {
  const rs = DEMO_CANDIDATES.map((c) => scoreCandidate(c.tag, c.label));
  const total = (k: "lossDin" | "lossMean") => rs.reduce((s, r) => s + r[k], 0);
  assert.ok(total("lossDin") < total("lossMean"));
  rs.forEach((r) => assert.ok(Number.isFinite(r.lossDin) && Number.isFinite(r.lossMean)));
});

test("a recent burst is diluted by mean pooling as N grows, not by the un-normalised DIN sum", () => {
  const h = longHistory();
  assert.equal(h.length, 200);
  assert.ok(separationAt(h, 12, "mean") > 4 * separationAt(h, 200, "mean"));
  assert.ok(separationAt(h, 200, "din") >= separationAt(h, 12, "din"));
});
