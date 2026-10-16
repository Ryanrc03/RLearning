"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import CodePanel from "./CodePanel";
import StepControls from "./StepControls";
import { kokoHours, traceKoko } from "@/lib/algorithms/binarySearch";

type Preset = { piles: number[]; h: number };

const PRESETS: Preset[] = [
  { piles: [3, 6, 7, 11], h: 8 },
  { piles: [30, 11, 23, 4, 20], h: 5 },
  { piles: [30, 11, 23, 4, 20], h: 6 },
];

function parsePiles(text: string): number[] | null {
  const parts = text.trim().replace(/^\[|\]$/g, "").split(/[,\s]+/).filter(Boolean).map(Number);
  if (!parts.length || parts.length > 8 || parts.some((x) => !Number.isInteger(x) || x < 1 || x > 60)) return null;
  return parts;
}

export default function KokoVisualizer() {
  const [preset, setPreset] = useState(0);
  const [custom, setCustom] = useState<Preset | null>(null);
  const [pilesText, setPilesText] = useState("5, 9, 12");
  const [hText, setHText] = useState("6");
  const [error, setError] = useState("");
  const [step, setStep] = useState(0);

  const input = custom ?? PRESETS[preset];
  const trace = useMemo(() => traceKoko(input.piles, input.h), [input]);
  const cur = trace.steps[Math.min(step, trace.steps.length - 1)];
  const done = cur.kind === "return";
  const probes = trace.steps.slice(0, Math.min(step, trace.steps.length - 1) + 1).filter((s) => s.kind === "right" || s.kind === "left");
  const maxPile = Math.max(...input.piles);

  const choose = (next: () => void) => { next(); setStep(0); setError(""); };
  const applyCustom = () => {
    const piles = parsePiles(pilesText);
    const h = Number(hText);
    if (!piles) return setError("piles：1 到 8 个 1–60 的整数。");
    if (!Number.isInteger(h) || h < piles.length) return setError(`h 必须是整数且 >= len(piles) = ${piles.length}，否则不存在可行速度。`);
    choose(() => setCustom({ piles, h }));
  };

  // Speed axis: one slot per candidate speed 1..maxPile.
  const W = 600;
  const pad = 14;
  const slotW = (W - 2 * pad) / maxPile;
  const x = (k: number) => pad + (k - 1) * slotW;
  const showMid = cur.mid !== undefined && cur.kind !== "test" && cur.kind !== "return";
  const tone = done ? " is-good" : cur.kind === "right" ? " is-warn" : cur.kind === "left" ? " is-bad" : "";
  const codeTone = done ? "done" : cur.kind === "right" ? "keep" : "run";
  // At the end, show the per-pile hours for the answer so the final frame is not empty.
  const shownSpeed = done ? cur.result : cur.hours ? cur.mid : undefined;
  const shownHours = done ? kokoHours(input.piles, cur.result!) : cur.hours;
  const shownTotal = shownHours?.reduce((a, b) => a + b, 0);
  const shownOk = shownTotal !== undefined && shownTotal <= input.h;
  const barMax = Math.max(input.h, ...(shownHours ?? [0]), 1);

  return (
    <VisualizationFrame
      title="Koko：在速度上二分"
      description="上面是候选速度的搜索空间，下面是当前速度下每堆要吃几小时。逐步执行，看 feasible(mid) 的结果如何决定排除哪一半。"
      footnote="feasible 为真时写 r = mid 而不是 r = mid - 1：当前速度可行，但它可能就是最小的可行速度，不能排除。为假时 l = mid + 1：mid 本身已经证明不行。"
    >
      <div className="viz-controls">
        <div className="viz-chips" role="group" aria-label="预设输入">
          {PRESETS.map((p, i) => <button key={i} type="button" className={`viz-chip mono${!custom && preset === i ? " is-on" : ""}`} aria-pressed={!custom && preset === i} onClick={() => choose(() => { setCustom(null); setPreset(i); })}>[{p.piles.join(",")}], h={p.h}</button>)}
        </div>
        <form className="bs-custom" onSubmit={(e) => { e.preventDefault(); applyCustom(); }}>
          <label>piles <input className="viz-mono" value={pilesText} onChange={(e) => setPilesText(e.target.value)} size={12} aria-label="自定义 piles，逗号分隔" /></label>
          <label>h <input className="viz-mono" value={hText} onChange={(e) => setHText(e.target.value)} size={3} aria-label="自定义 h" /></label>
          <button type="submit" className={`viz-chip${custom ? " is-on" : ""}`}>用这组</button>
        </form>
      </div>
      {error && <p className="viz-k bs-error" role="alert">{error}</p>}

      <div className="viz-grid2 wide-left">
        <div>
          <div className="viz-panel koko-axis">
            <h5 className="nocase">piles = [{input.piles.join(", ")}], h = {input.h} · 搜索空间 [1, {maxPile}]</h5>
            <div className="viz-scroll">
              <svg viewBox={`0 0 ${W} 74`} role="img" aria-label={`候选速度 ${cur.l} 到 ${cur.r}`}>
                {Array.from({ length: maxPile }, (_, i) => i + 1).map((k) => {
                  const gone = cur.excluded.some((e) => k >= e.from && k <= e.to);
                  const cand = k >= cur.l && k <= cur.r;
                  const isMid = showMid && k === cur.mid;
                  const fill = done && k === cur.result ? "#1baf7a" : isMid ? "#eda100" : gone ? "#e4dfcb" : cand ? "#cfe2f8" : "#efede4";
                  return (
                    <g key={k}>
                      <rect x={x(k) + 1} y={22} width={Math.max(slotW - 2, 1)} height={22} rx={3} fill={fill} stroke={isMid ? "#b77d00" : "none"} />
                      {(maxPile <= 16 || k === 1 || k === maxPile || k === cur.l || k === cur.r || isMid) && <text x={x(k) + slotW / 2} y={58} fontSize={10} textAnchor="middle" fill="#76796f" className="mono">{k}</text>}
                    </g>
                  );
                })}
                {!done && <>
                  <text x={x(cur.l) + slotW / 2} y={14} fontSize={10.5} fontWeight={600} textAnchor="middle" fill="#2a78d6">l{cur.l === cur.r ? " = r" : ""}</text>
                  {cur.l !== cur.r && <text x={x(cur.r) + slotW / 2} y={14} fontSize={10.5} fontWeight={600} textAnchor="middle" fill="#2a78d6">r</text>}
                </>}
                {showMid && <text x={x(cur.mid!) + slotW / 2} y={71} fontSize={10.5} fontWeight={600} textAnchor="middle" fill="#b77d00">mid</text>}
                {done && <text x={x(cur.result!) + slotW / 2} y={14} fontSize={10.5} fontWeight={600} textAnchor="middle" fill="#0a7a52">answer</text>}
              </svg>
            </div>
            <div className="viz-legend"><span><i style={{ background: "#cfe2f8" }} />候选速度 [l, r]</span><span><i style={{ background: "#eda100" }} />mid</span><span><i style={{ background: "#e4dfcb" }} />已排除</span></div>
          </div>

          <div className="viz-panel koko-piles">
            <h5 className="nocase">{shownSpeed !== undefined ? `速度 k = ${shownSpeed}${done ? "（答案）" : ""}：每堆需要的小时数` : "每堆需要的小时数（先算一个 mid）"}</h5>
            <div className="viz-bars">
              {input.piles.map((p, i) => {
                const hrs = shownHours?.[i];
                return (
                  <div className="viz-bar-row koko-row" key={i}>
                    <span className="viz-bar-label viz-mono">pile {p}</span>
                    <div className="viz-bar-track">{hrs !== undefined && <span style={{ width: `${(hrs / barMax) * 100}%`, background: shownOk ? "#1baf7a" : "#eb6834" }} />}</div>
                    <span className="viz-bar-val">{hrs !== undefined ? `⌈${p}/${shownSpeed}⌉ = ${hrs}` : "–"}</span>
                  </div>
                );
              })}
            </div>
            {shownTotal !== undefined && <p className={`koko-total${shownOk ? " is-good" : " is-bad"}`}>hours = {shownHours!.join(" + ")} = <b>{shownTotal}</b> {shownOk ? "<=" : ">"} h = {input.h} → feasible({shownSpeed}) = <b>{shownOk ? "True" : "False"}</b></p>}
          </div>

          <StepControls step={step} total={trace.steps.length} onStep={setStep} />
          <div className={`viz-narr${tone}`}>{cur.note}</div>
        </div>
        <div>
          <CodePanel code={trace.code} line={cur.line} tone={codeTone} title="Python" />
          <div className="viz-panel">
            <h5>Trace</h5>
            {probes.length ? (
              <table className="viz-table koko-trace">
                <thead><tr><th>#</th><th className="num">l</th><th className="num">r</th><th className="num">mid</th><th className="num">hours</th><th>ok?</th><th>move</th></tr></thead>
                <tbody>
                  {probes.map((s, i) => {
                    const before = trace.steps[trace.steps.indexOf(s) - 1];
                    return <tr key={i} className={s === cur ? "is-now" : undefined}><td>{i + 1}</td><td className="num">{before.l}</td><td className="num">{before.r}</td><td className="num">{s.mid}</td><td className="num">{s.total}</td><td>{s.feasible ? "True" : "False"}</td><td className="viz-mono">{s.kind === "right" ? `r = ${s.r}` : `l = ${s.l}`}</td></tr>;
                  })}
                  {done && <tr className="is-now"><td colSpan={7}>l = r = {cur.result} → answer = <b>{cur.result}</b></td></tr>}
                </tbody>
              </table>
            ) : <p className="viz-k">还没有任何一次 feasible 检查。按“下一步”。</p>}
          </div>
        </div>
      </div>
    </VisualizationFrame>
  );
}
