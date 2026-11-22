"use client";

import { useState } from "react";
import { attentionWeights } from "@/lib/ml/bahdanau";
import { C2_EXAMPLE_SCORES } from "@/lib/ml/rnnSelfAttention";
import { Arrow, BahFrame, Box, Legend, Markers, P, Sym } from "../bahdanau/shared";

type Step = 0 | 1 | 2 | 3;

const W = 700;
const H = 232;
const ID = "ssc";
const ROW_Y = [62, 138];
const ROW_H = 44;
const BAR_X = 438;
const BAR_MAX = 80;

const WEIGHTS = attentionWeights(C2_EXAMPLE_SCORES);
const fmt = (v: number) => v.toFixed(3);
const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

const STEPS: { key: Step; label: string }[] = [
  { key: 0, label: "全部" },
  { key: 1, label: "① Score" },
  { key: 2, label: "② Softmax" },
  { key: 3, label: "③ 加权求和" },
];

const NARR: Record<Step, { text: string; tone?: string }> = {
  0: {
    text: `这是图 2 里第二个 Attention 方块的内部：h₁、h₂ 各得一个分数，softmax 成权重，再加权求和成 c₂，交给第 3 步去算 h₃。示例分数是 [${C2_EXAMPLE_SCORES.join(", ")}]。`,
  },
  1: {
    text: `Score：同一个 align 函数分别给 h₁ 和 h₂ 打分，这里假设得到 ${C2_EXAMPLE_SCORES[0]} 和 ${C2_EXAMPLE_SCORES[1]}。分数是任意实数，还不是权重。`,
    tone: "is-warn",
  },
  2: {
    text: `Softmax：exp(1.2) ≈ 3.320，exp(0.4) ≈ 1.492，各自除以总和 4.812，得到 α ≈ [${WEIGHTS.map(fmt).join(", ")}]，也就是约 ${pct(WEIGHTS[0])} 和 ${pct(WEIGHTS[1])}，加起来是 1。`,
    tone: "is-warn",
  },
  3: {
    text: `加权求和：c₂ ≈ ${fmt(WEIGHTS[0])}·h₁ + ${fmt(WEIGHTS[1])}·h₂。h₂ 的权重小一些，但它没有被丢掉。c₂ 随后和 x₃ 一起进入 RNN：h₃ = tanh(A[x₃; c₂] + b)。`,
    tone: "is-good",
  },
};

