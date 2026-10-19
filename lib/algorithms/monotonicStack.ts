// Step engines for the Stack & Monotonic Stack notes. Like binarySearch.ts, each engine
// *executes* the Python template and records one trace entry per statement, so the
// visualizer never hand-writes states.

export type StackKind = "init" | "iter" | "test" | "pop" | "assign" | "push" | "return";

export type StackStep = {
  /** 0-based index into the template's code lines. */
  line: number;
  kind: StackKind;
  /** Index currently being processed by the for loop; -1 before the loop and after it ends. */
  i: number;
  /** Stack contents, bottom first. Entries are indices into the array shown by the visualizer. */
  stack: number[];
  /** Per-index answer so far. Daily Temperatures: days to wait, 0 = unresolved/never.
   *  Car Fleet: index of the fleet this car ended up in (its leader), or -1 while unknown. */
  ans: number[];
  /** Index that was just popped (on "pop" steps). */
  popped?: number;
  /** One sentence for the narration panel. */
  note: string;
  /** Set on the final step. */
  result?: number | number[];
};

export type StackTrace = { code: string[]; steps: StackStep[]; result: number | number[] };

// ---------- LeetCode 739 Daily Temperatures ----------

export const DAILY_TEMPS_CODE = [
  "n = len(temps)",
  "ans = [0] * n",
  "stack = []   # indices; temps non-increasing",
  "for i in range(n):",
  "    while stack and temps[stack[-1]] < temps[i]:",
  "        j = stack.pop()",
  "        ans[j] = i - j",
  "    stack.append(i)",
  "return ans",
];

const fmtStack = (stack: number[]) => (stack.length ? `[${stack.join(", ")}]` : "[]");

export function traceDailyTemperatures(temps: number[]): StackTrace {
  const code = DAILY_TEMPS_CODE;
  const steps: StackStep[] = [];
  const n = temps.length;
  const ans: number[] = new Array(n).fill(0);
  const stack: number[] = [];
  const snap = (p: Omit<StackStep, "stack" | "ans">): StackStep => ({ ...p, stack: [...stack], ans: [...ans] });

  steps.push(snap({ line: 1, kind: "init", i: -1, note: `ans 全部初始化为 0：到最后还留在栈里的下标，右边没有更暖的一天，答案就是 0。` }));
  steps.push(snap({ line: 2, kind: "init", i: -1, note: `栈里放的是下标，不是温度：之后要算“等了几天”，只有下标能相减。` }));
  for (let i = 0; i < n; i++) {
    steps.push(snap({ line: 3, kind: "iter", i, note: `i = ${i}，temps[${i}] = ${temps[i]}。它是栈里所有人等待的候选“更暖的一天”。` }));
    for (;;) {
      if (!stack.length) {
        steps.push(snap({ line: 4, kind: "test", i, note: `栈为空，没有人在等，不用弹出。` }));
        break;
      }
      const top = stack[stack.length - 1];
      if (!(temps[top] < temps[i])) {
        steps.push(snap({ line: 4, kind: "test", i, note: `栈顶 ${top} 的温度 ${temps[top]} ${temps[top] === temps[i] ? "==" : ">"} ${temps[i]}：今天没有更暖，栈顶继续等。栈顶都没被超过，它下面的更不会（温度更高）。` }));
        break;
      }
      steps.push(snap({ line: 4, kind: "test", i, note: `栈顶 ${top} 的温度 ${temps[top]} < ${temps[i]}：第 ${top} 天终于等到了更暖的一天。` }));
      stack.pop();
      steps.push(snap({ line: 5, kind: "pop", i, popped: top, note: `弹出 j = ${top}。它的答案已经确定，以后永远不用再看它。` }));
      ans[top] = i - top;
      steps.push(snap({ line: 6, kind: "assign", i, popped: top, note: `ans[${top}] = ${i} - ${top} = ${i - top}。` }));
    }
    stack.push(i);
    steps.push(snap({ line: 7, kind: "push", i, note: `压入 ${i}。栈从底到顶温度仍然单调不增（相等的也留着）：${fmtStack(stack)} → ${stack.map((k) => temps[k]).join(" ≥ ") || "空"}。` }));
  }
  steps.push(snap({ line: 3, kind: "iter", i: -1, note: `循环结束。${stack.length ? `栈里还剩 ${fmtStack(stack)}：右边没有更暖的一天，ans 保持 0。` : "栈已空。"}` }));
  steps.push(snap({ line: 8, kind: "return", i: -1, result: [...ans], note: `返回 ans = [${ans.join(", ")}]。每个下标最多压入一次、弹出一次，总共 ${n} 次压入、${n - stack.length} 次弹出。` }));
  return { code, steps, result: [...ans] };
}

