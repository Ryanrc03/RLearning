"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import CodePanel from "./CodePanel";
import StepControls from "./StepControls";
import { lowerBound, traceArray, type ArrayVariant } from "@/lib/algorithms/binarySearch";

type Preset = { nums: number[]; target: number };

const PRESETS: Preset[] = [
  { nums: [1, 3, 5], target: 6 },
  { nums: [1, 3, 5], target: 3 },
  { nums: [1, 3, 5], target: 0 },
  { nums: [], target: 2 },
  { nums: [1, 3, 5, 7, 9], target: 7 },
];

const VARIANTS: { id: ArrayVariant; label: string; blurb: string }[] = [
  { id: "exact", label: "Template A · l <= r", blurb: "闭区间 [l, r]，r 从 len-1 开始。回答“target 在哪”，找不到返回 -1。" },
  { id: "lowerBound", label: "Template B · l < r", blurb: "半开区间 [l, r)，r 从 len 开始。回答“第一个 >= target 的位置”，也就是插入位置。" },
  { id: "brokenLessThan", label: "A 的边界 + l < r（错误）", blurb: "保留 Template A 的 r = len-1 和 r = mid-1，只把 <= 改成 <，最后返回 l 当插入位置。看看哪一步出错。" },
];

function parseNums(text: string): number[] | null {
  const trimmed = text.trim().replace(/^\[|\]$/g, "");
  if (!trimmed) return [];
  const parts = trimmed.split(/[,\s]+/).filter(Boolean).map(Number);
  if (parts.length > 12 || parts.some((x) => !Number.isInteger(x))) return null;
  return [...parts].sort((a, b) => a - b);
}

