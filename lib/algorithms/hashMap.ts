// Step engines for the HashMap Internals note. Like binarySearch.ts and monotonicStack.ts,
// every engine *executes* the data structure and records one snapshot per step, so the
// visualizers only draw state and never hand-write it.
//
// Keys are small non-negative integers and hash(key) = key, which is exactly what CPython
// does for small ints. That keeps every number on screen checkable by hand: 10 % 8 = 2.

// ---------- Open addressing with linear probing ----------

export type SlotState = "empty" | "occupied" | "deleted";
export type Slot = { state: SlotState; key?: number; value?: string };

export type ProbeKind = "home" | "compare" | "skip" | "found" | "missing" | "place" | "update" | "tombstone" | "full";

export type ProbeStep = {
  kind: ProbeKind;
  /** Probe number i in index_i = (h + i) % capacity. */
  i: number;
  /** Slot being looked at. */
  idx: number;
  /** Table after this step. */
  slots: Slot[];
  /** First tombstone met on the way, remembered for reuse on insert. */
  tombstone: number | null;
  note: string;
};

export type ProbeOp = "insert" | "search" | "delete";
export type ProbeTrace = { op: ProbeOp; key: number; home: number; steps: ProbeStep[]; slots: Slot[]; result: "found" | "missing" | "inserted" | "updated" | "deleted" | "full" };

export const emptyTable = (capacity: number): Slot[] => Array.from({ length: capacity }, () => ({ state: "empty" }));

const copy = (slots: Slot[]): Slot[] => slots.map((s) => ({ ...s }));
const describe = (s: Slot) => (s.state === "empty" ? "EMPTY" : s.state === "deleted" ? "DELETED" : `(${s.key}, ${s.value})`);

/** Executes one operation on a linear-probing table and records every probe. Pure: returns the new table. */
export function traceOpenAddressing(slots: Slot[], op: ProbeOp, key: number, value = ""): ProbeTrace {
  const cap = slots.length;
  const table = copy(slots);
  const home = key % cap;
  const steps: ProbeStep[] = [];
  let tombstone: number | null = null;
  const snap = (p: Omit<ProbeStep, "slots" | "tombstone">) => steps.push({ ...p, slots: copy(table), tombstone });
  const verb = { insert: "插入", search: "查找", delete: "删除" }[op];

  snap({ kind: "home", i: 0, idx: home, note: `${verb} key = ${key}：hash(${key}) = ${key}，${key} % ${cap} = ${home}，从 index ${home} 开始探测。` });

  for (let i = 0; i < cap; i++) {
    const idx = (home + i) % cap;
    const s = table[idx];
    if (s.state === "empty") {
      if (op === "insert") {
        const at = tombstone ?? idx;
        table[at] = { state: "occupied", key, value };
        snap({ kind: "place", i, idx: at, note: tombstone !== null
          ? `index ${idx} 是 EMPTY，说明表里没有 ${key}。回头复用第一个 DELETED 的 index ${at}，把 (${key}, ${value}) 放进去。`
          : `index ${idx} 是 EMPTY：${key} 不在表里，就放在这里。` });
        return { op, key, home, steps, slots: table, result: "inserted" };
      }
      snap({ kind: "missing", i, idx, note: `index ${idx} 是 EMPTY。插入时从不跳过 EMPTY，所以 ${key} 不可能在更后面：${op === "search" ? "查找失败，返回 None" : "没有可删的"}。` });
      return { op, key, home, steps, slots: table, result: "missing" };
    }
    if (s.state === "deleted") {
      if (tombstone === null && op === "insert") tombstone = idx;
      snap({ kind: "skip", i, idx, note: `index ${idx} 是 DELETED（tombstone）：曾经有人住过，后面可能还有同一条探测链上的 key，跨过去继续。${op === "insert" && tombstone === idx ? "记下它：如果最后确认 key 不存在，可以回来复用。" : ""}` });
      continue;
    }
    if (s.key === key) {
      if (op === "insert") {
        table[idx] = { state: "occupied", key, value };
        snap({ kind: "update", i, idx, note: `index ${idx} 的 key 就是 ${key}：已经存在，原地更新 value，size 不变。` });
        return { op, key, home, steps, slots: table, result: "updated" };
      }
      if (op === "delete") {
        table[idx] = { state: "deleted" };
        snap({ kind: "tombstone", i, idx, note: `index ${idx} 的 key 就是 ${key}：标成 DELETED 而不是 EMPTY，这样它后面的 key 仍然能被探测到。` });
        return { op, key, home, steps, slots: table, result: "deleted" };
      }
      snap({ kind: "found", i, idx, note: `index ${idx} 的 key == ${key}：找到，第 ${i + 1} 次探测命中。` });
      return { op, key, home, steps, slots: table, result: "found" };
    }
    snap({ kind: "compare", i, idx, note: `index ${idx} 被 ${describe(s)} 占着，${s.key} != ${key}：冲突，看下一格 (${home} + ${i + 1}) % ${cap} = ${(home + i + 1) % cap}。` });
  }
  if (op === "insert" && tombstone !== null) {
    table[tombstone] = { state: "occupied", key, value };
    snap({ kind: "place", i: cap, idx: tombstone, note: `绕了一整圈没遇到 EMPTY，复用 DELETED 的 index ${tombstone}。` });
    return { op, key, home, steps, slots: table, result: "inserted" };
  }
  snap({ kind: "full", i: cap, idx: home, note: op === "insert" ? `绕了一整圈都没有空位：表满了。真实实现不会走到这里，它会在负载过高时提前 resize。` : `绕了一整圈没有 EMPTY 也没找到：${key} 不存在。` });
  return { op, key, home, steps, slots: table, result: op === "insert" ? "full" : "missing" };
}

