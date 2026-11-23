"use client";

import { useState } from "react";
import { BASE, positionalEncoding } from "@/lib/ml/transformerArch";
import { Arrow, BahFrame, Box, Legend, Markers, P, Sym } from "../bahdanau/shared";

const W = 700;
const H = 318;
const ID = "pef";
const POSITIONS = 8;
/** The heatmap uses a small width so the columns differ visibly; the listed numbers use the real 512. */
const DEMO_D = 16;
const X0 = 78;
const Y0 = 176;
const CW = 22;
const CH = 15;

const DEMO = positionalEncoding(POSITIONS, DEMO_D);
const REAL = positionalEncoding(POSITIONS, BASE.dModel);
const r2 = (v: number) => Math.round(v * 100) / 100;
const f3 = (v: number) => v.toFixed(3).replace("-", "−");

function Lane({ y, source, block }: { y: number; source: string; block: string }) {
  return (
    <g>
      <Box x={12} y={y} w={104} h={26} tone="neu" title={source} size={9.5} />
      <Arrow id={ID} tone="neu" d={`M116 ${y + 13} H129`} />
      <Box x={132} y={y} w={112} h={26} tone="neu" title={<>Embedding × √{BASE.dModel}</>} size={9.5} />
      <Arrow id={ID} tone="neu" d={`M244 ${y + 13} H261`} />
      <circle cx={274} cy={y + 13} r={10} fill={P.surface} stroke={P.ink} strokeWidth={1.3} />
      <text x={274} y={y + 17.5} fontSize={13} textAnchor="middle" fill={P.ink}>+</text>
      <Arrow id={ID} tone="neu" d={`M284 ${y + 13} H301`} />
      <Box x={304} y={y} w={110} h={26} tone="att" title={block} size={9.5} />
      <text x={422} y={y + 17} fontSize={9.5} fill={P.sub}>→ … × {BASE.layers}</text>
    </g>
  );
}

