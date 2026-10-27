"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

// Section 3.1: the whole DAE-Fuse network in one picture. The encoders and the
// decoder are used in both phases; Phase 1 decodes each modality on its own,
// Phase 2 mixes them with cross-attention and decodes one fused image. The two
// discriminators and the loss nodes only exist during training (grey, dashed).

type Phase = "none" | "p1" | "p2";

const BLUE = "#2a78d6";
const BLUE_F = "#dbe8f8";
const ORANGE = "#eb6834";
const ORANGE_F = "#fbe3d8";
const YEL = "#d9b24a";
const YEL_F = "#fbf1cf";
const GREY = "#9a9c8d";
const INK = "#3b4234";
const MUTED = "#76796f";

type BoxProps = { x: number; y: number; w: number; h: number; title: string; sub?: string; stroke: string; fill: string; dashed?: boolean; bold?: boolean; dim?: boolean };

function Box({ x, y, w, h, title, sub, stroke, fill, dashed, bold, dim }: BoxProps) {
  return (
    <g opacity={dim ? 0.28 : 1} style={{ transition: "opacity .25s" }}>
      <rect x={x} y={y} width={w} height={h} rx={5} fill={fill} stroke={stroke} strokeWidth={bold ? 2.3 : 1.3} strokeDasharray={dashed ? "4 3" : undefined} />
      <text x={x + w / 2} y={sub ? y + h / 2 - 2 : y + h / 2 + 3.5} fontSize={10} fontWeight={600} textAnchor="middle" fill={INK}>{title}</text>
      {sub && <text x={x + w / 2} y={y + h / 2 + 10} fontSize={8} textAnchor="middle" fill={MUTED}>{sub}</text>}
    </g>
  );
}

function Path({ d, color, marker, dim, bold, dashed }: { d: string; color: string; marker: string; dim?: boolean; bold?: boolean; dashed?: boolean }) {
  return <path d={d} fill="none" stroke={color} strokeWidth={bold ? 2 : 1.3} strokeDasharray={dashed ? "4 3" : undefined} markerEnd={`url(#arch-${marker})`} opacity={dim ? 0.25 : 1} style={{ transition: "opacity .25s" }} />;
}

const NARR: Record<Phase, { text: string; tone?: string }> = {
  none: {
    text: "蓝色是编码器和 cross-attention（主计算），黄色是图像和特征，橙色是重建解码器 RD，灰色虚线是只在训练时存在的判别器和损失。上下两路分别是红外 α 和可见光 β。点按钮看两个阶段各走哪条路。",
  },
  p1: {
    text: "Phase 1（80 个 epoch）：每种模态自己编码、自己解码，目标是把自己重建回来。浅层编码器 SE 之后分成两支：ResNet18（DHE）抽高频细节，ViT（DLE）抽低频结构，拼接成 Φ。损失有三部分：重建的 MSE + SSIM、高低频的相关性分解损失 L_corr、以及判别器 DM1 / DM2 分辨「原图 vs 重建图」的对抗损失。cross-attention 这时还没用上。",
    tone: "is-warn",
  },
  p2: {
    text: "Phase 2（140 个 epoch）：两路特征先过 cross-attention，红外的 query 去可见光的 key / value 里找对应信息（反过来也一样），得到 Φ̂(α)、Φ̂(β)，拼接后由同一个 RD 解码出一张融合图 F。同样两个判别器，这次判的是「源图 vs 融合图」：DM1 要求 F 像红外，DM2 要求 F 像可见光，两边同时被骗过，F 就不会偏向任何一种模态。再加 L_int（亮度取两者较大）和 L_text（梯度取两者较大）。",
    tone: "is-good",
  },
};

