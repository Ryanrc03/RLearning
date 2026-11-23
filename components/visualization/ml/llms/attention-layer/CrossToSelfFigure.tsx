"use client";

import { useState } from "react";
import { Arrow, BahFrame, Box, Legend, Markers, P, Sym } from "../bahdanau/shared";

type Focus = "none" | "cross" | "self";

const W = 700;
const H = 226;
const ID = "c2s";
const OX = 358;

const NARR: Record<Focus, { text: string; tone?: string }> = {
  none: {
    text: "左边的层有两个输入口，右边把同一个 X 接到了两个口上。层里面的三个投影矩阵和三步计算没有任何改动。",
  },
  cross: {
    text: "Cross-Attention，C = Attn(X, X′)：X 经过 W_K、W_V 给出 Key 和 Value，X′ 经过 W_Q 给出 Query。X 自己不需要 Query，X′ 自己不提供 Key 和 Value。输出 t 个 context，t 是 X′ 的长度。",
    tone: "is-warn",
  },
  self: {
    text: "Self-Attention，C = Attn(X, X)：同一个 X 被三个不同的矩阵投影三次，得到 Q、K、V。来源相同不等于 Q = K = V，因为 W_Q、W_K、W_V 是三个不同的矩阵。输出 m 个 context，仍然是向量，不是预测出的词。",
    tone: "is-good",
  },
};

