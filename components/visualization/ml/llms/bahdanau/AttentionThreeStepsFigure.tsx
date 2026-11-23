"use client";

import { useState } from "react";
import { EXAMPLE_SCORES, SOURCE_TOKENS, attentionWeights } from "@/lib/ml/bahdanau";
import { Arrow, BahFrame, Box, Legend, Markers, P, Sym } from "./shared";

type Step = 0 | 1 | 2 | 3;

const W = 700;
const H = 318;
const ID = "a3s";
const ROW_Y = [58, 114, 170, 226];
const ROW_H = 44;
const BAR_X = 462;
const BAR_MAX = 84;

const WEIGHTS = attentionWeights(EXAMPLE_SCORES);
const TOP = WEIGHTS.indexOf(Math.max(...WEIGHTS));
const fmt = (v: number) => v.toFixed(3);

const STEPS: { key: Step; label: string }[] = [
  { key: 0, label: "全部" },
  { key: 1, label: "① Score" },
  { key: 2, label: "② Softmax" },
  { key: 3, label: "③ 加权求和" },
];

const NARR: Record<Step, { text: string; tone?: string }> = {
  0: {
    text: `从左往右读：Decoder 的查询状态 sⱼ₋₁ 和每个 hᵢ 进同一个打分函数得到 e，softmax 把四个 e 变成和为 1 的权重 α，再用 α 把四个 hᵢ 加权求和成 cⱼ 送回 Decoder。这一步的示例分数是 [${EXAMPLE_SCORES.join(", ")}]。`,
  },
  1: {
    text: `第一步 Score：sⱼ₋₁ 分别和 h₁ 到 h₄ 配成四对，每一对算出一个实数 eⱼ,ᵢ。这里是 [${EXAMPLE_SCORES.join(", ")}]：machine 的分数最高。分数可以是负数，也不要求加起来等于 1，它还不是概率。`,
    tone: "is-warn",
  },
  2: {
    text: `第二步 Softmax：四个分数一起归一化，得到 α ≈ [${WEIGHTS.map(fmt).join(", ")}]。每个都不小于 0，加起来是 1。machine 拿到 ${fmt(WEIGHTS[TOP])}，其余三个词各 ${fmt(WEIGHTS[0])}，没有哪个被清零。`,
    tone: "is-warn",
  },
  3: {
    text: `第三步加权求和：cⱼ = ${WEIGHTS.map((w, i) => `${fmt(w)}·h${"₁₂₃₄"[i]}`).join(" + ")}。四个 hᵢ 全部参与，不是只挑权重最大的那个；cⱼ 和 hᵢ 一样长，随后交给 Decoder 用来生成第 j 个词。`,
    tone: "is-good",
  },
};

