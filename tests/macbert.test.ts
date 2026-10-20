import { test } from "node:test";
import assert from "node:assert/strict";
import { corrupt, DEMO_WORDS, MASK, stats, type MaskStrategy } from "@/lib/ml/macbert";

const SENTENCE = DEMO_WORDS.join("");
const show = (s: MaskStrategy) => corrupt(s).map((t) => (t.input === MASK ? "M" : t.input)).join("");

test("every strategy keeps one token per character and the targets spell the original sentence", () => {
  for (const s of ["bert", "wwm", "ngram", "macbert"] as const) {
    const toks = corrupt(s);
    assert.equal(toks.length, SENTENCE.length);
    assert.equal(toks.map((t) => t.target).join(""), SENTENCE);
  }
});

test("the four corruptions follow the example in Table 1 of the MacBERT paper", () => {
  assert.equal(show("bert"), "使用语言M型来M测下一个词的概率");
  assert.equal(show("wwm"), "使用语言MM来MM下一个词的概率");
  assert.equal(show("ngram"), "使用MMMM来MM下一个词的概率");
  assert.equal(show("macbert"), "使用语法建模来预见下一个词的几率");
});

test("BERT splits words; whole-word strategies never do", () => {
  assert.equal(stats(corrupt("bert")).partialWords, 2);
  for (const s of ["wwm", "ngram", "macbert"] as const) assert.equal(stats(corrupt(s)).partialWords, 0);
});

test("only MacBERT's input is free of [MASK]", () => {
  assert.equal(stats(corrupt("bert")).maskTokens, 2);
  assert.equal(stats(corrupt("wwm")).maskTokens, 4);
  assert.equal(stats(corrupt("ngram")).maskTokens, 6);
  const mac = stats(corrupt("macbert"));
  assert.equal(mac.maskTokens, 0);
  assert.equal(mac.predicted, 8);
  assert.equal(mac.wordsTouched, 4);
});

test("a swapped position keeps a real character in the input but still asks for the original", () => {
  const swapped = corrupt("macbert").filter((t) => t.kind === "swap");
  assert.ok(swapped.every((t) => t.input !== MASK));
  assert.ok(swapped.some((t) => t.input !== t.target));
});
