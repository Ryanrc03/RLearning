import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ceilDiv,
  firstTrue,
  lastTrue,
  lowerBound,
  minEatingSpeedBrute,
  traceBrokenLessThan,
  traceExactMatch,
  traceKoko,
  traceLowerBound,
} from "@/lib/algorithms/binarySearch";
import { createRng } from "@/lib/ml/random";

const rng = createRng(7);
const randomSorted = () => {
  const n = Math.floor(rng() * 9);
  return Array.from({ length: n }, () => Math.floor(rng() * 20)).sort((a, b) => a - b);
};

test("exact match (l <= r) finds an index of target or returns -1, on 300 random arrays", () => {
  for (let i = 0; i < 300; i++) {
    const nums = randomSorted();
    const target = Math.floor(rng() * 22) - 1;
    const { result, steps } = traceExactMatch(nums, target);
    if (nums.includes(target)) assert.equal(nums[result], target);
    else assert.equal(result, -1);
    assert.equal(steps[steps.length - 1].result, result);
    for (const s of steps) if (s.mid !== undefined) assert.ok(s.mid >= 0 && s.mid < nums.length, "mid in bounds");
  }
});

test("lower bound (l < r) returns the first index with nums[i] >= target, including len(nums)", () => {
  for (let i = 0; i < 300; i++) {
    const nums = randomSorted();
    const target = Math.floor(rng() * 22) - 1;
    const { result, steps } = traceLowerBound(nums, target);
    assert.equal(result, lowerBound(nums, target));
    for (const s of steps) if (s.mid !== undefined) assert.ok(s.mid < nums.length, "mid never reads nums[len]");
  }
  assert.equal(traceLowerBound([], 2).result, 0);
  assert.equal(traceLowerBound([1, 3, 5], 6).result, 3);
  assert.equal(traceLowerBound([1, 3, 5], 3).result, 1);
  assert.equal(traceLowerBound([1, 3, 5], 0).result, 0);
});

test("changing `<=` to `<` without changing the bounds skips the last candidate", () => {
  // The handoff's showcase failure: [1,3,5] target 6 should insert at 3 but exits with l = 2.
  const broken = traceBrokenLessThan([1, 3, 5], 6);
  assert.equal(broken.result, 2);
  assert.notEqual(broken.result, lowerBound([1, 3, 5], 6));
  // The same wrong loop happens to be right on other presets, which is why the bug hides.
  assert.equal(traceBrokenLessThan([1, 3, 5], 3).result, 1);
  assert.equal(traceBrokenLessThan([1, 3, 5], 0).result, 0);
  assert.equal(traceBrokenLessThan([], 2).result, 0);
  // It is wrong whenever the target is larger than every element of a non-empty array.
  for (let i = 0; i < 100; i++) {
    const nums = randomSorted();
    if (!nums.length) continue;
    const target = nums[nums.length - 1] + 1;
    assert.notEqual(traceBrokenLessThan(nums, target).result, nums.length);
  }
});

test("every step points at a real code line and pointers only move inward", () => {
  for (const trace of [traceExactMatch([1, 3, 5, 7, 9], 7), traceLowerBound([1, 3, 5], 6), traceBrokenLessThan([1, 3, 5], 6)]) {
    let prev = trace.steps[0];
    for (const s of trace.steps) {
      assert.ok(s.line >= 0 && s.line < trace.code.length);
      assert.ok(s.l >= prev.l && s.r <= prev.r, "interval shrinks monotonically");
      prev = s;
    }
  }
});

test("ceilDiv matches Math.ceil for positive integers", () => {
  for (let a = 1; a <= 40; a++) for (let b = 1; b <= 12; b++) assert.equal(ceilDiv(a, b), Math.ceil(a / b));
  assert.equal(ceilDiv(10, 3), 4);
  assert.equal(ceilDiv(9, 3), 3);
});

test("Koko trace for piles [3,6,7,11], h=8 reproduces the handoff's dry run exactly", () => {
  const trace = traceKoko([3, 6, 7, 11], 8);
  const probes = trace.steps.filter((s) => s.kind === "feasible").map((s) => ({ l: s.l, r: s.r, mid: s.mid, total: s.total, feasible: s.feasible }));
  assert.deepEqual(probes, [
    { l: 1, r: 11, mid: 6, total: 6, feasible: true },
    { l: 1, r: 6, mid: 3, total: 10, feasible: false },
    { l: 4, r: 6, mid: 5, total: 8, feasible: true },
    { l: 4, r: 5, mid: 4, total: 8, feasible: true },
  ]);
  const moves = trace.steps.filter((s) => s.kind === "right" || s.kind === "left").map((s) => [s.kind, s.l, s.r]);
  assert.deepEqual(moves, [["right", 1, 6], ["left", 4, 6], ["right", 4, 5], ["right", 4, 4]]);
  assert.equal(trace.result, 4);
  const last = trace.steps[trace.steps.length - 1];
  assert.equal(last.result, 4);
  // Excluded ranges tile [1, 11] minus the answer, with no overlaps.
  const covered = new Set<number>();
  for (const e of last.excluded) for (let k = e.from; k <= e.to; k++) { assert.ok(!covered.has(k)); covered.add(k); }
  assert.deepEqual([...covered].sort((a, b) => a - b), [1, 2, 3, 5, 6, 7, 8, 9, 10, 11]);
});

test("Koko trace matches brute force on random instances with h >= len(piles)", () => {
  for (let i = 0; i < 200; i++) {
    const n = 1 + Math.floor(rng() * 6);
    const piles = Array.from({ length: n }, () => 1 + Math.floor(rng() * 30));
    const h = n + Math.floor(rng() * 20);
    assert.equal(traceKoko(piles, h).result, minEatingSpeedBrute(piles, h));
  }
  assert.equal(traceKoko([30, 11, 23, 4, 20], 5).result, 30);
  assert.equal(traceKoko([30, 11, 23, 4, 20], 6).result, 23);
});

test("firstTrue / lastTrue templates terminate and agree with linear scans", () => {
  for (let i = 0; i < 200; i++) {
    const lo = Math.floor(rng() * 5);
    const hi = lo + Math.floor(rng() * 30);
    const cut = lo + Math.floor(rng() * (hi - lo + 1));
    assert.equal(firstTrue(lo, hi, (x) => x >= cut), cut);
    assert.equal(lastTrue(lo, hi, (x) => x <= cut), cut);
  }
  // The rounding-up midpoint is what keeps lastTrue moving when l + 1 == r.
  assert.equal(lastTrue(4, 5, (x) => x <= 5), 5);
});