export default function AttentionThreeStepsFigure() {
  const [step, setStep] = useState<Step>(0);
  const on = (s: Step) => step === 0 || step === s;
  const bold = (s: Step) => step === s;
  const narr = NARR[step];

  return (
    <BahFrame
      title="图 2 · Bahdanau Attention 的三步：Score → Softmax → Weighted Sum"
      description="Decoder 每生成一个词之前，都对全部 Encoder 状态做一遍这三步。点按钮逐步看。"
      footnote={<>教学示例：分数 [{EXAMPLE_SCORES.join(", ")}] 是为了好算而构造的，不是某个模型的真实输出；权重由这组分数经 softmax 算出。Encoder 画成四个状态，原论文的 hᵢ 来自双向 RNN。</>}
    >
      <div className="viz-controls" role="group" aria-label="选择要看的步骤">
        {STEPS.map((s) => (
          <button key={s.key} type="button" aria-pressed={step === s.key} className={`viz-btn${step === s.key ? " is-on" : ""}`} onClick={() => setStep(s.key)}>{s.label}</button>
        ))}
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${ID}-title ${ID}-desc`} style={{ minWidth: 620 }}>
          <title id={`${ID}-title`}>Bahdanau Attention 的三步计算</title>
          <desc id={`${ID}-desc`}>Decoder 的状态 s j-1 和四个 Encoder 状态分别进入打分函数，得到分数 0、0、2、0；softmax 之后的权重约为 0.096、0.096、0.711、0.096；用这些权重对四个 Encoder 状态加权求和得到上下文向量 c j，送回 Decoder。</desc>
          <Markers id={ID} />

          {/* column headers */}
          <text x={60} y={48} fontSize={9.5} textAnchor="middle" fill={P.sub}>Encoder 状态</text>
          <text x={372} y={48} fontSize={9.5} textAnchor="middle" fill={P.sub} opacity={on(1) ? 1 : 0.28} className="bah-fade">分数 e</text>
          <text x={520} y={48} fontSize={9.5} textAnchor="middle" fill={P.sub} opacity={on(2) ? 1 : 0.28} className="bah-fade">权重 α（和为 1）</text>

          {/* query and its bus */}
          <Box x={170} y={6} w={150} h={32} tone="dec" title={<>查询：Decoder 状态 <Sym b="s" s="j−1" /></>} dim={!on(1)} bold={bold(1)} size={10} />
          <Arrow id={ID} tone="dec" d={`M170 22 H146 V${ROW_Y[3] + 32}`} head={false} dim={!on(1)} bold={bold(1)} />

          {/* weighted sum reads every h_i again */}
          <Arrow id={ID} tone="enc" d={`M60 ${ROW_Y[3] + ROW_H} V298 H636 V181`} dim={!on(3)} bold={bold(3)} />
          <text x={348} y={292} fontSize={9} textAnchor="middle" fill={P.sub} opacity={on(3) ? 1 : 0.28} className="bah-fade">全部 hᵢ 再进入一次：被各自的 αᵢ 加权</text>

          {ROW_Y.map((y, i) => {
            const mid = y + ROW_H / 2;
            const top = i === TOP;
            const bw = Math.round((WEIGHTS[i] / WEIGHTS[TOP]) * BAR_MAX * 10) / 10;
            return (
              <g key={y}>
                <Box x={20} y={y} w={80} h={ROW_H} tone="enc" title={<Sym b="h" s={String(i + 1)} />} sub={SOURCE_TOKENS[i]} />
                <Arrow id={ID} tone="enc" d={`M100 ${y + 13} H177`} dim={!on(1)} bold={bold(1)} />
                <Arrow id={ID} tone="dec" d={`M146 ${y + 32} H177`} dim={!on(1)} bold={bold(1)} />
                <Box x={180} y={y} w={130} h={ROW_H} tone="par" title={<>a( <Sym b="s" s="j−1" /> , <Sym b="h" s={String(i + 1)} /> )</>} sub="同一个打分函数" dim={!on(1)} bold={bold(1)} />
                <Arrow id={ID} tone="dyn" d={`M310 ${mid} H343`} dim={!on(1)} bold={bold(1)} />
                <Box x={346} y={mid - 13} w={52} h={26} tone="dyn" title={`e = ${EXAMPLE_SCORES[i]}`} dim={!on(1)} bold={bold(1)} size={10} />
                <Arrow id={ID} tone="dyn" d={`M398 ${mid} H419`} dim={!on(2)} bold={bold(2)} />
                <g opacity={on(2) ? 1 : 0.28} className="bah-fade">
                  <rect x={BAR_X} y={mid - 9} width={BAR_MAX} height={18} rx={3} fill={P.surface} stroke={P.grey} strokeWidth={0.6} />
                  <rect x={BAR_X} y={mid - 9} width={bw} height={18} rx={3} fill={P.dyn} opacity={top ? 1 : 0.5} />
                  <text x={BAR_X + BAR_MAX + 6} y={mid + 4} fontSize={10} fontWeight={top ? 700 : 400} fill={P.ink} className="mono">{fmt(WEIGHTS[i])}</text>
                  {top && <text x={BAR_X + BAR_MAX / 2} y={mid - 13} fontSize={8.5} fontWeight={600} textAnchor="middle" fill={P.ink}>最关注：machine</text>}
                </g>
                <Arrow id={ID} tone="dyn" d={`M584 ${mid} L616 ${Math.round(162 + (mid - 164) * 0.1)}`} dim={!on(3)} bold={bold(3)} />
              </g>
            );
          })}

          {/* softmax spans all four scores */}
          <g opacity={on(2) ? 1 : 0.28} className="bah-fade">
            <rect x={422} y={ROW_Y[0]} width={28} height={ROW_Y[3] + ROW_H - ROW_Y[0]} rx={6} fill={P.dynFill} stroke={P.dyn} strokeWidth={bold(2) ? 2.2 : 1.3} />
            <text transform={`translate(440 ${ROW_Y[0] + (ROW_Y[3] + ROW_H - ROW_Y[0]) / 2}) rotate(-90)`} fontSize={10.5} fontWeight={600} textAnchor="middle" fill={P.ink}>softmax</text>
          </g>

          {/* weighted sum → context → decoder */}
          <g opacity={on(3) ? 1 : 0.28} className="bah-fade">
            <circle cx={636} cy={162} r={18} fill={P.dynFill} stroke={P.dyn} strokeWidth={bold(3) ? 2.2 : 1.3} />
            <text x={636} y={167} fontSize={14} fontWeight={600} textAnchor="middle" fill={P.ink}>Σ</text>
            <text x={662} y={166} fontSize={8.5} fill={P.sub}>αᵢ·hᵢ</text>
          </g>
          <Arrow id={ID} tone="dyn" d="M636 144 V103" dim={!on(3)} bold={bold(3)} />
          <Box x={596} y={68} w={80} h={32} tone="dyn" title={<>Context <Sym b="c" s="j" /></>} dim={!on(3)} bold={bold(3)} size={10} />
          <Arrow id={ID} tone="dec" d="M636 68 V41" dim={!on(3)} bold={bold(3)} />
          <Box x={586} y={6} w={100} h={32} tone="dec" title="送回 Decoder" dim={!on(3)} bold={bold(3)} size={10} />
        </svg>
      </div>
      <Legend items={[{ tone: "enc", label: "Encoder 状态 hᵢ" }, { tone: "dec", label: "Decoder 这一侧" }, { tone: "par", label: "打分函数（参数可训练、各行共用）" }, { tone: "dyn", label: "这一步现算出来的 e、α、c" }]} />
      <div className={`viz-narr${narr.tone ? ` ${narr.tone}` : ""}`} aria-live="polite">{narr.text}</div>
    </BahFrame>
  );
}