export default function BinarySearchVisualizer() {
  const [variant, setVariant] = useState<ArrayVariant>("lowerBound");
  const [preset, setPreset] = useState(0);
  const [custom, setCustom] = useState<Preset | null>(null);
  const [numsText, setNumsText] = useState("2, 4, 6, 8");
  const [targetText, setTargetText] = useState("5");
  const [step, setStep] = useState(0);

  const input = custom ?? PRESETS[preset];
  const trace = useMemo(() => traceArray(variant, input.nums, input.target), [variant, input]);
  const cur = trace.steps[Math.min(step, trace.steps.length - 1)];
  const done = cur.kind === "return" || cur.kind === "found";
  const expectedInsert = lowerBound(input.nums, input.target);
  const found = input.nums.indexOf(input.target);
  const n = input.nums.length;
  const halfOpen = variant === "lowerBound";
  const showNeg = trace.steps.some((s) => s.r < 0);

  const choose = (next: () => void) => { next(); setStep(0); };
  const applyCustom = () => {
    const nums = parseNums(numsText);
    const target = Number(targetText);
    if (!nums || !Number.isInteger(target)) return;
    choose(() => setCustom({ nums, target }));
  };

  // Slots: optional ghost at -1 (closed interval on an empty array), the n values, and the "+ insert" slot at n.
  const slots = [...(showNeg ? [-1] : []), ...Array.from({ length: n }, (_, i) => i), n];
  const inRange = (i: number) => i >= cur.l && i <= cur.r;
  const cellClass = (i: number) => {
    const c = ["bs-cell"];
    if (i < 0 || i === n) c.push("is-ghost");
    if (cur.kind === "found" && i === cur.mid) c.push("is-found");
    else if (cur.mid !== undefined && i === cur.mid && cur.kind !== "test" && cur.kind !== "return") c.push("is-mid");
    if (!done && i >= 0 && i <= n && inRange(i)) c.push("is-cand");
    if (!done && i >= 0 && i < n && !inRange(i)) c.push("is-out");
    return c.join(" ");
  };
  const markers = (i: number) => {
    const m: string[] = [];
    if (cur.l === i) m.push("l");
    if (cur.r === i) m.push("r");
    if (cur.mid === i && cur.kind !== "test" && cur.kind !== "return") m.push("mid");
    return m;
  };

  let verdict = "";
  let tone: "" | " is-good" | " is-bad" | " is-warn" = "";
  if (done) {
    if (variant === "exact") {
      verdict = cur.result === -1 ? `返回 -1。Template A 只回答“在不在”：target ${input.target} 不在数组里。它的 l 停在 ${cur.l}，恰好也是插入位置，但那是副产品，不是这段代码的契约。` : `返回下标 ${cur.result}，nums[${cur.result}] = ${input.target}。`;
      tone = cur.result === -1 ? " is-warn" : " is-good";
    } else if (variant === "lowerBound") {
      verdict = `插入位置 = ${cur.result}${found >= 0 ? `（target 已存在，返回它第一次出现的位置）` : cur.result === n ? "（接在末尾）" : ""}。线性扫描验证：第一个 >= ${input.target} 的位置也是 ${expectedInsert}。`;
      tone = " is-good";
    } else if (cur.kind === "found") {
      verdict = `命中返回 ${cur.result}。这次没有暴露问题，因为 target 正好在数组里。`;
      tone = " is-warn";
    } else if (cur.result === expectedInsert) {
      verdict = `返回 ${cur.result}，碰巧等于正确的插入位置 ${expectedInsert}。错误没有暴露，不代表代码对：换成 target 比所有元素都大的用例再试。`;
      tone = " is-warn";
    } else {
      verdict = `返回 ${cur.result}，但正确的插入位置是 ${expectedInsert}。原因：l < r 在 l == r == ${cur.l} 时退出，nums[${cur.l}] = ${input.nums[cur.l]} 还没和 target 比过，就把它的下标当成了答案。`;
      tone = " is-bad";
    }
  }
  const narrTone = done ? tone : cur.kind === "right" && halfOpen ? " is-warn" : "";
  const codeTone = done ? (tone === " is-bad" ? "bad" : "done") : cur.kind === "right" && halfOpen ? "keep" : "run";

  return (
    <VisualizationFrame
      title="Search Insert：同一组输入，三种循环"
      description="选一个模板和一组输入，逐步执行。格子上方是下标，下方是 l、r、mid 的位置；右边高亮正在执行的 Python 行。"
      footnote="数组格子里，黄色是当前 mid，浅色是还可能含有答案的候选区间，灰色是已经排除的下标。虚线格 + 表示“插在末尾”这个位置：它没有值，但对 Lower Bound 来说是合法答案。"
    >
      <div className="viz-tabs" role="tablist" aria-label="模板">
        {VARIANTS.map((v) => <button key={v.id} type="button" role="tab" aria-selected={variant === v.id} className={`viz-tab${variant === v.id ? " is-on" : ""}`} onClick={() => choose(() => setVariant(v.id))}>{v.label}</button>)}
      </div>
      <p className="viz-k bs-blurb">{VARIANTS.find((v) => v.id === variant)!.blurb}</p>
      <div className="viz-controls">
        <div className="viz-chips" role="group" aria-label="预设输入">
          {PRESETS.map((p, i) => <button key={i} type="button" className={`viz-chip mono${!custom && preset === i ? " is-on" : ""}`} aria-pressed={!custom && preset === i} onClick={() => choose(() => { setCustom(null); setPreset(i); })}>[{p.nums.join(",")}], {p.target}</button>)}
        </div>
        <form className="bs-custom" onSubmit={(e) => { e.preventDefault(); applyCustom(); }}>
          <label>nums <input className="viz-mono" value={numsText} onChange={(e) => setNumsText(e.target.value)} size={14} aria-label="自定义数组，逗号分隔" /></label>
          <label>target <input className="viz-mono" value={targetText} onChange={(e) => setTargetText(e.target.value)} size={3} aria-label="自定义 target" /></label>
          <button type="submit" className={`viz-chip${custom ? " is-on" : ""}`}>用这组</button>
        </form>
      </div>

      <div className="viz-grid2 wide-left">
        <div>
          <div className="viz-panel">
            <h5 className="nocase">nums = [{input.nums.join(", ")}], target = {input.target}{n === 0 && "（空数组）"}</h5>
            <div className="bs-scroll">
              <div className="bs-array" style={{ gridTemplateColumns: `repeat(${slots.length}, var(--bs-cell))` }}>
                {slots.map((i) => <span key={`i${i}`} className="bs-index">{i}</span>)}
                {slots.map((i) => <span key={`v${i}`} className={cellClass(i)}>{i < 0 ? "—" : i === n ? "+" : input.nums[i]}</span>)}
                {slots.map((i) => <span key={`m${i}`} className="bs-marks">{markers(i).map((m) => <b key={m} className={`bs-mark is-${m}`}>{m}</b>)}</span>)}
              </div>
            </div>
            <div className="viz-stat bs-stat">
              <div><small>l</small><b>{cur.l}</b></div>
              <div><small>r{halfOpen ? "（开）" : ""}</small><b>{cur.r}</b></div>
              <div><small>mid</small><b>{cur.mid !== undefined && cur.kind !== "test" && cur.kind !== "return" ? cur.mid : "–"}</b></div>
              <div><small>候选区间</small><b className="bs-small">{done ? "已结束" : halfOpen ? `[${cur.l}, ${cur.r})` : cur.l > cur.r ? "空" : `[${cur.l}, ${cur.r}]`}</b></div>
            </div>
          </div>
          <StepControls step={step} total={trace.steps.length} onStep={setStep} />
          <div className={`viz-narr${narrTone}`}>{cur.note}{done && <><br /><strong>结果：</strong>{verdict}</>}</div>
        </div>
        <CodePanel code={trace.code} line={cur.line} tone={codeTone} title="Python" />
      </div>
    </VisualizationFrame>
  );
}
