"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import { edgeRow } from "@/lib/ml/daefuseTrain";
import { gray } from "./DfPixels";

// 2.5 architecture: AE and VAE side by side as neuron diagrams, with the one
// place they differ — the bottleneck — drawn explicitly. These are the exact
// layer sizes the next figures train (12 → 10 → 2 → 10 → 12).

type Kind = "ae" | "vae";
const BLUE = "#2a78d6";
const BLUE_F = "#dbe8f8";
const ORANGE = "#eb6834";
const ORANGE_F = "#fbe3d8";
const YEL = "#d9b24a";
const YEL_F = "#fbf1cf";
const GREY = "#9a9c8d";
const INK = "#3b4234";
const MUTED = "#76796f";

const X_IN = edgeRow(5);
const X_AE = X_IN;
const X_VAE = X_IN.map((v, i) => (i === 4 ? 0.3 : i === 5 ? 0.62 : i === 6 ? 0.82 : v)); // 示意: a softened edge

const col = (n: number, x: number, cy: number, gap: number) => Array.from({ length: n }, (_, i) => [x, cy + (i - (n - 1) / 2) * gap] as const);

function Layer({ pts, fill, stroke, r = 5 }: { pts: (readonly [number, number])[]; fill: (i: number) => string; stroke: string; r?: number }) {
  return <g>{pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={r} fill={fill(i)} stroke={stroke} strokeWidth={1.2} />)}</g>;
}

