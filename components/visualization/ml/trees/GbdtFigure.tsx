"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Curve from "@/components/visualization/ml/primitives/Curve";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Plot from "@/components/visualization/ml/primitives/Plot";
import StepPlayer from "@/components/visualization/ml/primitives/StepPlayer";
import { GBDT_POINTS, gbdtRun, gbdtStepCurve } from "@/lib/ml/trees";

// Page 3 of Tree Models: sixteen points on one feature. Every round fits a
// depth-1 stump to the current residuals and adds lr × stump to F(x). Step
// through the rounds and watch the red residual lines shrink.

const ROUNDS = 10;
const LRS = [0.1, 0.5, 1.0];
const W = 440;
const H = 300;
const INK = "#3b4234";
const C_F = "#2a78d6";
const C_PREV = "#c9c4ad";
const C_STUMP = "#1baf7a";
const C_RES = "#d03b3b";
const Y_DOMAIN: [number, number] = [-1.5, 3];

const f3 = (v: number) => v.toFixed(3);
const f2 = (v: number) => v.toFixed(2);
const signed = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}`;

export default function GbdtFigure() {
  const [lr, setLr] = useState(0.5);
  const [step, setStep] = useState(0);
  const run = useMemo(() => gbdtRun(GBDT_POINTS, lr, ROUNDS), [lr]);
  const cur = run[step];
  const prev = step > 0 ? run[step - 1] : null;
  const f0 = run[0].F[0];
  const { curve, prevCurve } = useMemo(() => {
    const stumps = run.slice(1, step + 1).map((r) => r.stump!);
    return { curve: gbdtStepCurve(f0, stumps, lr, 0, 1), prevCurve: gbdtStepCurve(f0, stumps.slice(0, -1), lr, 0, 1) };
  }, [run, step, f0, lr]);
  const stump = cur.stump;
  const drop = prev ? prev.mse - cur.mse : 0;

  const narr = (() => {
    if (step === 0) return `第 0 轮：模型只是一个常数 F₀ = 均值 ${f2(f0)}。每条红线是一个点的残差 y − F₀，MSE ${f3(cur.mse)}。下一棵树要学的不是 y，而是这些红线。`;
    if (!stump) return "";
    const base = `第 ${step} 轮：桩在 x ≤ ${stump.threshold} 切开，左边残差平均 ${signed(stump.left)}、右边 ${signed(stump.right)}；乘 learning rate ${lr.toFixed(1)} 后，左边加 ${signed(lr * stump.left)}，右边加 ${signed(lr * stump.right)}。MSE 从 ${f3(prev!.mse)} 降到 ${f3(cur.mse)}。`;
    if (lr === 1 && step >= 4) return `${base}学习率 1.0 每轮把残差一次补完，降得最快，但后面的桩开始追单个点的噪声。`;
    if (lr === 0.1 && step >= 5) return `${base}学习率 0.1 每轮只走残差的 10%，稳，但 ${ROUNDS} 轮后 MSE 还有 ${f3(run[ROUNDS].mse)}，要很多棵树才追得上。`;
    return base;
  })();
  const tone = step > 0 && lr === 1 && step >= 4 ? " is-warn" : step > 0 && lr === 0.1 && step >= 5 ? " is-warn" : step === ROUNDS ? " is-good" : "";

  return (
    <VisualizationFrame
      title="GBDT：每一轮一棵小树，学的是上一轮剩下的残差"
      description="16 个点、一个特征。蓝色阶梯是当前模型 F_m(x)，红线是每个点的残差；每走一轮，就用一棵深度 1 的桩去拟合红线，乘 learning rate 加到蓝线上。"
    >
      <div className="viz-row">
        <span className="viz-k">learning rate γ</span>
        <div className="viz-chips" role="group" aria-label="learning rate">
          {LRS.map((v) => (
            <button key={v} type="button" className={`viz-chip mono${lr === v ? " is-on" : ""}`} aria-pressed={lr === v} onClick={() => setLr(v)}>{v.toFixed(1)}</button>
          ))}
        </div>
      </div>
      <StepPlayer step={step} total={ROUNDS + 1} onStep={setStep} intervalMs={1100} caption={`第 ${step} 轮 / 共 ${ROUNDS} 轮`} />

      <div className="viz-grid2 wide-left">
        <Figure width={W} height={H} label={`第 ${step} 轮，learning rate ${lr}，MSE ${f3(cur.mse)}`} minWidth={360}>
          <Plot box={{ x: 0, y: 0, w: W, h: H }} xDomain={[0, 1]} yDomain={Y_DOMAIN} xTicks={[0, 0.25, 0.5, 0.75, 1]} yTicks={[-1, 0, 1, 2, 3]} xLabel="x" yLabel="y">
            {(f) => (
              <>
                {step > 0 && <Curve frame={f} points={prevCurve} color={C_PREV} width={1.5} dashed step />}
                {GBDT_POINTS.map((p, i) => (
                  <line key={`r${i}`} x1={f.x(p.x)} y1={f.y(p.y)} x2={f.x(p.x)} y2={f.y(cur.F[i])} stroke={C_RES} strokeWidth={1.5} opacity={0.75} style={{ transition: "y2 .35s" }} />
                ))}
                <Curve frame={f} points={curve} color={C_F} width={2.5} step />
                {stump && Number.isFinite(stump.threshold) && (
                  <g>
                    <line x1={f.x(stump.threshold)} y1={f.y1} x2={f.x(stump.threshold)} y2={f.y0} stroke={C_STUMP} strokeWidth={1.5} strokeDasharray="5 3" />
                    <text x={f.x(stump.threshold)} y={f.y1 + 12} fontSize={11} fill={C_STUMP} fontWeight={600} textAnchor="middle" className="mono">x ≤ {stump.threshold}</text>
                    <text x={f.x(stump.threshold) - 6} y={f.y1 + 26} fontSize={11} fill={C_STUMP} textAnchor="end" className="mono">{signed(lr * stump.left)}</text>
                    <text x={f.x(stump.threshold) + 6} y={f.y1 + 26} fontSize={11} fill={C_STUMP} textAnchor="start" className="mono">{signed(lr * stump.right)}</text>
                  </g>
                )}
                {GBDT_POINTS.map((p, i) => (
                  <circle key={`p${i}`} cx={f.x(p.x)} cy={f.y(p.y)} r={4.5} fill={INK} stroke="#fff" strokeWidth={1.2} />
                ))}
              </>
            )}
          </Plot>
        </Figure>

        <div className="viz-panel">
          <h5>这一轮</h5>
          <div className="viz-stat" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div><small>轮数 m</small><b>{step}</b></div>
            <div><small>MSE</small><b>{f3(cur.mse)}{prev && <span className="delta">−{f3(drop)}</span>}</b></div>
            <div><small>桩的切点</small><b>{stump && Number.isFinite(stump.threshold) ? `x ≤ ${stump.threshold}` : "–"}</b></div>
            <div><small>γ</small><b>{lr.toFixed(1)}</b></div>
            <div><small>左叶加</small><b>{stump ? signed(lr * stump.left) : "–"}</b></div>
            <div><small>右叶加</small><b>{stump ? signed(lr * stump.right) : "–"}</b></div>
          </div>
          <table className="viz-table" style={{ marginTop: 10 }}>
            <thead><tr><th>轮</th><th className="num">MSE</th><th className="num">切点</th></tr></thead>
            <tbody>
              {run.slice(Math.max(0, step - 3), step + 1).map((r) => (
                <tr key={r.round} style={r.round === step ? { fontWeight: 600, background: "#eef5fd" } : undefined}>
                  <td>{r.round}</td>
                  <td className="num">{f3(r.mse)}</td>
                  <td className="num">{r.stump && Number.isFinite(r.stump.threshold) ? r.stump.threshold : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="viz-legend">
        <span><i style={{ background: C_F }} />F_m(x)</span>
        <span><i style={{ background: C_PREV }} />F_{"{m−1}"}(x)</span>
        <span><i style={{ background: C_RES }} />残差 y − F_m(x)</span>
        <span><i style={{ background: C_STUMP }} />本轮的桩</span>
      </div>
      <div className={`viz-narr${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}
