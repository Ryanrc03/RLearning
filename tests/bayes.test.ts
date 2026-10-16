import { test } from "node:test";
import assert from "node:assert/strict";
import { likelihood, posterior, prior, TABLE, TOTAL_DOCS, WORDS } from "@/lib/ml/bayes";

const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("the notes' table: 12 emails, 8 正常 and 4 垃圾, word totals 17 and 7", () => {
  assert.equal(TABLE.ham.docs + TABLE.spam.docs, TOTAL_DOCS);
  assert.equal(WORDS.reduce((s, w) => s + TABLE.ham.counts[w], 0), TABLE.ham.total);
  assert.equal(WORDS.reduce((s, w) => s + TABLE.spam.counts[w], 0), TABLE.spam.total);
  assert.deepEqual(prior("ham"), { num: 8, den: 12, value: 8 / 12 });
  assert.deepEqual(prior("spam"), { num: 4, den: 12, value: 4 / 12 });
  assert.deepEqual(likelihood("Dear", "ham"), { num: 8, den: 17, value: 8 / 17 });
  assert.deepEqual(likelihood("Money", "spam"), { num: 4, den: 7, value: 4 / 7 });
});

// 8/12 × 8/17 × 5/17 = 320/3468 ≈ 0.0923 (the handwritten 0.33 is a slip; the
// design doc's 0.115 is too), 4/12 × 2/7 × 1/7 = 8/588 ≈ 0.0136. 正常 wins either way.
test("\"Dear Friend\": 正常 0.0923 beats 垃圾 0.0136", () => {
  const r = posterior(["Dear", "Friend"]);
  close(r.ham.product, 320 / 3468, 1e-9);
  close(r.ham.product, 0.0923, 0.001);
  close(r.spam.product, 0.0136, 0.001);
  assert.equal(r.winner, "ham");
  close(r.ham.prob + r.spam.prob, 1);
  assert.ok(r.ham.prob > 0.87 && r.ham.prob < 0.88, `${r.ham.prob}`);
  assert.equal(r.ham.terms.length, 3);
  assert.equal(r.ham.terms[0].label, "P(正常)");
});

test("no words: the posterior is just the prior", () => {
  const r = posterior([]);
  close(r.ham.product, 8 / 12);
  close(r.spam.product, 4 / 12);
  close(r.ham.prob, 2 / 3);
});

test("Lunch never appears in 垃圾, so any email with Lunch gets 垃圾 exactly 0", () => {
  assert.equal(likelihood("Lunch", "spam").value, 0);
  const r = posterior(["Lunch", "Money", "Money"]);
  assert.equal(r.spam.product, 0);
  assert.equal(r.spam.prob, 0);
  assert.equal(r.ham.prob, 1);
  assert.equal(r.winner, "ham");
});

test("Laplace smoothing: +1 to every count, 垃圾 Lunch becomes 1/11 and 正常 Dear 9/21", () => {
  assert.deepEqual(likelihood("Lunch", "spam", true), { num: 1, den: 11, value: 1 / 11 });
  assert.deepEqual(likelihood("Dear", "ham", true), { num: 9, den: 21, value: 9 / 21 });
  const r = posterior(["Lunch", "Money"], true);
  assert.ok(r.spam.product > 0);
  close(r.spam.product, (4 / 12) * (1 / 11) * (5 / 11), 1e-9);
  // Likelihoods of one class still sum to 1 after smoothing.
  close(WORDS.reduce((s, w) => s + likelihood(w, "spam", true).value, 0), 1);
});
