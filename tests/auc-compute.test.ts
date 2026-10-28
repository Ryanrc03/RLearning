import { test } from "node:test";
import assert from "node:assert/strict";
import { averageRanks, byRequest, EXAMPLE_ROWS, gaucFrom, pairCountAuc, perGroupAuc, rankAuc, type Row } from "@/lib/ml/aucCompute";
import { createRng } from "@/lib/ml/random";

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const user = (g: string) => EXAMPLE_ROWS.filter((r) => r.group === g);

test("average ranks share tied positions", () => {
  assert.deepEqual(averageRanks([0.3, 0.1, 0.3, 0.9]), [2.5, 1, 2.5, 4]);
});

test("user A by hand: 12 good pairs + 1 tie out of 15, R+ = 18.5", () => {
  const p = pairCountAuc(user("A"));
  assert.deepEqual([p.good, p.ties, p.pairs], [12, 1, 15]);
  const r = rankAuc(user("A"));
  assert.equal(r.rPos, 18.5);
  assert.equal(r.floor, 6);
  close(r.auc, 12.5 / 15);
  close(p.auc, r.auc);
});

test("user B is 0.25 and user C (no positive) is skipped", () => {
  close(rankAuc(user("B")).auc, 0.25);
  const g = perGroupAuc(EXAMPLE_ROWS);
  assert.deepEqual(g.map((x) => [x.group, x.skipped]), [["A", false], ["B", false], ["C", true]]);
});

test("GAUC under the three weightings, and coverage 12 of 15 rows", () => {
  const g = perGroupAuc(EXAMPLE_ROWS);
  close(gaucFrom(g, "sample").gauc, (8 * (12.5 / 15) + 4 * 0.25) / 12);
  close(gaucFrom(g, "positive").gauc, (3 * (12.5 / 15) + 2 * 0.25) / 5);
  close(gaucFrom(g, "none").gauc, (12.5 / 15 + 0.25) / 2);
  close(gaucFrom(g).coverage, 12 / 15);
});

test("global AUC of the example mixes users: 31.5 of 50 pairs", () => {
  close(pairCountAuc(EXAMPLE_ROWS).auc, 31.5 / 50);
  close(rankAuc(EXAMPLE_ROWS).auc, 31.5 / 50);
});

test("grouping by request gives a different number from the same scores", () => {
  const g = perGroupAuc(byRequest(EXAMPLE_ROWS));
  assert.deepEqual(g.filter((x) => !x.skipped).map((x) => x.auc), [0.75, 1, 0, 0]);
  close(gaucFrom(g).gauc, 7 / 12);
});

test("rank formula equals pair counting on random data with many ties", () => {
  const rng = createRng(5);
  for (let t = 0; t < 20; t++) {
    const rows: Row[] = Array.from({ length: 40 }, (_, i) => ({ id: `${i}`, group: "g", score: Math.round(rng() * 8) / 8, label: rng() < 0.3 ? 1 : 0 }));
    const p = pairCountAuc(rows);
    if (p.pairs === 0) continue;
    close(rankAuc(rows).auc, p.auc);
  }
});