export default function PositionalEncodingFigure() {
  const [pos, setPos] = useState(1);
  const real = REAL[pos];

  return (
    <BahFrame
      title="图 3 · Positional Encoding：在第一个 Block 之前加一次"
      description="上半部分是数据流：两个塔的输入各自先加上位置编码。下半部分是位置编码本身：每一行是一个位置，每一列是一个维度。选一个位置看它那一行。"
      footnote={<>补充的原论文细节，课堂截图没有展开。热力图为了看得清，用的是 d_model = {DEMO_D} 的小例子（{BASE.dModel} 维时前几列的频率差得很小）；右边列出的数值是 d_model = {BASE.dModel} 的真实取值。位置从 0 开始编号。</>}
    >
      <div className="viz-controls" role="group" aria-label="选择位置">
        {Array.from({ length: POSITIONS }, (_, p) => (
          <button key={p} type="button" aria-pressed={pos === p} className={`viz-btn${pos === p ? " is-on" : ""}`} onClick={() => setPos(p)}>pos = {p}</button>
        ))}
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${ID}-title ${ID}-desc`} style={{ minWidth: 660 }}>
          <title id={`${ID}-title`}>位置编码加在哪里，以及它的数值</title>
          <desc id={`${ID}-desc`}>Source token 经过 Embedding 并乘以根号 512，加上位置编码，再进入 Encoder Block 1。右移后的 target token 同样处理后进入 Decoder Block 1。位置编码只在第一个 Block 之前加一次。下方热力图显示 8 个位置在 16 个维度上的正弦和余弦取值，当前选中位置 {pos}。</desc>
          <Markers id={ID} />

          <Lane y={10} source="Source tokens" block="Encoder Block 1" />
          <Lane y={96} source="Shifted target tokens" block="Decoder Block 1" />
          <Box x={214} y={53} w={120} h={26} tone="enc" bold title="Positional Encoding P" size={9.5} />
          <Arrow id={ID} tone="enc" d="M274 53 V36" />
          <Arrow id={ID} tone="enc" d="M274 79 V96" />

          <g fontSize={10} fill={P.ink}>
            <text x={500} y={22}><Sym b="Z" s="src" /> = √{BASE.dModel}·<Sym b="E" s="src" /> + <Sym b="P" s="src" /></text>
            <text x={500} y={36} fill={P.sub} fontSize={9}>{BASE.dModel} × m</text>
            <text x={500} y={108}><Sym b="Z" s="tgt" /> = √{BASE.dModel}·<Sym b="E" s="tgt" /> + <Sym b="P" s="tgt" /></text>
            <text x={500} y={122} fill={P.sub} fontSize={9}>{BASE.dModel} × t</text>
            <text x={500} y={70} fill={P.sub} fontSize={9}>不在每个 head 里加，</text>
            <text x={500} y={82} fill={P.sub} fontSize={9}>也不在 Encoder 输出处加</text>
          </g>

          {/* heatmap: rows are positions, columns are dimensions */}
          <text x={X0 + (DEMO_D * CW) / 2} y={Y0 - 22} fontSize={9.5} fontWeight={600} textAnchor="middle" fill={P.ink}>维度（偶数列 sin，奇数列 cos）</text>
          {Array.from({ length: DEMO_D }, (_, j) => (
            <text key={j} x={X0 + j * CW + CW / 2} y={Y0 - 6} fontSize={8} textAnchor="middle" fill={P.sub}>{j % 2 === 0 ? "sin" : "cos"}</text>
          ))}
          {DEMO.map((row, p) => (
            <g key={p} onClick={() => setPos(p)} style={{ cursor: "pointer" }}>
              <text x={X0 - 8} y={Y0 + p * CH + 11} fontSize={9} fontWeight={p === pos ? 700 : 400} textAnchor="end" fill={P.ink}>pos {p}</text>
              {row.map((v, j) => (
                <rect key={j} x={X0 + j * CW} y={Y0 + p * CH} width={CW - 1} height={CH - 1} fill={v >= 0 ? P.enc : P.dec} fillOpacity={r2(0.06 + 0.94 * Math.abs(v))} />
              ))}
              {p === pos && <rect x={X0 - 1.5} y={Y0 + p * CH - 1.5} width={DEMO_D * CW + 2} height={CH + 2} fill="none" stroke={P.ink} strokeWidth={1.6} rx={2} />}
            </g>
          ))}
          <text x={X0} y={Y0 + POSITIONS * CH + 14} fontSize={8.5} fill={P.sub}>左边的列变得快，右边的列变得慢：每个位置得到一行不同的数</text>

          <g fontSize={9.5} fill={P.ink} className="mono">
            <text x={452} y={Y0 - 6} fontWeight={700} className="">pos = {pos}，d_model = {BASE.dModel}</text>
            <text x={452} y={Y0 + 14}>PE({pos}, 0) = sin({pos}) = {f3(real[0])}</text>
            <text x={452} y={Y0 + 32}>PE({pos}, 1) = cos({pos}) = {f3(real[1])}</text>
            <text x={452} y={Y0 + 50}>PE({pos}, 2) = {f3(real[2])}</text>
            <text x={452} y={Y0 + 68}>PE({pos}, 3) = {f3(real[3])}</text>
            <text x={452} y={Y0 + 86}>…</text>
            <text x={452} y={Y0 + 104}>PE({pos}, 511) = {f3(real[BASE.dModel - 1])}</text>
          </g>
        </svg>
      </div>
      <Legend items={[{ tone: "enc", label: "位置编码；热力图里蓝色是正值" }, { tone: "dec", label: "热力图里橙色是负值" }, { tone: "att", label: "第一个 Block" }, { tone: "neu", label: "token 与 embedding" }]} />
      <div className="viz-narr" aria-live="polite">
        位置 {pos} 的编码是一个 {BASE.dModel} 维向量，前四个分量是 [{real.slice(0, 4).map(f3).join(", ")}]。{pos === 0 ? "位置 0 的所有 sin 都是 0、所有 cos 都是 1。" : "换一个位置，这一行就整个换掉，所以同一个词出现在不同位置时，进入 Block 的向量不同。"} 这些数是按公式直接算出来的，不需要训练；模型其余的参数学着去利用它们。
      </div>
    </BahFrame>
  );
}
