"use client";

import { useState } from "react";
import { Arrow, BahFrame, Box, Legend, Markers, P } from "../bahdanau/shared";

type Focus = "none" | "orig" | "bert";

const W = 700;
const H = 226;
const ID = "bvt";

const NARR: Record<Focus, { text: string; tone?: string }> = {
  none: {
    text: "左边是上一章搭出来的原始 Transformer，右边是 BERT。BERT 只留下了 Encoder 这一个塔，上面接的不是 Decoder，而是两个用于预训练的预测头。",
  },
  orig: {
    text: "原始 Transformer：Encoder 读 source，Decoder 一边用带因果 mask 的 Self-Attention 读已经生成的前缀，一边用 Cross-Attention 读 Encoder 的输出，逐个生成下一个 token。它是为翻译这类「读一句、写一句」的任务设计的。",
    tone: "is-warn",
  },
  bert: {
    text: "BERT：只有 Encoder 堆叠，没有 Decoder，也没有因果 mask，每个位置都能同时看左右两侧。它不生成句子；预训练时在 Encoder 的输出上接 MLM 和 NSP 两个头。光去掉 Decoder 不会得到 BERT，关键在这两个预训练目标和它们的数据构造。",
    tone: "is-good",
  },
};

export default function BertVsTransformerFigure() {
  const [focus, setFocus] = useState<Focus>("none");
  const dimL = focus === "bert";
  const dimR = focus === "orig";
  const narr = NARR[focus];

  return (
    <BahFrame
      title="图 1 · 原始 Transformer 与 BERT：留下哪一半"
      description="BERT 的主干是 Transformer Encoder，不是完整的 Encoder–Decoder。"
      footnote={<>结构示意。Encoder 内部的 Self-Attention、FFN、residual 和 LayerNorm 见上一章；这里把一摞 Block 画成一个方框。</>}
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${focus === "orig" ? " is-on" : ""}`} onClick={() => setFocus("orig")}>原始 Transformer</button>
        <button type="button" className={`viz-btn${focus === "bert" ? " is-on" : ""}`} onClick={() => setFocus("bert")}>BERT</button>
        <button type="button" className="viz-btn" onClick={() => setFocus("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${ID}-title ${ID}-desc`} style={{ minWidth: 640 }}>
          <title id={`${ID}-title`}>原始 Transformer 与 BERT 的结构对比</title>
          <desc id={`${ID}-desc`}>左侧原始 Transformer：source token 进入 Encoder，Encoder 的输出送给 Decoder，Decoder 读入目标前缀并输出下一个 token 的概率。右侧 BERT：输入 token 进入 Encoder 堆叠，没有 Decoder；预训练时 Encoder 的输出接 MLM 头和 NSP 头。</desc>
          <Markers id={ID} />
          <text x={170} y={18} fontSize={11} fontWeight={600} textAnchor="middle" fill={P.ink} opacity={dimL ? 0.28 : 1} className="bah-fade">Original Transformer</text>
          <text x={525} y={18} fontSize={11} fontWeight={600} textAnchor="middle" fill={P.ink} opacity={dimR ? 0.28 : 1} className="bah-fade">BERT</text>
          <line x1={350} y1={6} x2={350} y2={H - 6} stroke={P.grey} strokeWidth={0.8} strokeDasharray="3 3" />

          {/* original */}
          <Box x={24} y={84} w={120} h={56} tone="enc" title="Encoder × 6" sub="双向 Self-Attention" dim={dimL} bold={focus === "orig"} />
          <Arrow id={ID} tone="enc" d="M144 112 H193" dim={dimL} />
          <text x={168} y={105} fontSize={9} textAnchor="middle" fill={P.sub} opacity={dimL ? 0.28 : 1} className="bah-fade">U</text>
          <Box x={196} y={84} w={130} h={56} tone="neu" title="Decoder × 6" sub="因果 Self-Attn + Cross-Attn" dim={dimL} bold={focus === "orig"} />
          <Arrow id={ID} tone="neu" d="M84 178 V143" dim={dimL} />
          <text x={84} y={192} fontSize={9.5} textAnchor="middle" fill={P.ink} opacity={dimL ? 0.28 : 1} className="bah-fade">source tokens</text>
          <Arrow id={ID} tone="neu" d="M261 178 V143" dim={dimL} />
          <text x={261} y={192} fontSize={9.5} textAnchor="middle" fill={P.ink} opacity={dimL ? 0.28 : 1} className="bah-fade">已生成的前缀</text>
          <Arrow id={ID} tone="neu" d="M261 84 V57" dim={dimL} />
          <text x={261} y={48} fontSize={9.5} textAnchor="middle" fill={P.ink} opacity={dimL ? 0.28 : 1} className="bah-fade">下一个 token 的概率</text>

          {/* BERT */}
          <Box x={384} y={84} w={140} h={56} tone="enc" bold title="Encoder stack" sub="12 或 24 层 · 双向 Self-Attention" dim={dimR} />
          <Arrow id={ID} tone="neu" d="M454 178 V143" dim={dimR} />
          <text x={454} y={192} fontSize={9.5} textAnchor="middle" fill={P.ink} opacity={dimR ? 0.28 : 1} className="bah-fade">[CLS] … [SEP] … [SEP]</text>
          <Arrow id={ID} tone="att" d="M524 100 H548 V77 H561" dim={dimR} />
          <Arrow id={ID} tone="dec" d="M524 124 H548 V147 H561" dim={dimR} />
          <Box x={564} y={60} w={120} h={34} tone="att" title="MLM Head" sub="猜被遮住的 token" dim={dimR} bold={focus === "bert"} />
          <Box x={564} y={130} w={120} h={34} tone="dec" title="NSP Head" sub="B 是不是 A 的下一句" dim={dimR} bold={focus === "bert"} />
          <text x={454} y={212} fontSize={9} textAnchor="middle" fill={P.sub} opacity={dimR ? 0.28 : 1} className="bah-fade">没有 Decoder，不做自回归生成</text>
        </svg>
      </div>
      <Legend items={[{ tone: "enc", label: "Transformer Encoder" }, { tone: "att", label: "MLM" }, { tone: "dec", label: "NSP" }, { tone: "neu", label: "输入，以及原始结构里的 Decoder" }]} />
      <div className={`viz-narr${narr.tone ? ` ${narr.tone}` : ""}`} aria-live="polite">{narr.text}</div>
    </BahFrame>
  );
}
