import { test } from "node:test";
import assert from "node:assert/strict";
import {
  carFleetBrute,
  dailyTemperaturesBrute,
  sortCars,
  traceCarFleet,
  traceDailyTemperatures,
  DAILY_TEMPS_CODE,
  CAR_FLEET_CODE,
} from "@/lib/algorithms/monotonicStack";
import { createRng } from "@/lib/ml/random";

const rng = createRng(11);
const randInt = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));

test("Daily Temperatures reproduces the LeetCode examples", () => {
  assert.deepEqual(traceDailyTemperatures([73, 74, 75, 71, 69, 72, 76, 73]).result, [1, 1, 4, 2, 1, 1, 0, 0]);
  assert.deepEqual(traceDailyTemperatures([30, 40, 50, 60]).result, [1, 1, 1, 0]);
  assert.deepEqual(traceDailyTemperatures([30, 60, 90]).result, [1, 1, 0]);
  assert.deepEqual(traceDailyTemperatures([]).result, []);
  // Equal temperatures are not "warmer": strict `<` keeps them waiting.
  assert.deepEqual(traceDailyTemperatures([30, 30, 40]).result, [2, 1, 0]);
});

test("Daily Temperatures trace matches brute force on 300 random arrays, including many ties", () => {
  for (let k = 0; k < 300; k++) {
    const n = randInt(0, 10);
    const temps = Array.from({ length: n }, () => randInt(30, 36));
    const trace = traceDailyTemperatures(temps);
    assert.deepEqual(trace.result, dailyTemperaturesBrute(temps));
    assert.deepEqual(trace.steps[trace.steps.length - 1].result, trace.result);
    assert.deepEqual(trace.steps[trace.steps.length - 1].ans, trace.result);
  }
});

test("Daily Temperatures: stack holds non-increasing temperatures, each index pushed once and popped at most once", () => {
  for (let k = 0; k < 200; k++) {
    const n = randInt(1, 10);
    const temps = Array.from({ length: n }, () => randInt(30, 36));
    const trace = traceDailyTemperatures(temps);
    let pushes = 0;
    let pops = 0;
    for (const s of trace.steps) {
      assert.ok(s.line >= 0 && s.line < DAILY_TEMPS_CODE.length);
      for (let a = 1; a < s.stack.length; a++) assert.ok(temps[s.stack[a - 1]] >= temps[s.stack[a]], "non-increasing from bottom to top (equal temps both wait)");
      if (s.kind === "push") pushes++;
      if (s.kind === "pop") pops++;
    }
    assert.equal(pushes, n);
    assert.ok(pops <= n);
    // Pops that did happen each resolved exactly one index with a positive wait.
    assert.equal(pops, (trace.result as number[]).filter((x) => x > 0).length);
  }
});

test("Car Fleet reproduces the LeetCode examples and the tie rule", () => {
  assert.equal(traceCarFleet(12, [10, 8, 0, 5, 3], [2, 4, 1, 1, 3]).result, 3);
  assert.equal(traceCarFleet(10, [3], [3]).result, 1);
  assert.equal(traceCarFleet(100, [0, 2, 4], [4, 2, 1]).result, 1);
  // Equal arrival times at target count as one fleet, so the test is `<=`, not `<`.
  assert.equal(traceCarFleet(4, [0, 2], [4, 2]).result, 1);
  // Front car arrives later than the one behind only if the one behind is faster — and then it catches up.
  assert.equal(traceCarFleet(10, [0, 5], [1, 1]).result, 2);
});

test("Car Fleet trace matches brute force on 300 random instances", () => {
  for (let k = 0; k < 300; k++) {
    const n = randInt(1, 8);
    const target = randInt(10, 30);
    const positions = new Set<number>();
    while (positions.size < n) positions.add(randInt(0, target - 1));
    const position = [...positions];
    const speed = position.map(() => randInt(1, 6));
    const trace = traceCarFleet(target, position, speed);
    assert.equal(trace.result, carFleetBrute(target, position, speed));
    const last = trace.steps[trace.steps.length - 1];
    assert.equal(last.result, trace.result);
    assert.equal(last.stack.length, trace.result);
    // Every car ends up assigned to a leader that is still on the stack, and leaders lead themselves.
    for (let i = 0; i < n; i++) {
      assert.ok(last.stack.includes(last.ans[i]));
      assert.ok(last.ans[i] <= i);
    }
    for (const leader of last.stack) assert.equal(last.ans[leader], leader);
  }
});

test("Car Fleet: arrival times on the stack are strictly increasing from bottom to top", () => {
  for (let k = 0; k < 200; k++) {
    const n = randInt(1, 8);
    const target = randInt(10, 30);
    const positions = new Set<number>();
    while (positions.size < n) positions.add(randInt(0, target - 1));
    const position = [...positions];
    const speed = position.map(() => randInt(1, 6));
    const cars = sortCars(target, position, speed);
    const trace = traceCarFleet(target, position, speed);
    for (const s of trace.steps) {
      assert.ok(s.line >= 0 && s.line < CAR_FLEET_CODE.length);
      // Right after a push, and while that push is being tested, the new top may violate the invariant; check below it.
      const settled = s.kind === "push" || s.kind === "test" ? s.stack.slice(0, -1) : s.stack;
      for (let a = 1; a < settled.length; a++) assert.ok(cars[settled[a - 1]].time < cars[settled[a]].time, "strictly increasing times");
    }
  }
});
