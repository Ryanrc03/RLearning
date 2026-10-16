"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Slider from "@/components/visualization/ml/primitives/Slider";
import { gradientChain, layerFactors, MAX_DEPTH, RESIDUAL_SEED } from "@/lib/ml/backprop";

// Page 2 of Deep Learning Blocks: the same N layers twice. Each layer has one
// ∂f/∂x; the plain column multiplies them, the residual column multiplies
// (1 + ∂f/∂x). Bars are the cumulative |∂L/∂x| after each layer, log scale.

const W = 720;
const H = 360;
const TOP = 64;
const BOTTOM = 34;
const ROWS_H = H - TOP - BOTTOM;
const PANEL_W = 334;
const GAP = 24;
const BAR_X0 = 118;
const BAR_W = PANEL_W - BAR_X0 - 10;
const LOG_LO = -12;
const LOG_HI = 6;
const C_PLAIN = "#2a78d6";
const C_RES = "#eb6834";
const INK = "#3b4234";
const MUTED = "#76796f";
const LINE = "#e4dfcb";

type Preset = "random" | "const";
const PRESETS: { key: Preset; label: string }[] = [
  { key: "random", label: "随机 ∂f/∂x ∈ [−0.4, 0.6]" },
  { key: "const", label: "全部 +0.6" },
];

const sci = (v: number) => {
  if (v === 0) return "0";
  if (v >= 0.01 && v < 1000) return v.toFixed(v < 1 ? 3 : v < 100 ? 2 : 0);
  const [m, e] = v.toExponential(1).split("e");
  return `${m} × 10${sup(Number(e))}`;
};
const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const sup = (n: number) => (n < 0 ? "⁻" : "") + String(Math.abs(n)).split("").map((d) => SUP[Number(d)]).join("");
const num = (v: number, digits = 2) => v.toFixed(digits).replace("-", "−");
const onePlus = (v: number) => `1 ${v < 0 ? "−" : "+"} ${Math.abs(v).toFixed(2)}`;
const barLen = (v: number) => Math.max(0, Math.min(BAR_W, ((Math.log10(Math.max(v, 1e-300)) - LOG_LO) / (LOG_HI - LOG_LO)) * BAR_W));

