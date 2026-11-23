"use client";

import { useState } from "react";
import { Arrow, BahFrame, Box, Legend, Markers, P, Sym } from "../bahdanau/shared";

type Focus = "none" | "plain" | "attn";

const W = 700;
const H = 262;
const ID = "rva";
const LEFT = [60, 165, 270];
const RIGHT = [410, 520, 630];

const NARR: Record<Focus, { text: string; tone?: string }> = {
  none: {
    text: "左边是普通 RNN，右边是加了 Self-Attention 的 RNN，两边读的是同样三个输入。先比较 h₃ 的来路：左边只接上一个状态 h₂，右边接的是由 h₁、h₂ 汇总出来的 c₂。然后点按钮。",
  },
  plain: {
    text: "普通 RNN：h₃ = tanh(A[x₃; h₂] + b)。算 h₃ 时手里只有 x₃ 和 h₂，h₁ 没有直接连到这一步；x₁ 的信息要先进 h₁，再被 h₂ 吸收，才能影响 h₃。",
    tone: "is-warn",
  },
  attn: {
    text: "加了 Self-Attention：h₃ = tanh(A[x₃; c₂] + b)。h₁ 和 h₂ 都直接送进同一个 Attention 模块，按权重汇总成 c₂，再交给第 3 步。Attention 并不取消 RNN 的时间递推；它提供了额外的历史状态检索通道。",
    tone: "is-good",
  },
};

export default function RnnVsAttentionRnnFigure() {
  const [focus, setFocus] = useState<Focus>("none");
  const dimL = focus === "attn";
  const dimR = focus === "plain";
  const boldL = focus === "plain";
  const boldR = focus === "attn";
  const narr = NARR[focus];

  return (
    <BahFrame
      title="图 1 · 普通 RNN 与带 Self-Attention 的 RNN：h₃ 接的是什么"
      description="两边的 RNN 单元和输入完全一样，区别只在第 3 步读的是 h₂ 还是 c₂。"
      footnote={<>右边是课堂的 SimpleRNN 简化版；c₀、c₁ 的来历和 c₂ 一样，逐步展开见图 2。三个绿色的 RNN 方块是同一个单元在三个时间步上的展开，用的是同一套 A、b。</>}
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${focus === "plain" ? " is-on" : ""}`} onClick={() => setFocus("plain")}>普通 RNN：h₃ 接 h₂</button>
        <button type="button" className={`viz-btn${focus === "attn" ? " is-on" : ""}`} onClick={() => setFocus("attn")}>加 Attention：h₃ 接 c₂</button>
        <button type="button" className="viz-btn" onClick={() => setFocus("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${ID}-title ${ID}-desc`} style={{ minWidth: 620 }}>
          <title id={`${ID}-title`}>普通 RNN 与带 Self-Attention 的 RNN 对比</title>
          <desc id={`${ID}-desc`}>左侧普通 RNN：x1、x2、x3 依次进入 RNN 单元得到 h1、h2、h3，h3 只接收 x3 和 h2。右侧带 Self-Attention 的 RNN：h1 和 h2 一起进入 Attention 得到 c2，h3 接收 x3 和 c2。</desc>
          <Markers id={ID} />

          <text x={165} y={14} fontSize={11} fontWeight={600} textAnchor="middle" fill={P.ink} opacity={dimL ? 0.28 : 1} className="bah-fade">普通 RNN</text>
          <text x={520} y={14} fontSize={11} fontWeight={600} textAnchor="middle" fill={P.ink} opacity={dimR ? 0.28 : 1} className="bah-fade">RNN + Self-Attention</text>
          <line x1={340} y1={6} x2={340} y2={H - 6} stroke={P.grey} strokeWidth={0.8} strokeDasharray="3 3" />

          {/* left: plain RNN */}
          {LEFT.map((x, i) => {
            const key = i === 1;
            return (
              <g key={x}>
                <Box x={x - 30} y={222} w={60} h={28} tone="dec" title={<Sym b="x" s={String(i + 1)} />} dim={dimL} bold={boldL && i === 2} />
                <Arrow id={ID} tone="dec" d={`M${x} 222 V189`} dim={dimL} bold={boldL && i === 2} />
                <Box x={x - 32} y={150} w={64} h={36} tone="par" title="RNN" dim={dimL} bold={boldL && i === 2} />
                <Arrow id={ID} tone="enc" d={`M${x} 150 V113`} dim={dimL} bold={boldL && i === 2} />
                <Box x={x - 24} y={84} w={48} h={26} tone="enc" title={<Sym b="h" s={String(i + 1)} />} dim={dimL} bold={boldL && i >= 1} />
                {i < 2 && <Arrow id={ID} tone="enc" d={`M${x + 24} 97 H${x + 52} V168 H${LEFT[i + 1] - 35}`} dim={dimL} bold={boldL && key} />}
              </g>
            );
          })}
          <text x={228} y={64} fontSize={9} textAnchor="middle" fill={P.sub} opacity={dimL ? 0.28 : 1} className="bah-fade">h₃ 只直接接 h₂；h₁ 要先经过 h₂</text>

          {/* right: RNN + self-attention */}
          {RIGHT.map((x, i) => (
            <g key={x}>
              <Box x={x - 30} y={222} w={60} h={28} tone="dec" title={<Sym b="x" s={String(i + 1)} />} dim={dimR} bold={boldR && i === 2} />
              <Arrow id={ID} tone="dec" d={`M${x} 222 V189`} dim={dimR} bold={boldR && i === 2} />
              <Box x={x - 32} y={150} w={64} h={36} tone="par" title="RNN" dim={dimR} bold={boldR && i === 2} />
              <Arrow id={ID} tone="enc" d={`M${x} 150 V113`} dim={dimR} bold={boldR && i === 2} />
              <Box x={x - 24} y={84} w={48} h={26} tone="enc" title={<Sym b="h" s={String(i + 1)} />} dim={dimR} bold={boldR} />
              {i < 2 && (
                <g>
                  <Box x={x - 62} y={157} w={24} h={22} tone="dyn" title={<Sym b="c" s={String(i)} />} dim={dimR} size={9.5} />
                  <Arrow id={ID} tone="dyn" d={`M${x - 38} 168 H${x - 35}`} head={false} dim={dimR} />
                  <Arrow id={ID} tone="enc" d={`M${x} 84 V55`} dim={dimR} bold={boldR} />
                </g>
              )}
            </g>
          ))}
          <Box x={385} y={20} w={160} h={32} tone="par" title="Attention" sub="同一个模块读 h₁ 和 h₂" dim={dimR} bold={boldR} />
          <Arrow id={ID} tone="dyn" d="M545 36 H561" dim={dimR} bold={boldR} />
          <Box x={564} y={24} w={40} h={24} tone="dyn" title={<Sym b="c" s="2" />} dim={dimR} bold={boldR} />
          <Arrow id={ID} tone="dyn" d="M584 48 V168 H595" dim={dimR} bold={boldR} />
        </svg>
      </div>
      <Legend items={[{ tone: "enc", label: "hidden state hₜ" }, { tone: "dyn", label: "context cₜ：历史状态的加权汇总" }, { tone: "par", label: "有可训练参数的模块，各时间步共用" }, { tone: "dec", label: "当前输入 xₜ" }]} />
      <div className={`viz-narr${narr.tone ? ` ${narr.tone}` : ""}`} aria-live="polite">{narr.text}</div>
    </BahFrame>
  );
}
