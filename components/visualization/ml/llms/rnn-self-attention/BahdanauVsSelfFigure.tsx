"use client";

import { useState } from "react";
import { Arrow, BahFrame, Box, Legend, Markers, P, Sym } from "../bahdanau/shared";

type Focus = "none" | "cross" | "self";

const W = 700;
const H = 246;
const ID = "bvs";

const NARR: Record<Focus, { text: string; tone?: string }> = {
  none: {
    text: "两边中间的 Attention 做的是同样的三步。区别在接线：左边被读的状态和发出查询的状态属于两条不同的序列，右边它们是同一条序列里的前后位置。",
  },
  cross: {
    text: "Bahdanau Attention：被读的是 Encoder 的全部状态 hᵢ（原文），查询来自 Decoder 的 sⱼ₋₁（译文一侧）。算出的 cⱼ 用来更新 Decoder 状态、生成第 j 个目标词。这是跨两条序列的检索。",
    tone: "is-warn",
  },
  self: {
    text: "RNN Self-Attention：被读的是这条 RNN 自己已经算出的 h₁ … hₜ，查询也来自同一条序列。算出的 cₜ 用来更新下一个状态 hₜ₊₁。「Self」指同一条序列内部，而且只看已经读过的位置，看不到后面的词。",
    tone: "is-good",
  },
};

