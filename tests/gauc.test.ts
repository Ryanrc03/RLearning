import { test } from "node:test";
import assert from "node:assert/strict";
import { auc } from "@/lib/ml/metrics";
import { bootstrapGauc, gauc, gaucToyScores, pairedDiffBootstrap, pairedToy, pairedToyIntervals, perUserAuc } from "@/lib/ml/gauc";

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test("hand example: two users, weights by sample count, a single-class user is skipped", () => {
  const items = [
    { user: 0, score: 0.9, label: true },
    { user: 0, score: 0.8, label: true },
    { user: 0, score: 0.2, label: false },
    { user: 0, score: 0.1, label: false },
    { user: 1, score: 0.1, label: true },
    { user: 1, score: 0.9, label: false },
    { user: 2, score: 0.5, label: true },
  ];
  assert.equal(perUserAuc(items).length, 2);
  close(gauc(items), (4 * 1 + 2 * 0) / 6);
});

test("a per-user constant moves AUC but not GAUC", () => {
  const a = gaucToyScores(0, true);
  const b = gaucToyScores(1, true);
  close(gauc(a), gauc(b));
  assert.ok(auc(b) > auc(a) + 0.03);
});

test("knowing only who the user is gives GAUC 0.5 and a high AUC", () => {
  const s = gaucToyScores(1, false);
  close(gauc(s), 0.5);
  assert.ok(auc(s) > 0.65);
});

test("paired bootstrap: the difference interval is far narrower than either model's own interval", () => {
  const r = pairedToyIntervals(0.01);
  assert.ok(r.diff.hi - r.diff.lo < (r.a.hi - r.a.lo) / 4);
  assert.ok(r.a.hi > r.b.lo, "the two separate intervals overlap");
  assert.ok(r.diff.lo > 0, "but the paired difference excludes 0");
  close(r.diff.point, 0.01);
});

test("bootstrap is deterministic and brackets its point estimate", () => {
  const { a, b, w } = pairedToy(0.005);
  const x = bootstrapGauc(a, w, 300, 1);
  assert.deepEqual(x, bootstrapGauc(a, w, 300, 1));
  assert.ok(x.lo <= x.point && x.point <= x.hi);
  const d = pairedDiffBootstrap(b, a, w, 300, 2);
  assert.ok(d.lo <= d.point && d.point <= d.hi);
});
