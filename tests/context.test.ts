import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL_LAYERS, assemblePrompt, BUDGETS, estimateTokens, fillBudget, NO_LAYERS, SEGMENTS, whatToCut } from "@/lib/ml/context";

// ---------- Page 1: prompt assembly ----------

test("block order is role → few-shot → task → CoT → constraints", () => {
  const { blocks, text } = assemblePrompt(ALL_LAYERS);
  assert.deepEqual(
    blocks.map((b) => b.key),
    ["role", "fewShot", "task", "cot", "constraints"],
  );
  assert.equal(text, blocks.map((b) => b.text).join("\n\n"));
});

test("the task block is always present, even with every layer off", () => {
  const { blocks } = assemblePrompt(NO_LAYERS);
  assert.deepEqual(blocks.map((b) => b.key), ["task"]);
  const { blocks: some } = assemblePrompt({ ...NO_LAYERS, cot: true, role: true });
  assert.deepEqual(some.map((b) => b.key), ["role", "task", "cot"]);
});

test("estimateTokens counts CJK characters and Latin words", () => {
  assert.equal(estimateTokens("hello 世界"), 3);
  assert.equal(estimateTokens("标签：正面。"), 6);
  assert.equal(estimateTokens("8848 米"), 2);
  assert.equal(estimateTokens("a / b, c."), 3);
  assert.equal(estimateTokens(""), 0);
});

test("the token estimate grows monotonically as layers are added", () => {
  const steps = [
    NO_LAYERS,
    { ...NO_LAYERS, role: true },
    { ...NO_LAYERS, role: true, fewShot: true },
    { ...NO_LAYERS, role: true, fewShot: true, cot: true },
    ALL_LAYERS,
  ];
  const counts = steps.map((l) => estimateTokens(assemblePrompt(l).text));
  for (let i = 1; i < counts.length; i++) {
    assert.ok(counts[i] > counts[i - 1], `${counts[i]} should exceed ${counts[i - 1]}`);
  }
  assert.ok(counts[0] > 0);
});

// ---------- Page 2: the context budget ----------

const all = Object.fromEntries(SEGMENTS.map((s) => [s.key, true]));

test("fillBudget sums the enabled segments and reports a running total", () => {
  const total = SEGMENTS.reduce((s, x) => s + x.tokens, 0);
  const r = fillBudget(SEGMENTS, all, 128000);
  assert.equal(r.used, total);
  assert.equal(r.rows.length, SEGMENTS.length);
  assert.equal(r.rows[r.rows.length - 1].cumulative, total);
  let acc = 0;
  for (const row of r.rows) {
    acc += row.tokens;
    assert.equal(row.cumulative, acc);
    assert.equal(row.fits, true);
  }
  assert.equal(r.overflow, false);
  assert.equal(r.excess, 0);
});

test("the overflow flag flips exactly at the budget", () => {
  const total = SEGMENTS.reduce((s, x) => s + x.tokens, 0);
  const exact = fillBudget(SEGMENTS, all, total);
  assert.equal(exact.overflow, false);
  assert.equal(exact.excess, 0);
  const tight = fillBudget(SEGMENTS, all, total - 1);
  assert.equal(tight.overflow, true);
  assert.equal(tight.excess, 1);
  assert.equal(tight.rows[tight.rows.length - 1].fits, false);
});

test("the demo overflows the 8k window but fits the larger ones", () => {
  assert.equal(fillBudget(SEGMENTS, all, BUDGETS[0]).overflow, true);
  assert.equal(fillBudget(SEGMENTS, all, BUDGETS[1]).overflow, false);
  assert.equal(fillBudget(SEGMENTS, all, BUDGETS[2]).overflow, false);
});

test("disabling a segment removes its tokens and leaves later rows' totals lower", () => {
  const rag = SEGMENTS.find((s) => s.key === "rag")!;
  const withRag = fillBudget(SEGMENTS, all, 8000);
  const withoutRag = fillBudget(SEGMENTS, { ...all, rag: false }, 8000);
  assert.equal(withoutRag.used, withRag.used - rag.tokens);
  const row = withoutRag.rows.find((r) => r.key === "rag")!;
  assert.equal(row.enabled, false);
  const user = withoutRag.rows.find((r) => r.key === "user")!;
  assert.equal(user.cumulative, withoutRag.used);
});

test("whatToCut names the biggest compressible segment and how small it must get", () => {
  const r = fillBudget(SEGMENTS, all, 8000);
  const cut = whatToCut(r)!;
  assert.equal(cut.key, "rag");
  assert.equal(cut.keep, cut.tokens - r.excess);
  assert.equal(whatToCut(fillBudget(SEGMENTS, all, 128000)), null);
  // Only incompressible segments left: nothing to suggest.
  const onlyFixed = Object.fromEntries(SEGMENTS.map((s) => [s.key, !s.compressible]));
  assert.equal(whatToCut(fillBudget(SEGMENTS, onlyFixed, 10)), null);
});
