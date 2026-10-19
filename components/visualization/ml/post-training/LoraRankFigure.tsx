"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Curve from "@/components/visualization/ml/primitives/Curve";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Marker from "@/components/visualization/ml/primitives/Marker";
import Plot from "@/components/visualization/ml/primitives/Plot";
import Slider from "@/components/visualization/ml/primitives/Slider";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import {
  demoErrorCurves,
  fullParams,
  loraModelParams,
  loraParams,
  TARGET_PRESETS,
  TOY_N,
  totalParams,
  trainingMemoryGB,
} from "@/lib/ml/lora";

// Page 2 of Post-training: drag the rank r. Left, the frozen W plus the two
// thin trainable factors B (d × r) and A (r × k). Right, how much of a toy
// update ΔW the best rank-r matrix can capture, against a structureless random
// matrix. Below, trainable parameters for one 4096 × 4096 layer and for a
// whole Llama-style 8B model, and the training memory that follows.

type PresetKey = keyof typeof TARGET_PRESETS;
const PRESET_TABS = (Object.keys(TARGET_PRESETS) as PresetKey[]).map((key) => ({ key, label: TARGET_PRESETS[key].label }));

const W = 720;
const H = 300;
const D = 4096;
const C_W = "#cfcab4";
const C_B = "#2a78d6";
const C_A = "#1baf7a";
const C_UPD = "#2a78d6";
const C_RND = "#eb6834";
const INK = "#30332c";
const MUTED = "#76796f";

