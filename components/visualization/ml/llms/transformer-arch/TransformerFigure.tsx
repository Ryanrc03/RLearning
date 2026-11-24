"use client";

import { useState } from "react";
import { BASE } from "@/lib/ml/transformerArch";
import { Arrow, BahFrame, Box, Legend, Markers, P } from "../bahdanau/shared";

type Focus = "none" | "enc" | "wire" | "dec";

const W = 700;
const H = 408;
const ID = "tff";
const D = BASE.dModel;
/** Block k (1-based from the bottom) sits at BLOCK_Y[k − 1]. */
const BLOCK_Y = Array.from({ length: BASE.layers }, (_, i) => 296 - i * 38);
const BLOCK_H = 30;

const NARR: Record<Focus, { text: string; tone?: string }> = {
  none: {
    text: `左塔是 Encoder，右塔是 Decoder，各 ${BASE.layers} 块。蓝色的线是这张图的重点：Encoder 最上面的输出 U 接到每一个 Decoder Block 的 Cross-Attention 上。source 长度 m 和 target 长度 t 可以不同。`,
  },
  enc: {
    text: `Encoder：source token 经过 embedding 和位置编码，穿过 ${BASE.layers} 个块，得到 U（${D} × m）。给定输入后，这一侧只需要算一次，所有位置一起算。`,
    tone: "is-warn",
  },
  wire: {
    text: `连线：同一个 U 被送到全部 ${BASE.layers} 个 Decoder Block，在每一块里充当 Cross-Attention 的 Key 和 Value。它不是只在最底下那一块读一次，也没有接到 Decoder 的 Masked Self-Attention 上。每一块有自己的投影矩阵，读的是同一个 U。`,
    tone: "is-good",
  },
  dec: {
    text: `Decoder：右移后的 target token 经过 embedding 和位置编码，穿过 ${BASE.layers} 个块（每块三个子层），得到 ${D} × t 的状态，再经过 Linear 和 Softmax，变成每个目标位置上「下一个 token」的概率。`,
    tone: "is-warn",
  },
};

