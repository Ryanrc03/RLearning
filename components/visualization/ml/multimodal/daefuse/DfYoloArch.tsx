"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import { detTarget, GRID, SIDE, type Box } from "@/lib/ml/daefuseTrain";
import { Cells } from "./DfTrainKit";
import { gray } from "./DfPixels";

// 2.6 architecture: a YOLO-style detector reduced to its core idea. The image
// is cut into a 4 × 4 grid; one shared head looks at each cell (plus a 1-pixel
// border) and outputs [objectness, tx, ty, tw, th]. Click a cell to see its
// input window and its training target: only the cell holding the object's
// centre is asked to draw a box.

const BOX: Box = { x: 3, y: 1, w: 3, h: 4 };
const IMG = Array.from({ length: SIDE * SIDE }, (_, i) => {
  const r = Math.floor(i / SIDE);
  const c = i % SIDE;
  return c >= BOX.x && c < BOX.x + BOX.w && r >= BOX.y && r < BOX.y + BOX.h ? 0.85 : 0.1;
});
const BLUE = "#2a78d6";
const ORANGE = "#eb6834";
const GREEN = "#1baf7a";
const INK = "#3b4234";
const MUTED = "#76796f";

function windowOf(row: number, col: number) {
  const out: number[] = [];
  for (let dy = -1; dy < 3; dy++)
    for (let dx = -1; dx < 3; dx++) {
      const r = row * 2 + dy;
      const c = col * 2 + dx;
      out.push(r < 0 || c < 0 || r >= SIDE || c >= SIDE ? 0 : IMG[r * SIDE + c]);
    }
  return out;
}