export default function ScoreSoftmaxContextFigure() {
  const [step, setStep] = useState<Step>(0);
  const on = (s: Step) => step === 0 || step === s;
  const bold = (s: Step) => step === s;
  const narr = NARR[step];

  return (
    <BahFrame
      title="图 3 · c₂ 是怎么算出来的：Score → Softmax → Weighted Sum"
      description="和上一章相同的三步，只是被打分的不再是 Encoder 的状态，而是这条 RNN 自己已经算出的 h₁、h₂。"
      footnote={<>教学示例：分数 [{C2_EXAMPLE_SCORES.join(", ")}] 是假设的，不代表实际模型的训练结果；权重由它们经 softmax 算出。align 画成一个抽象的打分函数，课堂没有给出它的具体公式。</>}
    >
      <div className="viz-controls" role="group" aria-label="选择要看的步骤">
        {STEPS.map((s) => (
          <button key={s.key} type="button" aria-pressed={step === s.key} className={`viz-btn${step === s.key ? " is-on" : ""}`} onClick={() => setStep(s.key)}>{s.label}</button>
        ))}
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${ID}-title ${ID}-desc`} style={{ minWidth: 620 }}>
          <title id={`${ID}-title`}>由 h1 和 h2 计算 c2 的三步</title>
          <desc id={`${ID}-desc`}>h1 和 h2 分别经过同一个 align 打分函数得到分数 1.2 和 0.4；softmax 之后权重约为 0.690 和 0.310；加权求和得到 c2 约等于 0.690 乘 h1 加 0.310 乘 h2；c2 和 x3 一起进入 RNN 得到 h3。</desc>
          <Markers id={ID} />

          <text x={52} y={52} fontSize={9.5} textAnchor="middle" fill={P.sub}>历史状态</text>
          <text x={352} y={52} fontSize={9.5} textAnchor="middle" fill={P.sub} opacity={on(1) ? 1 : 0.28} className="bah-fade">分数 e</text>
          <text x={478} y={52} fontSize={9.5} textAnchor="middle" fill={P.sub} opacity={on(2) ? 1 : 0.28} className="bah-fade">权重 α</text>

          <Box x={150} y={8} w={150} h={32} tone="dec" title={<>查询 <Sym b="query" s="2" /></>} sub="由 t = 2 时的状态得到" dim={!on(1)} bold={bold(1)} size={10} />
          <Arrow id={ID} tone="dec" d={`M150 24 H130 V${ROW_Y[1] + 32}`} head={false} dim={!on(1)} bold={bold(1)} />

          {ROW_Y.map((y, i) => {
            const mid = y + ROW_H / 2;
            const bw = Math.round(WEIGHTS[i] * BAR_MAX * 10) / 10;
            return (
              <g key={y}>
                <Box x={16} y={y} w={72} h={ROW_H} tone="enc" title={<Sym b="h" s={String(i + 1)} />} />
                <Arrow id={ID} tone="enc" d={`M88 ${y + 13} H157`} dim={!on(1)} bold={bold(1)} />
                <Arrow id={ID} tone="dec" d={`M130 ${y + 32} H157`} dim={!on(1)} bold={bold(1)} />
                <Box x={160} y={y} w={136} h={ROW_H} tone="par" title={<>align( <Sym b="h" s={String(i + 1)} /> , <Sym b="query" s="2" /> )</>} sub="同一个打分函数" dim={!on(1)} bold={bold(1)} size={10} />
                <Arrow id={ID} tone="dyn" d={`M296 ${mid} H321`} dim={!on(1)} bold={bold(1)} />
                <Box x={324} y={mid - 13} w={56} h={26} tone="dyn" title={`e = ${C2_EXAMPLE_SCORES[i]}`} dim={!on(1)} bold={bold(1)} size={10} />
                <Arrow id={ID} tone="dyn" d={`M380 ${mid} H397`} dim={!on(2)} bold={bold(2)} />
                <g opacity={on(2) ? 1 : 0.28} className="bah-fade">
                  <rect x={BAR_X} y={mid - 9} width={BAR_MAX} height={18} rx={3} fill={P.surface} stroke={P.grey} strokeWidth={0.6} />
                  <rect x={BAR_X} y={mid - 9} width={bw} height={18} rx={3} fill={P.dyn} opacity={i === 0 ? 1 : 0.55} />
                  <text x={BAR_X + BAR_MAX / 2} y={mid - 13} fontSize={9} fontWeight={600} textAnchor="middle" fill={P.ink} className="mono">{fmt(WEIGHTS[i])}（{pct(WEIGHTS[i])}）</text>
                </g>
                {/* edge width follows the weight */}
                <path d={`M${BAR_X + BAR_MAX + 4} ${mid} L548 ${i === 0 ? 118 : 126}`} fill="none" stroke={P.dyn} strokeWidth={Math.round((1 + WEIGHTS[i] * 5) * 10) / 10} opacity={on(3) ? 1 : 0.28} className="bah-fade" />
              </g>
            );
          })}

          <g opacity={on(2) ? 1 : 0.28} className="bah-fade">
            <rect x={400} y={ROW_Y[0]} width={28} height={ROW_Y[1] + ROW_H - ROW_Y[0]} rx={6} fill={P.dynFill} stroke={P.dyn} strokeWidth={bold(2) ? 2.2 : 1.3} />
            <text transform={`translate(418 ${ROW_Y[0] + (ROW_Y[1] + ROW_H - ROW_Y[0]) / 2}) rotate(-90)`} fontSize={10.5} fontWeight={600} textAnchor="middle" fill={P.ink}>softmax</text>
          </g>

          <Box x={550} y={100} w={140} h={44} tone="dyn" title={<><Sym b="c" s="2" /> ≈ {WEIGHTS[0].toFixed(2)}<Sym b="h" s="1" /> + {WEIGHTS[1].toFixed(2)}<Sym b="h" s="2" /></>} sub="所有历史状态都参与" dim={!on(3)} bold={bold(3)} size={10} />
          <Arrow id={ID} tone="dyn" d="M620 144 V177" dim={!on(3)} bold={bold(3)} />
          <Box x={540} y={180} w={152} h={40} tone="par" title={<><Sym b="h" s="3" /> = tanh(A[<Sym b="x" s="3" />; <Sym b="c" s="2" />] + b)</>} sub="下一步的 RNN 更新" dim={!on(3)} bold={bold(3)} size={10} />
        </svg>
      </div>
      <Legend items={[{ tone: "enc", label: "已有的 hidden state" }, { tone: "par", label: "有可训练参数的模块" }, { tone: "dyn", label: "这一步现算出来的 e、α、c" }, { tone: "dec", label: "查询" }]} />
      <div className={`viz-narr${narr.tone ? ` ${narr.tone}` : ""}`} aria-live="polite">{narr.text}</div>
    </BahFrame>
  );
}
