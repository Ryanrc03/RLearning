// Step engines for the Algorithms notes. Each engine *executes* the Python template
// and records one trace entry per statement, so the visualizers never hand-write states.

export type ArrayVariant = "exact" | "lowerBound" | "brokenLessThan";

export type ArrayStep = {
  /** Current pointers after this step. r may be -1 (empty closed interval) or len (half-open bound). */
  l: number;
  r: number;
  /** mid is defined once computed in this iteration and until the next iteration begins. */
  mid?: number;
  /** 0-based index into the template's code lines. */
  line: number;
  kind: "init" | "test" | "mid" | "compare" | "left" | "right" | "found" | "return";
  /** One sentence for the narration panel. */
  note: string;
  /** Set on the final step. */
  result?: number;
};

export type ArrayTrace = { code: string[]; steps: ArrayStep[]; result: number };

const fmt = (nums: number[]) => `[${nums.join(", ")}]`;

/** Template A — LeetCode 704 style exact match on a closed interval [l, r]. */
export const EXACT_CODE = [
  "l, r = 0, len(nums) - 1",
  "while l <= r:",
  "    mid = (l + r) // 2",
  "    if nums[mid] == target:",
  "        return mid",
  "    elif nums[mid] < target:",
  "        l = mid + 1",
  "    else:",
  "        r = mid - 1",
  "return -1",
];

/** Template B — LeetCode 35 style lower bound on a half-open interval [l, r). */
export const LOWER_BOUND_CODE = [
  "l, r = 0, len(nums)",
  "while l < r:",
  "    mid = (l + r) // 2",
  "    if nums[mid] < target:",
  "        l = mid + 1",
  "    else:",
  "        r = mid",
  "return l",
];

/** Template A's interval, but the loop condition was changed to `<` without touching the bounds. */
export const BROKEN_CODE = [
  "l, r = 0, len(nums) - 1",
  "while l < r:   # changed from <=",
  "    mid = (l + r) // 2",
  "    if nums[mid] == target:",
  "        return mid",
  "    elif nums[mid] < target:",
  "        l = mid + 1",
  "    else:",
  "        r = mid - 1",
  "return l",
];

export function traceExactMatch(nums: number[], target: number): ArrayTrace {
  return traceClosed(nums, target, EXACT_CODE, "<=", -1);
}

export function traceBrokenLessThan(nums: number[], target: number): ArrayTrace {
  return traceClosed(nums, target, BROKEN_CODE, "<", "l");
}

function traceClosed(nums: number[], target: number, code: string[], cmp: "<=" | "<", fallback: -1 | "l"): ArrayTrace {
  const steps: ArrayStep[] = [];
  let l = 0;
  let r = nums.length - 1;
  steps.push({ l, r, line: 0, kind: "init", note: `闭区间 [l, r] = [${l}, ${r}]：两端都是可能含有答案的下标${nums.length === 0 ? "，数组为空，所以 r = -1，区间一开始就是空的" : ""}。` });
  for (;;) {
    const go = cmp === "<=" ? l <= r : l < r;
    if (!go) {
      const why = cmp === "<=" ? `l = ${l} > r = ${r}，闭区间已经为空，所有下标都检查过了。` : `l = ${l}, r = ${r}，\`l < r\` 不成立就退出。${l === r ? `注意 nums[${l}] 还没有被检查过。` : "区间为空。"}`;
      steps.push({ l, r, line: 1, kind: "test", note: `检查 while l ${cmp} r：不成立。${why}` });
      const result = fallback === -1 ? -1 : l;
      steps.push({ l, r, line: code.length - 1, kind: "return", result, note: fallback === -1 ? "返回 -1：没有找到 target。" : `返回 l = ${l} 作为插入位置。` });
      return { code, steps, result };
    }
    steps.push({ l, r, line: 1, kind: "test", note: `检查 while l ${cmp} r：${l} ${cmp} ${r} 成立，区间 [${l}, ${r}] 里还有候选。` });
    const mid = Math.floor((l + r) / 2);
    steps.push({ l, r, mid, line: 2, kind: "mid", note: `mid = (${l} + ${r}) // 2 = ${mid}，nums[mid] = ${nums[mid]}。` });
    if (nums[mid] === target) {
      steps.push({ l, r, mid, line: 3, kind: "compare", note: `nums[${mid}] = ${nums[mid]} == target：命中。` });
      steps.push({ l, r, mid, line: 4, kind: "found", result: mid, note: `返回 mid = ${mid}。` });
      return { code, steps, result: mid };
    }
    if (nums[mid] < target) {
      steps.push({ l, r, mid, line: 5, kind: "compare", note: `nums[${mid}] = ${nums[mid]} < target = ${target}：答案只可能在 mid 右边。` });
      l = mid + 1;
      steps.push({ l, r, mid, line: 6, kind: "left", note: `l = mid + 1 = ${l}。mid 已经检查过，不必保留。` });
    } else {
      steps.push({ l, r, mid, line: 7, kind: "compare", note: `nums[${mid}] = ${nums[mid]} > target = ${target}：答案只可能在 mid 左边。` });
      r = mid - 1;
      steps.push({ l, r, mid, line: 8, kind: "right", note: `r = mid - 1 = ${r}。mid 已经检查过，不必保留。` });
    }
  }
}

