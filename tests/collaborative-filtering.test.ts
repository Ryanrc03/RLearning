import assert from "node:assert/strict";
import { test } from "node:test";
import { cosine, INTERACTIONS, itemVector, popularityWeight, retrieveToy, scorePaths } from "@/lib/ml/collaborativeFiltering";

const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-10);

test("row and column cosine count common interactions and handle empty vectors", () => {
  const items = cosine(itemVector(INTERACTIONS, 0), itemVector(INTERACTIONS, 2));
  assert.deepEqual(items.shared, [false, true, true, false, false]);
  close(items.value, 2 / 3);
  close(cosine(INTERACTIONS[0], INTERACTIONS[1]).value, 2 / Math.sqrt(6));
  assert.equal(cosine([0, 0], [1, 0]).value, 0);
});

test("both lookup sequences merge shared candidates, filter history and honor limits", () => {
  const item = retrieveToy("item", 200, 10, 100);
  const user = retrieveToy("user", 200, 10, 100);
  for (const result of [item, user]) assert.deepEqual(result.selected.map(({ item }) => item), [2, 3]);
  close(item.selected[0].score, 1);
  close(item.selected[1].score, 1 / Math.sqrt(6));
  close(user.selected[0].score, 2 / Math.sqrt(6) + 0.5);
  close(user.selected[1].score, 0.5);
  for (const mode of ["item", "user"] as const) {
    const bounded = retrieveToy(mode, 2, 2, 1);
    assert.ok(bounded.paths.length <= 4);
    assert.ok(bounded.selected.length <= 1);
  }
});

test("weighted contributions and popularity penalty reproduce the teaching cases", () => {
  close(scorePaths([2, 1, 4, 3].map((like, i) => ({ like, similarity: [0.1, 0.4, 0.2, 0.6][i] }))), 3.2);
  close(scorePaths([0, 1, 3, 0].map((like, i) => ({ like, similarity: [0.9, 0.7, 0.7, 0.4][i] }))), 2.8);
  assert.ok(popularityWeight(3) > popularityWeight(100));
});
