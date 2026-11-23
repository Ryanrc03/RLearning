"use client";

import { useState } from "react";
import { BASE, headDim } from "@/lib/ml/transformerArch";
import { Arrow, BahFrame, Box, Legend, Markers, P, Sym } from "../bahdanau/shared";

type Focus = "none" | "attn" | "ffn" | "stack";

const W = 700;
const H = 330;
const ID = "ebf";
const D = BASE.dModel;
const STACK_Y = Array.from({ length: BASE.layers }, (_, i) => 250 - i * 34);

const NARR: Record<Focus, { text: string; tone?: string }> = {
  none: {
    text: `左边是一个 Encoder Block 的内部，从下往上读；右边是 ${BASE.layers} 个这样的块叠起来。每个箭头上的形状都是 ${D} × m。先看左边的两个子层，再看右边的堆叠。`,
  },
  attn: {
    text: `第一个子层：Multi-Head Self-Attention 让 m 个位置互相读信息（${BASE.heads} 个 head，每个 ${headDim(D, BASE.heads)} 维）。它的输出和输入相加（residual），再做 LayerNorm：A = LayerNorm(X + MultiHeadSelfAttn(X))。能相加，是因为 W_O 把输出映射回了 ${D} 维。`,
    tone: "is-warn",
  },
  ffn: {
    text: `第二个子层：FFN 对每个位置单独做一次 ${D} → ${BASE.dFf} → ${D} 的非线性变换，所有位置用同一套参数，位置之间不交换信息。同样是相加再 LayerNorm：Y = LayerNorm(A + FFN(A))。课堂图里的一个 Dense 是它的简化。`,
    tone: "is-warn",
  },
  stack: {
    text: `堆叠：上一块的输出是下一块的输入，形状一直是 ${D} × m。${BASE.layers} 个块结构相同、参数各自独立。最上面的输出 U 是整条序列的表示，有 m 列，不是像最早的 RNN Seq2Seq 那样只留一个最终状态。`,
    tone: "is-good",
  },
};