export function traceLowerBound(nums: number[], target: number): ArrayTrace {
  const code = LOWER_BOUND_CODE;
  const steps: ArrayStep[] = [];
  let l = 0;
  let r = nums.length;
  steps.push({ l, r, line: 0, kind: "init", note: `半开区间 [l, r) = [${l}, ${r})：r = len(nums) 让“插在末尾”也是候选答案${nums.length === 0 ? "。数组为空时 l == r == 0，循环一次都不进" : ""}。` });
  for (;;) {
    if (!(l < r)) {
      steps.push({ l, r, line: 1, kind: "test", note: `检查 while l < r：l = r = ${l}，候选区间只剩一个位置，它就是答案。` });
      steps.push({ l, r, line: code.length - 1, kind: "return", result: l, note: `返回 l = ${l}：第一个 nums[i] >= ${target} 的位置${l === nums.length ? "（数组末尾）" : ""}。` });
      return { code, steps, result: l };
    }
    steps.push({ l, r, line: 1, kind: "test", note: `检查 while l < r：${l} < ${r} 成立，候选区间 [${l}, ${r}) 还有不止一个位置。` });
    const mid = Math.floor((l + r) / 2);
    steps.push({ l, r, mid, line: 2, kind: "mid", note: `mid = (${l} + ${r}) // 2 = ${mid}，nums[mid] = ${nums[mid]}（mid 永远小于 len(nums)，不会越界）。` });
    if (nums[mid] < target) {
      steps.push({ l, r, mid, line: 3, kind: "compare", note: `nums[${mid}] = ${nums[mid]} < target = ${target}：mid 不可能是插入位置，答案在右边。` });
      l = mid + 1;
      steps.push({ l, r, mid, line: 4, kind: "left", note: `l = mid + 1 = ${l}。` });
    } else {
      steps.push({ l, r, mid, line: 5, kind: "compare", note: `nums[${mid}] = ${nums[mid]} >= target = ${target}：mid 本身可能就是答案，不能排除。` });
      r = mid;
      steps.push({ l, r, mid, line: 6, kind: "right", note: `r = mid = ${r}，而不是 mid - 1：把 mid 留在候选区间里。` });
    }
  }
}

export function traceArray(variant: ArrayVariant, nums: number[], target: number): ArrayTrace {
  if (variant === "exact") return traceExactMatch(nums, target);
  if (variant === "lowerBound") return traceLowerBound(nums, target);
  return traceBrokenLessThan(nums, target);
}

/** Reference answers used by tests and by the visualizer's verdict line. */
export function lowerBound(nums: number[], target: number): number {
  let i = 0;
  while (i < nums.length && nums[i] < target) i++;
  return i;
}

export function describeArray(nums: number[], target: number): string {
  return `nums = ${fmt(nums)}, target = ${target}`;
}

// ---------- Binary search on answer: LeetCode 875 Koko Eating Bananas ----------

export const ceilDiv = (a: number, b: number) => Math.floor((a + b - 1) / b);

export const KOKO_CODE = [
  "def feasible(k):",
  "    hours = sum((p + k - 1) // k for p in piles)",
  "    return hours <= h",
  "",
  "l, r = 1, max(piles)",
  "while l < r:",
  "    mid = (l + r) // 2",
  "    if feasible(mid):",
  "        r = mid",
  "    else:",
  "        l = mid + 1",
  "return l",
];

export type KokoStep = {
  l: number;
  r: number;
  mid?: number;
  /** Hours each pile needs at speed mid. */
  hours?: number[];
  total?: number;
  feasible?: boolean;
  line: number;
  kind: "init" | "test" | "mid" | "feasible" | "right" | "left" | "return";
  note: string;
  /** Speeds ruled out so far, as inclusive ranges, accumulated over the trace. */
  excluded: { from: number; to: number }[];
  result?: number;
};

