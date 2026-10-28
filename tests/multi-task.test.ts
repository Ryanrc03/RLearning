import { test } from "node:test";
import assert from "node:assert/strict";
import { fuse, fusedGauc, fusionMean, fusionToy, MTL_DIFFS, pearson, REAL_FUSION } from "@/lib/ml/multiTask";

test("fusion is Σ w log p and a constant factor on one head does not change the order", () => {
  assert.ok(Math.abs(fuse([0.5, 0.2], [1, 0.5]) - (Math.log(0.5) + 0.5 * Math.log(0.2))) < 1e-12);
  const a = fuse([0.3, 0.1], [1, 0.5]);
  const b = fuse([0.6, 0.1], [1, 0.5]);
  const a2 = fuse([0.3 / 2, 0.1], [1, 0.5]);
  const b2 = fuse([0.6 / 2, 0.1], [1, 0.5]);
  assert.equal(Math.sign(b - a), Math.sign(b2 - a2));
  assert.ok(Math.abs(b - a - (b2 - a2)) < 1e-12);
});

test("toy labels are nearly unrelated, so the click head alone ranks likes near chance", () => {
  const rows = fusionToy();
  assert.ok(Math.abs(pearson(rows.map((r) => +r.click), rows.map((r) => +r.like))) < 0.1);
  const g0 = fusedGauc(rows, 0);
  assert.ok(g0.like < 0.56);
  assert.ok(g0.click > 0.74);
});

test("raising the like weight trades click GAUC for like GAUC", () => {
  const rows = fusionToy();
  const a = fusedGauc(rows, 0);
  const b = fusedGauc(rows, 0.5);
  assert.ok(b.like > a.like + 0.1);
  assert.ok(b.click < a.click - 0.03);
  assert.ok(b.mean > a.mean);
});

test("real fusion table: valid weights give like +0.042, click −0.012, three-target mean 0.6147", () => {
  const [only, valid] = REAL_FUSION;
  assert.equal((valid.tab1[2] - only.tab1[2]).toFixed(3), "0.042");
  assert.equal((valid.tab1[0] - only.tab1[0]).toFixed(3), "-0.012");
  assert.equal(fusionMean(valid.tab1).toFixed(4), "0.6147");
  assert.equal(fusionMean(only.tab1).toFixed(4), "0.6060");
});

test("like is significantly worse than single-task in every structure", () => {
  for (const r of MTL_DIFFS) {
    const like = r.diffs[2];
    assert.ok(like.hi !== null && like.hi < 0, r.arch);
  }
});
