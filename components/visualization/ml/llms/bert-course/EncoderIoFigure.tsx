"use client";

import { useState } from "react";
import { MLM_SENTENCE } from "@/lib/ml/bertPretrain";
import { Arrow, BahFrame, Box, Legend, Markers, P, Sym } from "../bahdanau/shared";

const W = 700;
const H = 262;
const ID = "eio";
const N = MLM_SENTENCE.length;
const cx = (i: number) => 86 + i * 106;

export default function EncoderIoFigure() {
  const [sel, setSel] = useState(1);

  return (
    <BahFrame
      title="图 2 · Encoder 的输入和输出：进去 6 个向量，出来 6 个向量"
      description="每个输出位置对应一个输入位置，但它读的是整句。选一个输出，看哪些输入参与了它。"
      footnote={<>结构示意。Encoder 内部是多层 Block，这里只画出「每个输出都能读到所有位置」这一点；紫色连线表示信息的来源，不是某一层的注意力权重。</>}
    >
      <div className="viz-controls" role="group" aria-label="选择输出位置">
        {MLM_SENTENCE.map((tok, i) => (
          <button key={i} type="button" aria-pressed={sel === i} className={`viz-btn${sel === i ? " is-on" : ""}`} onClick={() => setSel(i)}>u<sub>{i + 1}</sub>（{tok}）</button>
        ))}
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${ID}-title ${ID}-desc`} style={{ minWidth: 640 }}>
          <title id={`${ID}-title`}>BERT Encoder 的输入与输出</title>
          <desc id={`${ID}-desc`}>六个 token the、cat、sat、on、the、mat 经过 Embedding 层变成 x1 到 x6，经过 BERT Encoder 得到 u1 到 u6。当前选中 u{sel + 1}，它由全部六个输入位置共同决定，包括它左边和右边的位置。</desc>
          <Markers id={ID} />

          <rect x={30} y={86} width={640} height={56} rx={8} fill={P.encFill} stroke={P.enc} strokeWidth={1.6} />

          {MLM_SENTENCE.map((_, j) => (
            <line key={j} x1={cx(j)} y1={140} x2={cx(sel)} y2={88} stroke={P.att} strokeWidth={j === sel ? 2.4 : 1.4} opacity={0.9} className="bah-fade" />
          ))}

          <rect x={176} y={105} width={348} height={18} rx={4} fill={P.encFill} opacity={0.92} />
          <text x={350} y={118} fontSize={9} fontWeight={600} textAnchor="middle" fill={P.ink}>BERT Encoder：多层 Transformer Encoder，双向 Self-Attention</text>
          <rect x={30} y={166} width={640} height={24} rx={6} fill={P.surface} stroke={P.sub} strokeWidth={1.2} />
          <text x={350} y={182} fontSize={9.5} fontWeight={600} textAnchor="middle" fill={P.ink}>Embedding Layer</text>

          {MLM_SENTENCE.map((tok, i) => (
            <g key={i}>
              <Box x={cx(i) - 34} y={224} w={68} h={26} tone="neu" title={tok} size={10} />
              <Arrow id={ID} tone="neu" d={`M${cx(i)} 224 V193`} />
              <Arrow id={ID} tone="neu" d={`M${cx(i)} 166 V145`} />
              <text x={cx(i) + 8} y={160} fontSize={9} fill={P.sub}><Sym b="x" s={String(i + 1)} /></text>
              <Arrow id={ID} tone="dyn" d={`M${cx(i)} 86 V55`} dim={i !== sel} bold={i === sel} />
              <Box x={cx(i) - 26} y={26} w={52} h={26} tone="dyn" title={<Sym b="u" s={String(i + 1)} />} dim={i !== sel} bold={i === sel} />
            </g>
          ))}
          <text x={350} y={14} fontSize={9} textAnchor="middle" fill={P.sub}>输出是 {N} 个隐藏向量（hidden vectors），还不是词的预测</text>
        </svg>
      </div>
      <Legend items={[{ tone: "neu", label: "输入 token 与 embedding" }, { tone: "enc", label: "BERT Encoder" }, { tone: "dyn", label: "输出的隐藏向量 uᵢ" }, { tone: "att", label: "参与这个输出的输入位置" }]} />
      <div className="viz-narr" aria-live="polite">
        u<sub>{sel + 1}</sub> 对应第 {sel + 1} 个位置的「{MLM_SENTENCE[sel]}」，但六条线都连到它：它自己、左边的 {sel} 个位置和右边的 {N - 1 - sel} 个位置都参与了它的计算。所以 u<sub>{sel + 1}</sub> 不等于「{MLM_SENTENCE[sel]}」的 embedding，它是放在这句话里的「{MLM_SENTENCE[sel]}」。输入 {N} 个位置，输出也是 {N} 个位置。
      </div>
    </BahFrame>
  );
}