export type KokoTrace = { code: string[]; steps: KokoStep[]; result: number; lo: number; hi: number };

export function kokoHours(piles: number[], k: number): number[] {
  return piles.map((p) => ceilDiv(p, k));
}

export function traceKoko(piles: number[], h: number): KokoTrace {
  const code = KOKO_CODE;
  const steps: KokoStep[] = [];
  const excluded: { from: number; to: number }[] = [];
  const snap = () => excluded.map((e) => ({ ...e }));
  let l = 1;
  const hi = Math.max(...piles);
  let r = hi;
  steps.push({ l, r, line: 4, kind: "init", excluded: snap(), note: `搜索空间是速度 [1, ${hi}]：最慢每小时 1 根；速度到 max(piles) = ${hi} 时每堆 1 小时吃完，再快也没用。` });
  for (;;) {
    if (!(l < r)) {
      steps.push({ l, r, line: 5, kind: "test", excluded: snap(), note: `while l < r：l = r = ${l}，只剩一个候选速度。` });
      steps.push({ l, r, line: 11, kind: "return", excluded: snap(), result: l, note: `返回 l = ${l}：最小的可行速度。` });
      return { code, steps, result: l, lo: 1, hi };
    }
    steps.push({ l, r, line: 5, kind: "test", excluded: snap(), note: `while l < r：${l} < ${r}，候选速度 [${l}, ${r}] 还有 ${r - l + 1} 个。` });
    const mid = Math.floor((l + r) / 2);
    steps.push({ l, r, mid, line: 6, kind: "mid", excluded: snap(), note: `mid = (${l} + ${r}) // 2 = ${mid}：试试速度 ${mid}。` });
    const hours = kokoHours(piles, mid);
    const total = hours.reduce((a, b) => a + b, 0);
    const ok = total <= h;
    steps.push({ l, r, mid, hours, total, feasible: ok, line: 7, kind: "feasible", excluded: snap(), note: `feasible(${mid})：每堆向上取整 ${hours.join(" + ")} = ${total} 小时，${ok ? `<= h = ${h}，可行` : `> h = ${h}，不可行`}。` });
    if (ok) {
      const gone = { from: mid + 1, to: r };
      if (gone.from <= gone.to) excluded.push(gone);
      r = mid;
      steps.push({ l, r, mid, hours, total, feasible: ok, line: 8, kind: "right", excluded: snap(), note: `r = mid = ${mid}：速度 ${mid} 可行，但它可能就是最小的，不能排除；比它快的${gone.from <= gone.to ? ` [${gone.from}, ${gone.to}]` : ""}不用再看。` });
    } else {
      const gone = { from: l, to: mid };
      excluded.push(gone);
      l = mid + 1;
      steps.push({ l, r, mid, hours, total, feasible: ok, line: 10, kind: "left", excluded: snap(), note: `l = mid + 1 = ${l}：速度 ${mid} 来不及，比它慢的更来不及，[${gone.from}, ${gone.to}] 全部排除。` });
    }
  }
}

/** Reference: smallest k in [1, max(piles)] with total hours <= h, by linear scan. */
export function minEatingSpeedBrute(piles: number[], h: number): number {
  const hi = Math.max(...piles);
  for (let k = 1; k <= hi; k++) if (kokoHours(piles, k).reduce((a, b) => a + b, 0) <= h) return k;
  return hi;
}

// ---------- Reusable answer-space templates (the cheat sheet at the end of note 2) ----------

/** Smallest x in [lo, hi] with ok(x) true. Assumes ok is monotone and ok(hi) is true. */
export function firstTrue(lo: number, hi: number, ok: (x: number) => boolean): number {
  let l = lo;
  let r = hi;
  while (l < r) {
    const mid = Math.floor((l + r) / 2);
    if (ok(mid)) r = mid;
    else l = mid + 1;
  }
  return l;
}

/** Largest x in [lo, hi] with ok(x) true. Assumes ok is monotone and ok(lo) is true. */
export function lastTrue(lo: number, hi: number, ok: (x: number) => boolean): number {
  let l = lo;
  let r = hi;
  while (l < r) {
    const mid = Math.floor((l + r + 1) / 2);
    if (ok(mid)) l = mid;
    else r = mid - 1;
  }
  return l;
}
