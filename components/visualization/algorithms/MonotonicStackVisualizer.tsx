"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import CodePanel from "./CodePanel";
import StepControls from "./StepControls";
import { fmtTime, sortCars, traceCarFleet, traceDailyTemperatures, type StackTrace } from "@/lib/algorithms/monotonicStack";

type Problem = "temps" | "fleet";
type TempsPreset = { kind: "temps"; temps: number[] };
type FleetPreset = { kind: "fleet"; target: number; position: number[]; speed: number[] };
type Preset = TempsPreset | FleetPreset;

const TEMPS_PRESETS: TempsPreset[] = [
  { kind: "temps", temps: [73, 74, 75, 71, 69, 72, 76, 73] },
  { kind: "temps", temps: [30, 30, 40] },
  { kind: "temps", temps: [30, 20, 40] },
  { kind: "temps", temps: [60, 50, 40, 30] },
];

const FLEET_PRESETS: FleetPreset[] = [
  { kind: "fleet", target: 12, position: [10, 8, 0, 5, 3], speed: [2, 4, 1, 1, 3] },
  { kind: "fleet", target: 4, position: [0, 2], speed: [4, 2] },
  { kind: "fleet", target: 100, position: [0, 2, 4], speed: [4, 2, 1] },
  { kind: "fleet", target: 10, position: [0, 5], speed: [1, 1] },
];

const PROBLEMS: { id: Problem; label: string; blurb: string }[] = [
  { id: "temps", label: "LC 739 · Daily Temperatures", blurb: "栈里是还没等到更暖一天的下标，从底到顶温度单调不增。新的一天进来时，把所有比它冷的栈顶弹出并结算。" },
  { id: "fleet", label: "LC 853 · Car Fleet", blurb: "按位置从近到远处理，栈里是每个车队到达 target 的时间，从底到顶严格递增。新车到得不比前队晚，就并入前队。" },
];

function parseInts(text: string, max: number): number[] | null {
  const trimmed = text.trim().replace(/^\[|\]$/g, "");
  if (!trimmed) return [];
  const parts = trimmed.split(/[,\s]+/).filter(Boolean).map(Number);
  if (parts.length > max || parts.some((x) => !Number.isInteger(x))) return null;
  return parts;
}

