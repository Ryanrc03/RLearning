import { test } from "node:test";
import assert from "node:assert/strict";
import {
  angleBetweenDeg,
  averageOneHots,
  classifierLogit,
  clsPool,
  contentMask,
  contextIndices,
  DEMO_CLASSIFIER,
  DEMO_HIDDEN,
  fromPolar,
  meanPool,
  negativeWords,
  norm,
  oneHot,
  poolingWeights,
  SENTENCE_TOKENS,
  sigmoid,
  toDeg,
  TOKENS,
  VECTOR_A,
  vocabIndex,
  windowPairs,
} from "@/lib/ml/embeddings";
import { cosineSimilarity, dot } from "@/lib/ml/clip";

const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const closeVec = (a: number[], b: number[], eps = 1e-9) => {
  assert.equal(a.length, b.length);
  a.forEach((x, i) => close(x, b[i], eps));
};

// ---------- Word2Vec ----------

test("the notes' sentence: centre 'about' with window 2 has context we, are, to, study", () => {
  assert.deepEqual([...TOKENS], ["we", "are", "about", "to", "study", "the", "idea"]);
  const p = windowPairs(TOKENS, 2, 2);
  assert.deepEqual(p.cbow, { context: ["we", "are", "to", "study"], target: "about" });
  assert.equal(p.skipgram.length, 4);
  assert.deepEqual(p.skipgram, [
    ["about", "we"],
    ["about", "are"],
    ["about", "to"],
    ["about", "study"],
  ]);
});

test("the second example from the notes: (are, about, study, the) → to", () => {
  const p = windowPairs(TOKENS, 3, 2);
  assert.deepEqual(p.cbow, { context: ["are", "about", "study", "the"], target: "to" });
  // Skip-gram for 'study': we? no, the window is 2: about, to, the, idea.
  assert.deepEqual(windowPairs(TOKENS, 4, 2).skipgram.map(([, w]) => w), ["about", "to", "the", "idea"]);
});

test("the window shrinks at the edges of the sentence", () => {
  assert.deepEqual(windowPairs(TOKENS, 0, 2).cbow.context, ["are", "about"]);
  assert.equal(windowPairs(TOKENS, 0, 2).skipgram.length, 2);
  assert.deepEqual(windowPairs(TOKENS, 6, 2).cbow.context, ["study", "the"]);
  assert.deepEqual(windowPairs(TOKENS, 1, 2).cbow.context, ["we", "about", "to"]);
  assert.deepEqual(contextIndices(TOKENS, 5, 2), [3, 4, 6]);
  assert.throws(() => contextIndices(TOKENS, 7, 2), RangeError);
});

test("words outside the window are the negative samples", () => {
  assert.deepEqual(negativeWords(TOKENS, 2, 2), ["the", "idea"]);
  assert.deepEqual(negativeWords(TOKENS, 0, 2), ["to", "study", "the", "idea"]);
  assert.deepEqual(negativeWords(TOKENS, 3, 2), ["we", "idea"]);
});

test("averaged one-hots: 1/4 at the four context positions, summing to 1", () => {
  const idx = windowPairs(TOKENS, 2, 2).cbow.context.map((w) => vocabIndex(w));
  assert.deepEqual(idx, [0, 1, 3, 4]);
  const v = averageOneHots(idx, TOKENS.length);
  assert.equal(v.length, 7);
  closeVec(v, [0.25, 0.25, 0, 0.25, 0.25, 0, 0]);
  close(v.reduce((s, x) => s + x, 0), 1);
  // Two context words at the sentence start: 1/2 each.
  closeVec(averageOneHots([1, 2], 7), [0, 0.5, 0.5, 0, 0, 0, 0]);
  assert.throws(() => averageOneHots([], 7), RangeError);
});

test("one-hot has a single 1 and vocabIndex rejects unknown words", () => {
  assert.deepEqual(oneHot(2, 7), [0, 0, 1, 0, 0, 0, 0]);
  assert.equal(vocabIndex("Study"), 4);
  assert.throws(() => vocabIndex("banana"), RangeError);
  assert.throws(() => oneHot(7, 7), RangeError);
});

// ---------- Sentence embedding ----------

test("DEMO_HIDDEN is 6 tokens × 6 dims and clsPool returns a copy of row 0", () => {
  assert.equal(DEMO_HIDDEN.length, 6);
  assert.ok(DEMO_HIDDEN.every((row) => row.length === 6));
  const cls = clsPool(DEMO_HIDDEN);
  assert.deepEqual(cls, [0.4, 0.5, 0.0, 0.4, 0.3, -0.1]);
  cls[0] = 99;
  assert.equal(DEMO_HIDDEN[0][0], 0.4);
});

