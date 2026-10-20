"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import DfPixels from "./DfPixels";
import { receptiveField, TOY_CAR, toyAttentionRow, toyVisible, TOY_H, TOY_W } from "@/lib/ml/daefuse";

// Section 2.1–2.2: what one output position can "see". Left, a stack of 3 × 3
// convolutions: the window grows by 2 pixels per layer. Right, one ViT layer
// over 4 × 4 patches: every patch attends to every other, weighted by how
// similar the two patches look. Click a pixel to move the query.

const CELL = 11;
const P = 4; // patch size
const C1 = "#2a78d6";
const INK = "#3b4234";

function patchFeatures(img: number[][]) {
  const rows = TOY_H / P;
  const cols = TOY_W / P;
  const feats: number[][] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const v: number[] = [];
      for (let y = 0; y < P; y++) for (let x = 0; x < P; x++) v.push(img[r * P + y][c * P + x]);
      const m = v.reduce((a, b) => a + b, 0) / v.length;
      const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length);
      feats.push([m, sd]);
    }
  return { feats, rows, cols };
}

export default function DfCnnVsVit() {
  const img = useMemo(() => toyVisible(), []);
  const { feats, cols } = useMemo(() => patchFeatures(img), [img]);
  const [pix, setPix] = useState({ x: 5, y: 10 });
  const [layers, setLayers] = useState(1);

  const rf = receptiveField(layers);
  const r = Math.floor(rf / 2);
  const q = Math.floor(pix.y / P) * cols + Math.floor(pix.x / P);
  const att = toyAttentionRow(feats, q);
  const maxAtt = Math.max(...att);
  // Chebyshev distance to the nearest car pixel: the window reaches it once r ≥ that.
  const carDist = Math.max(Math.max(0, TOY_CAR.x0 - pix.x, pix.x - TOY_CAR.x1), Math.max(0, TOY_CAR.y0 - pix.y, pix.y - TOY_CAR.y1));
  const seesCar = r >= carDist;
  const carPatches = new Set<number>();
  for (let y = TOY_CAR.y0; y <= TOY_CAR.y1; y++) for (let x = TOY_CAR.x0; x <= TOY_CAR.x1; x++) carPatches.add(Math.floor(y / P) * cols + Math.floor(x / P));
  const attOnCar = [...carPatches].reduce((s, i) => s + att[i], 0);

  const LX = 20;
  const RX = 330;
  const TY = 34;

  return (
    <VisualizationFrame
      title="一个输出位置看得到多远：3 × 3 卷积 vs ViT 的一层 attention"
      description="同一张 24 × 16 的可见光示意图。点图上任意像素换查询位置。左边按层数看卷积的感受野；右边是 ViT 把图切成 4 × 4 的 patch 之后，查询所在 patch 对所有 patch 的 attention 权重。"
      footnote="示意计算：patch 的特征只取（平均亮度, 亮度标准差）两维，score = −‖q − k‖² / 0.02，再 softmax。真实 ViT 的 q、k 是学出来的投影，但「每个 patch 第一层就能看到全图」这一点相同。"
    >
      <div className="viz-controls">
        <span className="viz-k">卷积层数</span>
        {[1, 2, 3, 4, 6, 9].map((l) => (
          <button key={l} type="button" className={`viz-btn${layers === l ? " is-on" : ""}`} onClick={() => setLayers(l)}>
            {l} 层
          </button>
        ))}
      </div>
      <div className="viz-scroll">
        <svg viewBox="0 0 630 256" role="img" aria-label={`查询像素 (${pix.x}, ${pix.y})；${layers} 层卷积的感受野 ${rf} × ${rf}；ViT 一层的 attention 有 ${(attOnCar * 100).toFixed(0)}% 落在车上`} style={{ minWidth: 560 }}>
          <DfPixels img={img} x={LX} y={TY} cell={CELL} title={`CNN：${layers} 层 3 × 3 卷积`} onPick={(x, y) => setPix({ x, y })} />
          <rect
            x={LX + (pix.x - r) * CELL}
            y={TY + (pix.y - r) * CELL}
            width={rf * CELL}
            height={rf * CELL}
            fill={C1}
            fillOpacity={0.22}
            stroke={C1}
            strokeWidth={2}
            style={{ transition: "all .25s", pointerEvents: "none" }}
          />
          <rect x={LX + pix.x * CELL} y={TY + pix.y * CELL} width={CELL} height={CELL} fill="none" stroke={INK} strokeWidth={2} style={{ pointerEvents: "none" }} />
          <text x={LX} y={TY + TOY_H * CELL + 18} fontSize={10.5} fill="#30332c">感受野 1 + {layers}·(3 − 1) = <tspan fontWeight={700}>{rf} × {rf}</tspan></text>
          <text x={LX} y={TY + TOY_H * CELL + 34} fontSize={10} fill="#76796f">{seesCar ? "已经覆盖到车" : `离车最近还差 ${carDist - r} 个像素`}</text>

          <DfPixels img={img} x={RX} y={TY} cell={CELL} title="ViT：一层 self-attention（4 × 4 patch）" onPick={(x, y) => setPix({ x, y })} />
          {att.map((w, i) => {
            const pr = Math.floor(i / cols);
            const pc = i % cols;
            return (
              <g key={i} style={{ pointerEvents: "none" }}>
                <rect x={RX + pc * P * CELL} y={TY + pr * P * CELL} width={P * CELL} height={P * CELL} fill={C1} fillOpacity={(w / maxAtt) * 0.6} stroke="#fff" strokeWidth={0.8} style={{ transition: "fill-opacity .25s" }} />
                <text x={RX + pc * P * CELL + P * CELL - 3} y={TY + pr * P * CELL + 12} fontSize={9} textAnchor="end" fill={w / maxAtt > 0.5 ? "#fff" : "#30332c"} className="mono">{(w * 100).toFixed(0)}</text>
              </g>
            );
          })}
          <rect x={RX + (q % cols) * P * CELL} y={TY + Math.floor(q / cols) * P * CELL} width={P * CELL} height={P * CELL} fill="none" stroke={INK} strokeWidth={2.2} style={{ pointerEvents: "none" }} />
          <text x={RX} y={TY + TOY_H * CELL + 18} fontSize={10.5} fill="#30332c">一层就覆盖 24 个 patch，数字是权重 %</text>
          <text x={RX} y={TY + TOY_H * CELL + 34} fontSize={10} fill="#76796f">落在车所在 patch 上的权重合计 {(attOnCar * 100).toFixed(0)}%</text>
        </svg>
      </div>
      <div className="viz-legend">
        <span><i style={{ background: "#dbe8f8", border: `1px solid ${C1}` }} />卷积感受野 / attention 权重（越深越大）</span>
        <span><i style={{ background: "#fff", border: `2px solid ${INK}` }} />查询位置</span>
      </div>
      <div className={`viz-narr${seesCar ? " is-good" : " is-warn"}`}>
        {seesCar
          ? `${layers} 层之后感受野是 ${rf} × ${rf}，查询像素终于「看到」了车。代价是要叠这么多层，而且越外圈的像素对输出的贡献越小（有效感受野比理论值小）。卷积擅长的是窗口里的局部变化：边缘、纹理、砖缝，也就是高频。`
          : `${layers} 层 3 × 3 卷积只看到 ${rf} × ${rf} 的邻域，查询像素离车还差 ${carDist - r} 个像素。右边的 ViT 一层就给全图 24 个 patch 都分了权重，相似的 patch 拿得多（砖墙看砖墙，路看路）：它天然在做大范围的加权平均，擅长整体亮度、布局这些低频信息。`}
      </div>
    </VisualizationFrame>
  );
}