/** Number of slots that are not EMPTY (occupied + tombstones). Lookups cost by this, not by size. */
export const nonEmptyCount = (slots: Slot[]) => slots.filter((s) => s.state !== "empty").length;
export const occupiedCount = (slots: Slot[]) => slots.filter((s) => s.state === "occupied").length;

// ---------- Separate chaining ----------

export type Chain = { key: number; value: string }[];
export type ChainStep = { kind: "home" | "compare" | "found" | "missing" | "append" | "update" | "unlink"; bucket: number; pos: number; buckets: Chain[]; note: string };
export type ChainTrace = { op: ProbeOp; key: number; home: number; steps: ChainStep[]; buckets: Chain[]; result: ProbeTrace["result"] };

export const emptyBuckets = (capacity: number): Chain[] => Array.from({ length: capacity }, () => []);
const copyBuckets = (b: Chain[]) => b.map((c) => c.map((e) => ({ ...e })));

export function traceChaining(buckets: Chain[], op: ProbeOp, key: number, value = ""): ChainTrace {
  const cap = buckets.length;
  const table = copyBuckets(buckets);
  const home = key % cap;
  const steps: ChainStep[] = [];
  const snap = (p: Omit<ChainStep, "buckets">) => steps.push({ ...p, buckets: copyBuckets(table) });
  const verb = { insert: "插入", search: "查找", delete: "删除" }[op];
  const chain = table[home];
  snap({ kind: "home", bucket: home, pos: -1, note: `${verb} key = ${key}：${key} % ${cap} = ${home}，进 bucket ${home}，沿链表逐个比较。` });
  for (let pos = 0; pos < chain.length; pos++) {
    if (chain[pos].key === key) {
      if (op === "insert") { chain[pos].value = value; snap({ kind: "update", bucket: home, pos, note: `第 ${pos + 1} 个节点 key == ${key}：原地更新 value。` }); return { op, key, home, steps, buckets: table, result: "updated" }; }
      if (op === "delete") { chain.splice(pos, 1); snap({ kind: "unlink", bucket: home, pos, note: `第 ${pos + 1} 个节点 key == ${key}：直接摘掉。链表删除不需要 tombstone，因为其他 key 的位置不依赖它。` }); return { op, key, home, steps, buckets: table, result: "deleted" }; }
      snap({ kind: "found", bucket: home, pos, note: `第 ${pos + 1} 个节点 key == ${key}：找到，比较了 ${pos + 1} 次。` });
      return { op, key, home, steps, buckets: table, result: "found" };
    }
    snap({ kind: "compare", bucket: home, pos, note: `第 ${pos + 1} 个节点是 ${chain[pos].key}，!= ${key}，看下一个。` });
  }
  if (op === "insert") { chain.push({ key, value }); snap({ kind: "append", bucket: home, pos: chain.length - 1, note: `链表走完没有 ${key}：追加到 bucket ${home} 的末尾，链长变成 ${chain.length}。` }); return { op, key, home, steps, buckets: table, result: "inserted" }; }
  snap({ kind: "missing", bucket: home, pos: chain.length, note: `链表走完（${chain.length} 次比较）没有 ${key}：${op === "search" ? "返回 None" : "没有可删的"}。` });
  return { op, key, home, steps, buckets: table, result: "missing" };
}

// ---------- Load factor, resize and rehash ----------

export type LoadSnapshot = {
  /** Keys inserted so far, in order. */
  n: number;
  capacity: number;
  slots: Slot[];
  /** Keys that did not land on their home slot. */
  displaced: number;
  /** Average probes for a successful lookup over all keys in the table. */
  avgProbes: number;
  /** Longest probe chain for any key present. */
  maxProbes: number;
  /** Slot writes done so far, including every re-insertion during resizes. */
  totalWrites: number;
  /** Set when inserting this key triggered a resize: the table just before the rebuild. */
  resizedFrom?: { capacity: number; slots: Slot[] };
};