export default function BahdanauVsSelfFigure() {
  const [focus, setFocus] = useState<Focus>("none");
  const dimL = focus === "self";
  const dimR = focus === "cross";
  const boldL = focus === "cross";
  const boldR = focus === "self";
  const narr = NARR[focus];

  return (
    <BahFrame
      title="图 6 · 两章的 Attention 接在哪里：跨序列与同一序列"
      description="计算相同，接入网络的位置不同。"
      footnote={<>结构示意，各只画了三个被读的状态。左边是上一章的时序 sⱼ₋₁ → cⱼ → sⱼ，右边是本章的 hₜ → cₜ → hₜ₊₁。</>}
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${focus === "cross" ? " is-on" : ""}`} onClick={() => setFocus("cross")}>Bahdanau：跨序列</button>
        <button type="button" className={`viz-btn${focus === "self" ? " is-on" : ""}`} onClick={() => setFocus("self")}>Self-Attention：同一序列</button>
        <button type="button" className="viz-btn" onClick={() => setFocus("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${ID}-title ${ID}-desc`} style={{ minWidth: 620 }}>
          <title id={`${ID}-title`}>Bahdanau Attention 与 RNN Self-Attention 的接线对比</title>
          <desc id={`${ID}-desc`}>左侧 Bahdanau Attention：Encoder 的状态 h1、h2、h3 和 Decoder 的状态 s j-1 进入 Attention，得到 c j，用于更新 Decoder 状态 s j。右侧 RNN Self-Attention：同一条 RNN 的状态 h1 到 h t 进入 Attention，查询来自 h t，得到 c t，用于更新下一个状态 h t+1。</desc>
          <Markers id={ID} />

          <text x={170} y={14} fontSize={11} fontWeight={600} textAnchor="middle" fill={P.ink} opacity={dimL ? 0.28 : 1} className="bah-fade">Bahdanau Attention（上一章）</text>
          <text x={525} y={14} fontSize={11} fontWeight={600} textAnchor="middle" fill={P.ink} opacity={dimR ? 0.28 : 1} className="bah-fade">RNN Self-Attention（本章）</text>
          <line x1={348} y1={6} x2={348} y2={H - 6} stroke={P.grey} strokeWidth={0.8} strokeDasharray="3 3" />

          {/* left: encoder states read by a decoder query */}
          <g opacity={dimL ? 0.28 : 1} className="bah-fade">
            <rect x={24} y={28} width={200} height={50} rx={8} fill="none" stroke={P.enc} strokeWidth={1} strokeDasharray="2 3" />
            <text x={34} y={41} fontSize={8.5} fill={P.sub}>Encoder 序列（原文）</text>
          </g>
          {[60, 124, 188].map((x, i) => (
            <Box key={x} x={x - 24} y={46} w={48} h={26} tone="enc" title={<Sym b="h" s={String(i + 1)} />} dim={dimL} />
          ))}
          <Arrow id={ID} tone="enc" d="M124 78 V107" dim={dimL} bold={boldL} />
          <Box x={64} y={110} w={120} h={36} tone="par" title="Attention" sub="Score → Softmax → Σ" dim={dimL} bold={boldL} />
          <g opacity={dimL ? 0.28 : 1} className="bah-fade">
            <rect x={24} y={170} width={300} height={54} rx={8} fill="none" stroke={P.dec} strokeWidth={1} strokeDasharray="2 3" />
            <text x={34} y={183} fontSize={8.5} fill={P.sub}>Decoder 序列（译文）</text>
          </g>
          <Box x={40} y={190} w={56} h={26} tone="dec" title={<Sym b="s" s="j−1" />} dim={dimL} bold={boldL} />
          <Arrow id={ID} tone="dec" d="M56 190 V128 H61" dim={dimL} bold={boldL} />
          <Arrow id={ID} tone="dyn" d="M184 128 H221" dim={dimL} bold={boldL} />
          <Box x={224} y={116} w={44} h={24} tone="dyn" title={<Sym b="c" s="j" />} dim={dimL} bold={boldL} />
          <Arrow id={ID} tone="dyn" d="M256 140 V187" dim={dimL} bold={boldL} />
          <Arrow id={ID} tone="dec" d="M96 203 H225" dim={dimL} />
          <Box x={228} y={190} w={56} h={26} tone="dec" title={<Sym b="s" s="j" />} dim={dimL} bold={boldL} />

          {/* right: one sequence reads its own earlier states */}
          <g opacity={dimR ? 0.28 : 1} className="bah-fade">
            <rect x={372} y={170} width={316} height={54} rx={8} fill="none" stroke={P.enc} strokeWidth={1} strokeDasharray="2 3" />
            <text x={530} y={238} fontSize={8.5} textAnchor="middle" fill={P.sub}>同一条 RNN 序列，从左往右</text>
          </g>
          {[404, 468, 532].map((x, i) => (
            <g key={x}>
              <Box x={x - 24} y={190} w={48} h={26} tone="enc" title={<Sym b="h" s={["1", "…", "t"][i]} />} dim={dimR} bold={boldR && i === 2} />
              <Arrow id={ID} tone="enc" d={`M${x} 190 V${i === 1 ? 149 : 160} ${i === 1 ? "" : `H468 V149`}`} dim={dimR} bold={boldR} head={i === 1} />
            </g>
          ))}
          <Box x={408} y={110} w={120} h={36} tone="par" title="Attention" sub="Score → Softmax → Σ" dim={dimR} bold={boldR} />
          <Arrow id={ID} tone="dyn" d="M528 128 H565" dim={dimR} bold={boldR} />
          <Box x={568} y={116} w={44} h={24} tone="dyn" title={<Sym b="c" s="t" />} dim={dimR} bold={boldR} />
          <Arrow id={ID} tone="dyn" d="M612 128 H640 V187" dim={dimR} bold={boldR} />
          <Box x={612} y={190} w={56} h={26} tone="enc" title={<Sym b="h" s="t+1" />} dim={dimR} bold={boldR} />
          <text x={468} y={100} fontSize={8.5} textAnchor="middle" fill={P.sub} opacity={dimR ? 0.28 : 1} className="bah-fade">查询也来自这条序列</text>
        </svg>
      </div>
      <Legend items={[{ tone: "enc", label: "被读的 hidden state" }, { tone: "dec", label: "Decoder 状态" }, { tone: "par", label: "Attention 模块" }, { tone: "dyn", label: "算出的 context" }]} />
      <div className={`viz-narr${narr.tone ? ` ${narr.tone}` : ""}`} aria-live="polite">{narr.text}</div>
    </BahFrame>
  );
}