export default function MonotonicStackVisualizer() {
  const [problem, setProblem] = useState<Problem>("temps");
  const [presetIdx, setPresetIdx] = useState(0);
  const [custom, setCustom] = useState<Preset | null>(null);
  const [tempsText, setTempsText] = useState("34, 31, 33, 35, 31");
  const [targetText, setTargetText] = useState("20");
  const [posText, setPosText] = useState("6, 1, 12, 9");
  const [spdText, setSpdText] = useState("2, 3, 4, 1");
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);

  const presets: Preset[] = problem === "temps" ? TEMPS_PRESETS : FLEET_PRESETS;
  const input: Preset = custom && custom.kind === problem ? custom : presets[presetIdx];
  const trace: StackTrace = useMemo(
    () => (input.kind === "temps" ? traceDailyTemperatures(input.temps) : traceCarFleet(input.target, input.position, input.speed)),
    [input],
  );
  const cars = useMemo(() => (input.kind === "fleet" ? sortCars(input.target, input.position, input.speed) : []), [input]);
  const cur = trace.steps[Math.min(step, trace.steps.length - 1)];
  const done = cur.kind === "return";
  const n = cur.ans.length;
  const isTemps = input.kind === "temps";
  const values = isTemps ? input.temps : cars.map((c) => c.pos);

  const choose = (next: () => void) => { next(); setStep(0); setError(""); };
  const pickProblem = (id: Problem) => choose(() => { setProblem(id); setPresetIdx(0); setCustom(null); });
  const applyCustom = () => {
    if (problem === "temps") {
      const temps = parseInts(tempsText, 12);
      if (!temps) return setError("temps：最多 12 个整数，逗号分隔。");
      return choose(() => setCustom({ kind: "temps", temps }));
    }
    const target = Number(targetText);
    const position = parseInts(posText, 8);
    const speed = parseInts(spdText, 8);
    if (!Number.isInteger(target) || !position || !speed || !position.length) return setError("position / speed：1 到 8 个整数，target 为整数。");
    if (position.length !== speed.length) return setError("position 和 speed 长度要相同。");
    if (new Set(position).size !== position.length) return setError("position 不能重复（题目保证）。");
    if (position.some((p) => p < 0 || p >= target) || speed.some((s) => s < 1)) return setError("要求 0 <= position < target，speed >= 1。");
    choose(() => setCustom({ kind: "fleet", target, position, speed }));
  };

  const onStack = new Set(cur.stack);
  // On a pop step the snapshot has already removed the index; draw it once more, on top, in the "popping" style.
  const drawn = cur.kind === "pop" && cur.popped !== undefined ? [...cur.stack, cur.popped] : cur.stack;
  const stackTop = cur.stack[cur.stack.length - 1];
  const cellClass = (i: number) => {
    const c = ["ms-cell"];
    if (i === cur.i) c.push("is-now");
    if (cur.kind === "pop" && i === cur.popped) c.push("is-pop");
    else if (onStack.has(i)) c.push("is-stack");
    else if (isTemps ? cur.ans[i] > 0 : cur.ans[i] >= 0 && cur.ans[i] !== i) c.push("is-done");
    else if (done && isTemps && cur.ans[i] === 0) c.push("is-never");
    else if (done && !isTemps) c.push("is-stack");
    return c.join(" ");
  };
  const answerText = (i: number) => {
    if (isTemps) return cur.ans[i] > 0 ? String(cur.ans[i]) : done ? "0" : (i < cur.i || (cur.i === -1 && i < n && cur.kind !== "init")) || onStack.has(i) ? "?" : "·";
    if (cur.ans[i] < 0) return "·";
    return cur.ans[i] === i ? "队" : `→${cur.ans[i]}`;
  };

  const narrTone = done ? " is-good" : cur.kind === "pop" ? " is-warn" : "";
  const codeTone = done ? "done" : cur.kind === "pop" || cur.kind === "assign" ? "keep" : "run";
  const pops = trace.steps.slice(0, Math.min(step, trace.steps.length - 1) + 1).filter((s) => s.kind === "pop").length;
  const pushes = trace.steps.slice(0, Math.min(step, trace.steps.length - 1) + 1).filter((s) => s.kind === "push").length;

  return (
    <VisualizationFrame
      title="Monotonic Stack：一个下标最多进出各一次"
      description="选一道题和一组输入，逐步执行。上面是数组，每格下面是它的答案；右边是栈（栈顶在上）和正在执行的 Python 行。"
      footnote="数组格子里，黄色是当前处理的 i，蓝色是还留在栈里的下标，红色是正在被弹出的，绿色是答案已经确定的。Car Fleet 里“队”表示它是一个车队的领头，→k 表示它并入了车队 k。"
    >
      <div className="viz-tabs" role="tablist" aria-label="题目">
        {PROBLEMS.map((p) => <button key={p.id} type="button" role="tab" aria-selected={problem === p.id} className={`viz-tab${problem === p.id ? " is-on" : ""}`} onClick={() => pickProblem(p.id)}>{p.label}</button>)}
      </div>
      <p className="viz-k bs-blurb">{PROBLEMS.find((p) => p.id === problem)!.blurb}</p>
      <div className="viz-controls">
        <div className="viz-chips" role="group" aria-label="预设输入">
          {presets.map((p, i) => (
            <button key={i} type="button" className={`viz-chip mono${input === p ? " is-on" : ""}`} aria-pressed={input === p} onClick={() => choose(() => { setCustom(null); setPresetIdx(i); })}>
              {p.kind === "temps" ? `[${p.temps.join(",")}]` : `t=${p.target} p=[${p.position.join(",")}] s=[${p.speed.join(",")}]`}
            </button>
          ))}
        </div>
        <form className="bs-custom" onSubmit={(e) => { e.preventDefault(); applyCustom(); }}>
          {problem === "temps" ? (
            <label>temps <input className="viz-mono" value={tempsText} onChange={(e) => setTempsText(e.target.value)} size={18} aria-label="自定义温度数组，逗号分隔" /></label>
          ) : (
            <>
              <label>target <input className="viz-mono" value={targetText} onChange={(e) => setTargetText(e.target.value)} size={3} aria-label="自定义 target" /></label>
              <label>position <input className="viz-mono" value={posText} onChange={(e) => setPosText(e.target.value)} size={10} aria-label="自定义 position，逗号分隔" /></label>
              <label>speed <input className="viz-mono" value={spdText} onChange={(e) => setSpdText(e.target.value)} size={10} aria-label="自定义 speed，逗号分隔" /></label>
            </>
          )}
          <button type="submit" className={`viz-chip${custom && custom.kind === problem ? " is-on" : ""}`}>用这组</button>
        </form>
      </div>
      {error && <p className="viz-k bs-error" role="alert">{error}</p>}

      <div className="viz-grid2 wide-left">
        <div>
          <div className="viz-panel">
            <h5 className="nocase">
              {isTemps ? `temps = [${input.temps.join(", ")}]` : `target = ${input.target}，按 position 从大到小排序后`}
              {n === 0 && "（空数组）"}
            </h5>
            <div className="bs-scroll">
              <div className="ms-array" style={{ gridTemplateColumns: `auto repeat(${Math.max(n, 1)}, var(--bs-cell))` }}>
                <span className="ms-rowlabel">i</span>
                {Array.from({ length: n }, (_, i) => <span key={`i${i}`} className="bs-index">{i}</span>)}
                <span className="ms-rowlabel">{isTemps ? "temp" : "pos"}</span>
                {Array.from({ length: n }, (_, i) => <span key={`v${i}`} className={cellClass(i)}>{values[i]}</span>)}
                {!isTemps && <span className="ms-rowlabel">spd</span>}
                {!isTemps && cars.map((c, i) => <span key={`s${i}`} className="ms-sub">{c.spd}</span>)}
                {!isTemps && <span className="ms-rowlabel">t</span>}
                {!isTemps && cars.map((c, i) => <span key={`t${i}`} className="ms-sub">{fmtTime(c.time)}</span>)}
                <span className="ms-rowlabel">{isTemps ? "ans" : "fleet"}</span>
                {Array.from({ length: n }, (_, i) => <span key={`a${i}`} className={`ms-ans${(isTemps ? cur.ans[i] > 0 : cur.ans[i] >= 0 && cur.ans[i] !== i) ? " is-set" : ""}${cur.kind === "assign" && i === cur.popped ? " is-new" : ""}`}>{answerText(i)}</span>)}
                {n === 0 && <span className="ms-sub">—</span>}
              </div>
            </div>
            <div className="viz-stat bs-stat">
              <div><small>i</small><b>{cur.i >= 0 ? cur.i : "–"}</b></div>
              <div><small>栈顶</small><b>{stackTop !== undefined ? stackTop : "空"}</b></div>
              <div><small>压入 / 弹出</small><b>{pushes} / {pops}</b></div>
              <div><small>{isTemps ? "已结算" : "车队数"}</small><b>{isTemps ? cur.ans.filter((x) => x > 0).length : cur.stack.length}</b></div>
            </div>
          </div>
          <StepControls step={step} total={trace.steps.length} onStep={setStep} />
          <div className={`viz-narr${narrTone}`}>{cur.note}</div>
        </div>
        <div>
          <div className="viz-panel ms-stackpanel">
            <h5>stack{isTemps ? "（下标 · 温度）" : "（下标 · 到达时间）"}</h5>
            <div className="ms-stack" role="list" aria-label="栈，栈顶在上">
              {drawn.length === 0 && <span className="ms-empty">空</span>}
              {[...drawn].reverse().map((idx, k) => (
                <span key={idx} role="listitem" className={`ms-item${k === 0 ? " is-top" : ""}${cur.kind === "pop" && idx === cur.popped ? " is-pop" : ""}${cur.kind === "push" && idx === cur.i ? " is-new" : ""}`}>
                  <b>{idx}</b>
                  <span>{isTemps ? values[idx] : fmtTime(cars[idx].time)}</span>
                  {k === 0 && <small>top</small>}
                </span>
              ))}
              <span className="ms-base" aria-hidden="true" />
            </div>
          </div>
          <CodePanel code={trace.code} line={cur.line} tone={codeTone} title="Python" />
        </div>
      </div>
    </VisualizationFrame>
  );
}
