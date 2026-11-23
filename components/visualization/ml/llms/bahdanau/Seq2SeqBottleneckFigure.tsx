"use client";

import { useState } from "react";
import { SOURCE_TOKENS } from "@/lib/ml/bahdanau";
import { Arrow, BahFrame, Box, Legend, Markers, P, Sym } from "./shared";

type Focus = "none" | "encoder" | "bottleneck";

const W = 690;
const H = 286;
const ID = "s2s";
const ENC_X = [70, 160, 250, 340];
const DEC_X = [548, 640];
const DEC_IN = ["<BOS>", "我"];
const DEC_OUT = ["我", "爱"];

const NARR: Record<Focus, { text: string; tone?: string }> = {
  none: {
    text: "蓝色是 Encoder，橙色是 Decoder。Encoder 每读一个词产生一个 hidden state，一共四个；但在这个基础结构里，只有最后一个 h₄ 被交给 Decoder。先看整体，再点上面的按钮。",
  },
  encoder: {
    text: "Encoder 这一侧：x₁ 到 x₄ 依次进入同一个 RNN 单元，得到 h₁、h₂、h₃、h₄。每个 hᵢ 都是一个定长向量，里面主要是读到第 i 个词为止的信息。这四个向量都算出来了，问题在下一步怎么用。",
    tone: "is-warn",
  },
  bottleneck: {
    text: "瓶颈在这里：Decoder 只拿到 h₄ 这一个定长向量来初始化自己。h₁、h₂、h₃ 没有通往 Decoder 的连线，早先的词只能靠被压进 h₄ 的那一部分间接起作用。句子越长，这张「便签」越不够写。",
    tone: "is-bad",
  },
};

