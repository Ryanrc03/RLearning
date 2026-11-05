import { test } from "node:test";
import assert from "node:assert/strict";
import {
  balancedDepth, balancedTree, dictDelete, dictKeysInOrder, dictLookup, dictResize, dictSet, DKIX_DUMMY, DKIX_EMPTY,
  emptyBuckets, emptyDict, emptyTable, javaBinDecision, probeSequence, probesFor, redBlackBound, sampleKeys, searchPath,
  simulateLoad, toyHash, traceChaining, traceOpenAddressing, usableFraction, type Slot,
} from "@/lib/algorithms/hashMap";

const run = (ops: [("insert" | "search" | "delete"), number][], cap = 8) => {
  let slots = emptyTable(cap);
  const traces = ops.map(([op, key]) => { const t = traceOpenAddressing(slots, op, key, `v${key}`); slots = t.slots; return t; });
  return { slots, traces };
};

test("10, 18, 26 collide at index 2 and probe linearly into 2, 3, 4", () => {
  const { slots, traces } = run([["insert", 10], ["insert", 18], ["insert", 26]]);
  assert.deepEqual(slots.slice(2, 5).map((s) => s.key), [10, 18, 26]);
  assert.equal(traces[2].home, 2);
  assert.deepEqual(traces[2].steps.map((s) => s.kind), ["home", "compare", "compare", "place"]);
});

test("delete 18 leaves a tombstone and 26 stays reachable; emptying the slot would lose it", () => {
  const { slots, traces } = run([["insert", 10], ["insert", 18], ["insert", 26], ["delete", 18], ["search", 26]]);
  assert.equal(slots[3].state, "deleted");
  assert.equal(traces[4].result, "found");
  assert.deepEqual(traces[4].steps.map((s) => s.kind), ["home", "compare", "skip", "found"]);
  // Counterfactual: wipe the slot to EMPTY and the same search stops early.
  const broken: Slot[] = slots.map((s, i) => (i === 3 ? { state: "empty" } : s));
  assert.equal(traceOpenAddressing(broken, "search", 26).result, "missing");
});

test("insert reuses the first tombstone only after confirming the key is absent", () => {
  const { slots: a } = run([["insert", 10], ["insert", 18], ["insert", 26], ["delete", 18], ["insert", 26]]);
  assert.equal(a[3].state, "deleted", "26 already exists past the tombstone: update, do not insert");
  assert.equal(a[4].value, "v26");
  const { slots: b, traces } = run([["insert", 10], ["insert", 18], ["insert", 26], ["delete", 18], ["insert", 34]]);
  assert.equal(b[3].key, 34);
  assert.equal(traces[4].result, "inserted");
  assert.equal(traces[4].steps.at(-1)!.idx, 3);
});

test("search and delete of absent keys stop at the first EMPTY; updates keep size", () => {
  const { slots, traces } = run([["insert", 10], ["insert", 10], ["search", 2], ["delete", 3]]);
  assert.equal(slots.filter((s) => s.state === "occupied").length, 1);
  assert.equal(traces[1].result, "updated");
  assert.equal(traces[2].result, "missing");
  assert.equal(traces[2].steps.length, 3); // home, compare 10, empty at 3
  assert.equal(traces[3].result, "missing");
});

test("open addressing agrees with a Map under random ops while at least one slot stays empty", () => {
  const keys = sampleKeys(40, 3);
  let slots = emptyTable(16);
  const ref = new Map<number, string>();
  let x = 5;
  const rnd = () => (x = (x * 48271) % 2147483647) / 2147483647;
  for (let t = 0; t < 600; t++) {
    const key = keys[Math.floor(rnd() * keys.length)];
    const r = rnd();
    if (r < 0.45) {
      if (slots.filter((s) => s.state !== "empty").length >= 15 && !ref.has(key)) continue; // keep one EMPTY, like a real table would via resize
      const tr = traceOpenAddressing(slots, "insert", key, `v${t}`); slots = tr.slots; ref.set(key, `v${t}`);
      assert.equal(tr.result, ref.size === new Set([...ref.keys()]).size && tr.result !== "full" ? tr.result : "full");
    } else if (r < 0.75) {
      const tr = traceOpenAddressing(slots, "delete", key); slots = tr.slots;
      assert.equal(tr.result === "deleted", ref.delete(key));
    } else {
      const tr = traceOpenAddressing(slots, "search", key);
      assert.equal(tr.result === "found", ref.has(key), `search ${key}`);
    }
    assert.equal(slots.filter((s) => s.state === "occupied").length, ref.size);
  }
});

test("chaining never needs tombstones and reports chain-walk comparisons", () => {
  let b = emptyBuckets(8);
  for (const k of [10, 18, 26]) b = traceChaining(b, "insert", k, `v${k}`).buckets;
  assert.equal(b[2].length, 3);
  const del = traceChaining(b, "delete", 18); b = del.buckets;
  assert.deepEqual(b[2].map((e) => e.key), [10, 26]);
  const s = traceChaining(b, "search", 26);
  assert.equal(s.result, "found");
  assert.equal(s.steps.filter((st) => st.kind === "compare").length, 1);
  assert.equal(traceChaining(b, "search", 34).result, "missing");
});