export default function CrossToSelfFigure() {
  const [focus, setFocus] = useState<Focus>("none");
  const dimL = focus === "self";
  const dimR = focus === "cross";
  const boldL = focus === "cross";
  const boldR = focus === "self";
  const narr = NARR[focus];

  return (
    <BahFrame
      title="图 5 · 从 Attn(X, X′) 到 Attn(X, X)：只改了接线"
      description="令 X′ = X，Cross-Attention 就成了 Self-Attention。"
      footnote={<>Attn(X, X′) 是课堂的记号：第一个参数提供 Key / Value，第二个参数提供 Query。它不是某个库的参数顺序。</>}
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${focus === "cross" ? " is-on" : ""}`} onClick={() => setFocus("cross")}>Cross：两组输入</button>
        <button type="button" className={`viz-btn${focus === "self" ? " is-on" : ""}`} onClick={() => setFocus("self")}>Self：同一组输入</button>
        <button type="button" className="viz-btn" onClick={() => setFocus("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${ID}-title ${ID}-desc`} style={{ minWidth: 640 }}>
          <title id={`${ID}-title`}>从 Cross-Attention 到 Self-Attention</title>
          <desc id={`${ID}-desc`}>左侧 Cross-Attention：X 经过 W K 和 W V 得到 K 和 V，X prime 经过 W Q 得到 Q，一起进入 Attention，输出 t 个 context。右侧 Self-Attention：同一个 X 分别经过 W Q、W K、W V 得到 Q、K、V，进入 Attention，输出 m 个 context。</desc>
          <Markers id={ID} />
          <text x={175} y={16} fontSize={11} fontWeight={600} textAnchor="middle" fill={P.ink} opacity={dimL ? 0.28 : 1} className="bah-fade">Cross-Attention：C = Attn(X, X′)</text>
          <text x={OX + 171} y={16} fontSize={11} fontWeight={600} textAnchor="middle" fill={P.ink} opacity={dimR ? 0.28 : 1} className="bah-fade">Self-Attention：C = Attn(X, X)</text>
          <line x1={350} y1={6} x2={350} y2={H - 26} stroke={P.grey} strokeWidth={0.8} strokeDasharray="3 3" />
          <text x={350} y={H - 8} fontSize={10} fontWeight={600} textAnchor="middle" fill={P.ink}>令 X′ = X  →</text>

          {/* cross */}
          <Box x={12} y={52} w={62} h={34} tone="neu" title="X" sub="m 个向量" dim={dimL} bold={boldL} />
          <Arrow id={ID} tone="neu" d="M74 69 H84 V51 H93" dim={dimL} />
          <Arrow id={ID} tone="neu" d="M74 69 H84 V87 H93" dim={dimL} />
          <Box x={96} y={40} w={44} h={22} tone="neu" title={<Sym b="W" s="K" />} dim={dimL} size={10} />
          <Box x={96} y={76} w={44} h={22} tone="neu" title={<Sym b="W" s="V" />} dim={dimL} size={10} />
          <Arrow id={ID} tone="par" d="M140 51 H157" dim={dimL} bold={boldL} />
          <Arrow id={ID} tone="enc" d="M140 87 H157" dim={dimL} bold={boldL} />
          <Box x={160} y={39} w={40} h={24} tone="par" title="K" dim={dimL} bold={boldL} />
          <Box x={160} y={75} w={40} h={24} tone="enc" title="V" dim={dimL} bold={boldL} />
          <Box x={12} y={150} w={62} h={34} tone="neu" title="X′" sub="t 个向量" dim={dimL} bold={boldL} />
          <Arrow id={ID} tone="neu" d="M74 167 H93" dim={dimL} />
          <Box x={96} y={156} w={44} h={22} tone="neu" title={<Sym b="W" s="Q" />} dim={dimL} size={10} />
          <Arrow id={ID} tone="dec" d="M140 167 H157" dim={dimL} bold={boldL} />
          <Box x={160} y={155} w={40} h={24} tone="dec" title="Q" dim={dimL} bold={boldL} />
          <Arrow id={ID} tone="par" d="M200 51 H214 V96 H223" dim={dimL} bold={boldL} />
          <Arrow id={ID} tone="enc" d="M200 87 H208 V110 H223" dim={dimL} bold={boldL} />
          <Arrow id={ID} tone="dec" d="M200 167 H214 V128 H223" dim={dimL} bold={boldL} />
          <Box x={226} y={82} w={58} h={60} tone="att" title="Attn" dim={dimL} bold={boldL} />
          <Arrow id={ID} tone="dyn" d="M284 112 H295" dim={dimL} bold={boldL} />
          <Box x={298} y={92} w={44} h={40} tone="dyn" title="C" sub="t 个" dim={dimL} bold={boldL} />

          {/* self */}
          <Box x={OX + 12} y={95} w={62} h={34} tone="neu" title="X" sub="m 个向量" dim={dimR} bold={boldR} />
          <Arrow id={ID} tone="neu" d={`M${OX + 74} 112 H${OX + 84} V51 H${OX + 93}`} dim={dimR} />
          <Arrow id={ID} tone="neu" d={`M${OX + 74} 112 H${OX + 93}`} dim={dimR} />
          <Arrow id={ID} tone="neu" d={`M${OX + 74} 112 H${OX + 84} V173 H${OX + 93}`} dim={dimR} />
          <Box x={OX + 96} y={40} w={44} h={22} tone="neu" title={<Sym b="W" s="Q" />} dim={dimR} size={10} />
          <Box x={OX + 96} y={101} w={44} h={22} tone="neu" title={<Sym b="W" s="K" />} dim={dimR} size={10} />
          <Box x={OX + 96} y={162} w={44} h={22} tone="neu" title={<Sym b="W" s="V" />} dim={dimR} size={10} />
          <Arrow id={ID} tone="dec" d={`M${OX + 140} 51 H${OX + 157}`} dim={dimR} bold={boldR} />
          <Arrow id={ID} tone="par" d={`M${OX + 140} 112 H${OX + 157}`} dim={dimR} bold={boldR} />
          <Arrow id={ID} tone="enc" d={`M${OX + 140} 173 H${OX + 157}`} dim={dimR} bold={boldR} />
          <Box x={OX + 160} y={39} w={40} h={24} tone="dec" title="Q" dim={dimR} bold={boldR} />
          <Box x={OX + 160} y={100} w={40} h={24} tone="par" title="K" dim={dimR} bold={boldR} />
          <Box x={OX + 160} y={161} w={40} h={24} tone="enc" title="V" dim={dimR} bold={boldR} />
          <Arrow id={ID} tone="dec" d={`M${OX + 200} 51 H${OX + 214} V96 H${OX + 223}`} dim={dimR} bold={boldR} />
          <Arrow id={ID} tone="par" d={`M${OX + 200} 112 H${OX + 223}`} dim={dimR} bold={boldR} />
          <Arrow id={ID} tone="enc" d={`M${OX + 200} 173 H${OX + 214} V128 H${OX + 223}`} dim={dimR} bold={boldR} />
          <Box x={OX + 226} y={82} w={58} h={60} tone="att" title="Attn" dim={dimR} bold={boldR} />
          <Arrow id={ID} tone="dyn" d={`M${OX + 284} 112 H${OX + 295}`} dim={dimR} bold={boldR} />
          <Box x={OX + 298} y={92} w={40} h={40} tone="dyn" title="C" sub="m 个" dim={dimR} bold={boldR} />
        </svg>
      </div>
      <Legend items={[{ tone: "dec", label: "Query" }, { tone: "par", label: "Key" }, { tone: "enc", label: "Value" }, { tone: "att", label: "Attention（同一个层）" }, { tone: "dyn", label: "输出 context" }]} />
      <div className={`viz-narr${narr.tone ? ` ${narr.tone}` : ""}`} aria-live="polite">{narr.text}</div>
    </BahFrame>
  );
}
