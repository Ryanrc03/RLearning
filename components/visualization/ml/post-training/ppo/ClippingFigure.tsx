"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Slider from "@/components/visualization/ml/primitives/Slider";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import { clipObjective } from "@/lib/ml/ppo";

const x = (ratio: number) => 62 + (ratio - 0.4) / 1.4 * 550;
const y = (value: number) => 156 - value / 2 * 116;
const path = (points: number[], value: (ratio: number) => number) => points.map((ratio, i) => `${i ? "L" : "M"}${x(ratio)},${y(value(ratio))}`).join(" ");

export default function ClippingFigure() {
  const [sign, setSign] = useState<"positive" | "negative">("positive");
  const [epsilon, setEpsilon] = useState(0.2);
  const [ratio, setRatio] = useState(1.4);
  const advantage = sign === "positive" ? 1 : -1;
  const result = clipObjective(ratio, advantage, epsilon);
  const lower = 1 - epsilon, upper = 1 + epsilon;
  const samples = [...new Set([0.4, lower, 1, upper, 1.8])].sort((a, b) => a - b);
  const activeStart = advantage > 0 ? upper : 0.4;
  const activeEnd = advantage > 0 ? 1.8 : lower;
  const objective = (r: number) => clipObjective(r, advantage, epsilon).objective;
  const active = result.objective < result.unclipped;
  const shade = `${path([activeStart, activeEnd], r => r * advantage)} L${x(activeEnd)},${y(objective(activeEnd))} L${x(activeStart)},${y(objective(activeStart))} Z`;

  return <div className="ranking-viz ppo-viz">
    <VisualizationFrame title="PPO clipping：只截断继续改善的那一侧" description="最大化 L = min(rA, clip(r, 1−ε, 1+ε)A)。切换 advantage 正负，观察平台从右侧移到左侧。" footnote="教学示意值；A 固定为 +1 或 −1。r = πθ(a|s) / πold(a|s)，此图画的是要最大化的 surrogate，实际 loss 常取它的负号。Clipping 不保证 KL 被硬性限制。">
      <Tabs options={[{ key: "positive", label: "A = +1 · 好 action" }, { key: "negative", label: "A = −1 · 坏 action" }]} value={sign} onChange={setSign} ariaLabel="advantage 正负" />
      <div className="viz-row" style={{ marginTop: 14 }}>
        <Slider label="裁剪范围 ε" min={0.05} max={0.4} step={0.05} value={epsilon} onChange={setEpsilon} display={epsilon.toFixed(2)} />
        <Slider label="概率比 r" min={0.4} max={1.8} step={0.01} value={ratio} onChange={setRatio} display={ratio.toFixed(2)} />
        <button type="button" className="viz-btn" onClick={() => { setSign("positive"); setEpsilon(0.2); setRatio(1.4); }}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg style={{ minWidth: 510 }} viewBox="0 0 660 324" role="img" aria-label="概率比与 clipped surrogate 曲线">
          <title>{`A=${advantage}，ε=${epsilon.toFixed(2)}，r=${ratio.toFixed(2)}；PPO objective=${result.objective.toFixed(3)}`}</title>
          {[-2, -1, 0, 1, 2].map(value => <g key={value}>
            <line x1={62} x2={612} y1={y(value)} y2={y(value)} stroke="var(--vline)" />
            <text x={50} y={y(value) + 4} fill="var(--muted)" fontSize={11} textAnchor="end">{value}</text>
          </g>)}
          <path d={shade} fill="var(--v2)" opacity={0.18} />
          {[lower, upper].map((boundary, i) => <g key={i}>
            <line x1={x(boundary)} x2={x(boundary)} y1={30} y2={282} stroke="var(--muted)" strokeDasharray="4 4" />
            <text x={x(boundary)} y={20} fontSize={11} textAnchor="middle" fill="var(--muted)">{`${i === 0 ? "1−ε" : "1+ε"}=${boundary.toFixed(2)}`}</text>
          </g>)}
          <path d={path(samples, r => r * advantage)} fill="none" stroke="var(--v1)" strokeWidth={5} opacity={0.55} />
          <path d={path(samples, objective)} fill="none" stroke="var(--v3)" strokeWidth={2.5} />
          <line x1={x(ratio)} x2={x(ratio)} y1={30} y2={282} stroke="var(--ink)" opacity={0.35} />
          <circle cx={x(ratio)} cy={y(result.unclipped)} r={5} fill="var(--ranking-paper)" stroke="var(--v1)" strokeWidth={2} />
          <circle cx={x(ratio)} cy={y(result.objective)} r={4} fill="var(--v3)" />
          {[0.4, 0.6, 1, 1.4, 1.8].map(value => <text key={value} x={x(value)} y={298} fill="var(--muted)" fontSize={11} textAnchor="middle">{value.toFixed(1)}</text>)}
          <text x={337} y={320} fill="var(--ink)" fontSize={12} textAnchor="middle">概率比 r = πθ / πold</text>
          <text x={12} y={155} fill="var(--ink)" fontSize={11} transform="rotate(-90 12 155)" textAnchor="middle">surrogate objective</text>
        </svg>
      </div>
      <div className="viz-legend"><span style={{ color: "var(--v1)" }}>蓝：raw = rA</span><span style={{ color: "var(--v3)" }}>绿：min(raw, clipped)</span><span style={{ color: "var(--v2)" }}>阴影：裁剪实际生效的差额</span></div>
      <div className="viz-narr" aria-live="polite">
        <p className="viz-mono">{`raw = ${result.unclipped.toFixed(3)} · clipped = ${result.clipped.toFixed(3)} · min = ${result.objective.toFixed(3)}`}</p>
        <p>{advantage > 0 ? `A > 0：增加好 action 的概率有利；r > ${upper.toFixed(2)} 后，继续增加不再提高这个样本的目标。` : `A < 0：降低坏 action 的概率有利；r < ${lower.toFixed(2)} 后，继续降低不再提高这个样本的目标。`}</p>
        <p>{active ? "当前位置在平台上：min 选择 clipped 分支，这个样本对 r 的局部梯度为 0。" : "当前位置 min 选择 raw 分支。朝错误方向的大步仍受惩罚，不能把 r 直接夹紧后就当作最终目标。"}</p>
      </div>
    </VisualizationFrame>
  </div>;
}