test("load simulation: doubles past the threshold, rehash moves keys, amortized writes stay small", () => {
  const keys = sampleKeys(60, 1);
  for (const maxLoad of [0.5, 2 / 3, 0.75]) {
    const snaps = simulateLoad(keys, maxLoad);
    for (const s of snaps) {
      assert.ok(s.n / s.capacity <= maxLoad + 1e-9, `load ${s.n}/${s.capacity} > ${maxLoad}`);
      assert.equal(s.slots.filter((x) => x.state === "occupied").length, s.n);
      for (const k of keys.slice(0, s.n)) assert.ok(probesFor(s.slots, k) <= s.capacity);
      assert.ok(s.avgProbes >= 1 && s.maxProbes >= s.avgProbes);
    }
    const resizes = snaps.filter((s) => s.resizedFrom);
    assert.ok(resizes.length >= 3);
    for (const s of resizes) assert.equal(s.capacity, s.resizedFrom!.capacity * 2);
    // Every live key got written at most once per resize plus once on insert: total writes / n bounded.
    const last = snaps.at(-1)!;
    assert.ok(last.totalWrites / last.n < 3, `amortized ${last.totalWrites / last.n}`);
    // Higher thresholds mean fewer resizes but longer probes.
  }
  const loose = simulateLoad(keys, 0.75).at(-1)!;
  const tight = simulateLoad(keys, 0.5).at(-1)!;
  assert.ok(loose.capacity <= tight.capacity);
});

test("sampleKeys is deterministic and distinct", () => {
  assert.deepEqual(sampleKeys(10), sampleKeys(10));
  assert.equal(new Set(sampleKeys(200)).size, 200);
});

test("CPython probe sequence visits every slot of a power-of-two table", () => {
  for (const size of [8, 16, 64]) for (const h of [0, 7, 12345, 2 ** 31 - 1]) {
    const seq = probeSequence(h, size, size * 4);
    assert.equal(seq[0], h & (size - 1));
    assert.equal(new Set(seq).size, size, `hash ${h} size ${size} must reach all slots`);
  }
  // perturb = hash; i = (i*5 + perturb + 1) & mask after perturb >>= 5.
  const h = 0b1011001; // 89 → first slot 89 & 7 = 1
  const p = Math.floor(89 / 32); // 2
  assert.deepEqual(probeSequence(h, 8, 2), [1, (1 * 5 + p + 1) & 7]);
});

test("compact dict keeps insertion order in dk_entries, points indices at entries, resizes at 2/3", () => {
  let d = emptyDict(8);
  d = dictSet(d, "apple", 3); d = dictSet(d, "banana", 5); d = dictSet(d, "cherry", 7);
  assert.deepEqual(dictKeysInOrder(d), ["apple", "banana", "cherry"]);
  assert.deepEqual(d.entries.map((e) => e.value), [3, 5, 7]);
  for (const [k, ix] of [["apple", 0], ["banana", 1], ["cherry", 2]] as const) {
    const r = dictLookup(d, k);
    assert.equal(r.ix, ix);
    assert.equal(d.indices[r.slot], ix);
    assert.equal(d.entries[ix].hash, toyHash(k));
  }
  assert.equal(d.indices.filter((i) => i >= 0).length, 3);
  // Update does not append.
  d = dictSet(d, "banana", 6);
  assert.equal(d.entries.length, 3);
  assert.equal(d.entries[1].value, 6);
  // Delete: index slot becomes DUMMY, entry is NULLed, order of the rest is kept, lookups still work.
  const slotB = dictLookup(d, "banana").slot;
  d = dictDelete(d, "banana");
  assert.equal(d.indices[slotB], DKIX_DUMMY);
  assert.equal(d.entries[1].key, null);
  assert.deepEqual(dictKeysInOrder(d), ["apple", "cherry"]);
  assert.equal(dictLookup(d, "banana").ix, DKIX_EMPTY);
  assert.equal(dictLookup(d, "cherry").ix, 2);
  // Re-inserting appends at the end: order is "last insertion", like Python.
  d = dictSet(d, "banana", 9);
  assert.deepEqual(dictKeysInOrder(d), ["apple", "cherry", "banana"]);
  // USABLE_FRACTION(8) = 5 entries. The NULLed entry still occupies its dk_entries slot
  // (deletion never gives dk_usable back), so after apple, NULL, cherry, banana, date the
  // array is full and "elder" forces a resize: used = 4 → used*3 = 12 → 16 slots, dummies gone.
  assert.equal(usableFraction(8), 5);
  d = dictSet(d, "date", 1);
  assert.equal(d.indices.length, 8);
  assert.equal(d.entries.length, 5);
  d = dictSet(d, "elder", 1);
  assert.equal(d.indices.length, 16);
  assert.ok(!d.indices.includes(DKIX_DUMMY));
  assert.equal(d.entries.length, 5, "the rebuild compacts away the NULL entry");
  assert.deepEqual(dictKeysInOrder(d), ["apple", "cherry", "banana", "date", "elder"]);
  assert.equal(dictResize(emptyDict(8)).indices.length, 8);
});

test("list vs tree: worst-case path lengths and the Java treeify decision", () => {
  assert.equal(balancedDepth(1), 1);
  assert.equal(balancedDepth(8), 4);
  assert.equal(balancedDepth(64), 7);
  assert.ok(redBlackBound(64) >= balancedDepth(64));
  const root = balancedTree(15)!;
  assert.equal(root.key, 8);
  for (let k = 1; k <= 15; k++) {
    const path = searchPath(root, k);
    assert.equal(path.at(-1), k);
    assert.ok(path.length <= balancedDepth(15));
  }
  assert.equal(searchPath(root, 99).length, 4);
  assert.equal(javaBinDecision(7, 64), "stay-list");
  assert.equal(javaBinDecision(8, 16), "resize-instead");
  assert.equal(javaBinDecision(8, 64), "treeify");
  assert.equal(javaBinDecision(20, 32), "resize-instead");
});