/** Probes needed to find `key` in `slots` by linear probing (1 = home slot). */
export function probesFor(slots: Slot[], key: number): number {
  const cap = slots.length;
  const home = key % cap;
  for (let i = 0; i < cap; i++) {
    const s = slots[(home + i) % cap];
    if (s.state === "empty") return i + 1;
    if (s.state === "occupied" && s.key === key) return i + 1;
  }
  return cap;
}

function placeLinear(slots: Slot[], key: number): number {
  const cap = slots.length;
  const home = key % cap;
  for (let i = 0; i < cap; i++) {
    const idx = (home + i) % cap;
    if (slots[idx].state !== "occupied") { slots[idx] = { state: "occupied", key, value: "" }; return i; }
  }
  throw new Error("table full");
}

/**
 * Inserts `keys` one by one into a linear-probing table that doubles whenever
 * load = n / capacity would exceed `maxLoad`, recording a snapshot after each insert.
 */
export function simulateLoad(keys: number[], maxLoad: number, initialCapacity = 8): LoadSnapshot[] {
  let slots = emptyTable(initialCapacity);
  let totalWrites = 0;
  const out: LoadSnapshot[] = [];
  const present: number[] = [];
  for (const key of keys) {
    let resizedFrom: LoadSnapshot["resizedFrom"];
    if ((present.length + 1) / slots.length > maxLoad) {
      resizedFrom = { capacity: slots.length, slots: copy(slots) };
      const bigger = emptyTable(slots.length * 2);
      for (const k of present) { placeLinear(bigger, k); totalWrites++; }
      slots = bigger;
    }
    placeLinear(slots, key);
    totalWrites++;
    present.push(key);
    const probes = present.map((k) => probesFor(slots, k));
    out.push({
      n: present.length,
      capacity: slots.length,
      slots: copy(slots),
      displaced: present.filter((k) => k % slots.length !== slots.findIndex((s) => s.state === "occupied" && s.key === k)).length,
      avgProbes: probes.reduce((a, b) => a + b, 0) / probes.length,
      maxProbes: Math.max(...probes),
      totalWrites,
      resizedFrom,
    });
  }
  return out;
}

/** Deterministic key stream for the simulator: distinct values in [0, 1000). */
export function sampleKeys(count: number, seed = 1): number[] {
  // Park–Miller, same generator as lib/ml/random.ts, inlined to keep this module dependency-free.
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  const next = () => { state = (state * 48271) % 2147483647; return (state - 1) / 2147483646; };
  const seen = new Set<number>();
  const keys: number[] = [];
  while (keys.length < count) {
    const k = Math.floor(next() * 1000);
    if (!seen.has(k)) { seen.add(k); keys.push(k); }
  }
  return keys;
}

// ---------- CPython compact dict (teaching model) ----------

export const DKIX_EMPTY = -1;
export const DKIX_DUMMY = -2;
export const PERTURB_SHIFT = 5;

export type DictEntry = { hash: number; key: string | null; value: number | null };
export type CompactDict = { indices: number[]; entries: DictEntry[]; used: number };