test("meanPool over all six tokens equals the hand-computed average", () => {
  closeVec(meanPool(DEMO_HIDDEN), [0.3, 0.3, 0.5 / 6, 1.6 / 6, 1.3 / 6, -0.2 / 6]);
});

test("meanPool with the content mask drops [CLS] and [SEP]", () => {
  const mask = contentMask(SENTENCE_TOKENS);
  assert.deepEqual(mask, [false, true, true, true, true, false]);
  closeVec(meanPool(DEMO_HIDDEN, mask), [0.3, 0.425, 0.05, 0.3, 0.325, -0.075]);
  assert.throws(() => meanPool(DEMO_HIDDEN, [false, false, false, false, false, false]), RangeError);
});

test("pooling weights: 1/n for kept tokens under mean, only [CLS] under cls", () => {
  closeVec(poolingWeights(6, "mean"), [1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6]);
  closeVec(poolingWeights(6, "mean", contentMask(SENTENCE_TOKENS)), [0, 0.25, 0.25, 0.25, 0.25, 0]);
  assert.deepEqual(poolingWeights(6, "cls"), [1, 0, 0, 0, 0, 0]);
  // Weighted sum with these weights reproduces meanPool.
  const w = poolingWeights(6, "mean", contentMask(SENTENCE_TOKENS));
  const viaWeights = DEMO_HIDDEN[0].map((_, j) => DEMO_HIDDEN.reduce((s, row, i) => s + w[i] * row[j], 0));
  closeVec(viaWeights, meanPool(DEMO_HIDDEN, contentMask(SENTENCE_TOKENS)));
});

test("the toy classifier head: logit = w · h + b, probability through sigmoid", () => {
  const { w, b } = DEMO_CLASSIFIER;
  close(classifierLogit(clsPool(DEMO_HIDDEN), w, b), 0.89);
  close(classifierLogit(meanPool(DEMO_HIDDEN), w, b), 0.36 + 0.24 + 0.05 + 1.6 / 6 + 0.65 / 6 - 0.08 / 6 - 0.5);
  close(classifierLogit(meanPool(DEMO_HIDDEN, contentMask(SENTENCE_TOKENS)), w, b), 0.6625);
  close(sigmoid(0), 0.5);
  assert.ok(sigmoid(0.89) > 0.7 && sigmoid(0.89) < 0.71);
});

// ---------- Cosine similarity ----------

test("cosine is 1 for parallel, 0 for orthogonal, −1 for opposite vectors", () => {
  close(cosineSimilarity([1, 0], [2, 0]), 1);
  close(cosineSimilarity([1, 0], [0, 1]), 0);
  close(cosineSimilarity([1, 0], [-3, 0]), -1);
  close(cosineSimilarity([1, 1], [2, 2]), 1);
});

test("scaling one vector leaves cosine unchanged but multiplies the dot product", () => {
  const a = [0.8, 0.4];
  const b = [0.3, 0.7];
  close(cosineSimilarity(a, b.map((x) => 3 * x)), cosineSimilarity(a, b));
  close(dot(a, b.map((x) => 3 * x)), 3 * dot(a, b));
  close(angleBetweenDeg(a, b.map((x) => 0.1 * x)), angleBetweenDeg(a, b));
});

test("angleBetweenDeg and fromPolar agree with the unit circle", () => {
  close(angleBetweenDeg([1, 0], [0, 1]), 90);
  close(angleBetweenDeg([1, 0], [1, 0]), 0);
  close(angleBetweenDeg([1, 0], [-1, 0]), 180);
  close(angleBetweenDeg([1, 0], [1, 1]), 45);
  closeVec(fromPolar(1, 90), [0, 1]);
  closeVec(fromPolar(2, 0), [2, 0]);
  closeVec(fromPolar(1, 180), [-1, 0]);
  close(norm(fromPolar(0.7, 123)), 0.7);
  close(toDeg(fromPolar(1, 250)), 250);
  close(toDeg([1, 0]), 0);
});

test("the figure's fixed vector A sits at 20° with length 0.9, so 110° is orthogonal to it", () => {
  close(norm(VECTOR_A), 0.9);
  close(toDeg(VECTOR_A), 20);
  close(angleBetweenDeg(VECTOR_A, fromPolar(1, 110)), 90);
  close(dot([...VECTOR_A], [...fromPolar(0.5, 20)]), 0.45);
});
