"use client";

import { useState } from "react";
import { SOURCE_TOKENS } from "@/lib/ml/bahdanau";
import { Arrow, BahFrame, Box, Legend, Markers, P, Sym } from "./shared";

type Focus = 0 | 1 | 2;

const W = 700;
const H = 300;
const ID = "tsd";
const H_X = [200, 285, 370, 455];

const NARR: Record<Focus, { text: string; tone?: string }> = {
  0: {
    text: "沿着底下一排橙色的状态从左往右读：s₀ → s₁ → s₂。每往前走一步之前，都先拿「上一个状态」去上面那组 Encoder 状态里做一次 Attention，得到这一步专用的 context，再用它更新状态。点按钮分别看两步。",
  },
  1: {
    text: "第 1 步（j = 1）：用 s₀ 和全部 hᵢ 做 Attention，得到 c₁；再用 s₀、上一个词 y₀（句首标记 <BOS>）的 embedding 和 c₁ 算出 s₁，由 s₁ 预测 y₁ =「我」。顺序是 s₀ → c₁ → s₁。",
    tone: "is-warn",
  },
  2: {
    text: "第 2 步（j = 2）：查询换成 s₁，Attention 模块和它的参数 θₐ 还是同一个，读的也是同一组 hᵢ，算出来的 c₂ 却和 c₁ 不同；再用 s₁、y₁ 的 embedding 和 c₂ 算出 s₂，预测 y₂ =「爱」。顺序是 s₁ → c₂ → s₂。",
    tone: "is-good",
  },
};

