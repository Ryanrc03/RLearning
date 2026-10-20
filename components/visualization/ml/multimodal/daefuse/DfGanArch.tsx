"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

// 2.4 architecture: the two networks of a GAN and which one moves in each
// half of a training step. Neurons are drawn as in an MLP; the toy versions
// the next figures train are named in the narration.

type Mode = "none" | "d" | "g";
const BLUE = "#2a78d6";
const BLUE_F = "#dbe8f8";
const GREEN = "#1baf7a";
const GREEN_F = "#d9f1e6";
const YEL = "#d9b24a";
const YEL_F = "#fbf1cf";
const ORANGE = "#eb6834";
const GREY = "#9a9c8d";
const INK = "#3b4234";
const MUTED = "#76796f";

function Net({ x, y, layers, color, fill, label, sub, dim, bold, frozen }: { x: number; y: number; layers: number[]; color: string; fill: string; label: string; sub: string; dim?: boolean; bold?: boolean; frozen?: boolean }) {
  const gap = 46;
  const pts = layers.map((n, l) => Array.from({ length: n }, (_, i) => [x + l * gap, y + (i - (n - 1) / 2) * 18] as const));
  return (
    <g opacity={dim ? 0.25 : 1} style={{ transition: "opacity .25s" }}>
      <rect x={x - 18} y={y - 52} width={gap * (layers.length - 1) + 36} height={104} rx={8} fill={fill} stroke={color} strokeWidth={bold ? 2.4 : 1.2} strokeDasharray={frozen ? "4 3" : undefined} />
      {pts.slice(1).map((col, l) => col.map(([x2, y2], i) => pts[l].map(([x1, y1], k) => <line key={`${l}-${i}-${k}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={0.6} opacity={0.6} />)))}
      {pts.flat().map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r={5.5} fill="#fff" stroke={color} strokeWidth={1.3} />)}
      <text x={x - 12} y={y - 58} fontSize={11} fontWeight={700} fill={INK}>{label}</text>
      <text x={x - 12} y={y + 66} fontSize={9} fill={MUTED}>{frozen ? "这一步冻结，只传梯度" : sub}</text>
    </g>
  );
}

function Tensor({ x, y, w, title, sub, dim, bold }: { x: number; y: number; w: number; title: string; sub: string; dim?: boolean; bold?: boolean }) {
  return (
    <g opacity={dim ? 0.25 : 1} style={{ transition: "opacity .25s" }}>
      <rect x={x} y={y} width={w} height={36} rx={5} fill={YEL_F} stroke={YEL} strokeWidth={bold ? 2.2 : 1.2} />
      <text x={x + w / 2} y={y + 15} fontSize={10.5} fontWeight={600} textAnchor="middle" fill={INK}>{title}</text>
      <text x={x + w / 2} y={y + 28} fontSize={8.5} textAnchor="middle" fill={MUTED}>{sub}</text>
    </g>
  );
}

const NARR: Record<Mode, { text: string; tone?: string }> = {
  none: { text: "两个网络：生成器 G（蓝）把随机噪声 z 变成一张假样本，判别器 D（绿）给任何样本打一个「是真的」的概率。训练时两者轮流走一步，点按钮看每一步谁在动。下面训练的玩具版本：真数据是 N(2, 0.5²) 的一维数，G(z) = a·z + b 只有 2 个参数，D(x) = σ(w₂x² + w₁x + w₀) 只有 3 个参数。" },
  d: { text: "训练 D 一步：拿一批真样本（标签 1）和一批 G 造的假样本（标签 0），D 做一次二分类，损失 L_D = −log D(真) − log(1 − D(假))，梯度只更新 D 的参数。G 在这一步只负责造样本，参数不动。DAE-Fuse 里的 DM1、DM2 就是这样的判别器，「真」是源图，「假」是重建图或融合图。", tone: "is-warn" },
  g: { text: "训练 G 一步：G 造一批假样本送进 D，希望 D 把它们判成真的，损失 L_G = −log D(G(z))。梯度从 D 的输出一路往回传，穿过 D（D 冻结，只传梯度不更新），一直传到 G 的参数。G 永远看不到真样本：它对「真数据长什么样」的全部了解，都来自 D 传回来的梯度。", tone: "is-good" },
};

export default function DfGanArch() {
  const [mode, setMode] = useState<Mode>("none");
  const dD = mode === "g";
  const dG = mode === "d";
  return (
    <VisualizationFrame title="GAN 的结构：一个造假，一个鉴别，轮流训练" description="点按钮看「训练 D 一步」和「训练 G 一步」分别是哪些数据进来、损失在哪算、哪些参数被更新。">
      <div className="viz-controls">
        <button type="button" className={`viz-btn${mode === "d" ? " is-on" : ""}`} onClick={() => setMode("d")}>训练 D 一步</button>
        <button type="button" className={`viz-btn${mode === "g" ? " is-on" : ""}`} onClick={() => setMode("g")}>训练 G 一步</button>
        <button type="button" className="viz-btn" onClick={() => setMode("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox="0 0 700 300" role="img" aria-label={NARR[mode].text} style={{ minWidth: 620 }}>
          <defs>
            {[["ink", INK], ["or", ORANGE], ["gr", GREY]].map(([id, c]) => (
              <marker key={id} id={`ganarch-${id}`} viewBox="0 0 6 6" refX={5} refY={3} markerWidth={6} markerHeight={6} orient="auto"><path d="M0 0 L6 3 L0 6 z" fill={c} /></marker>
            ))}
          </defs>
          <Tensor x={8} y={62} w={84} title="噪声 z" sub="z ~ N(0, 1)" bold={mode !== "none"} />
          <line x1={92} y1={80} x2={124} y2={80} stroke={INK} markerEnd="url(#ganarch-ink)" />
          <Net x={146} y={80} layers={[1, 4, 4, 1]} color={BLUE} fill={BLUE_F} label="生成器 G" sub="这一步更新" bold={mode === "g"} frozen={mode === "d"} />
          <line x1={306} y1={80} x2={330} y2={80} stroke={INK} markerEnd="url(#ganarch-ink)" />
          <Tensor x={332} y={62} w={76} title="假样本 G(z)" sub="标签 0" bold={mode !== "none"} />

          <Tensor x={8} y={210} w={84} title="真数据" sub="x ~ p_data" dim={dD} />
          <line x1={92} y1={228} x2={330} y2={228} stroke={INK} opacity={dD ? 0.25 : 1} markerEnd="url(#ganarch-ink)" />
          <Tensor x={332} y={210} w={76} title="真样本 x" sub="标签 1" dim={dD} bold={mode === "d"} />

          <line x1={408} y1={80} x2={448} y2={140} stroke={INK} markerEnd="url(#ganarch-ink)" />
          <line x1={408} y1={228} x2={448} y2={170} stroke={INK} opacity={dD ? 0.25 : 1} markerEnd="url(#ganarch-ink)" />
          <Net x={470} y={155} layers={[1, 4, 1]} color={GREEN} fill={GREEN_F} label="判别器 D" sub="这一步更新" bold={mode === "d"} frozen={mode === "g"} />
          <line x1={584} y1={155} x2={600} y2={155} stroke={INK} markerEnd="url(#ganarch-ink)" />
          <circle cx={622} cy={155} r={20} fill="#fff" stroke={INK} strokeWidth={1.3} />
          <text x={622} y={152} fontSize={10} textAnchor="middle" fill={INK} fontWeight={600}>D(·)</text>
          <text x={622} y={164} fontSize={8} textAnchor="middle" fill={MUTED}>0 – 1</text>

          <g opacity={dD ? 0.25 : 1}>
            <rect x={590} y={204} width={104} height={40} rx={5} fill="#fff" stroke={GREY} strokeDasharray="4 3" strokeWidth={mode === "d" ? 2 : 1.2} />
            <text x={642} y={220} fontSize={10} fontWeight={600} textAnchor="middle" fill={INK}>L_D</text>
            <text x={642} y={234} fontSize={8} textAnchor="middle" fill={MUTED}>−log D(真) − log(1−D(假))</text>
          </g>
          <g opacity={dG ? 0.25 : 1}>
            <rect x={590} y={66} width={104} height={40} rx={5} fill="#fff" stroke={GREY} strokeDasharray="4 3" strokeWidth={mode === "g" ? 2 : 1.2} />
            <text x={642} y={82} fontSize={10} fontWeight={600} textAnchor="middle" fill={INK}>L_G</text>
            <text x={642} y={96} fontSize={8} textAnchor="middle" fill={MUTED}>−log D(假)</text>
          </g>
          <line x1={622} y1={135} x2={634} y2={108} stroke={GREY} opacity={dG ? 0.25 : 1} />
          <line x1={622} y1={175} x2={634} y2={202} stroke={GREY} opacity={dD ? 0.25 : 1} />

          {mode === "d" && <path d="M600 224 C 560 280, 500 270, 490 214" fill="none" stroke={ORANGE} strokeWidth={2.2} markerEnd="url(#ganarch-or)" />}
          {mode === "d" && <text x={520} y={284} fontSize={10} fill={ORANGE} fontWeight={600}>梯度 → 只更新 D</text>}
          {mode === "g" && <path d="M610 64 C 560 10, 330 8, 240 30" fill="none" stroke={ORANGE} strokeWidth={2.2} markerEnd="url(#ganarch-or)" />}
          {mode === "g" && <text x={330} y={18} fontSize={10} fill={ORANGE} fontWeight={600}>梯度穿过冻结的 D → 只更新 G</text>}
        </svg>
      </div>
      <div className="viz-legend">
        <span><i style={{ background: BLUE_F, border: `1px solid ${BLUE}` }} />生成器</span>
        <span><i style={{ background: GREEN_F, border: `1px solid ${GREEN}` }} />判别器</span>
        <span><i style={{ background: YEL_F, border: `1px solid ${YEL}` }} />样本</span>
        <span><i style={{ background: "#fff", border: `1px dashed ${GREY}` }} />损失 / 这一步冻结的网络</span>
        <span><i style={{ background: ORANGE }} />梯度往回传的路</span>
      </div>
      <div className={`viz-narr${NARR[mode].tone ? ` ${NARR[mode].tone}` : ""}`}>{NARR[mode].text}</div>
    </VisualizationFrame>
  );
}