export default function ResidualFigure() {
  const [depth, setDepth] = useState(12);
  const [preset, setPreset] = useState<Preset>("random");
  const factors = useMemo(() => (preset === "random" ? layerFactors(RESIDUAL_SEED, MAX_DEPTH) : Array<number>(MAX_DEPTH).fill(0.6)), [preset]);
  const used = factors.slice(0, depth);
  const plain = gradientChain(used, false);
  const resid = gradientChain(used, true);
  const lastPlain = plain[depth - 1];
  const lastRes = resid[depth - 1];
  const rowH = Math.min(22, ROWS_H / depth);
  const showLabels = rowH >= 13;
  const oneX = BAR_X0 + barLen(1);

  const narr =
    preset === "const"
      ? depth < 4
        ? `每层 ∂f/∂x 都是 +0.6。${depth} 层时 plain 是 0.6${sup(depth)} = ${sci(lastPlain)}，residual 是 1.6${sup(depth)} = ${sci(lastRes)}，差别还不大，往右拖。`
        : `每层 ∂f/∂x 都是 +0.6。${depth} 层后 plain 连乘成 0.6${sup(depth)} = ${sci(lastPlain)}，residual 却是 1.6${sup(depth)} = ${sci(lastRes)}：那个 1 保证梯度不消失，不保证不爆炸。因子全部同号时 (1 + ∂f/∂x) 一路大于 1，这就是 residual 几乎总和 normalization 一起出现的原因。`
      : depth < 4
        ? `只有 ${depth} 层，两条路差不多：plain 累计 ${sci(lastPlain)}，residual 累计 ${sci(lastRes)}。继续往右拖，差距会按指数拉开。`
        : lastPlain >= 1e-3
          ? `${depth} 层后 plain 累计 ${sci(lastPlain)}，residual 累计 ${sci(lastRes)}：差距已经拉开，但 plain 还没小到收不到梯度。再往右拖。`
          : `${depth} 层后，plain 这一路连乘成 ${sci(lastPlain)}，靠近输入的层几乎收不到梯度；residual 这一路还是 ${sci(lastRes)}，在 1 附近。两列用的是同一组 ∂f/∂x，差别只在每一项是 ∂f/∂x 还是 1 + ∂f/∂x。`;
  const tone = preset === "const" && depth >= 4 ? " is-warn" : depth < 4 ? "" : lastPlain < 1e-3 ? " is-bad" : " is-warn";

  const column = (x0: number, title: string, formula: string, values: number[], color: string, residual: boolean) => (
    <g>
      <text x={x0} y={22} fontSize={12.5} fontWeight={600} fill={INK}>{title}</text>
      <text x={x0} y={38} fontSize={11.5} fill={MUTED} className="mono">{formula}</text>
      <text x={x0 + PANEL_W} y={38} fontSize={12.5} fontWeight={700} textAnchor="end" fill={color} className="mono">{depth} 层后 {sci(values[depth - 1])}</text>
      <line x1={x0 + BAR_X0} y1={TOP - 6} x2={x0 + BAR_X0} y2={TOP + depth * rowH} stroke={LINE} />
      <line x1={x0 + oneX} y1={TOP - 6} x2={x0 + oneX} y2={TOP + depth * rowH} stroke="#8e8d78" strokeDasharray="3 3" />
      <text x={x0 + oneX} y={TOP - 10} fontSize={10.5} textAnchor="middle" fill={MUTED} className="mono">1</text>
      {[-12, -8, -4, 0, 4].map((e) => (
        <text key={e} x={x0 + BAR_X0 + ((e - LOG_LO) / (LOG_HI - LOG_LO)) * BAR_W} y={H - 14} fontSize={10.5} textAnchor="middle" fill={MUTED} className="mono">10{sup(e)}</text>
      ))}
      {residual && depth > 0 && <line x1={x0 + 14} y1={TOP + rowH / 2} x2={x0 + 14} y2={TOP + (depth - 0.5) * rowH} stroke={color} strokeWidth={1.5} opacity={0.7} />}
      {values.map((v, i) => {
        const y = TOP + i * rowH;
        const f = used[i];
        return (
          <g key={i}>
            {residual && showLabels && (
              <g>
                <circle cx={x0 + 14} cy={y + rowH / 2} r={5} fill="#fff" stroke={color} strokeWidth={1.2} />
                <text x={x0 + 14} y={y + rowH / 2 + 3} fontSize={9} textAnchor="middle" fill={color} fontWeight={700}>+</text>
              </g>
            )}
            {showLabels && (
              <>
                <text x={x0 + 26} y={y + rowH / 2 + 4} fontSize={10.5} fill={MUTED} className="mono">{i + 1}</text>
                <text x={x0 + BAR_X0 - 6} y={y + rowH / 2 + 4} fontSize={11} textAnchor="end" fill={INK} className="mono">
                  {residual ? `×(${onePlus(f)})` : `× ${num(f)}`}
                </text>
              </>
            )}
            <rect x={x0 + BAR_X0} y={y + 2} width={barLen(v)} height={Math.max(2, rowH - 4)} rx={2} fill={color} opacity={0.85} style={{ transition: "width .25s" }} />
          </g>
        );
      })}
    </g>
  );

  return (
    <VisualizationFrame
      title="Residual：同一串 ∂f/∂x，连乘它 vs 连乘 (1 + 它)"
      description="梯度从 loss 出发，从上往下穿过 N 层。左右两列的每一层用同一个 ∂f/∂x；条是经过这一层后 |∂L/∂x| 的累计大小，横轴是对数刻度，虚线是 1。"
    >
      <div className="viz-row">
        <div className="viz-chips" role="group" aria-label="每层的 ∂f/∂x">
          {PRESETS.map((p) => (
            <button key={p.key} type="button" className={`viz-chip${preset === p.key ? " is-on" : ""}`} aria-pressed={preset === p.key} onClick={() => setPreset(p.key)}>{p.label}</button>
          ))}
        </div>
      </div>
      <Slider label="层数 N" value={depth} min={1} max={MAX_DEPTH} step={1} onChange={setDepth} display={String(depth)} id="res-depth" />

      <Figure width={W} height={H} label={`${depth} 层：plain 累计梯度 ${sci(lastPlain)}，residual 累计梯度 ${sci(lastRes)}`} minWidth={600}>
        {column(12, "Plain：y = f(x)", "∂L/∂x = ∏ ∂f/∂x", plain, C_PLAIN, false)}
        {column(12 + PANEL_W + GAP, "Residual：y = x + f(x)", "∂L/∂x = ∏ (1 + ∂f/∂x)", resid, C_RES, true)}
      </Figure>

      <div className="viz-legend">
        <span><i style={{ background: C_PLAIN }} />plain：每层乘 ∂f/∂x</span>
        <span><i style={{ background: C_RES }} />residual：每层乘 1 + ∂f/∂x，⊕ 是跳线汇入的地方</span>
        {!showLabels && <span>层数多时每层的因子不再标出，两列用的仍是同一组数</span>}
      </div>

      <div className={`viz-narr${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}