export default function DfYoloArch() {
  const { cell: owner, tgt } = detTarget(BOX);
  const [sel, setSel] = useState(owner);
  const row = Math.floor(sel / GRID);
  const col = sel % GRID;
  const isOwner = sel === owner;
  const C = 18;
  const ins = Array.from({ length: 16 }, (_, i) => [300, 52 + i * 11] as const);
  const hid = Array.from({ length: 12 }, (_, i) => [360, 74 + i * 11] as const);
  const outs = Array.from({ length: 5 }, (_, i) => [420, 112 + i * 18] as const);
  const names = ["obj", "tx", "ty", "tw", "th"];

  return (
    <VisualizationFrame
      title="YOLO 的结构：切成网格，每个格子自己报「有没有东西、框在哪」"
      description="这是下面要训练的小检测器。8 × 8 的图切成 4 × 4 个格子，同一个小网络（共享权重）在每个格子上各跑一次，输出 5 个数。点任意一个格子，看它的输入和它的训练目标。"
      footnote="真实的 YOLOv8 结构更深：backbone（卷积，逐步下采样）→ neck（多尺度特征融合）→ head，在步长 8、16、32 三个尺度上，每个位置输出框到四条边的距离和 80 个类别的分数（COCO）。核心思路相同：一次前向，每个位置自己报框。"
    >
      <div className="viz-scroll">
        <svg viewBox="0 0 700 300" role="img" aria-label={`第 ${row + 1} 行第 ${col + 1} 列的格子：${isOwner ? "负责这个物体" : "不负责物体"}`} style={{ minWidth: 620 }}>
          <defs>
            <marker id="yoloarch-ink" viewBox="0 0 6 6" refX={5} refY={3} markerWidth={6} markerHeight={6} orient="auto"><path d="M0 0 L6 3 L0 6 z" fill={INK} /></marker>
          </defs>
          <Cells vals={IMG} cols={SIDE} x={10} y={40} cell={C} color={(v) => gray(v)} title="输入 8 × 8，切成 4 × 4 个格子" />
          {Array.from({ length: GRID * GRID }, (_, k) => {
            const r = Math.floor(k / GRID);
            const c = k % GRID;
            return (
              <rect key={k} x={10 + c * 2 * C} y={40 + r * 2 * C} width={2 * C} height={2 * C} fill={k === owner ? GREEN : "transparent"} fillOpacity={0.25} stroke={k === sel ? INK : "#d9b24a"} strokeWidth={k === sel ? 2.6 : 1} style={{ cursor: "pointer" }} onClick={() => setSel(k)} />
            );
          })}
          <rect x={10 + BOX.x * C} y={40 + BOX.y * C} width={BOX.w * C} height={BOX.h * C} fill="none" stroke={ORANGE} strokeWidth={2} pointerEvents="none" />
          <circle cx={10 + (BOX.x + BOX.w / 2) * C} cy={40 + (BOX.y + BOX.h / 2) * C} r={3.5} fill={ORANGE} pointerEvents="none" />
          <text x={10} y={202} fontSize={10} fill={MUTED}>橙框 = 标注框，橙点 = 它的中心</text>
          <text x={10} y={216} fontSize={10} fill={MUTED}>绿格 = 中心落在里面、负责它的格子</text>

          <line x1={166} y1={110} x2={186} y2={110} stroke={INK} markerEnd="url(#yoloarch-ink)" />
          <Cells vals={windowOf(row, col)} cols={4} x={192} y={82} cell={14} color={(v) => gray(v)} title="这一格的输入" />
          <rect x={192 + 14} y={82 + 14} width={28} height={28} fill="none" stroke={INK} strokeWidth={1.5} />
          <text x={192} y={152} fontSize={9} fill={MUTED}>格子 2 × 2 + 一圈边 = 16 个数</text>

          <line x1={252} y1={110} x2={286} y2={110} stroke={INK} markerEnd="url(#yoloarch-ink)" />
          {ins.flatMap(([x1, y1], i) => hid.map(([x2, y2], k) => <line key={`a${i}-${k}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={BLUE} strokeWidth={0.3} opacity={0.4} />))}
          {hid.flatMap(([x1, y1], i) => outs.map(([x2, y2], k) => <line key={`b${i}-${k}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={BLUE} strokeWidth={0.4} opacity={0.5} />))}
          {ins.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3.5} fill="#fff" stroke={BLUE} />)}
          {hid.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={4} fill="#fff" stroke={BLUE} />)}
          {outs.map(([x, y], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r={6} fill="#fbe3d8" stroke={ORANGE} />
              <text x={x + 12} y={y + 4} fontSize={10} fill={INK} className="mono">{names[i]}</text>
            </g>
          ))}
          <text x={296} y={34} fontSize={10.5} fontWeight={600} fill="#30332c">共享的检测头 16 → 12 → 5</text>
          <text x={296} y={246} fontSize={9} fill={MUTED}>16 个格子用同一套权重（相当于 1 × 1 卷积）</text>

          <rect x={480} y={40} width={210} height={176} rx={6} fill="#fff" stroke={isOwner ? GREEN : "#e4dfcb"} strokeWidth={isOwner ? 2 : 1} />
          <text x={492} y={60} fontSize={11} fontWeight={700} fill={INK}>这一格的训练目标</text>
          {(isOwner
            ? [
                ["obj", "1", "这里有物体"],
                ["tx", tgt[0].toFixed(3), "中心在格内的横向位置"],
                ["ty", tgt[1].toFixed(3), "中心在格内的纵向位置"],
                ["tw", tgt[2].toFixed(3), `宽 ${BOX.w} / 图宽 8`],
                ["th", tgt[3].toFixed(3), `高 ${BOX.h} / 图高 8`],
              ]
            : [
                ["obj", "0", "这里没有物体中心"],
                ["tx", "—", "不算框的损失"],
                ["ty", "—", ""],
                ["tw", "—", ""],
                ["th", "—", ""],
              ]
          ).map(([k, v, why], i) => (
            <g key={k}>
              <text x={492} y={84 + i * 24} fontSize={10.5} fill={INK} className="mono">{k}</text>
              <text x={540} y={84 + i * 24} fontSize={10.5} fill={isOwner ? "#087a08" : MUTED} className="mono" fontWeight={700}>{v}</text>
              <text x={586} y={84 + i * 24} fontSize={9} fill={MUTED}>{why}</text>
            </g>
          ))}
          <text x={480} y={240} fontSize={10} fill={MUTED}>整张图的输出：(4, 4, 5)</text>
          <text x={480} y={256} fontSize={10} fill={MUTED}>之后：取 obj 高的格子 → 解码成框 → NMS</text>
        </svg>
      </div>
      <div className="viz-legend">
        <span><i style={{ background: "#d9f1e6", border: `1px solid ${GREEN}` }} />负责物体的格子</span>
        <span><i style={{ background: "#fff", border: `2px solid ${INK}` }} />当前选中的格子</span>
        <span><i style={{ background: "#fbe3d8", border: `1px solid ${ORANGE}` }} />每格的 5 个输出</span>
      </div>
      <div className={`viz-narr${isOwner ? " is-good" : ""}`}>
        {isOwner
          ? `这一格是物体中心所在的格子，它要学会输出 obj = 1，并且把框画对：中心在格子里 (${tgt[0].toFixed(2)}, ${tgt[1].toFixed(2)}) 的位置，宽高占整张图的 ${tgt[2].toFixed(3)} 和 ${tgt[3].toFixed(3)}。损失 = 物体置信度的二分类交叉熵 + 5 × 四个框坐标的平方误差。`
          : `这一格里没有物体中心，它只要学会输出 obj = 0；它报的框不管是什么都不算损失。16 个格子里只有 1 个负责物体，其余 15 个都是这种「负样本格」，这就是检测里正负样本极不平衡的来源。`}
      </div>
    </VisualizationFrame>
  );
}