export default function EncoderBlockFigure() {
  const [focus, setFocus] = useState<Focus>("none");
  const on = (...f: Focus[]) => focus === "none" || f.includes(focus);
  const bold = (f: Focus) => focus === f;
  const narr = NARR[focus];
  const left = on("attn", "ffn");

  return (
    <BahFrame
      title={`图 4 · Encoder Block 与 ${BASE.layers} 层堆叠`}
      description="一个块里有两个子层：Self-Attention 和 FFN，各自外面套一圈 residual 相加与 LayerNorm。"
      footnote={<>画的是 2017 年原论文的 Post-LN 布局（先相加、再 LayerNorm），省略了 dropout。课堂截图里的块只画了 Attention + Dense，Add &amp; Norm 是补充的原论文细节。后来的很多实现改用 Pre-LN，不是这张图。</>}
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${focus === "attn" ? " is-on" : ""}`} onClick={() => setFocus("attn")}>Self-Attention 子层</button>
        <button type="button" className={`viz-btn${focus === "ffn" ? " is-on" : ""}`} onClick={() => setFocus("ffn")}>FFN 子层</button>
        <button type="button" className={`viz-btn${focus === "stack" ? " is-on" : ""}`} onClick={() => setFocus("stack")}>堆叠 × {BASE.layers}</button>
        <button type="button" className="viz-btn" onClick={() => setFocus("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${ID}-title ${ID}-desc`} style={{ minWidth: 640 }}>
          <title id={`${ID}-title`}>Encoder Block 的内部结构与堆叠</title>
          <desc id={`${ID}-desc`}>一个 Encoder Block 从下到上是：输入，Multi-Head Self-Attention，残差相加与 LayerNorm，逐位置的 FFN，再一次残差相加与 LayerNorm，输出。输入输出形状都是 {D} 乘 m。右侧 {BASE.layers} 个 Encoder Block 依次堆叠，最终输出 U。</desc>
          <Markers id={ID} />

          {/* one block, bottom to top */}
          <g opacity={left ? 1 : 0.28} className="bah-fade">
            <rect x={22} y={68} width={300} height={214} rx={10} fill="none" stroke={P.grey} strokeWidth={1} strokeDasharray="2 3" />
            <text x={32} y={62} fontSize={9.5} fontWeight={600} fill={P.ink}>一个 Encoder Block</text>
          </g>
          <Box x={82} y={294} w={180} h={26} tone="neu" title={`输入 ${D} × m`} dim={!left} size={10} />
          <Arrow id={ID} tone="neu" d="M172 294 V271" dim={!on("attn")} bold={bold("attn")} />
          <Box x={82} y={232} w={180} h={36} tone="att" title="Multi-Head Self-Attention" sub={`${BASE.heads} heads × ${headDim(D, BASE.heads)} 维`} dim={!on("attn")} bold={bold("attn")} size={10} />
          <Arrow id={ID} tone="neu" d="M172 232 V215" dim={!on("attn")} bold={bold("attn")} />
          <Box x={82} y={186} w={180} h={26} tone="par" title="Add & Norm" dim={!on("attn")} bold={bold("attn")} size={10} />
          <Arrow id={ID} tone="par" d="M172 282 H44 V199 H79" dim={!on("attn")} bold={bold("attn")} />
          <text x={50} y={244} fontSize={8.5} fill={P.sub} opacity={on("attn") ? 1 : 0.28} className="bah-fade">residual</text>

          <Arrow id={ID} tone="neu" d="M172 186 V167" dim={!on("ffn")} bold={bold("ffn")} />
          <Box x={82} y={128} w={180} h={36} tone="dec" title="Position-wise FFN" sub={`${D} → ${BASE.dFf} → ${D}`} dim={!on("ffn")} bold={bold("ffn")} size={10} />
          <Arrow id={ID} tone="neu" d="M172 128 V111" dim={!on("ffn")} bold={bold("ffn")} />
          <Box x={82} y={82} w={180} h={26} tone="par" title="Add & Norm" dim={!on("ffn")} bold={bold("ffn")} size={10} />
          <Arrow id={ID} tone="par" d="M172 176 H300 V95 H265" dim={!on("ffn")} bold={bold("ffn")} />
          <text x={294} y={140} fontSize={8.5} textAnchor="end" fill={P.sub} opacity={on("ffn") ? 1 : 0.28} className="bah-fade">residual</text>
          <Arrow id={ID} tone="neu" d="M172 82 V49" dim={!left} />
          <Box x={82} y={20} w={180} h={26} tone="dyn" title={`输出 ${D} × m`} dim={!left} size={10} />

          {/* stack of blocks */}
          <Box x={450} y={294} w={170} h={26} tone="neu" title={<><Sym b="Z" s="src" />：{D} × m</>} dim={!on("stack")} size={10} />
          {STACK_Y.map((y, i) => (
            <g key={y}>
              <Arrow id={ID} tone="neu" d={`M535 ${y + 34} V${y + 29}`} dim={!on("stack")} head={false} />
              <Box x={450} y={y} w={170} h={26} tone="att" title={`Encoder Block ${i + 1}`} dim={!on("stack")} bold={bold("stack")} size={10} />
            </g>
          ))}
          <Arrow id={ID} tone="enc" d={`M535 ${STACK_Y[BASE.layers - 1]} V49`} dim={!on("stack")} bold={bold("stack")} />
          <Box x={450} y={20} w={170} h={26} tone="enc" bold title={<>U：{D} × m</>} dim={!on("stack")} size={10} />
          <text x={632} y={170} fontSize={8.5} fill={P.sub} opacity={on("stack") ? 1 : 0.28} className="bah-fade">每一块</text>
          <text x={632} y={182} fontSize={8.5} fill={P.sub} opacity={on("stack") ? 1 : 0.28} className="bah-fade">{D} × m</text>
          <path d="M322 175 C 380 175, 390 263, 447 263" fill="none" stroke={P.grey} strokeWidth={1} strokeDasharray="2 3" opacity={focus === "none" ? 1 : 0.28} className="bah-fade" />
          <text x={386} y={210} fontSize={8.5} textAnchor="middle" fill={P.sub} opacity={focus === "none" ? 1 : 0.28} className="bah-fade">其中一块</text>
        </svg>
      </div>
      <Legend items={[{ tone: "att", label: "Self-Attention：位置之间交换信息" }, { tone: "dec", label: "FFN：每个位置各自变换" }, { tone: "par", label: "residual 相加与 LayerNorm" }, { tone: "enc", label: "Encoder 的最终输出 U" }]} />
      <div className={`viz-narr${narr.tone ? ` ${narr.tone}` : ""}`} aria-live="polite">{narr.text}</div>
    </BahFrame>
  );
}
