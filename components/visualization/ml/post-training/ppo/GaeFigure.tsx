"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Slider from "@/components/visualization/ml/primitives/Slider";
import StepPlayer from "@/components/visualization/ml/primitives/StepPlayer";
import { computeGae } from "@/lib/ml/ppo";

const REWARDS = [0, 0, 1];
const VALUES = [0.4, 0.6, 0.8];
const fmt = (value: number) => value.toFixed(3);

export default function GaeFigure() {
  const [lambda, setLambda] = useState(1);
  const [step, setStep] = useState(0);
  const current = 2 - step;
  const result = computeGae(REWARDS, VALUES, 1, lambda);
  const nextValue = VALUES[current + 1] ?? 0;
  const nextAdvantage = result.advantages[current + 1] ?? 0;
  return <div className="ranking-viz ppo-viz">
    <VisualizationFrame title="GAE：把末尾的奖励向前传" description="固定三个 action，r = [0, 0, 1]、V = [0.4, 0.6, 0.8]、γ = 1。按 t₃ → t₂ → t₁ 反向计算；λ 决定保留多少未来 TD residual。" footnote="教学示意值。真实终止状态的 V₄ = 0，A₄ = 0；value target 为 stop-gradient 的 A + V。这里没有对 advantage 做 batch 标准化。">
      <div className="viz-row">
        <Slider label="GAE λ" min={0} max={1} step={0.05} value={lambda} onChange={setLambda} display={lambda.toFixed(2)} />
      </div>
      <StepPlayer step={step} total={3} onStep={setStep} caption={`当前计算 t${current + 1} · 从右向左`} onReset={() => { setStep(0); setLambda(1); }} />
      <div className="viz-scroll">
        <svg style={{ minWidth: 510 }} viewBox="0 0 660 230" role="img" aria-label="GAE 的三步反向递推">
          <title>{`λ=${lambda.toFixed(2)}；当前 t${current + 1}，advantage=${fmt(result.advantages[current])}`}</title>
          {[0, 1, 2].map(i => {
            const active = i === current;
            const calculated = i >= current;
            const x = 10 + i * 220;
            return <g key={i} opacity={calculated ? 1 : 0.4}>
              <rect x={x} y={18} width={200} height={174} rx={8} fill="var(--ranking-paper)" stroke={active ? "var(--v1)" : "var(--vline)"} strokeWidth={active ? 2.5 : 1} />
              <text x={x + 14} y={42} fill="var(--ink)" fontSize={12} fontWeight={600}>{`t${i + 1}${active ? " · 当前" : ""}`}</text>
              <text x={x + 14} y={67} fill="var(--v2)" fontSize={12}>{`reward r${i + 1} = ${REWARDS[i]}`}</text>
              <text x={x + 14} y={89} fill="var(--v1)" fontSize={12}>{`value V${i + 1} = ${VALUES[i].toFixed(1)}`}</text>
              <text x={x + 14} y={117} fill="var(--ink)" fontSize={12}>{`δ${i + 1} = ${fmt(result.deltas[i])}`}</text>
              <text x={x + 14} y={143} fill="var(--v3)" fontSize={12} fontWeight={600}>{`A${i + 1} = ${calculated ? fmt(result.advantages[i]) : "待反传"}`}</text>
              <text x={x + 14} y={169} fill="var(--v3)" fontSize={12}>{`target = ${calculated ? fmt(result.returns[i]) : "待计算"}`}</text>
            </g>;
          })}
          <path d="M 430 210 H 25 M 25 210 l 8 -5 M 25 210 l 8 5" fill="none" stroke="var(--v3)" strokeWidth={1.5} />
          <text x={450} y={214} fontSize={11} fill="var(--muted)">末尾：V₄ = A₄ = 0</text>
        </svg>
      </div>
      <div className="viz-narr" aria-live="polite">
        <p className="viz-mono">{`δ${current + 1} = ${REWARDS[current]} + 1 × ${nextValue.toFixed(1)} − ${VALUES[current].toFixed(1)} = ${fmt(result.deltas[current])}`}</p>
        <p className="viz-mono">{`A${current + 1} = ${fmt(result.deltas[current])} + ${lambda.toFixed(2)} × ${fmt(nextAdvantage)} = ${fmt(result.advantages[current])}`}</p>
        <p className="viz-mono">{`target = A${current + 1} + V${current + 1} = ${fmt(result.returns[current])}`}</p>
        <p>{lambda === 0 ? "λ = 0：只保留当前一步 TD error，target 为 r + V_next。" : lambda === 1 ? "λ = 1：累加所有未来 TD error，三个 target 都回到完整回报 1。" : `λ = ${lambda.toFixed(2)}：未来每远一步，TD error 的权重再乘一次 λ。末尾 A₃ 不变，越靠前的 A 变化越大。`}</p>
      </div>
      <div className="viz-legend"><span style={{ color: "var(--v2)" }}>橙：reward</span><span style={{ color: "var(--v1)" }}>蓝：critic value</span><span style={{ color: "var(--v3)" }}>绿：advantage / target</span></div>
    </VisualizationFrame>
  </div>;
}