const fmtCount = (v: number) => (v >= 1e9 ? `${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v.toLocaleString("en-US"));
const pct = (a: number, b: number) => {
  const p = (a / b) * 100;
  return `${p < 0.1 ? p.toFixed(3) : p < 1 ? p.toFixed(2) : p.toFixed(1)}%`;
};

export default function LoraRankFigure() {
  const [logR, setLogR] = useState(3);
  const [preset, setPreset] = useState<PresetKey>("qv");
  const r = 2 ** logR;
  const curves = useMemo(() => demoErrorCurves(), []);
  const total = totalParams();

  const layerFull = fullParams(D, D);
  const layerLora = loraParams(D, D, r);
  const modelLora = loraModelParams(r, TARGET_PRESETS[preset].targets);
  const memFull = trainingMemoryGB(total, total);
  const memLora = trainingMemoryGB(total, modelLora);
  const errUpd = curves.update[r];
  const errRnd = curves.random[r];

  // Plot x is log2(r) + 1 so the x ticks (1 … 8) never collide with the y ticks (0 … 100 %).
  const px = logR + 1;
  const updPts = curves.update.slice(1).map((e, i) => [Math.log2(i + 1) + 1, e * 100] as const);
  const rndPts = curves.random.slice(1).map((e, i) => [Math.log2(i + 1) + 1, e * 100] as const);

  // Left diagram, r direction drawn exaggerated so small ranks stay visible.
  const S = 112;
  const thick = 3 + r * 0.36;
  const wx = 18;
  const wy = 64;
  const bx = wx + S + 30;
  const ax = bx + thick + 12;

  const reset = () => {
    setLogR(3);
    setPreset("qv");
  };

  const tone = r <= 4 ? " is-warn" : r >= TOY_N ? " is-warn" : " is-good";
  const narr =
    r <= 4
      ? `r = ${r}：只训 ${fmtCount(layerLora)} 个数，但 toy ΔW 的主要方向有 8 个，rank ${r} 装不下，最好的近似也还差 ${Math.round(errUpd * 100)}%。r 太小是欠拟合，不是省钱。`
      : r >= TOY_N
        ? `r = ${r}：toy 矩阵只有 ${TOY_N} × ${TOY_N}，r 到头就是满秩，误差归零，等于全量微调。真实模型里 r = ${r} 也只有一层的 ${pct(layerLora, layerFull)}，但比 r = 16 多出的参数几乎换不来误差下降。`
        : `r = ${r}：toy ΔW 用 rank ${r} 就能还原到只差 ${Math.round(errUpd * 100)}%，同样的 rank 对一个没有结构的随机矩阵只能做到差 ${Math.round(errRnd * 100)}%。LoRA 押的就是「微调的增量是前一种」。整个 8B 模型此时只训 ${fmtCount(modelLora)} 个参数（${pct(modelLora, total)}）。`;

  return (
    <VisualizationFrame
      title="LoRA：拖 rank，看训多少参数、能装下多少 ΔW"
      description="左边：冻结的 W 加上两根细长的可训练矩阵 B 和 A（r 方向放大画）。右边：一个 128 × 128 的 toy 增量 ΔW（内在秩 8 加少量噪声）被最好的 rank-r 矩阵近似后的相对误差，橙色虚线是一个同样大小但没有结构的随机矩阵。下面是一层 4096 × 4096 和整个 8B 模型的参数账。"
    >
      <div className="viz-row">
        <Slider label="rank r" value={logR} min={0} max={7} step={1} onChange={setLogR} display={`r = ${r}`} id="lora-rank" />
        <Tabs options={PRESET_TABS} value={preset} onChange={setPreset} ariaLabel="LoRA 加在哪些矩阵上" />
        <button type="button" className="viz-btn" onClick={reset}>重置</button>
      </div>

      <Figure width={W} height={H} label={`r = ${r}，一层训练 ${layerLora} 个参数，toy ΔW 近似误差 ${Math.round(errUpd * 100)}%`}>
        <text x={wx} y={22} fontSize={12.5} fontWeight={600} fill={INK}>h = W x + (α / r) · B A x</text>
        <rect x={wx} y={wy} width={S} height={S} fill={C_W} rx={4} />
        <text x={wx + S / 2} y={wy + S / 2 - 6} fontSize={13} fontWeight={600} textAnchor="middle" fill={INK}>W</text>
        <text x={wx + S / 2} y={wy + S / 2 + 12} fontSize={11} textAnchor="middle" fill={INK}>4096 × 4096</text>
        <text x={wx + S / 2} y={wy + S / 2 + 28} fontSize={11} textAnchor="middle" fill={MUTED}>冻结</text>
        <text x={wx + S + 15} y={wy + S / 2 + 6} fontSize={20} textAnchor="middle" fill={INK}>+</text>
        <rect x={bx} y={wy} width={thick} height={S} fill={C_B} rx={2} style={{ transition: "width .3s" }} />
        <text x={bx + thick / 2} y={wy - 8} fontSize={12} fontWeight={600} textAnchor="middle" fill={C_B}>B</text>
        <text x={bx + thick / 2} y={wy + S + 16} fontSize={11} textAnchor="middle" fill={C_B}>{D}×{r}</text>
        <text x={bx + thick / 2} y={wy + S + 30} fontSize={10.5} textAnchor="middle" fill={MUTED}>初始 0</text>
        <rect x={ax} y={wy} width={S} height={thick} fill={C_A} rx={2} style={{ transition: "height .3s, x .3s" }} />
        <text x={ax + S / 2} y={wy - 8} fontSize={12} fontWeight={600} textAnchor="middle" fill={C_A}>A  {r}×{D}</text>
        <text x={ax + S / 2} y={wy + thick + 16} fontSize={10.5} textAnchor="middle" fill={MUTED}>随机初始化</text>
        <text x={wx} y={wy + S + 58} fontSize={11.5} fill={INK}>
          这一层训练 r(d + k) = <tspan fontWeight={700} fill={C_B}>{layerLora.toLocaleString("en-US")}</tspan>
        </text>
        <text x={wx} y={wy + S + 76} fontSize={11.5} fill={MUTED}>
          全量是 d · k = {layerFull.toLocaleString("en-US")}，只占 {pct(layerLora, layerFull)}
        </text>

        <Plot
          box={{ x: 352, y: 0, w: 368, h: H }}
          xDomain={[1, 8]}
          yDomain={[0, 100]}
          xTicks={[1, 2, 3, 4, 5, 6, 7, 8]}
          yTicks={[0, 25, 50, 75, 100]}
          format={(v) => (v >= 1 && v <= 8 ? String(2 ** (v - 1)) : `${v}%`)}
          xLabel="rank r（对数刻度）"
          yLabel="rank-r 近似的相对误差"
          title="最好的 rank-r 近似差多少（Eckart–Young）"
        >
          {(f) => (
            <g>
              <Curve frame={f} points={rndPts} color={C_RND} dashed />
              <Curve frame={f} points={updPts} color={C_UPD} width={2.4} />
              <line x1={f.x(px)} x2={f.x(px)} y1={f.y1} y2={f.y0} stroke={INK} strokeDasharray="4 3" strokeWidth={1} style={{ transition: "x1 .3s, x2 .3s" }} />
              <Marker frame={f} x={px} y={errRnd * 100} color={C_RND} label={`${Math.round(errRnd * 100)}%`} side="right" r={4} />
              <Marker frame={f} x={px} y={errUpd * 100} color={C_UPD} label={`${Math.round(errUpd * 100)}%`} side={logR >= 6 ? "left" : "right"} />
              <text x={f.x(1.15)} y={f.y(6)} fontSize={11} fill={C_UPD} fontWeight={600}>— 微调增量 ΔW</text>
              <text x={f.x(1.15)} y={f.y(14)} fontSize={11} fill={C_RND} fontWeight={600}>- - 随机矩阵</text>
            </g>
          )}
        </Plot>
      </Figure>

      <div className="viz-stat" style={{ marginTop: 6 }}>
        <div><small>8B 模型总参数</small><b>{fmtCount(total)}</b></div>
        <div><small>LoRA 可训练（{TARGET_PRESETS[preset].label}）</small><b style={{ color: C_B }}>{fmtCount(modelLora)}</b><span className="delta">{pct(modelLora, total)}</span></div>
        <div><small>训练显存：全量 FT</small><b>{memFull.toFixed(0)} GB</b></div>
        <div><small>训练显存：LoRA</small><b style={{ color: C_B }}>{memLora.toFixed(1)} GB</b></div>
      </div>

      <div className={`viz-narr${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}
