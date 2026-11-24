"use client";

import { useState } from "react";
import { MLM_EXAMPLES, MLM_SENTENCE, mlmExampleLoss, mlmInput } from "@/lib/ml/bertPretrain";
import { Arrow, BahFrame, Box, Legend, Markers, P, Sym } from "../bahdanau/shared";

const W = 700;
const H = 330;
const ID = "mlm";
const cx = (i: number) => 86 + i * 80;
const BAR_X = 596;
const BAR_MAX = 60;

export default function MlmFigure() {
  const [idx, setIdx] = useState(0);
  const ex = MLM_EXAMPLES[idx];
  const input = mlmInput(ex);
  const loss = mlmExampleLoss(ex);
  const m = ex.position;

  return (
    <BahFrame
      title="图 3 · MLM：遮住一个 token，从它那个位置的输出猜回来"
      description="选一个要遮住的位置。只有这个位置的输出向量被送进 MLM Head 并计算 loss。"
      footnote={<>教学示例：四个候选词的概率是假设的，不是模型的真实推理结果；loss 由它们算出。词表实际有几万个 token，这里只画了概率最大的四个。灰色虚线是只在训练时存在的部分。</>}
    >
      <div className="viz-controls" role="group" aria-label="选择被遮住的位置">
        {MLM_EXAMPLES.map((e, k) => (
          <button key={e.target} type="button" aria-pressed={idx === k} className={`viz-btn${idx === k ? " is-on" : ""}`} onClick={() => setIdx(k)}>遮住第 {e.position + 1} 个：{e.target}</button>
        ))}
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${ID}-title ${ID}-desc`} style={{ minWidth: 660 }}>
          <title id={`${ID}-title`}>Masked Language Modeling 的前向计算与 loss</title>
          <desc id={`${ID}-desc`}>原句 the cat sat on the mat 的第 {m + 1} 个 token {ex.target} 被替换为 MASK。整句经过 BERT Encoder，取第 {m + 1} 个位置的输出向量送入 MLM Head，得到词表上的概率分布，其中 {ex.target} 的概率是 {ex.candidates[0].p}。交叉熵 loss 约为 {loss.toFixed(3)}，梯度经过 MLM Head 回到 Encoder 和 Embedding。</desc>
          <Markers id={ID} />

          {/* input with one masked position */}
          <text x={18} y={322} fontSize={8.5} fill={P.sub}>原句：{MLM_SENTENCE.join(" ")}</text>
          {input.map((tok, i) => (
            <g key={i}>
              <Box x={cx(i) - 34} y={272} w={68} h={26} tone={i === m ? "att" : "neu"} bold={i === m} title={tok} size={10} />
              <Arrow id={ID} tone="neu" d={`M${cx(i)} 272 V257`} />
              <Arrow id={ID} tone="dyn" d={`M${cx(i)} 214 V189`} dim={i !== m} bold={i === m} />
              <Box x={cx(i) - 26} y={160} w={52} h={26} tone="dyn" title={i === m ? <Sym b="u" s="M" /> : <Sym b="u" s={String(i + 1)} />} dim={i !== m} bold={i === m} />
            </g>
          ))}
          <Box x={40} y={214} w={492} h={40} tone="enc" title="BERT Encoder" sub="每个位置都能读到左右两侧的上下文" />

          {/* only the masked position goes to the head */}
          <Arrow id={ID} tone="att" d={`M${cx(m)} 160 V138 H548 V172 H557`} bold />
          <Box x={560} y={154} w={124} h={36} tone="att" bold title="MLM Head" sub="→ 词表上的 logits z" />
          <Arrow id={ID} tone="att" d="M622 154 V127" />
          <text x={622} y={20} fontSize={9.5} fontWeight={600} textAnchor="middle" fill={P.ink}>p = Softmax(z)</text>
          {ex.candidates.map((c, k) => {
            const y = 32 + k * 22;
            return (
              <g key={c.token}>
                <text x={BAR_X - 6} y={y + 12} fontSize={9.5} fontWeight={k === 0 ? 700 : 400} textAnchor="end" fill={P.ink}>{c.token}</text>
                <rect x={BAR_X} y={y + 2} width={BAR_MAX} height={14} rx={3} fill={P.surface} stroke={P.grey} strokeWidth={0.6} />
                <rect className="bah-bar" x={BAR_X} y={y + 2} width={Math.round(c.p * BAR_MAX * 10) / 10} height={14} rx={3} fill={P.att} opacity={k === 0 ? 1 : 0.5} />
                <text x={BAR_X + BAR_MAX + 5} y={y + 13} fontSize={9.5} fontWeight={k === 0 ? 700 : 400} fill={P.ink} className="mono">{c.p.toFixed(2)}</text>
              </g>
            );
          })}

          {/* loss and gradient: training only */}
          <Arrow id={ID} tone="grey" dashed d="M548 44 H275" />
          <Box x={16} y={24} w={256} h={42} tone="grey" dashed title={<>Cross-Entropy：L = −ln p({ex.target})</>} sub={`= −ln ${ex.candidates[0].p.toFixed(2)} ≈ ${loss.toFixed(3)}`} size={10} />
          <Arrow id={ID} tone="grey" dashed d="M26 66 V234 H37" />
          <text x={34} y={104} fontSize={8.5} fill={P.sub}>梯度：MLM Head → Encoder → Embeddings</text>
          <text x={150} y={84} fontSize={8.5} fill={P.sub}>目标：原来的 token「{ex.target}」</text>
        </svg>
      </div>
      <Legend items={[{ tone: "att", label: "MLM：被遮住的位置、MLM Head、预测分布" }, { tone: "enc", label: "BERT Encoder" }, { tone: "dyn", label: "输出的隐藏向量" }, { tone: "grey", label: "只在训练时存在：loss 与梯度" }]} />
      <div className="viz-narr" aria-live="polite">
        第 {m + 1} 个位置的「{ex.target}」被换成 [MASK]。Encoder 仍然给 6 个位置都输出了向量，但只有 u<sub>M</sub> 被送进 MLM Head。假设模型给「{ex.target}」的概率是 {ex.candidates[0].p.toFixed(2)}，loss 就是 −ln {ex.candidates[0].p.toFixed(2)} ≈ {loss.toFixed(3)}；这个概率越接近 1，loss 越接近 0。其余五个位置这一次不产生 MLM loss。
      </div>
    </BahFrame>
  );
}
