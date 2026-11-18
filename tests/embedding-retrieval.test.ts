import assert from "node:assert/strict";
import { test } from "node:test";
import { dot, exactTopK, INITIAL_EMBEDDINGS, metricScore, normalize, OBSERVATIONS, observedMse, partitionSearch, sgdStep } from "@/lib/ml/embeddingRetrieval";

const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-10);

test("observations include the explicit zero and exclude missing cells", () => {
  assert.equal(OBSERVATIONS.length, 6);
  assert.ok(OBSERVATIONS.some(({ user, item, label }) => user === 0 && item === 1 && label === 0));
  assert.ok(!OBSERVATIONS.some(({ user, item }) => user === 0 && item === 2));
  close(dot(INITIAL_EMBEDDINGS.users[0], INITIAL_EMBEDDINGS.items[0]), 0.9);
});

test("SGD updates both selected embeddings from their original values", () => {
  const step = sgdStep(INITIAL_EMBEDDINGS, { user: 2, item: 1, label: 2 });
  close(step.before, 0.6);
  close(step.after, 0.82736);
  assert.equal(step.model.users[0], INITIAL_EMBEDDINGS.users[0]);
  assert.equal(step.model.items[2], INITIAL_EMBEDDINGS.items[2]);
  let model = INITIAL_EMBEDDINGS;
  for (let i = 0; i < 120; i++) for (const sample of OBSERVATIONS) model = sgdStep(model, sample).model;
  assert.ok(observedMse(model) < 1e-5);
});

test("Top-K uses only eligible unknown cells and metric changes can reorder items", () => {
  assert.deepEqual(exactTopK(INITIAL_EMBEDDINGS, 0, 2).map(({ item }) => item), [2, 3]);
  assert.deepEqual(exactTopK(INITIAL_EMBEDDINGS, 0, 2, (item) => item !== 2).map(({ item }) => item), [3]);
  close(metricScore([1, 0], [0.8, 0.6], "l2")!, Math.sqrt(0.4));
  close(metricScore([1, 0], [2, 0], "ip")!, 2);
  close(metricScore([1, 0], normalize([2, 0]), "cosine")!, 1);
  assert.equal(metricScore([0, 0], [2, 0], "cosine"), null);
});

test("partition budget changes visited points and exhaustive ANN matches Exact Top-K", () => {
  const limited = partitionSearch([1, 0.55], 1);
  assert.equal(limited.visited.length, 6);
  assert.ok(limited.recall < 1);
  assert.equal(limited.recall, limited.approximate.filter((item) => limited.exact.includes(item)).length / 5);
  const all = partitionSearch([1, 0.55], 4);
  assert.equal(all.visited.length, 24);
  assert.equal(all.recall, 1);
  assert.deepEqual(all.approximate, all.exact);
});
