"use client";

import { useState, type KeyboardEvent } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import { patchCount, patchesPerSide } from "@/lib/ml/patches";

const SIZE = 224;
const SIZES = [8, 16, 32] as const;

// Original vector illustration so the page needs no external image.
export function CatIllustration() {
  return (
    <g aria-hidden>
      <rect width="224" height="224" fill="#fdf6df" />
      <rect x="0" y="150" width="224" height="74" fill="#d9c9a3" />
      <rect x="10" y="120" width="204" height="44" rx="14" fill="#b9946a" />
      <rect x="18" y="160" width="188" height="40" rx="8" fill="#a07c55" />
      <circle cx="186" cy="40" r="18" fill="#f4d47a" />
      <ellipse cx="118" cy="140" rx="58" ry="34" fill="#e7a35a" />
      <path d="M160 150 q38 -6 34 -40" stroke="#e7a35a" strokeWidth="10" fill="none" strokeLinecap="round" />
      <circle cx="92" cy="98" r="36" fill="#eeb06a" />
      <polygon points="62,76 66,44 88,66" fill="#eeb06a" />
      <polygon points="122,76 118,44 96,66" fill="#eeb06a" />
      <polygon points="68,70 70,54 82,66" fill="#f6c9a0" />
      <polygon points="116,70 114,54 102,66" fill="#f6c9a0" />
      <ellipse cx="79" cy="96" rx="5" ry="7" fill="#2f3a2a" />
      <ellipse cx="105" cy="96" rx="5" ry="7" fill="#2f3a2a" />
      <path d="M88 108 l4 4 l4 -4 z" fill="#c4626a" />
      <path d="M66 112 h-22 M66 117 h-20 M118 112 h22 M118 117 h20" stroke="#6b5d4a" strokeWidth="1.2" />
      <path d="M84 70 q8 -6 16 0" stroke="#c98a45" strokeWidth="3" fill="none" />
    </g>
  );
}

export default function ImagePatchExplorer() {
  const [p, setP] = useState<number>(16);
  const [sel, setSel] = useState<[number, number]>([6, 5]);
  const side = patchesPerSide(SIZE, p);
  const total = patchCount(SIZE, SIZE, p);
  const [r, c] = [Math.min(sel[0], side - 1), Math.min(sel[1], side - 1)];
  const index = r * side + c;

  const changeSize = (next: number) => {
    // Keep pointing at the same spot of the image when the grid changes.
    const cx = (c + 0.5) * p;
    const cy = (r + 0.5) * p;
    setSel([Math.floor(cy / next), Math.floor(cx / next)]);
    setP(next);
  };

  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    setSel([Math.max(0, Math.min(side - 1, r + m[0])), Math.max(0, Math.min(side - 1, c + m[1]))]);
  };

  // Show a window of the flattened token sequence around the selected patch.
  const around = [index - 2, index - 1, index, index + 1, index + 2].filter((k) => k >= 0 && k < total);

  return (
    <VisualizationFrame
      title="Image → Patch Grid"
      description="固定 224×224 的输入，换 patch 大小，看能切出多少块。点图上任意一块（或聚焦图片后用方向键），对应的 visual token 会亮起。"
      footnote="这里只展示 patch 切分的概念。真实 VLM 还会先缩放图片、可能加 [CLS] 等特殊 token、做 patch merge 或动态分辨率，最终送进 LLM 的 token 数未必等于 patch 数。"
    >
      <div className="viz-controls">
        <span className="viz-k">Patch size</span>
        <div className="viz-chips" role="group" aria-label="patch size">
          {SIZES.map((k) => (
            <button key={k} type="button" className={`viz-chip mono${p === k ? " is-on" : ""}`} aria-pressed={p === k} onClick={() => changeSize(k)}>{k}×{k}</button>
          ))}
        </div>
      </div>
      <div className="patch-layout">
        <svg
          className="patch-svg"
          viewBox="0 0 224 224"
          role="img"
          tabIndex={0}
          aria-label={`224×224 的猫插画，切成 ${side}×${side} 个 patch。当前选中第 ${r + 1} 行第 ${c + 1} 列，方向键移动`}
          onKeyDown={onKey}
        >
          <CatIllustration />
          {Array.from({ length: total }, (_, k) => {
            const rr = Math.floor(k / side);
            const cc = k % side;
            return <rect key={k} className={`cell${k === index ? " is-on" : ""}`} x={cc * p} y={rr * p} width={p} height={p} onClick={() => setSel([rr, cc])} />;
          })}
        </svg>
        <div style={{ minWidth: 0 }}>
          <div className="viz-stat">
            <div><small>每边 224 / {p}</small><b>{side}</b></div>
            <div><small>patch 数 ({side})²</small><b>{total}</b></div>
            <div><small>每块原始数值 {p}×{p}×3</small><b>{p * p * 3}</b></div>
          </div>
          <p className="viz-k" style={{ margin: "10px 0 6px" }}>按行展平后的 {total} 个 visual token（每格一个）：</p>
          <div className="tok-grid" style={{ gridTemplateColumns: `repeat(${side}, minmax(0, 1fr))`, maxWidth: 260 }} aria-hidden>
            {Array.from({ length: total }, (_, k) => (
              <button key={k} type="button" tabIndex={-1} className={k === index ? "is-on" : ""} onClick={() => setSel([Math.floor(k / side), k % side])} />
            ))}
          </div>
          <div className="tok-strip" style={{ marginTop: 10 }} aria-live="polite">
            {around[0] > 0 && <span className="viz-k">…</span>}
            {around.map((k) => (
              <span key={k} className={`tok is-vis${k === index ? " is-active" : ""}`}>V{k + 1}<small>({Math.floor(k / side) + 1},{(k % side) + 1})</small></span>
            ))}
            {around[around.length - 1] < total - 1 && <span className="viz-k">… V{total}</span>}
          </div>
        </div>
      </div>
      <div className="viz-narr">
        第 {r + 1} 行第 {c + 1} 列的 patch 是 {p}×{p}×3 = {p * p * 3} 个像素值。展平后乘一个线性投影矩阵，变成一个 d 维向量（ViT-L 是 1024 维），按行优先排在第 {index + 1} 位，记作 V{index + 1}。
        {p === 8 ? " patch 越小，细节越多，但 token 数涨到 784 个，attention 的计算量按 n² 涨。" : p === 32 ? " patch 越大，token 越少（49 个），但一块里装了太多内容，细节会丢。" : " 16×16 是 ViT 论文标题里的那个“16×16 words”。"}
      </div>
    </VisualizationFrame>
  );
}
