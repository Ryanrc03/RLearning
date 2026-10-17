"use client";

import { useState, type KeyboardEvent } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import { qwen2vlTokens } from "@/lib/ml/patches";

const PRESETS = [
  [224, 224],
  [448, 448],
  [448, 896],
  [896, 1344],
] as const;
const TEXT_BEFORE = 3; // e.g. "<|im_start|>user\n" style prefix, simplified to 3 text positions

// Qwen2-VL: patch 14, 2×2 merge, dynamic resolution, M-RoPE (temporal, height, width).
export default function QwenResolutionCounter() {
  const [preset, setPreset] = useState(0);
  const [cell, setCell] = useState<[number, number]>([0, 0]);
  const [h, w] = PRESETS[preset];
  const t = qwen2vlTokens(h, w);
  const rows = h / 28;
  const cols = w / 28;
  const [r, c] = [Math.min(cell[0], rows - 1), Math.min(cell[1], cols - 1)];
  const scale = 200 / Math.max(h, w);
  const vw = w * scale;
  const vh = h * scale;
  const start = TEXT_BEFORE + 1; // after the text prefix and <vision_start>
  const afterText = start + Math.max(rows, cols);
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    setCell([Math.max(0, Math.min(rows - 1, r + m[0])), Math.max(0, Math.min(cols - 1, c + m[1]))]);
  };

  return (
    <VisualizationFrame
      title="Qwen2-VL：分辨率决定 visual token 数"
      description="Qwen2-VL 不把图片缩到固定尺寸，而是按原始分辨率切 14×14 patch，再把相邻 2×2 合成一个 token。换个分辨率，点任意 token 看它的 M-RoPE 位置。"
      footnote="按 Qwen2-VL 论文描述计算：patch 14、2×2 merge、前后各加一个 vision 特殊 token。实际实现还会把图片缩放到 28 的倍数，并受 min_pixels / max_pixels 限制；M-RoPE 位置 id 为简化示意。"
    >
      <div className="viz-controls">
        <div className="viz-chips" role="group" aria-label="输入分辨率">
          {PRESETS.map(([ph, pw], i) => (
            <button key={i} type="button" className={`viz-chip mono${preset === i ? " is-on" : ""}`} aria-pressed={preset === i} onClick={() => setPreset(i)}>{pw}×{ph}</button>
          ))}
        </div>
      </div>
      <div className="viz-grid2">
        <div className="viz-panel">
          <h5 className="nocase">{w}×{h} → {cols}×{rows} 个合并后的 token</h5>
          <svg viewBox={`0 0 ${vw} ${vh}`} style={{ width: "100%", maxWidth: 260, margin: "0 auto" }} role="img" tabIndex={0} onKeyDown={onKey} aria-label={`${cols} 列 ${rows} 行的 visual token 网格，方向键移动选中的 token`}>
            <rect width={vw} height={vh} fill="#eaf3fd" stroke="#9cc3ef" />
            {Array.from({ length: rows * cols }, (_, k) => {
              const rr = Math.floor(k / cols);
              const cc = k % cols;
              const on = rr === r && cc === c;
              return (
                <rect key={k} x={cc * 28 * scale} y={rr * 28 * scale} width={28 * scale} height={28 * scale} fill={on ? "rgba(237,161,0,.55)" : "transparent"} stroke="rgba(42,120,214,.45)" strokeWidth={0.5} style={{ cursor: "pointer" }} onClick={() => setCell([rr, cc])} />
              );
            })}
          </svg>
        </div>
        <div className="viz-panel">
          <h5 className="nocase">数一数</h5>
          <table className="viz-table">
            <tbody>
              <tr><td>14×14 patch</td><td className="num">{w / 14} × {h / 14} = {t.patches}</td></tr>
              <tr><td>2×2 merge 后</td><td className="num">{t.patches} / 4 = {t.merged}</td></tr>
              <tr><td>+ vision_start / vision_end</td><td className="num">{t.withSpecial}</td></tr>
            </tbody>
          </table>
          <p style={{ marginTop: 10 }} aria-live="polite">
            选中 token（第 {r + 1} 行，第 {c + 1} 列）的 M-RoPE 位置：
            <br />
            <span className="viz-mono">(temporal, height, width) = ({start}, {start + r}, {start + c})</span>
            <br />
            <span className="viz-k">前面的文本 token 三个分量相同，如 (2, 2, 2)；图片之后的文本从 {afterText} 继续。</span>
          </p>
        </div>
      </div>
    </VisualizationFrame>
  );
}