/** Small, checkable stand-in for Python's string hash (the real one is SipHash and randomised per process). */
export function toyHash(key: string): number {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

export const emptyDict = (size = 8): CompactDict => ({ indices: new Array(size).fill(DKIX_EMPTY), entries: [], used: 0 });

/** CPython's probe sequence: i = (i*5 + perturb + 1) & mask; perturb >>= PERTURB_SHIFT. */
export function probeSequence(hash: number, size: number, limit = size): number[] {
  const mask = size - 1;
  let perturb = hash;
  let i = hash & mask;
  const seq = [i];
  while (seq.length < limit) {
    perturb = Math.floor(perturb / 2 ** PERTURB_SHIFT);
    i = (i * 5 + perturb + 1) & mask;
    seq.push(i);
  }
  return seq;
}

export type DictProbe = { slot: number; ix: number; kind: "empty" | "dummy" | "hit" | "miss" };

/** Finds `key`: the probe path plus the index-slot and entry index it ends on. */
export function dictLookup(d: CompactDict, key: string): { path: DictProbe[]; slot: number; ix: number } {
  const hash = toyHash(key);
  const path: DictProbe[] = [];
  let firstDummy = -1;
  for (const slot of probeSequence(hash, d.indices.length)) {
    const ix = d.indices[slot];
    if (ix === DKIX_EMPTY) { path.push({ slot, ix, kind: "empty" }); return { path, slot: firstDummy >= 0 ? firstDummy : slot, ix: DKIX_EMPTY }; }
    if (ix === DKIX_DUMMY) { path.push({ slot, ix, kind: "dummy" }); if (firstDummy < 0) firstDummy = slot; continue; }
    const e = d.entries[ix];
    if (e.hash === hash && e.key === key) { path.push({ slot, ix, kind: "hit" }); return { path, slot, ix }; }
    path.push({ slot, ix, kind: "miss" });
  }
  return { path, slot: firstDummy, ix: DKIX_EMPTY };
}

/** Usable entries before a resize: CPython's USABLE_FRACTION(n) = (n << 1) / 3. */
export const usableFraction = (size: number) => Math.floor((size * 2) / 3);

export function dictSet(d: CompactDict, key: string, value: number): CompactDict {
  const next: CompactDict = { indices: [...d.indices], entries: d.entries.map((e) => ({ ...e })), used: d.used };
  const { slot, ix } = dictLookup(next, key);
  if (ix >= 0) { next.entries[ix].value = value; return next; }
  if (next.entries.length >= usableFraction(next.indices.length)) return dictSet(dictResize(next), key, value);
  next.indices[slot] = next.entries.length;
  next.entries.push({ hash: toyHash(key), key, value });
  next.used++;
  return next;
}

export function dictDelete(d: CompactDict, key: string): CompactDict {
  const { slot, ix } = dictLookup(d, key);
  if (ix < 0) return d;
  const next: CompactDict = { indices: [...d.indices], entries: d.entries.map((e) => ({ ...e })), used: d.used - 1 };
  next.indices[slot] = DKIX_DUMMY;           // the index slot becomes a dummy
  next.entries[ix] = { hash: 0, key: null, value: null }; // the entry is NULLed, not compacted
  return next;
}

/** Rebuild: CPython sizes the new table from GROWTH_RATE = used * 3, rounded up to a power of two, and drops dummies and NULL entries. */
export function dictResize(d: CompactDict): CompactDict {
  let size = 8;
  while (size < d.used * 3) size *= 2;
  let next = emptyDict(size);
  for (const e of d.entries) if (e.key !== null) next = dictSet(next, e.key, e.value as number);
  return next;
}

export const dictKeysInOrder = (d: CompactDict) => d.entries.filter((e) => e.key !== null).map((e) => e.key as string);

// ---------- Chaining vs red-black tree bins ----------

/** Worst-case comparisons to find a key in a bin of `n` nodes. */
export const listWorst = (n: number) => n;
/** A perfectly balanced BST of n nodes has height ceil(log2(n+1)); a red-black tree guarantees at most 2*log2(n+1). */
export const balancedDepth = (n: number) => (n <= 0 ? 0 : Math.ceil(Math.log2(n + 1)));
export const redBlackBound = (n: number) => (n <= 0 ? 0 : Math.floor(2 * Math.log2(n + 1)));

export type TreeNode = { key: number; left?: TreeNode; right?: TreeNode; depth: number };

/** Builds the balanced BST over keys 1..n (median as root), tagging each node's depth (root = 1). */
export function balancedTree(n: number): TreeNode | undefined {
  const build = (lo: number, hi: number, depth: number): TreeNode | undefined => {
    if (lo > hi) return undefined;
    const mid = Math.floor((lo + hi) / 2);
    return { key: mid, depth, left: build(lo, mid - 1, depth + 1), right: build(mid + 1, hi, depth + 1) };
  };
  return build(1, n, 1);
}

/** Keys compared on the way to `target` in a BST. */
export function searchPath(root: TreeNode | undefined, target: number): number[] {
  const path: number[] = [];
  let node = root;
  while (node) {
    path.push(node.key);
    if (target === node.key) break;
    node = target < node.key ? node.left : node.right;
  }
  return path;
}

export const JAVA = { TREEIFY_THRESHOLD: 8, UNTREEIFY_THRESHOLD: 6, MIN_TREEIFY_CAPACITY: 64, DEFAULT_LOAD_FACTOR: 0.75, DEFAULT_INITIAL_CAPACITY: 16 } as const;

/**
 * What java.util.HashMap.putVal does when the new key lands in a bin that already holds
 * `nodesBefore` nodes. The loop appends the new node and then checks
 * `binCount >= TREEIFY_THRESHOLD - 1`, where binCount is the number of nodes walked past
 * before the tail, so the check fires when the bin held 8 and now holds 9. treeifyBin then
 * resizes instead of treeifying while `tab.length < MIN_TREEIFY_CAPACITY`.
 */
export function javaBinDecision(nodesBefore: number, tableLength: number): "stay-list" | "resize-instead" | "treeify" {
  if (nodesBefore < JAVA.TREEIFY_THRESHOLD) return "stay-list";
  return tableLength < JAVA.MIN_TREEIFY_CAPACITY ? "resize-instead" : "treeify";
}