export default function Seq2SeqBottleneckFigure() {
  const [focus, setFocus] = useState<Focus>("none");
  const dimEnc = focus === "bottleneck";
  const dimDec = focus === "encoder";
  const boldEnc = focus === "encoder";
  const boldPath = focus === "bottleneck";
  const narr = NARR[focus];

  return (
    <BahFrame
      title="图 1 · 没有 Attention 的 Seq2Seq：Decoder 只拿到最后一个状态"
      description="四个源词经过 Encoder 得到四个 hidden state，Decoder 只用最后一个来生成译文。点按钮看信息在哪里被压缩。"
      footnote={<>结构示意：Encoder 画成单向 RNN 链，RNN 也可以换成 LSTM 或 GRU。译文「我 爱 …」是讲解用的例子。</>}
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${focus === "encoder" ? " is-on" : ""}`} onClick={() => setFocus("encoder")}>Encoder 读入</button>
        <button type="button" className={`viz-btn${focus === "bottleneck" ? " is-on" : ""}`} onClick={() => setFocus("bottleneck")}>瓶颈在哪</button>
        <button type="button" className="viz-btn" onClick={() => setFocus("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${ID}-title ${ID}-desc`} style={{ minWidth: 600 }}>
          <title id={`${ID}-title`}>没有 Attention 的 Seq2Seq 结构</title>
          <desc id={`${ID}-desc`}>Encoder 依次读入 I、love、machine、learning，产生 h1 到 h4。只有 h4 作为固定长度向量传给 Decoder；h1、h2、h3 没有连到 Decoder。Decoder 依次生成 我、爱。</desc>
          <Markers id={ID} />

          <text x={205} y={16} fontSize={11} fontWeight={600} textAnchor="middle" fill={P.enc} opacity={dimEnc ? 0.28 : 1} className="bah-fade">Encoder（RNN / LSTM）</text>
          <text x={594} y={16} fontSize={11} fontWeight={600} textAnchor="middle" fill={P.dec} opacity={dimDec ? 0.28 : 1} className="bah-fade">Decoder</text>

          {/* h1..h3 cannot be read by the decoder */}
          <g opacity={dimDec ? 0.28 : 1} className="bah-fade">
            <path d="M44 62 V56 H276 V62" fill="none" stroke={boldPath ? "var(--vcrit)" : P.grey} strokeWidth={boldPath ? 1.8 : 1.2} />
            <text x={160} y={48} fontSize={9.5} fontWeight={boldPath ? 600 : 400} textAnchor="middle" fill={boldPath ? "var(--vcrit)" : P.sub}>h₁、h₂、h₃：算出来了，但 Decoder 读不到</text>
          </g>

          {ENC_X.map((x, i) => {
            const last = i === ENC_X.length - 1;
            const dimState = dimEnc && !last;
            return (
              <g key={x}>
                <Box x={x - 34} y={232} w={68} h={34} tone="enc" title={SOURCE_TOKENS[i]} sub={<Sym b="x" s={String(i + 1)} />} dim={dimEnc} bold={boldEnc} />
                <Arrow id={ID} tone="enc" d={`M${x} 232 V199`} dim={dimEnc} bold={boldEnc} />
                <Box x={x - 32} y={160} w={64} h={36} tone="enc" title="RNN" dim={dimEnc} bold={boldEnc} />
                {!last && <Arrow id={ID} tone="enc" d={`M${x + 32} 178 H${ENC_X[i + 1] - 35}`} dim={dimEnc} bold={boldEnc} />}
                <Arrow id={ID} tone="enc" d={`M${x} 160 V101`} dim={dimState} bold={boldEnc || (boldPath && last)} />
                <Box x={x - 24} y={72} w={48} h={26} tone="enc" title={<Sym b="h" s={String(i + 1)} />} dim={dimState} bold={boldEnc || (boldPath && last)} />
              </g>
            );
          })}

          {/* the only channel */}
          <Arrow id={ID} tone="dyn" d="M364 85 H399" bold={boldPath} dim={dimDec} />
          <Box x={402} y={64} w={96} h={42} tone="dyn" title="固定长度向量" sub="只有这一张「便签」" bold={boldPath} dim={dimDec} />
          <Arrow id={ID} tone="dyn" d="M450 106 V178 H513" bold={boldPath} dim={dimDec} />
          <text x={456} y={150} fontSize={8.5} fill={P.sub} opacity={dimDec ? 0.28 : 1} className="bah-fade">初始化 s₀</text>

          {DEC_X.map((x, i) => (
            <g key={x}>
              <Box x={x - 34} y={232} w={68} h={34} tone="dec" title={DEC_IN[i]} sub={<Sym b="y" s={String(i)} />} dim={dimDec} />
              <Arrow id={ID} tone="dec" d={`M${x} 232 V199`} dim={dimDec} />
              <Box x={x - 32} y={160} w={64} h={36} tone="dec" title="RNN" sub={<Sym b="s" s={String(i + 1)} />} dim={dimDec} bold={boldPath} />
              {i === 0 && <Arrow id={ID} tone="dec" d={`M${x + 32} 178 H${DEC_X[1] - 35}`} dim={dimDec} />}
              <Arrow id={ID} tone="dec" d={`M${x} 160 V101`} dim={dimDec} />
              <Box x={x - 30} y={72} w={60} h={26} tone="dec" title={<><Sym b="y" s={String(i + 1)} /> = {DEC_OUT[i]}</>} dim={dimDec} />
            </g>
          ))}
          <text x={682} y={182} fontSize={11} textAnchor="middle" fill={P.sub} opacity={dimDec ? 0.28 : 1} className="bah-fade">…</text>
        </svg>
      </div>
      <Legend items={[{ tone: "enc", label: "Encoder 与它的状态 hᵢ" }, { tone: "dec", label: "Decoder 与它生成的词" }, { tone: "dyn", label: "交给 Decoder 的那一个向量" }]} />
      <div className={`viz-narr${narr.tone ? ` ${narr.tone}` : ""}`} aria-live="polite">{narr.text}</div>
    </BahFrame>
  );
}