function Links({ a, b, color }: { a: (readonly [number, number])[]; b: (readonly [number, number])[]; color: string }) {
  return <g>{a.flatMap(([x1, y1], i) => b.map(([x2, y2], k) => <line key={`${i}-${k}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={0.4} opacity={0.45} />))}</g>;
}

export default function DfAeVaeArch() {
  const [kind, setKind] = useState<Kind>("ae");
  const vae = kind === "vae";
  const CY = 140;
  const inp = col(12, 40, CY, 17);
  const h1 = col(10, 120, CY, 17);
  const mu = col(2, 200, vae ? CY - 46 : CY, 22);
  const lv = col(2, 200, CY + 46, 22);
  const z = col(2, vae ? 290 : 200, CY, 22);
  const dx = vae ? 90 : 0;
  const h2 = col(10, 280 + dx, CY, 17);
  const out = col(12, 360 + dx, CY, 17);
  const rec = vae ? X_VAE : X_AE;

  return (
    <VisualizationFrame
      title="AE 与 VAE 的结构：只差在中间那个瓶颈"
      description="输入是一行 12 个像素（一条亮度台阶），编码器把它压成 2 个数，解码器再还原成 12 个像素。切换看 AE 和 VAE 在中间做的事有什么不同。"
      footnote="层的大小就是下面训练用的：12 → 10（tanh）→ 2 → 10（tanh）→ 12（sigmoid）。输出那一列的灰度是示意：VAE 的重建通常比 AE 软一些，下面的实验会真的算出来。"
    >
      <div className="viz-row">
        <Tabs options={[{ key: "ae", label: "AE（自编码器）" }, { key: "vae", label: "VAE（变分自编码器）" }]} value={kind} onChange={setKind} ariaLabel="模型" />
      </div>
      <div className="viz-scroll">
        <svg viewBox="0 0 720 300" role="img" aria-label={vae ? "VAE：编码器输出 μ 和 log σ²，加噪声采样 z，再解码" : "AE：编码器输出一个点 z，直接解码"} style={{ minWidth: 640 }}>
          <defs>
            <marker id="aearch-ink" viewBox="0 0 6 6" refX={5} refY={3} markerWidth={6} markerHeight={6} orient="auto"><path d="M0 0 L6 3 L0 6 z" fill={INK} /></marker>
          </defs>
          <rect x={22} y={28} width={196} height={226} rx={8} fill={BLUE_F} opacity={0.5} />
          <text x={30} y={22} fontSize={11} fontWeight={700} fill={BLUE}>编码器 φ</text>
          <rect x={262 + dx} y={28} width={116} height={226} rx={8} fill={ORANGE_F} opacity={0.5} />
          <text x={270 + dx} y={22} fontSize={11} fontWeight={700} fill={ORANGE}>解码器 ρ</text>

          <Links a={inp} b={h1} color={BLUE} />
          <Links a={h1} b={mu} color={BLUE} />
          {vae && <Links a={h1} b={lv} color={BLUE} />}
          <Links a={z} b={h2} color={ORANGE} />
          <Links a={h2} b={out} color={ORANGE} />
          <Layer pts={inp} fill={(i) => gray(X_IN[i])} stroke={INK} />
          <Layer pts={h1} fill={() => "#fff"} stroke={BLUE} />
          <Layer pts={h2} fill={() => "#fff"} stroke={ORANGE} />
          <Layer pts={out} fill={(i) => gray(rec[i])} stroke={INK} />
          <text x={40} y={276} fontSize={10} textAnchor="middle" fill={MUTED}>输入 x</text>
          <text x={40} y={289} fontSize={9} textAnchor="middle" fill={MUTED}>12</text>
          <text x={120} y={276} fontSize={10} textAnchor="middle" fill={MUTED}>10</text>
          <text x={280 + dx} y={276} fontSize={10} textAnchor="middle" fill={MUTED}>10</text>
          <text x={360 + dx} y={276} fontSize={10} textAnchor="middle" fill={MUTED}>重建 x̂</text>
          <text x={360 + dx} y={289} fontSize={9} textAnchor="middle" fill={MUTED}>12</text>

          {!vae && (
            <g>
              <Layer pts={z} fill={() => YEL_F} stroke={YEL} r={8} />
              <text x={200} y={CY - 26} fontSize={10.5} fontWeight={700} textAnchor="middle" fill={INK}>z</text>
              <text x={200} y={CY + 40} fontSize={9} textAnchor="middle" fill={MUTED}>一个确定的点</text>
            </g>
          )}
          {vae && (
            <g>
              <Layer pts={mu} fill={() => YEL_F} stroke={YEL} r={8} />
              <Layer pts={lv} fill={() => YEL_F} stroke={YEL} r={8} />
              <text x={200} y={CY - 76} fontSize={10.5} fontWeight={700} textAnchor="middle" fill={INK}>μ</text>
              <text x={200} y={CY + 84} fontSize={10.5} fontWeight={700} textAnchor="middle" fill={INK}>log σ²</text>
              <rect x={222} y={CY - 14} width={44} height={28} rx={5} fill="#fff" stroke={GREY} strokeDasharray="4 3" />
              <text x={244} y={CY - 2} fontSize={9.5} textAnchor="middle" fill={INK}>ε~N(0,1)</text>
              <text x={244} y={CY + 9} fontSize={8} textAnchor="middle" fill={MUTED}>训练时采样</text>
              <line x1={210} y1={CY - 46} x2={274} y2={CY - 12} stroke={INK} markerEnd="url(#aearch-ink)" />
              <line x1={210} y1={CY + 46} x2={274} y2={CY + 12} stroke={INK} markerEnd="url(#aearch-ink)" />
              <Layer pts={z} fill={() => YEL_F} stroke={YEL} r={8} />
              <text x={290} y={CY - 26} fontSize={10.5} fontWeight={700} textAnchor="middle" fill={INK}>z</text>
              <text x={290} y={CY + 40} fontSize={8.5} textAnchor="middle" fill={MUTED}>z = μ + σ·ε</text>
            </g>
          )}

          <rect x={480 + dx * 0.4} y={70} width={210 - dx * 0.4} height={50} rx={6} fill="#fff" stroke={GREY} strokeDasharray="4 3" />
          <text x={490 + dx * 0.4} y={90} fontSize={10.5} fontWeight={700} fill={INK}>重建损失</text>
          <text x={490 + dx * 0.4} y={108} fontSize={10} fill={MUTED} className="mono">‖x − x̂‖²：x̂ 要像 x</text>
          {vae && (
            <g>
              <rect x={516} y={140} width={174} height={58} rx={6} fill="#fff" stroke={GREY} strokeDasharray="4 3" />
              <text x={526} y={160} fontSize={10.5} fontWeight={700} fill={INK}>KL 损失（× β）</text>
              <text x={526} y={176} fontSize={9.5} fill={MUTED} className="mono">KL(N(μ,σ²) ‖ N(0, I))</text>
              <text x={526} y={190} fontSize={9.5} fill={MUTED}>编码要靠近标准正态</text>
            </g>
          )}
          <rect x={480 + dx * 0.4} y={vae ? 214 : 150} width={210 - dx * 0.4} height={40} rx={6} fill={vae ? "#d9f1e6" : "#f6f4ec"} stroke={vae ? "#1baf7a" : GREY} />
          <text x={490 + dx * 0.4} y={vae ? 231 : 167} fontSize={10} fontWeight={700} fill={INK}>{vae ? "能生成：z ~ N(0, I) → ρ" : "不保证能生成"}</text>
          <text x={490 + dx * 0.4} y={vae ? 245 : 181} fontSize={9} fill={MUTED}>{vae ? "编码挤在先验附近，随便采一个点都能解码" : "z 可能散在任何地方，先验里采的点没见过"}</text>
        </svg>
      </div>
      <div className="viz-legend">
        <span><i style={{ background: BLUE_F, border: `1px solid ${BLUE}` }} />编码器</span>
        <span><i style={{ background: YEL_F, border: `1px solid ${YEL}` }} />瓶颈 / 潜变量</span>
        <span><i style={{ background: ORANGE_F, border: `1px solid ${ORANGE}` }} />解码器</span>
        <span><i style={{ background: "#fff", border: `1px dashed ${GREY}` }} />只在训练时存在</span>
      </div>
      <div className={`viz-narr${vae ? " is-warn" : ""}`}>
        {vae
          ? "VAE：编码器不再输出一个点，而是输出一个分布的均值 μ 和方差 σ²；训练时从这个分布里采一个 z = μ + σ·ε 再解码（ε 是外面加的噪声，梯度能穿过 μ 和 σ，这叫重参数化）。损失多了一项 KL，把每个样本的编码分布都往标准正态 N(0, I) 拉。好处是训练完可以从 N(0, I) 里随便采一个 z 生成新样本；代价是编码互相重叠、解码时会被平均，重建偏软。"
          : "AE：编码器把 12 个像素压成 2 个数 z，解码器从 z 还原 12 个像素，损失只有重建误差。瓶颈只有 2 个数，网络被迫只保留最关键的信息（这里就是「台阶在第几格」）。z 是一个确定的点，同一张输入永远得到同一个 z。DAE-Fuse 的编码器-解码器就是这种确定性的 AE。"}
      </div>
    </VisualizationFrame>
  );
}