export default function TransformerFigure() {
  const [focus, setFocus] = useState<Focus>("none");
  const on = (...f: Focus[]) => focus === "none" || f.includes(focus);
  const bold = (f: Focus) => focus === f;
  const narr = NARR[focus];

  return (
    <BahFrame
      title="图 6 · 完整的 Transformer：两个塔和它们之间的连线"
      description="Encoder 的输出 U 接到每一个 Decoder Block。点按钮分别看两个塔和中间的连线。"
      footnote={<>2017 年原论文的 Encoder–Decoder 结构，{BASE.layers} + {BASE.layers} 层。每个块内部见图 4 和图 5；这里把块画成一个方框。只有 Decoder 最上面才有词表投影。</>}
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${focus === "enc" ? " is-on" : ""}`} onClick={() => setFocus("enc")}>Encoder</button>
        <button type="button" className={`viz-btn${focus === "wire" ? " is-on" : ""}`} onClick={() => setFocus("wire")}>U 的连线</button>
        <button type="button" className={`viz-btn${focus === "dec" ? " is-on" : ""}`} onClick={() => setFocus("dec")}>Decoder</button>
        <button type="button" className="viz-btn" onClick={() => setFocus("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${ID}-title ${ID}-desc`} style={{ minWidth: 640 }}>
          <title id={`${ID}-title`}>完整的 Transformer Encoder–Decoder</title>
          <desc id={`${ID}-desc`}>左侧 source token 经过 embedding 和位置编码进入 {BASE.layers} 个 Encoder Block，输出 U，形状 {D} 乘 m。右侧右移后的 target token 经过 embedding 和位置编码进入 {BASE.layers} 个 Decoder Block。U 连接到每一个 Decoder Block 的 Cross-Attention，作为 Key 和 Value。Decoder 的输出经过 Linear 和 Softmax 得到下一个 token 的概率。</desc>
          <Markers id={ID} />

          {/* encoder tower */}
          <text x={130} y={400} fontSize={9.5} textAnchor="middle" fill={P.ink} opacity={on("enc") ? 1 : 0.28} className="bah-fade">Source tokens（m 个）</text>
          <Arrow id={ID} tone="neu" d="M130 388 V371" dim={!on("enc")} />
          <Box x={50} y={344} w={160} h={24} tone="neu" title="Embedding + Positional Encoding" dim={!on("enc")} size={9} />
          {BLOCK_Y.map((y, i) => (
            <g key={y}>
              <Arrow id={ID} tone="neu" d={`M130 ${y + BLOCK_H + (i === 0 ? 18 : 8)} V${y + BLOCK_H + 3}`} dim={!on("enc")} />
              <Box x={50} y={y} w={160} h={BLOCK_H} tone="att" title={`Encoder Block ${i + 1}`} sub="Self-Attn → FFN" dim={!on("enc")} bold={bold("enc")} size={10} />
            </g>
          ))}
          <Arrow id={ID} tone="enc" d={`M130 ${BLOCK_Y[BASE.layers - 1]} V83`} dim={!on("enc", "wire")} bold={bold("enc") || bold("wire")} />
          <Box x={70} y={54} w={120} h={26} tone="enc" bold title={`U：${D} × m`} dim={!on("enc", "wire")} size={10} />

          {/* U goes to the cross-attention of every decoder block */}
          <Arrow id={ID} tone="enc" d={`M190 67 H330 V${BLOCK_Y[0] + BLOCK_H / 2}`} head={false} dim={!on("wire")} bold={bold("wire")} />
          {BLOCK_Y.map((y) => (
            <Arrow key={y} id={ID} tone="enc" d={`M330 ${y + BLOCK_H / 2} H447`} dim={!on("wire")} bold={bold("wire")} />
          ))}
          <text x={336} y={60} fontSize={9} fill={P.sub} opacity={on("wire") ? 1 : 0.28} className="bah-fade">同一个 U：Key + Value</text>
          <text x={440} y={BLOCK_Y[0] + BLOCK_H + 14} fontSize={8.5} textAnchor="end" fill={P.sub} opacity={on("wire") ? 1 : 0.28} className="bah-fade">接到每一块的 Cross-Attn</text>

          {/* decoder tower */}
          <text x={550} y={400} fontSize={9.5} textAnchor="middle" fill={P.ink} opacity={on("dec") ? 1 : 0.28} className="bah-fade">Shifted target tokens（t 个）</text>
          <Arrow id={ID} tone="neu" d="M550 388 V371" dim={!on("dec")} />
          <Box x={450} y={344} w={200} h={24} tone="neu" title="Embedding + Positional Encoding" dim={!on("dec")} size={9} />
          {BLOCK_Y.map((y, i) => (
            <g key={y}>
              <Arrow id={ID} tone="neu" d={`M550 ${y + BLOCK_H + (i === 0 ? 18 : 8)} V${y + BLOCK_H + 3}`} dim={!on("dec")} />
              <Box x={450} y={y} w={200} h={BLOCK_H} tone="dec" title={`Decoder Block ${i + 1}`} sub="Masked Self-Attn → Cross-Attn → FFN" dim={!on("dec", "wire")} bold={bold("dec")} size={10} />
            </g>
          ))}
          <Arrow id={ID} tone="neu" d={`M550 ${BLOCK_Y[BASE.layers - 1]} V83`} dim={!on("dec")} />
          <text x={556} y={97} fontSize={8.5} fill={P.sub} opacity={on("dec") ? 1 : 0.28} className="bah-fade">{D} × t</text>
          <Box x={450} y={54} w={200} h={26} tone="dyn" title="Linear（词表投影）+ Softmax" dim={!on("dec")} bold={bold("dec")} size={10} />
          <Arrow id={ID} tone="dyn" d="M550 54 V35" dim={!on("dec")} />
          <text x={550} y={26} fontSize={9.5} fontWeight={600} textAnchor="middle" fill={P.ink} opacity={on("dec") ? 1 : 0.28} className="bah-fade">下一个 token 的概率：|Vocab| × t</text>
        </svg>
      </div>
      <Legend items={[{ tone: "att", label: "Encoder Block" }, { tone: "dec", label: "Decoder Block" }, { tone: "enc", label: "Encoder 输出 U 及它的连线" }, { tone: "dyn", label: "词表投影与输出概率" }, { tone: "neu", label: "embedding 与位置编码" }]} />
      <div className={`viz-narr${narr.tone ? ` ${narr.tone}` : ""}`} aria-live="polite">{narr.text}</div>
    </BahFrame>
  );
}
