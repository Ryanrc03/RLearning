"use client";

import { useId, useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Curve from "@/components/visualization/ml/primitives/Curve";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Marker from "@/components/visualization/ml/primitives/Marker";
import Plot, { type PlotFrame } from "@/components/visualization/ml/primitives/Plot";
import Slider from "@/components/visualization/ml/primitives/Slider";
import {
  circlePoints,
  dataLoss,
  diamondPoints,
  ellipsePoints,
  H_DEMO,
  l1Norm,
  l2Norm,
  lassoSolution,
  lassoZeroLambda,
  ridgeSolution,
  W_STAR,
  type Vec2,
} from "@/lib/ml/regularize";

// Page 3 of Training: the same two-weight data loss under an L2 and an L1
// penalty. Drag λ and watch the ridge solution slide along an arc while the
// lasso solution runs into a corner of the diamond and one weight becomes 0.

const W = 720;
const H = 340;
const LAMBDA_MAX = 4;
const DOMAIN: [number, number] = [-1.4, 2.6];
const TICKS = [-1, 0, 1, 2];
const LEVELS = [0.1, 0.4, 0.9, 1.6, 2.5];
const C_L2 = "#2a78d6";
const C_L1 = "#eb6834";
const C_ZERO = "#d03b3b";

const f2 = (v: number) => (Math.abs(v) < 0.005 ? "0.00" : v.toFixed(2));
const exactZero = (v: number) => v === 0;

type Panel = { kind: "l2" | "l1"; color: string; w: Vec2; path: Vec2[]; shape: Vec2[]; level: number };

function PanelBody({ f, p, clipId, contours }: { f: PlotFrame; p: Panel; clipId: string; contours: Vec2[][] }) {
  return (
    <>
      <clipPath id={clipId}>
        <rect x={f.x0} y={f.y1} width={f.x1 - f.x0} height={f.y0 - f.y1} />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        <line x1={f.x0} y1={f.y(0)} x2={f.x1} y2={f.y(0)} stroke="#c9c4ad" strokeWidth={1.2} />
        <line x1={f.x(0)} y1={f.y1} x2={f.x(0)} y2={f.y0} stroke="#c9c4ad" strokeWidth={1.2} />
        {contours.map((pts, i) => (
          <Curve key={i} frame={f} points={pts} color="#c9c4ad" width={1} />
        ))}
        <Curve frame={f} points={p.path} color={p.color} width={1} dashed opacity={0.55} />
        {p.level > 1e-6 && <Curve frame={f} points={ellipsePoints(H_DEMO, W_STAR, p.level)} color={p.color} width={1.6} />}
        <Curve frame={f} points={p.shape} color={p.color} width={1.8} area />
      </g>
      <circle cx={f.x(W_STAR[0])} cy={f.y(W_STAR[1])} r={4} fill="#fff" stroke="#3b4234" strokeWidth={1.5} />
      <text x={f.x(W_STAR[0]) + 7} y={f.y(W_STAR[1]) - 6} fontSize={11.5} fill="#3b4234" fontWeight={600} className="mono">w*</text>
      <Marker frame={f} x={p.w[0]} y={p.w[1]} color={exactZero(p.w[1]) || exactZero(p.w[0]) ? C_ZERO : p.color} label={`(${f2(p.w[0])}, ${f2(p.w[1])})`} side="below" r={5} />
    </>
  );
}

export default function RegularizationFigure() {
  const [lambda, setLambda] = useState(1.5);
  const clipL2 = useId();
  const clipL1 = useId();

  const fixed = useMemo(() => {
    const contours = LEVELS.map((l) => ellipsePoints(H_DEMO, W_STAR, l));
    const grid = Array.from({ length: 81 }, (_, i) => (i * LAMBDA_MAX) / 80);
    const ridgePath = grid.map((l) => ridgeSolution(H_DEMO, W_STAR, l));
    const lassoPath = grid.map((l) => lassoSolution(H_DEMO, W_STAR, l));
    return { contours, ridgePath, lassoPath, zeroAt: lassoZeroLambda(H_DEMO, W_STAR) };
  }, []);

  const ridge = ridgeSolution(H_DEMO, W_STAR, lambda);
  const lasso = lassoSolution(H_DEMO, W_STAR, lambda);
  const panels: Panel[] = [
    { kind: "l2", color: C_L2, w: ridge, path: fixed.ridgePath, shape: circlePoints(l2Norm(ridge)), level: dataLoss(H_DEMO, W_STAR, ridge) },
    { kind: "l1", color: C_L1, w: lasso, path: fixed.lassoPath, shape: diamondPoints(l1Norm(lasso)), level: dataLoss(H_DEMO, W_STAR, lasso) },
  ];
  const lassoZeros = (exactZero(lasso[0]) ? 1 : 0) + (exactZero(lasso[1]) ? 1 : 0);

  const narr =
    lambda === 0
      ? { tone: "", text: "λ = 0：没有惩罚，两边的解都停在 w* = (1.6, 0.9)，也就是数据 loss 的最低点。往右拖，看两个解各自怎么离开 w*。" }
      : lassoZeros === 2
        ? {
            tone: "is-warn",
            text: `λ = ${lambda.toFixed(2)} ≥ ${fixed.zeroAt.toFixed(2)}：L1 把两个权重都推到了 0，模型什么都不学了。L2 的解 (${f2(ridge[0])}, ${f2(ridge[1])}) 还在往原点缩，但永远到不了 0：(H + λI)⁻¹ 只是把它除小，不会减成零。`,
          }
        : lassoZeros === 1
          ? {
              tone: "is-good",
              text: `λ = ${lambda.toFixed(2)}：L1 的解落在了 w₂ = 0 这条轴上，椭圆和菱形在角上相切，w₂ 被精确地置零，等于把这个特征删掉。L2 这边 w₂ = ${f2(ridge[1])}，只是小了，不是 0：圆没有角，椭圆碰到它的地方几乎不会正好落在坐标轴上。继续拖，L1 的 w₁ 沿着轴往原点走。`,
            }
          : {
              tone: "",
              text: `λ = ${lambda.toFixed(2)}：两边都在往原点缩。L2 的解沿一条弧线走，w₁、w₂ 都变小但都不是 0。L1 的 w₂ 已经从 0.90 缩到 ${f2(lasso[1])}，比 L2 的 ${f2(ridge[1])} 小得多：菱形的角正好在坐标轴上，椭圆最先碰到的往往就是角。`,
            };

  return (
    <VisualizationFrame
      title="同一个数据 loss，圆形约束和菱形约束"
      description="灰色椭圆是数据 loss ½ (w − w*)ᵀ H (w − w*) 的等高线，w* = (1.6, 0.9) 是不加惩罚时的最优解。彩色的圆 / 菱形是经过当前解的 ‖w‖₂ / ‖w‖₁ 等值线，虚线是 λ 从 0 拖到 4 时解走过的路。"
    >
      <Slider label="λ（惩罚强度）" value={lambda} min={0} max={LAMBDA_MAX} step={0.05} onChange={setLambda} display={lambda.toFixed(2)} id="reg-lambda" />
      <Figure width={W} height={H} label={`λ = ${lambda.toFixed(2)}：L2 的解 (${f2(ridge[0])}, ${f2(ridge[1])})，L1 的解 (${f2(lasso[0])}, ${f2(lasso[1])})`}>
        <Plot box={{ x: 0, y: 0, w: 355, h: H }} xDomain={DOMAIN} yDomain={DOMAIN} xTicks={TICKS} yTicks={TICKS} xLabel="w₁" yLabel="w₂" title="L2（Ridge）：圆形约束 ‖w‖₂² ≤ r">
          {(f) => <PanelBody f={f} p={panels[0]} clipId={clipL2} contours={fixed.contours} />}
        </Plot>
        <Plot box={{ x: 365, y: 0, w: 355, h: H }} xDomain={DOMAIN} yDomain={DOMAIN} xTicks={TICKS} yTicks={TICKS} xLabel="w₁" yLabel="w₂" title="L1（Lasso）：菱形约束 ‖w‖₁ ≤ r">
          {(f) => <PanelBody f={f} p={panels[1]} clipId={clipL1} contours={fixed.contours} />}
        </Plot>
      </Figure>

      <div className="viz-panel" style={{ marginTop: 12 }}>
        <h5>λ = {lambda.toFixed(2)} 时的两个解</h5>
        <table className="viz-table">
          <thead>
            <tr><th></th><th className="num">w₁</th><th className="num">w₂</th><th className="num">惩罚项</th><th className="num">数据 loss</th><th className="num">精确为 0 的权重</th></tr>
          </thead>
          <tbody>
            {panels.map((p) => {
              const zeros = (exactZero(p.w[0]) ? 1 : 0) + (exactZero(p.w[1]) ? 1 : 0);
              const pen = p.kind === "l2" ? `½‖w‖₂² = ${(0.5 * l2Norm(p.w) ** 2).toFixed(2)}` : `‖w‖₁ = ${l1Norm(p.w).toFixed(2)}`;
              return (
                <tr key={p.kind}>
                  <td><i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: p.color, marginRight: 6 }} />{p.kind === "l2" ? "L2 / Ridge" : "L1 / Lasso"}</td>
                  {[0, 1].map((i) => (
                    <td key={i} className="num" style={exactZero(p.w[i]) ? { color: C_ZERO, fontWeight: 700 } : undefined}>{exactZero(p.w[i]) ? "0（精确）" : p.w[i].toFixed(3)}</td>
                  ))}
                  <td className="num">{pen}</td>
                  <td className="num">{p.level.toFixed(3)}</td>
                  <td className="num" style={zeros > 0 ? { color: C_ZERO, fontWeight: 700 } : undefined}>{zeros}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className={`viz-narr${narr.tone ? ` ${narr.tone}` : ""}`}>{narr.text}</div>
    </VisualizationFrame>
  );
}