export default function DfArchitecture() {
  const [phase, setPhase] = useState<Phase>("none");
  const d1 = phase === "p2"; // Phase-1-only parts dim in Phase 2
  const d2 = phase === "p1"; // Phase-2-only parts dim in Phase 1
  const b = phase !== "none";

  const branch = (cy: number, input: string, sym: string) => (
    <g>
      <Box x={8} y={cy - 18} w={56} h={36} title={sym} sub={input} stroke={YEL} fill={YEL_F} bold={b} />
      <Path d={`M64 ${cy} H80`} color={BLUE} marker="blue" />
      <Box x={82} y={cy - 22} w={66} h={44} title="SE" sub="Restormer 块" stroke={BLUE} fill={BLUE_F} bold={b} />
      <Path d={`M148 ${cy} C160 ${cy}, 160 ${cy - 20}, 170 ${cy - 20}`} color={BLUE} marker="blue" />
      <Path d={`M148 ${cy} C160 ${cy}, 160 ${cy + 20}, 170 ${cy + 20}`} color={BLUE} marker="blue" />
      <Box x={172} y={cy - 34} w={92} h={28} title="DHE · ResNet18" sub="高频细节" stroke={BLUE} fill={BLUE_F} bold={b} />
      <Box x={172} y={cy + 6} w={92} h={28} title="DLE · ViT" sub="低频结构" stroke={BLUE} fill={BLUE_F} bold={b} />
      <Path d={`M264 ${cy - 20} C275 ${cy - 20}, 278 ${cy}, 280 ${cy}`} color={BLUE} marker="blue" />
      <Path d={`M264 ${cy + 20} C275 ${cy + 20}, 278 ${cy}, 280 ${cy}`} color={BLUE} marker="blue" />
      <circle cx={289} cy={cy} r={9} fill="#fff" stroke={INK} strokeWidth={1.3} />
      <text x={289} y={cy + 3.5} fontSize={9.5} textAnchor="middle" fill={INK} fontWeight={700}>C</text>
      <Path d={`M298 ${cy} H304`} color={INK} marker="ink" />
      <Box x={306} y={cy - 20} w={42} h={40} title={`Φ(${sym})`} stroke={YEL} fill={YEL_F} bold={b} />
    </g>
  );

  return (
    <VisualizationFrame
      title="DAE-Fuse 的结构：同一套编码器和解码器，两个阶段走不同的路"
      description="对照论文图 1（Phase 1）和图 2（Phase 2）重画。点按钮聚焦一个阶段，另一阶段才用的部分会变淡。"
      footnote="结构来自论文第 III 节：SE 与 RD 是 Restormer 风格的 channel-Transformer 块，DHE 是 ResNet18，DLE 是 ViT，判别器是 Conv2D–LeakyReLU–BatchNorm 堆叠加一个全连接层。各模块的层数、通道数论文未披露。"
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${phase === "p1" ? " is-on" : ""}`} onClick={() => setPhase("p1")}>Phase 1：各自重建</button>
        <button type="button" className={`viz-btn${phase === "p2" ? " is-on" : ""}`} onClick={() => setPhase("p2")}>Phase 2：融合</button>
        <button type="button" className="viz-btn" onClick={() => setPhase("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox="0 0 700 340" role="img" aria-label={NARR[phase].text} style={{ minWidth: 600 }}>
          <defs>
            {[["blue", BLUE], ["orange", ORANGE], ["grey", GREY], ["ink", INK], ["yel", YEL]].map(([id, c]) => (
              <marker key={id} id={`arch-${id}`} viewBox="0 0 6 6" refX={5} refY={3} markerWidth={6} markerHeight={6} orient="auto"><path d="M0 0 L6 3 L0 6 z" fill={c} /></marker>
            ))}
          </defs>

          {branch(90, "红外", "α")}
          {branch(250, "可见光", "β")}

          {/* correlation decomposition loss between the two branches (Phase 1) */}
          <Box x={172} y={155} w={92} h={30} title="L_corr（式 10）" sub="高频不相关，低频相关" stroke={GREY} fill="#fff" dashed dim={d1} bold={phase === "p1"} />
          <Path d="M218 124 V153" color={GREY} marker="grey" dashed dim={d1} />
          <Path d="M218 216 V187" color={GREY} marker="grey" dashed dim={d1} />

          {/* Phase 1: each embedding straight to the decoder */}
          <Path d="M348 90 C430 90, 520 92, 536 133" color={ORANGE} marker="orange" dim={d1} bold={phase === "p1"} />
          <Path d="M348 250 C430 250, 520 248, 536 197" color={ORANGE} marker="orange" dim={d1} bold={phase === "p1"} />

          {/* Phase 2: cross-attention, concat, decode */}
          <Path d="M348 100 C362 100, 362 130, 372 136" color={BLUE} marker="blue" dim={d2} bold={phase === "p2"} />
          <Path d="M348 240 C362 240, 362 210, 372 204" color={BLUE} marker="blue" dim={d2} bold={phase === "p2"} />
          <Box x={374} y={124} w={96} h={92} title="Cross-attention" sub="Q 一边，K / V 另一边" stroke={BLUE} fill={BLUE_F} dim={d2} bold={phase === "p2"} />
          <text x={422} y={196} fontSize={8} textAnchor="middle" fill={MUTED} opacity={d2 ? 0.25 : 1}>→ Φ̂(α), Φ̂(β)</text>
          <Path d="M470 170 H482" color={INK} marker="ink" dim={d2} bold={phase === "p2"} />
          <g opacity={d2 ? 0.25 : 1}>
            <circle cx={492} cy={170} r={9} fill="#fff" stroke={INK} strokeWidth={1.3} />
            <text x={492} y={173.5} fontSize={9.5} textAnchor="middle" fill={INK} fontWeight={700}>C</text>
          </g>
          <Path d="M501 170 H510" color={INK} marker="ink" dim={d2} bold={phase === "p2"} />

          <Box x={512} y={137} w={74} h={66} title="RD 解码器" sub="与 SE 同结构" stroke={ORANGE} fill={ORANGE_F} bold={b} />

          {/* outputs */}
          <Path d="M586 150 C600 150, 604 90, 618 90" color={ORANGE} marker="orange" dim={d1} bold={phase === "p1"} />
          <Path d="M586 190 C600 190, 604 250, 618 250" color={ORANGE} marker="orange" dim={d1} bold={phase === "p1"} />
          <Path d="M586 170 H618" color={ORANGE} marker="orange" dim={d2} bold={phase === "p2"} />
          <Box x={620} y={72} w={52} h={36} title="α̃" sub="重建红外" stroke={YEL} fill={YEL_F} dim={d1} bold={phase === "p1"} />
          <Box x={620} y={152} w={52} h={36} title="F" sub="融合图" stroke={YEL} fill={YEL_F} dim={d2} bold={phase === "p2"} />
          <Box x={620} y={232} w={52} h={36} title="β̃" sub="重建可见光" stroke={YEL} fill={YEL_F} dim={d1} bold={phase === "p1"} />
          <text x={646} y={202} fontSize={8} textAnchor="middle" fill={GREY} opacity={d2 ? 0.25 : 1}>L_int · L_text</text>

          {/* discriminators: real input on the left, generated image on the right */}
          <Box x={410} y={4} w={150} h={30} title="DM1 判别器（红外）" sub="真：α　假：α̃ 或 F" stroke={GREY} fill="#fff" dashed bold={b} />
          <Box x={410} y={306} w={150} h={30} title="DM2 判别器（可见光）" sub="真：β　假：β̃ 或 F" stroke={GREY} fill="#fff" dashed bold={b} />
          <Path d="M36 72 V19 H408" color={GREY} marker="grey" dashed />
          <Path d="M36 268 V321 H408" color={GREY} marker="grey" dashed />
          <Path d="M646 72 V19 H562" color={GREY} marker="grey" dashed dim={d1} />
          <Path d="M646 268 V321 H562" color={GREY} marker="grey" dashed dim={d1} />
          <Path d="M672 164 H690 V27 H562" color={GREY} marker="grey" dashed dim={d2} />
          <Path d="M672 176 H690 V313 H562" color={GREY} marker="grey" dashed dim={d2} />
        </svg>
      </div>
      <div className="viz-legend">
        <span><i style={{ background: BLUE_F, border: `1px solid ${BLUE}` }} />编码器与 cross-attention</span>
        <span><i style={{ background: YEL_F, border: `1px solid ${YEL}` }} />图像与特征</span>
        <span><i style={{ background: ORANGE_F, border: `1px solid ${ORANGE}` }} />重建解码器 RD</span>
        <span><i style={{ background: "#fff", border: `1px dashed ${GREY}` }} />只在训练时存在：判别器、损失</span>
      </div>
      <div className={`viz-narr${NARR[phase].tone ? ` ${NARR[phase].tone}` : ""}`}>{NARR[phase].text}</div>
    </VisualizationFrame>
  );
}
