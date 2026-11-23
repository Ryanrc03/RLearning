"use client";

import { useState } from "react";
import { Arrow, BahFrame, Box, Legend, Markers, P, Sym } from "../bahdanau/shared";

type Step = 0 | 1 | 2 | 3;

const W = 700;
const H = 300;
const ID = "usa";
const CELL_X = [120, 340, 560];

const STEPS: { key: Step; label: string }[] = [
  { key: 0, label: "全部" },
  { key: 1, label: "Step 1：算 h₁" },
  { key: 2, label: "Step 2：算 h₂" },
  { key: 3, label: "Step 3：算 h₃" },
];

const NARR: Record<Step, { text: string; tone?: string }> = {
  0: {
    text: "从左往右是时间。蓝色的 h 由绿色的 RNN 单元算出；每算出一个 h，Attention 就把到目前为止的全部 h 汇总成黄色的 c，交给下一步。顺序是 c₀ → h₁ → c₁ → h₂ → c₂ → h₃。",
  },
  1: {
    text: "Step 1：h₁ = tanh(A[x₁; c₀] + b)。这时还没有任何历史状态，c₀ 在这个演示里取零向量，所以 h₁ 只由 x₁ 决定。",
    tone: "is-warn",
  },
  2: {
    text: "Step 2：先用已有的 h₁ 算出 c₁。只有一个位置可看，softmax 的权重只能是 1，所以 c₁ = h₁。然后 h₂ = tanh(A[x₂; c₁] + b)。",
    tone: "is-warn",
  },
  3: {
    text: "Step 3：先用 h₁ 和 h₂ 算出 c₂ = α₂,₁h₁ + α₂,₂h₂，再算 h₃ = tanh(A[x₃; c₂] + b)。c₂ 只来自 h₁、h₂：图里没有从 h₃ 指回 c₂ 的箭头，否则 h₃ 就要依赖它自己了。",
    tone: "is-good",
  },
};

