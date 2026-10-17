import { test } from "node:test";
import assert from "node:assert/strict";
import { DEMO_K, DEMO_LIBRARY_TOTAL, DEMO_RELEVANT_RANKS, demoFlags, hitAtK, hitRate, hitsInTopK, LIBRARY_TOTALS, MEASURED, precisionAtK, recallAtK } from "@/lib/ml/retrieval";

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("P@30 with 6 relevant of 30 = 0.2", () => {
  const flags = demoFlags();
  assert.equal(flags.length, DEMO_K);
  assert.equal(hitsInTopK(flags, 30), 6);
  close(precisionAtK(flags, 30), 0.2);
  // Only the first k ranks count: the 6th hit sits at rank 25, so P@20 sees 5 of 20.
  close(precisionAtK(flags, 20), 5 / 20);
  // A list shorter than k counts the missing ranks as misses.
  close(precisionAtK([true, true], 4), 0.5);
  assert.throws(() => precisionAtK(flags, 0));
});

test("Recall@30 with 6 of 10 relevant in the library = 0.6", () => {
  const flags = demoFlags();
  close(recallAtK(flags, 30, DEMO_LIBRARY_TOTAL), 0.6);
  close(recallAtK(flags, 30, 20), 0.3);
  close(recallAtK(flags, 30, 6), 1);
  assert.throws(() => recallAtK(flags, 30, 5), /only 5 relevant/);
  assert.throws(() => recallAtK(flags, 30, 0));
});

test("hit@30 is true iff any of the first 30 is relevant", () => {
  const none = Array<boolean>(30).fill(false);
  assert.equal(hitAtK(none, 30), false);
  assert.equal(hitAtK(demoFlags(), 30), true);
  const lastOnly = [...none];
  lastOnly[29] = true;
  assert.equal(hitAtK(lastOnly, 30), true);
  assert.equal(hitAtK(lastOnly, 29), false);
  // The project's "P@30" is a hit rate over queries: 3 of 4 queries find something in their top 30.
  close(hitRate([demoFlags(), none, lastOnly, [true]], 30), 0.75);
});

test("P@1 looks only at rank 1", () => {
  const flags = demoFlags();
  assert.equal(DEMO_RELEVANT_RANKS[0], 1);
  close(precisionAtK(flags, 1), 1);
  const moved = [...flags];
  moved[0] = false;
  moved[1] = true;
  close(precisionAtK(moved, 1), 0);
  close(precisionAtK(moved, 30), 0.2);
  assert.equal(hitAtK(moved, 1), false);
});

test("presets and measured numbers are the ones from the notes", () => {
  assert.deepEqual([...LIBRARY_TOTALS], [5, 10, 20]);
  assert.ok((LIBRARY_TOTALS as readonly number[]).includes(DEMO_LIBRARY_TOTAL));
  const byKey = Object.fromEntries(MEASURED.map((m) => [m.key, m.value]));
  assert.deepEqual(byKey, { exact: 0.23, semantic: 0.9344, group: 0.8287 });
  assert.ok(MEASURED.every((m) => m.value >= 0 && m.value <= 1 && m.gloss.length > 0));
});