export default function TwoStepDecodeFigure() {
  const [focus, setFocus] = useState<Focus>(0);
  const d1 = focus === 2;
  const d2 = focus === 1;
  const b1 = focus === 1;
  const b2 = focus === 2;
  const narr = NARR[focus];

  return (
    <BahFrame
      title="图 4 · 两个 Decoder step：context 怎样进入下一个状态"
      description="按原论文的时序画：先用上一个状态做 Attention，再更新状态。两次 Attention 读同一组 Encoder 状态、用同一套参数。"
      footnote={<>时序是原论文的 sⱼ₋₁ → cⱼ → sⱼ。Encoder 状态只画了四个方块，原论文里它们来自双向 RNN。「我」「爱」是讲解用的译文。</>}
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${focus === 1 ? " is-on" : ""}`} onClick={() => setFocus(1)}>第 1 步 · j = 1</button>
        <button type="button" className={`viz-btn${focus === 2 ? " is-on" : ""}`} onClick={() => setFocus(2)}>第 2 步 · j = 2</button>
        <button type="button" className="viz-btn" onClick={() => setFocus(0)}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${ID}-title ${ID}-desc`} style={{ minWidth: 620 }}>
          <title id={`${ID}-title`}>带 Attention 的两步解码</title>
          <desc id={`${ID}-desc`}>第 1 步：s0 和全部 Encoder 状态经过 Attention 得到 c1，s0、y0 和 c1 一起得到 s1，s1 输出 y1。第 2 步：s1 和同一组 Encoder 状态经过同一个 Attention 得到 c2，s1、y1 和 c2 一起得到 s2，s2 输出 y2。</desc>
          <Markers id={ID} />

          {/* encoder states, computed once */}
          <rect x={150} y={6} width={356} height={50} rx={8} fill="none" stroke={P.enc} strokeWidth={1} strokeDasharray="2 3" />
          <text x={160} y={18} fontSize={8.5} fill={P.sub}>Encoder 状态：只算一次，每一步都读这同一组</text>
          {H_X.map((x, i) => (
            <Box key={x} x={x - 34} y={24} w={68} h={26} tone="enc" title={<><Sym b="h" s={String(i + 1)} /> · {SOURCE_TOKENS[i]}</>} size={9.5} />
          ))}
          <Arrow id={ID} tone="enc" d="M190 56 V93" dim={d1} bold={b1} />
          <Arrow id={ID} tone="enc" d="M460 56 V93" dim={d2} bold={b2} />

          {/* step 1 */}
          <Box x={28} y={210} w={64} h={36} tone="dec" title={<Sym b="s" s="0" />} sub="初始状态" dim={d1} bold={b1} />
          <Arrow id={ID} tone="dec" d="M60 210 V116 H127" dim={d1} bold={b1} />
          <Box x={130} y={96} w={120} h={40} tone="par" title="Attention" sub="Score → Softmax → Σ · θₐ" dim={d1} bold={b1} />
          <Arrow id={ID} tone="dyn" d="M190 136 V157" dim={d1} bold={b1} />
          <Box x={167} y={160} w={46} h={24} tone="dyn" title={<Sym b="c" s="1" />} dim={d1} bold={b1} />
          <Arrow id={ID} tone="dyn" d="M213 172 H312 V207" dim={d1} bold={b1} />
          <Arrow id={ID} tone="dec" d="M92 228 H295" dim={d1} bold={b1} />
          <Box x={150} y={266} w={84} h={24} tone="dec" title={<><Sym b="y" s="0" /> = {"<BOS>"}</>} dim={d1} size={9.5} />
          <Arrow id={ID} tone="dec" d="M234 278 H310 V249" dim={d1} bold={b1} />

          {/* s1 and y1 belong to both steps */}
          <Box x={298} y={210} w={64} h={36} tone="dec" title={<Sym b="s" s="1" />} bold={b1 || b2} />
          <Arrow id={ID} tone="dec" d="M348 246 V263" dim={d1} bold={b1} />
          <Box x={322} y={266} w={72} h={24} tone="dec" title={<><Sym b="y" s="1" /> = 我</>} size={9.5} />

          {/* step 2 */}
          <Arrow id={ID} tone="dec" d="M330 210 V116 H397" dim={d2} bold={b2} />
          <Box x={400} y={96} w={120} h={40} tone="par" title="Attention" sub="同一个模块 · 同一套 θₐ" dim={d2} bold={b2} />
          <Arrow id={ID} tone="dyn" d="M460 136 V157" dim={d2} bold={b2} />
          <Box x={437} y={160} w={46} h={24} tone="dyn" title={<Sym b="c" s="2" />} dim={d2} bold={b2} />
          <Arrow id={ID} tone="dyn" d="M483 172 H582 V207" dim={d2} bold={b2} />
          <Arrow id={ID} tone="dec" d="M362 228 H565" dim={d2} bold={b2} />
          <Arrow id={ID} tone="dec" d="M394 278 H580 V249" dim={d2} bold={b2} />
          <Box x={568} y={210} w={64} h={36} tone="dec" title={<Sym b="s" s="2" />} dim={d2} bold={b2} />
          <Arrow id={ID} tone="dec" d="M618 246 V263" dim={d2} bold={b2} />
          <Box x={592} y={266} w={72} h={24} tone="dec" title={<><Sym b="y" s="2" /> = 爱</>} dim={d2} size={9.5} />
          <text x={676} y={232} fontSize={11} textAnchor="middle" fill={P.sub} opacity={d2 ? 0.28 : 1} className="bah-fade">…</text>

          <text x={190} y={223} fontSize={8.5} textAnchor="middle" fill={P.sub} opacity={d1 ? 0.28 : 1} className="bah-fade">上一个状态</text>
          <text x={262} y={166} fontSize={8.5} textAnchor="middle" fill={P.sub} opacity={d1 ? 0.28 : 1} className="bah-fade">这一步的 context</text>
          <text x={272} y={272} fontSize={8.5} textAnchor="middle" fill={P.sub} opacity={d1 ? 0.28 : 1} className="bah-fade">上一个词</text>
        </svg>
      </div>
      <Legend items={[{ tone: "dec", label: "Decoder 状态 sⱼ 与输出的词 yⱼ" }, { tone: "par", label: "Attention 模块：两步共用一套 θₐ" }, { tone: "dyn", label: "每一步现算的 context cⱼ" }, { tone: "enc", label: "Encoder 状态" }]} />
      <div className={`viz-narr${narr.tone ? ` ${narr.tone}` : ""}`} aria-live="polite">{narr.text}</div>
    </BahFrame>
  );
}
