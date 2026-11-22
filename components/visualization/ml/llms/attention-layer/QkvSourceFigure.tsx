"use client";

import { useState, type ReactNode } from "react";
import { Arrow, BahFrame, Box, Legend, Markers, P, Sym } from "../bahdanau/shared";

type Focus = "none" | "rnn" | "layer";

const W = 700;
const H = 216;
const ID = "qks";

const NARR: Record<Focus, { text: string; tone?: string }> = {
  none: {
    text: "两边的投影矩阵 W_Q、W_K、W_V 和后面的计算完全一样，区别只在最左边的输入：左边是 RNN 算出的状态，右边是任意两组输入向量。先看左右各自的三条线，再点按钮。",
  },
  rnn: {
    text: "Seq2Seq 里的写法：Encoder 的每个状态 hᵢ 同时投影出一个 Key kᵢ 和一个 Value vᵢ，Decoder 的状态 sⱼ 投影出一个 Query qⱼ。Query 来自 Decoder 一侧，Key 和 Value 都来自 Encoder 一侧。",
    tone: "is-warn",
  },
  layer: {
    text: "通用 Attention Layer：把 hᵢ、sⱼ 的位置换成两组输入向量 X 和 X′，它们可以是 embedding，也可以是别的网络的输出。这不是说 hᵢ 等于 xᵢ，而是这一层不再规定输入必须由 RNN 算出来。",
    tone: "is-good",
  },
};

function Panel({ ox, input, query, kvOut, qOut, dim, bold, sub }: { ox: number; input: ReactNode; query: ReactNode; kvOut: [ReactNode, ReactNode]; qOut: ReactNode; dim: boolean; bold: boolean; sub: [string, string] }) {
  return (
    <g>
      <Box x={ox + 16} y={52} w={104} h={36} tone="neu" title={input} sub={sub[0]} dim={dim} bold={bold} size={10} />
      <Arrow id={ID} tone="neu" d={`M${ox + 120} 70 H${ox + 134} V51 H${ox + 147}`} dim={dim} />
      <Arrow id={ID} tone="neu" d={`M${ox + 120} 70 H${ox + 134} V89 H${ox + 147}`} dim={dim} />
      <Box x={ox + 150} y={40} w={50} h={22} tone="neu" title={<Sym b="W" s="K" />} dim={dim} size={10} />
      <Box x={ox + 150} y={78} w={50} h={22} tone="neu" title={<Sym b="W" s="V" />} dim={dim} size={10} />
      <Arrow id={ID} tone="par" d={`M${ox + 200} 51 H${ox + 227}`} dim={dim} bold={bold} />
      <Arrow id={ID} tone="enc" d={`M${ox + 200} 89 H${ox + 227}`} dim={dim} bold={bold} />
      <Box x={ox + 230} y={38} w={96} h={26} tone="par" title={kvOut[0]} dim={dim} bold={bold} size={10} />
      <Box x={ox + 230} y={76} w={96} h={26} tone="enc" title={kvOut[1]} dim={dim} bold={bold} size={10} />

      <Box x={ox + 16} y={146} w={104} h={36} tone="neu" title={query} sub={sub[1]} dim={dim} bold={bold} size={10} />
      <Arrow id={ID} tone="neu" d={`M${ox + 120} 164 H${ox + 147}`} dim={dim} />
      <Box x={ox + 150} y={153} w={50} h={22} tone="neu" title={<Sym b="W" s="Q" />} dim={dim} size={10} />
      <Arrow id={ID} tone="dec" d={`M${ox + 200} 164 H${ox + 227}`} dim={dim} bold={bold} />
      <Box x={ox + 230} y={151} w={96} h={26} tone="dec" title={qOut} dim={dim} bold={bold} size={10} />
    </g>
  );
}