export default function UnrolledSelfAttentionFigure() {
  const [step, setStep] = useState<Step>(0);
  const on = (...s: Step[]) => step === 0 || s.includes(step);
  const bold = (s: Step) => step === s;
  const narr = NARR[step];

  return (
    <BahFrame
      title="图 2 · 按时间展开：c₀ → h₁ → c₁ → h₂ → c₂ → h₃"
      description="每一步用上一步留下的 context 和当前输入算出新的 hidden state，再把它并入下一份 context。点 Step 只高亮这一步用到的东西。"
      footnote={<>课堂的 SimpleRNN 简化版；c₀ 取零向量是演示假设。三个 RNN 方块共用一套 A、b，两个 Attention 方块共用一套打分参数。</>}
    >
      <div className="viz-controls" role="group" aria-label="选择时间步">
        {STEPS.map((s) => (
          <button key={s.key} type="button" aria-pressed={step === s.key} className={`viz-btn${step === s.key ? " is-on" : ""}`} onClick={() => setStep(s.key)}>{s.label}</button>
        ))}
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${ID}-title ${ID}-desc`} style={{ minWidth: 620 }}>
          <title id={`${ID}-title`}>SimpleRNN 加 Self-Attention 的时间展开</title>
          <desc id={`${ID}-desc`}>c0 和 x1 进入 RNN 得到 h1。h1 进入 Attention 得到 c1。c1 和 x2 进入 RNN 得到 h2。h1 和 h2 进入 Attention 得到 c2。c2 和 x3 进入 RNN 得到 h3。没有从 h3 回到 c2 的连线。</desc>
          <Markers id={ID} />

          {/* RNN cells, inputs and states */}
          {CELL_X.map((x, i) => {
            const s = (i + 1) as Step;
            return (
              <g key={x}>
                <Box x={x - 30} y={258} w={60} h={28} tone="dec" title={<Sym b="x" s={String(i + 1)} />} dim={!on(s)} bold={bold(s)} />
                <Arrow id={ID} tone="dec" d={`M${x} 258 V229`} dim={!on(s)} bold={bold(s)} />
                <Box x={x - 35} y={190} w={70} h={36} tone="par" title="RNN" sub="A, b" dim={!on(s)} bold={bold(s)} />
                <Arrow id={ID} tone="enc" d={`M${x} 190 V149`} dim={!on(s)} bold={bold(s)} />
              </g>
            );
          })}
          {/* h_1 is an input of steps 2 and 3, h_2 of step 3 */}
          <Box x={96} y={120} w={48} h={26} tone="enc" title={<Sym b="h" s="1" />} dim={!on(1, 2, 3)} bold={step !== 0} />
          <Box x={316} y={120} w={48} h={26} tone="enc" title={<Sym b="h" s="2" />} dim={!on(2, 3)} bold={step === 2 || step === 3} />
          <Box x={536} y={120} w={48} h={26} tone="enc" title={<Sym b="h" s="3" />} dim={!on(3)} bold={bold(3)} />

          {/* c_0 */}
          <Box x={14} y={196} w={44} h={24} tone="dyn" title={<Sym b="c" s="0" />} dim={!on(1)} bold={bold(1)} />
          <text x={36} y={234} fontSize={8.5} textAnchor="middle" fill={P.sub} opacity={on(1) ? 1 : 0.28} className="bah-fade">零向量</text>
          <Arrow id={ID} tone="dyn" d="M58 208 H82" dim={!on(1)} bold={bold(1)} />

          {/* attention after h_1 → c_1 → step 2 */}
          <Arrow id={ID} tone="enc" d="M144 133 H200 V79" dim={!on(2)} bold={bold(2)} />
          <Box x={180} y={40} w={100} h={36} tone="par" title="Attention" sub="读 h₁" dim={!on(2)} bold={bold(2)} />
          <Arrow id={ID} tone="dyn" d="M250 76 V95" dim={!on(2)} bold={bold(2)} />
          <Box x={228} y={98} w={44} h={24} tone="dyn" title={<Sym b="c" s="1" />} dim={!on(2)} bold={bold(2)} />
          <Arrow id={ID} tone="dyn" d="M250 122 V208 H302" dim={!on(2)} bold={bold(2)} />

          {/* attention after h_2 → c_2 → step 3 */}
          <Arrow id={ID} tone="enc" d="M120 120 V20 H430 V37" dim={!on(3)} bold={bold(3)} />
          <Arrow id={ID} tone="enc" d="M364 133 H415 V79" dim={!on(3)} bold={bold(3)} />
          <Box x={400} y={40} w={100} h={36} tone="par" title="Attention" sub="读 h₁、h₂" dim={!on(3)} bold={bold(3)} />
          <Arrow id={ID} tone="dyn" d="M470 76 V95" dim={!on(3)} bold={bold(3)} />
          <Box x={448} y={98} w={44} h={24} tone="dyn" title={<Sym b="c" s="2" />} dim={!on(3)} bold={bold(3)} />
          <Arrow id={ID} tone="dyn" d="M470 122 V208 H522" dim={!on(3)} bold={bold(3)} />

          {/* what comes next */}
          <g opacity={step === 0 ? 1 : 0.28} className="bah-fade">
            <path d="M584 133 H640 V98" fill="none" stroke={P.grey} strokeWidth={1.2} strokeDasharray="4 3" />
            <text x={640} y={90} fontSize={9} textAnchor="middle" fill={P.sub}>→ c₃ → h₄ …</text>
          </g>

          <text x={275} y={14} fontSize={8.5} textAnchor="middle" fill={P.sub} opacity={on(3) ? 1 : 0.28} className="bah-fade">h₁ 再被读一次</text>
        </svg>
      </div>
      <Legend items={[{ tone: "enc", label: "hidden state h₁、h₂、h₃" }, { tone: "dyn", label: "context c₀、c₁、c₂" }, { tone: "par", label: "RNN 单元与 Attention 模块" }, { tone: "dec", label: "输入 xₜ" }]} />
      <div className={`viz-narr${narr.tone ? ` ${narr.tone}` : ""}`} aria-live="polite">{narr.text}</div>
    </BahFrame>
  );
}
