"use client";

import { useId, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Slider from "@/components/visualization/ml/primitives/Slider";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import { DEMO_EXPERTS, mmoeDemo } from "@/lib/ml/mmoe";

const colors = ["var(--v1)", "var(--v3)", "var(--v4)"];
const vector = (v: number[]) => `[${v.map((n) => n.toFixed(3)).join(", ")}]`;

export default function MmoeArchitectureFigure() {
  const [task, setTask] = useState<"ctr" | "like">("ctr");
  const [thirdLogits, setThirdLogits] = useState<[number, number]>([0, 0]);
  const selected = task === "ctr" ? 0 : 1;
  const tasks = mmoeDemo(thirdLogits);
  const current = tasks[selected];
  const marker = `mmoe-${useId().replace(/:/g, "")}`;
  const box = (x: number, y: number, w: number, title: string, detail: string, color: string) => <g>
    <rect x={x} y={y} width={w} height="50" rx="6" fill="var(--paper)" stroke={color} />
    <text x={x + w / 2} y={y + 20} textAnchor="middle" fontSize="13" fill="var(--ink)">{title}</text>
    <text x={x + w / 2} y={y + 39} textAnchor="middle" fontSize="11" fill="var(--muted)">{detail}</text>
  </g>;
  return <div className="ranking-viz mmoe-viz">
    <VisualizationFrame title="3 个共享 Expert，2 条独立 Gate 路径" description="固定一个样本 x 和三组演示专家向量。手动修改所选 Gate 的第三个 logit，Softmax 自动计算整组权重；这不是训练好的 Gate Network。">
      <div className="viz-row">
        <Tabs options={[{ key: "ctr", label: "CTR 路径" }, { key: "like", label: "Like 路径" }]} value={task} onChange={setTask} ariaLabel="高亮任务路径" />
        <button type="button" className="viz-btn" onClick={() => { setTask("ctr"); setThirdLogits([0, 0]); }}>重置</button>
      </div>
      <Slider label={`${current.task}：Expert 3 logit`} min={-4} max={4} step={0.1} value={thirdLogits[selected]} display={thirdLogits[selected].toFixed(1)} onChange={(v) => setThirdLogits((prev) => selected === 0 ? [v, prev[1]] : [prev[0], v])} />
      <Figure width={720} height={505} minWidth={620} label="输入同时进入三个共享专家与两个任务独立的 Gate；每个任务按自己的 Softmax 权重融合专家向量，再经任务塔和 Sigmoid 输出概率">
        <defs><marker id={marker} markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="none" stroke="context-stroke" /></marker></defs>
        <path d="M360 60 V76 M180 76 H540 M180 76 V97 M360 76 V97 M540 76 V97" stroke="var(--muted)" fill="none" />
        <path d="M265 35 H60 V215 M455 35 H660 V215" stroke="var(--v2)" strokeDasharray="5 4" fill="none" markerEnd={`url(#${marker})`} />
        {box(265, 10, 190, "Input Features · x", "x ∈ ℝⁿ · 同一份输入", "var(--vline)")}
        <rect x="92" y="89" width="536" height="80" rx="8" fill="none" stroke="var(--vline)" strokeDasharray="4 4" />
        {DEMO_EXPERTS.map((e, i) => <g key={i}>{box(105 + i * 180, 100, 150, `Shared Expert ${i + 1}`, `e${i + 1} = ${vector(e)}`, colors[i])}</g>)}
        <text x="360" y="190" textAnchor="middle" fontSize="12" fill="var(--muted)">共享参数池：所有任务都可使用这 3 个 d = 2 向量</text>
        {tasks.map((t, ti) => {
          const x = ti === 0 ? 230 : 490;
          const active = selected === ti;
          return <g key={t.task} opacity={active ? 1 : 0.3}>
            {t.gate.map((g, i) => <path key={i} d={`M${180 + 180 * i} 150 C${180 + 180 * i} 230 ${x} 240 ${x} 300`} fill="none" stroke={colors[i]} strokeWidth={1 + 8 * g} opacity={active ? 0.85 : 0.4} markerEnd={`url(#${marker})`} />)}
            {box(ti === 0 ? 8 : 608, 215, 104, `${t.task} Gate`, "Gₜ(x) → Softmax", "var(--v2)")}
            <path d={ti === 0 ? "M60 265 V325 H137" : "M660 265 V325 H583"} fill="none" stroke="var(--v2)" strokeDasharray="5 4" markerEnd={`url(#${marker})`} />
            {box(x - 90, 300, 180, `${t.task} Aggregation`, `h = ${vector(t.hidden)}`, active ? "var(--ink)" : "var(--vline)")}
            <path d={`M${x} 350 V385`} fill="none" stroke="var(--muted)" markerEnd={`url(#${marker})`} />
            {box(x - 90, 388, 180, `${t.task} Task Tower`, ti === 0 ? "z = h₁ − h₂ − 0.2" : "z = 0.5h₁ + h₂ − 0.8", "var(--vline)")}
            <path d={`M${x} 438 V460`} fill="none" stroke="var(--muted)" markerEnd={`url(#${marker})`} />
            <text x={x} y="482" textAnchor="middle" fontSize="13" fill="var(--ink)">Sigmoid → ŷ = {t.prediction.toFixed(4)}</text>
          </g>;
        })}
      </Figure>
      <div className="viz-legend"><span>实线粗细 = 专家权重</span><span>橙色虚线 = 输入到 Gate / Gate 的权重输出</span></div>
      <div className="viz-grid2 mmoe-gap">
        {tasks.map((t, ti) => <div className={`viz-panel${ti === selected ? " mmoe-selected" : ""}`} key={t.task}>
          <h5>{t.task} 独立门控</h5>
          <div>logits = {vector(t.logits)}</div>
          <div>g = {vector(t.gate)}</div>
          <div>Σg = {t.gate.reduce((s, p) => s + p, 0).toFixed(3)}</div>
        </div>)}
      </div>
      <div className="viz-narr" aria-live="polite">当前高亮 {current.task}：Expert 3 权重为 {(current.gate[2] * 100).toFixed(1)}%，h = {vector(current.hidden)}。另一任务有自己的 Gate，调整当前 logit 不改变它的权重。真实模型的 logits 由 Gₜ(x) 计算，并随输入 x 改变。</div>
    </VisualizationFrame>
  </div>;
}