/** Reference: for each day, scan rightwards for the first warmer day. */
export function dailyTemperaturesBrute(temps: number[]): number[] {
  return temps.map((t, i) => {
    for (let j = i + 1; j < temps.length; j++) if (temps[j] > t) return j - i;
    return 0;
  });
}

// ---------- LeetCode 853 Car Fleet ----------

export const CAR_FLEET_CODE = [
  "cars = sorted(zip(position, speed), reverse=True)",
  "stack = []   # arrival times; strictly increasing",
  "for pos, spd in cars:",
  "    t = (target - pos) / spd",
  "    stack.append(t)",
  "    if len(stack) >= 2 and stack[-1] <= stack[-2]:",
  "        stack.pop()   # caught the fleet ahead",
  "return len(stack)",
];

export type Car = { pos: number; spd: number; time: number };

/** Cars sorted by position descending (closest to target first), with their solo arrival time. */
export function sortCars(target: number, position: number[], speed: number[]): Car[] {
  return position
    .map((pos, k) => ({ pos, spd: speed[k], time: (target - pos) / speed[k] }))
    .sort((a, b) => b.pos - a.pos);
}

/** Exact `t_a <= t_b` using integer cross-multiplication, so ties are not lost to floating point. */
const arrivesNoLaterThan = (target: number, a: Car, b: Car) => (target - a.pos) * b.spd <= (target - b.pos) * a.spd;

export const fmtTime = (t: number) => (Number.isInteger(t) ? String(t) : t.toFixed(2).replace(/0+$/, "").replace(/\.$/, ""));

export function traceCarFleet(target: number, position: number[], speed: number[]): StackTrace {
  const code = CAR_FLEET_CODE;
  const steps: StackStep[] = [];
  const cars = sortCars(target, position, speed);
  const n = cars.length;
  const ans: number[] = new Array(n).fill(-1);
  const stack: number[] = [];
  const snap = (p: Omit<StackStep, "stack" | "ans">): StackStep => ({ ...p, stack: [...stack], ans: [...ans] });

  steps.push(snap({ line: 0, kind: "init", i: -1, note: `按位置从大到小排序：下标 0 离 target 最近。车只能追前面的车，所以要从最前面的车开始处理。` }));
  steps.push(snap({ line: 1, kind: "init", i: -1, note: `栈里放的是每个车队的到达时间。从栈底到栈顶时间严格递增：越靠后的车队到得越晚。` }));
  for (let i = 0; i < n; i++) {
    const c = cars[i];
    steps.push(snap({ line: 2, kind: "iter", i, note: `i = ${i}：位置 ${c.pos}，速度 ${c.spd}。` }));
    steps.push(snap({ line: 3, kind: "assign", i, note: `单独开到 target 要 (${target} - ${c.pos}) / ${c.spd} = ${fmtTime(c.time)}。` }));
    stack.push(i);
    ans[i] = i;
    steps.push(snap({ line: 4, kind: "push", i, note: `先压入，暂时当它是一个新车队的领头。` }));
    if (stack.length >= 2) {
      const ahead = stack[stack.length - 2];
      const caught = arrivesNoLaterThan(target, c, cars[ahead]);
      steps.push(snap({ line: 5, kind: "test", i, note: `和前一个车队比：${fmtTime(c.time)} ${caught ? "<=" : ">"} ${fmtTime(cars[ahead].time)}。${caught ? "它更早（或同时）到达，一定会在 target 前追上前面的车队。" : "它到得更晚，追不上，自成一队。"}` }));
      if (caught) {
        stack.pop();
        ans[i] = ans[ahead];
        steps.push(snap({ line: 6, kind: "pop", i, popped: i, note: `弹出 ${i}：并入车队 ${ans[ahead]}，以车队领头的时间 ${fmtTime(cars[ans[ahead]].time)} 到达。栈顶仍是前面那个车队。` }));
      }
    } else {
      steps.push(snap({ line: 5, kind: "test", i, note: `栈里只有它自己，前面没有车队可追。` }));
    }
  }
  steps.push(snap({ line: 2, kind: "iter", i: -1, note: `循环结束。栈里剩下的每个时间就是一个车队：${stack.map((k) => fmtTime(cars[k].time)).join(" < ") || "空"}。` }));
  steps.push(snap({ line: 7, kind: "return", i: -1, result: stack.length, note: `返回 len(stack) = ${stack.length}。` }));
  return { code, steps, result: stack.length };
}

/** Reference: a car (sorted by position descending) leads a fleet iff its solo arrival time is
 *  strictly later than every car ahead of it; otherwise it catches some fleet before target. */
export function carFleetBrute(target: number, position: number[], speed: number[]): number {
  const cars = sortCars(target, position, speed);
  let fleets = 0;
  for (let i = 0; i < cars.length; i++) {
    let leads = true;
    for (let j = 0; j < i; j++) if (arrivesNoLaterThan(target, cars[i], cars[j])) leads = false;
    if (leads) fleets++;
  }
  return fleets;
}
