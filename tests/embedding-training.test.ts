import { test } from "node:test";
import assert from "node:assert/strict";
import { createEmbeddingExample, embeddingForward, embeddingGradients, embeddingUpdate, firstAdamStep } from "@/lib/ml/embeddingTraining";

const close = (a: number, b: number, eps = 1e-8) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test("initialization is deterministic, 4×2, and is not the trained checkpoint", () => {
  const a = createEmbeddingExample();
  assert.deepEqual(a, createEmbeddingExample());
  assert.notDeepEqual(a.embeddings, createEmbeddingExample(17).embeddings);
  assert.equal(a.embeddings.length, 4);
  assert.ok(a.embeddings.every(row => row.length === 2 && row.every(Number.isFinite)));
});

test("lookup concatenates exactly the selected row with the dense input; sigmoid and BCE agree", () => {
  const model = createEmbeddingExample();
  model.embeddings[model.selected] = [0.2, -0.1];
  model.weights = [0.4, -0.3, 0.2]; model.bias = 0.1;
  const f = embeddingForward(model);
  assert.deepEqual(f.x, [0.2, -0.1, model.dense]);
  close(f.logit, 0.2 * 0.4 + -0.1 * -0.3 + model.dense * 0.2 + 0.1);
  close(f.probability, 1 / (1 + Math.exp(-f.logit)));
  close(f.loss, -Math.log(f.probability));
});

test("all embedding, head and bias gradients match central finite differences", () => {
  const model = createEmbeddingExample(); const g = embeddingGradients(model); const h = 1e-5;
  function numeric(perturb: (m: typeof model, delta: number) => void) {
    const a = structuredClone(model); const b = structuredClone(model);
    perturb(a, h); perturb(b, -h);
    return (embeddingForward(a).loss - embeddingForward(b).loss) / (2 * h);
  }
  model.embeddings.forEach((row, i) => row.forEach((_, j) => close(g.embeddings[i][j], numeric((m, d) => { m.embeddings[i][j] += d; }))));
  model.weights.forEach((_, i) => close(g.weights[i], numeric((m, d) => { m.weights[i] += d; })));
  close(g.bias, numeric((m, d) => { m.bias += d; }));
});

test("first Adam step uses bias-corrected moments, including a zero gradient", () => {
  const a = firstAdamStep(0.2, -0.3);
  close(a.m, -0.03); close(a.v, 0.00009); close(a.mHat, -0.3); close(a.vHat, 0.09);
  close(a.after, 0.2 + 0.01 * 0.3 / (0.3 + 1e-8));
  close(firstAdamStep(0.2, 0).after, 0.2);
});

test("one joint update reduces loss, leaves untouched rows unchanged and does not mutate input", () => {
  const model = createEmbeddingExample(); const original = structuredClone(model);
  const next = embeddingUpdate(model);
  assert.deepEqual(model, original);
  model.embeddings.forEach((row, i) => {
    if (i !== model.selected) assert.deepEqual(next.embeddings[i], row);
    else assert.notDeepEqual(next.embeddings[i], row);
  });
  assert.notDeepEqual(next.weights, model.weights);
  assert.ok(embeddingForward(next).loss < embeddingForward(model).loss);
});