export default function QkvSourceFigure() {
  const [focus, setFocus] = useState<Focus>("none");
  const dimL = focus === "layer";
  const dimR = focus === "rnn";
  const narr = NARR[focus];

  return (
    <BahFrame
      title="图 1 · Q、K、V 从哪里来：Seq2Seq 里的写法与通用 Attention Layer"
      description="同样三个投影矩阵。左边的输入是 RNN 的隐藏状态，右边的输入是任意两组向量。"
      footnote={<>结构示意。W_Q、W_K、W_V 是可训练的矩阵，对每个位置都用同一个；Q、K、V 是把输入乘上它们现算出来的。</>}
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${focus === "rnn" ? " is-on" : ""}`} onClick={() => setFocus("rnn")}>Seq2Seq：输入是 RNN 状态</button>
        <button type="button" className={`viz-btn${focus === "layer" ? " is-on" : ""}`} onClick={() => setFocus("layer")}>通用 Layer：输入是 X、X′</button>
        <button type="button" className="viz-btn" onClick={() => setFocus("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${ID}-title ${ID}-desc`} style={{ minWidth: 640 }}>
          <title id={`${ID}-title`}>Q、K、V 的来源</title>
          <desc id={`${ID}-desc`}>左侧 Seq2Seq：Encoder 状态 h i 经过 W K 得到 key，经过 W V 得到 value；Decoder 状态 s j 经过 W Q 得到 query。右侧通用 Attention Layer：输入 X 经过 W K 和 W V 得到 K 和 V，输入 X prime 经过 W Q 得到 Q，不依赖 RNN。</desc>
          <Markers id={ID} />
          <text x={175} y={18} fontSize={11} fontWeight={600} textAnchor="middle" fill={P.ink} opacity={dimL ? 0.28 : 1} className="bah-fade">RNN Seq2Seq 里的 Attention</text>
          <text x={525} y={18} fontSize={11} fontWeight={600} textAnchor="middle" fill={P.ink} opacity={dimR ? 0.28 : 1} className="bah-fade">通用 Attention Layer</text>
          <line x1={350} y1={6} x2={350} y2={H - 6} stroke={P.grey} strokeWidth={0.8} strokeDasharray="3 3" />

          <Panel
            ox={0} dim={dimL} bold={focus === "rnn"}
            input={<>Encoder 状态 <Sym b="h" s="i" /></>} query={<>Decoder 状态 <Sym b="s" s="j" /></>}
            sub={["由 Encoder RNN 算出", "由 Decoder RNN 算出"]}
            kvOut={[<><Sym b="k" s="i" /> = <Sym b="W" s="K" /><Sym b="h" s="i" /></>, <><Sym b="v" s="i" /> = <Sym b="W" s="V" /><Sym b="h" s="i" /></>]}
            qOut={<><Sym b="q" s="j" /> = <Sym b="W" s="Q" /><Sym b="s" s="j" /></>}
          />
          <Panel
            ox={358} dim={dimR} bold={focus === "layer"}
            input={<>输入 <Sym b="x" s="i" />（X 的一列）</>} query={<>输入 <Sym b="x′" s="j" />（X′ 的一列）</>}
            sub={["embedding 或上游表示", "不要求经过 RNN"]}
            kvOut={[<><Sym b="k" s="i" /> = <Sym b="W" s="K" /><Sym b="x" s="i" /></>, <><Sym b="v" s="i" /> = <Sym b="W" s="V" /><Sym b="x" s="i" /></>]}
            qOut={<><Sym b="q" s="j" /> = <Sym b="W" s="Q" /><Sym b="x′" s="j" /></>}
          />
          <text x={175} y={204} fontSize={9} textAnchor="middle" fill={P.sub} opacity={dimL ? 0.28 : 1} className="bah-fade">Key、Value 来自 Encoder 一侧；Query 来自 Decoder 一侧</text>
          <text x={533} y={204} fontSize={9} textAnchor="middle" fill={P.sub} opacity={dimR ? 0.28 : 1} className="bah-fade">Key、Value 来自 X；Query 来自 X′</text>
        </svg>
      </div>
      <Legend items={[{ tone: "dec", label: "Query" }, { tone: "par", label: "Key" }, { tone: "enc", label: "Value" }, { tone: "neu", label: "输入与投影矩阵" }]} />
      <div className={`viz-narr${narr.tone ? ` ${narr.tone}` : ""}`} aria-live="polite">{narr.text}</div>
    </BahFrame>
  );
}
