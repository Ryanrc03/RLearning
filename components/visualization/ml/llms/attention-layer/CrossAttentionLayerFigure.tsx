"use client";

import { useState } from "react";
import { A_CROSS, CROSS_KEYS, LAYER_DIMS, layerShapes, shapeText } from "@/lib/ml/attentionLayer";
import { Arrow, BahFrame, Box, Legend, Markers, P, Sym } from "../bahdanau/shared";
import Heatmap from "./Heatmap";

const W = 700;
const H = 296;
const ID = "cal";
const S = layerShapes(LAYER_DIMS.cross);
const T = LAYER_DIMS.cross.t;
const QUERIES = Array.from({ length: T }, (_, j) => `q${"₁₂₃₄₅"[j]}`);
const SUBS = "₁₂₃₄₅";

export default function CrossAttentionLayerFigure() {
  const [j, setJ] = useState(0);
  const row = A_CROSS[j];
  const top = row.indexOf(Math.max(...row));

  return (
    <BahFrame
      title="图 3 · Cross-Attention Layer：两组输入进，一组 context 出"
      description="X 有 4 个向量，提供 Key 和 Value；X′ 有 5 个向量，提供 Query。输出是 5 个 context。选一个 Query 看它那一行权重。"
      footnote={<>教学构造数据：右边是示意的 softmax 后权重，每行和为 1，不是真实训练结果。行是 Query、列是 Key，所以格子 A[j, i] 就是推导里的 α<sub>ij</sub>。形状按每行一个 token 的写法标注。</>}
    >
      <div className="viz-controls" role="group" aria-label="选择 Query">
        {QUERIES.map((q, k) => (
          <button key={q} type="button" aria-pressed={j === k} className={`viz-btn${j === k ? " is-on" : ""}`} onClick={() => setJ(k)}>{q}</button>
        ))}
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${ID}-title ${ID}-desc`} style={{ minWidth: 660 }}>
          <title id={`${ID}-title`}>Cross-Attention Layer 的输入、输出与权重矩阵</title>
          <desc id={`${ID}-desc`}>输入 X 的 4 个向量经过 W K 和 W V 得到 4 个 Key 和 4 个 Value，输入 X prime 的 5 个向量经过 W Q 得到 5 个 Query。Attention 输出 5 个 context 向量，形状 5 乘 32。当前选中第 {j + 1} 个 Query，它对四个 Key 的权重是 {row.join("、")}。</desc>
          <Markers id={ID} />

          {/* X → K, V */}
          <text x={16} y={14} fontSize={9.5} fontWeight={600} fill={P.ink}>X：4 个向量（{shapeText(S.x)}）</text>
          {CROSS_KEYS.map((tok, i) => (
            <Box key={tok} x={16 + i * 50} y={22} w={46} h={22} tone="neu" title={tok} size={8.5} />
          ))}
          <Arrow id={ID} tone="neu" d="M60 44 V71" />
          <Arrow id={ID} tone="neu" d="M150 44 V71" />
          <Box x={32} y={74} w={56} h={22} tone="neu" title={<Sym b="W" s="K" />} size={10} />
          <Box x={122} y={74} w={56} h={22} tone="neu" title={<Sym b="W" s="V" />} size={10} />
          <Arrow id={ID} tone="par" d="M60 96 V113" />
          <Arrow id={ID} tone="enc" d="M150 96 V113" />
          <Box x={26} y={116} w={68} h={30} tone="par" title="K" sub={shapeText(S.k)} />
          <Box x={116} y={116} w={68} h={30} tone="enc" title="V" sub={shapeText(S.v)} />

          {/* X′ → Q */}
          <text x={16} y={290} fontSize={9.5} fontWeight={600} fill={P.ink}>X′：5 个向量（{shapeText(S.xQuery)}）</text>
          {QUERIES.map((q, k) => (
            <Box key={q} x={16 + k * 40} y={256} w={36} h={22} tone="neu" title={<Sym b="x′" s={String(k + 1)} />} size={9} bold={k === j} />
          ))}
          <Arrow id={ID} tone="neu" d="M105 256 V243" />
          <Box x={77} y={218} w={56} h={22} tone="neu" title={<Sym b="W" s="Q" />} size={10} />
          <Arrow id={ID} tone="dec" d="M105 218 V203" />
          <Box x={71} y={170} w={68} h={30} tone="dec" title="Q" sub={shapeText(S.q)} />

          {/* layer */}
          <Arrow id={ID} tone="par" d="M60 146 V158 H213" />
          <Arrow id={ID} tone="enc" d="M184 131 H213" />
          <Arrow id={ID} tone="dec" d="M139 185 H213" />
          <Box x={216} y={112} w={92} h={92} tone="att" title="Attention" sub="Softmax(QKᵀ)·V" bold />

          {/* output */}
          <Arrow id={ID} tone="dyn" d="M308 158 H325" />
          <text x={354} y={86} fontSize={9.5} fontWeight={600} textAnchor="middle" fill={P.ink}>C：{shapeText(S.c)}</text>
          {QUERIES.map((q, k) => (
            <Box key={q} x={328} y={94 + k * 26} w={52} h={22} tone="dyn" title={<Sym b="c" s={String(k + 1)} />} size={9.5} bold={k === j} />
          ))}
          <text x={354} y={236} fontSize={8.5} textAnchor="middle" fill={P.sub}>5 个 = Query 的个数</text>

          {/* weights */}
          <text x={552} y={30} fontSize={9.5} fontWeight={600} textAnchor="middle" fill={P.ink}>A = Softmax(QKᵀ)：{shapeText(S.a)}</text>
          <text x={552} y={46} fontSize={8.5} textAnchor="middle" fill={P.sub}>列：Key（X 的 4 个位置）</text>
          <Heatmap x={448} y={70} cellW={52} cellH={32} weights={A_CROSS} rowLabels={QUERIES} colLabels={[...CROSS_KEYS]} selected={j} onSelect={setJ} />
          <text x={552} y={250} fontSize={8.5} textAnchor="middle" fill={P.sub}>行：Query（X′ 的 5 个位置），每行和为 1</text>
          <text x={552} y={268} fontSize={9} textAnchor="middle" fill={P.ink}>A[j, i] = α<tspan dy={3} fontSize="0.74em">ij</tspan></text>
        </svg>
      </div>
      <Legend items={[{ tone: "dec", label: "Query" }, { tone: "par", label: "Key" }, { tone: "enc", label: "Value" }, { tone: "att", label: "权重 A" }, { tone: "dyn", label: "输出 C" }]} />
      <div className="viz-narr" aria-live="polite">
        第 {j + 1} 个 Query 对 4 个 Key 的权重是这一行：[{row.map((w) => w.toFixed(2)).join(", ")}]，最大的是 <b>{CROSS_KEYS[top]}</b>。它的输出 c{SUBS[j]} = {row.map((w, i) => `${w.toFixed(2)}·v${SUBS[i]}`).join(" + ")}，是一个 {S.c[1]} 维向量。5 个 Query 各得一个，所以 C 是 {shapeText(S.c)}，行数跟 Query，不跟 Key。
      </div>
    </BahFrame>
  );
}
