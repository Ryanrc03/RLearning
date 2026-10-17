"use client";

import { useId, useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Curve from "@/components/visualization/ml/primitives/Curve";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Marker from "@/components/visualization/ml/primitives/Marker";
import Plot from "@/components/visualization/ml/primitives/Plot";
import StepPlayer from "@/components/visualization/ml/primitives/StepPlayer";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import { bowlContour, HYPER, runOptimizer, stepsToSettle, type OptimizerName, type TrajectoryPoint, type Vec2 } from "@/lib/ml/optim";

// Page 1 of Training: five optimizers released from the same corner of one
// elongated bowl. Pick a method, step through, and watch where each one is
// after the same number of updates.

const W = 720;
const H = 380;
const STEPS = 40;
const SEED = 7;
const SETTLE = 0.01;
const LEVELS = [0.03, 0.12, 0.3, 0.6, 1, 1.5, 2.1, 2.8, 3.6];
const LABELLED = new Set([0.03, 0.12, 0.3, 0.6]);
const X_DOMAIN: [number, number] = [-3.6, 3.6];
const Y_DOMAIN: [number, number] = [-2.6, 2.6];

const METHODS: { key: OptimizerName; label: string; color: string; eta: string }[] = [
  { key: "gd", label: "GD", color: "#76796f", eta: `η = ${HYPER.gd.lr}` },
  { key: "sgd", label: "SGD", color: "#eda100", eta: `η = ${HYPER.sgd.lr}，σ = ${HYPER.sgd.noiseSd}` },
  { key: "momentum", label: "Momentum", color: "#eb6834", eta: `η = ${HYPER.momentum.lr}，β = ${HYPER.momentum.beta}` },
  { key: "rmsprop", label: "RMSProp", color: "#1baf7a", eta: `η = ${HYPER.rmsprop.lr}，ρ = ${HYPER.rmsprop.rho}` },
  { key: "adam", label: "Adam", color: "#2a78d6", eta: `η = ${HYPER.adam.lr}，β₁ = ${HYPER.adam.beta1}，β₂ = ${HYPER.adam.beta2}` },
];

const f2 = (v: number) => (Math.abs(v) < 0.005 ? "0.00" : v.toFixed(2));
const vec = (v: Vec2) => `(${f2(v[0])}, ${f2(v[1])})`;
const lossText = (l: number) => (l < 0.001 ? l.toExponential(1) : l.toFixed(3));

function stateText(m: OptimizerName, p: TrajectoryPoint): { label: string; value: string } {
  switch (m) {
    case "gd":
      return { label: "当前梯度 g", value: vec(p.grad) };
    case "sgd":
      return { label: "这一步用的 g（含噪声）", value: p.used ? vec(p.used) : vec(p.grad) };
    case "momentum":
      return { label: "惯性 v = βv + g", value: p.v ? vec(p.v) : "(0.00, 0.00)" };
    case "rmsprop":
      return { label: "每维尺度 √s", value: p.s ? vec([Math.sqrt(p.s[0]), Math.sqrt(p.s[1])]) : "(0.00, 0.00)" };
    case "adam":
      return { label: "m̂ 与 √v̂", value: p.mHat && p.vHat ? `${vec(p.mHat)} / ${vec([Math.sqrt(p.vHat[0]), Math.sqrt(p.vHat[1])])}` : "—" };
  }
}

function narrate(m: OptimizerName, k: number, p: TrajectoryPoint, settle: number | null): { text: string; tone: string } {
  const x = p.theta[0];
  const l = lossText(p.loss);
  const settled = settle !== null && k >= settle;
  if (k === 0) {
    return {
      text: `起点 (−2.6, 2.2)，loss 2.80。碗沿 x 方向平缓、沿 y 方向陡峭，所以等高线是横着的椭圆。按「下一步」看 ${METHODS.find((o) => o.key === m)!.label} 怎么走，或切换方法比较五条路。`,
      tone: "",
    };
  }
  switch (m) {
    case "gd":
      if (k <= 8) {
        return {
          text: `GD 每一步沿负梯度走 η = ${HYPER.gd.lr} 倍：y 方向陡、梯度大，一步就跨过谷底跳到对面，于是上下来回蹦；x 方向平、梯度小，每步只挪一点。一个 η 要同时伺候两个方向，只能这样折中。第 ${k} 步 loss ${l}。`,
          tone: "is-warn",
        };
      }
      return {
        text: `上下的蹦跳衰减得差不多了，剩下的是沿平缓的 x 方向慢慢爬：梯度越来越小，步子也跟着越来越小。第 ${k} 步 loss ${l}${settled ? "，已经稳定在 0.01 以下" : ""}。`,
        tone: settled ? "is-good" : "",
      };
    case "sgd":
      if (k <= 12) {
        return {
          text: `SGD 每步只用一小批数据估梯度，相当于真梯度加噪声（这里是 σ = ${HYPER.sgd.noiseSd} 的高斯噪声，种子固定）：方向忽左忽右，便宜但不稳。这一步用的 g = ${p.used ? vec(p.used) : ""}，真梯度是 ${vec(p.grad)}。`,
          tone: "is-warn",
        };
      }
      return {
        text: `到了谷底附近它也停不下来：噪声不会因为梯度变小而变小，于是一直在最低点周围晃，loss 在 0.0x 之间跳。实际训练靠逐步调小 η（learning rate decay）来收口。第 ${k} 步 loss ${l}。`,
        tone: "is-warn",
      };
    case "momentum":
      if (settled) {
        return { text: `来回几次后惯性耗尽，停在最低点附近。第 ${k} 步 loss ${l}，从第 ${settle} 步起稳定在 0.01 以下。`, tone: "is-good" };
      }
      if (x > 0.05) {
        return {
          text: `冲过头了：x 已经越过 0 到了 ${f2(x)}，因为攒下的惯性不会立刻停。现在梯度反向，v = ${p.v ? vec(p.v) : ""} 被一点点刹住，再掉头回来。第 ${k} 步 loss ${l}。`,
          tone: "is-warn",
        };
      }
      return {
        text: `v_t = βv_{t−1} + g_t 把前几步的梯度攒起来（β = ${HYPER.momentum.beta}）：x 方向的梯度一直同号，越攒越快；y 方向的梯度来回变号，在 v 里互相抵消，所以蹦得比 GD 小。当前 v = ${p.v ? vec(p.v) : ""}，第 ${k} 步 loss ${l}。`,
        tone: "",
      };
    case "rmsprop":
      if (k === 1) {
        return {
          text: `s_t = ρs_{t−1} + (1 − ρ) g_t² 记录每个维度梯度的均方。第一步 s 只有 (1 − ρ) g²，η g / √s 一下子跨了 ${f2(Math.abs(x - (-2.6)))}，比 η 大三倍：RMSProp 没有 bias correction 的副作用。`,
          tone: "is-warn",
        };
      }
      if (!settled) {
        return {
          text: `每个维度各自除以自己的 √s = ${p.s ? vec([Math.sqrt(p.s[0]), Math.sqrt(p.s[1])]) : ""}：x 方向梯度小就被放大，y 方向梯度大就被缩小，两个方向的步长差不多，所以路径几乎是直线。第 ${k} 步 loss ${l}。`,
          tone: "",
        };
      }
      return {
        text: `靠近最低点后梯度变小，而 s 还记着之前更大的梯度，步长随之缩小，稳稳停下。第 ${k} 步 loss ${l}，从第 ${settle} 步起稳定在 0.01 以下。`,
        tone: "is-good",
      };
    case "adam":
      if (k === 1) {
        return {
          text: `Adam = Momentum 的 m 加 RMSProp 的 v，再各除以 (1 − βᵗ) 做 bias correction。第一步 m̂ = g、√v̂ = |g|，所以每个坐标正好走 η = ${HYPER.adam.lr}，没有 RMSProp 那种起跳。`,
          tone: "",
        };
      }
      if (settled) {
        return {
          text: `第 ${k} 步 loss ${l}，从第 ${settle} 步起稳定在 0.01 以下。在这个两维的碗里 Adam 并不比 RMSProp 快；它的好处要到维度多、各维梯度尺度悬殊、还带噪声的真实问题上才显出来。`,
          tone: "is-good",
        };
      }
      if (x > 0.05) {
        return {
          text: `惯性让它冲过了最低点（x = ${f2(x)}）：m̂ 要十来步才能掉头，而 v̂（β₂ = ${HYPER.adam.beta2}）还记着起步时的大梯度，所以回来的步子很小。这是 η 偏大时 Adam 的典型样子。第 ${k} 步 loss ${l}。`,
          tone: "is-warn",
        };
      }
      return {
        text: `m̂ / √v̂ 的每个分量都接近 ±1，于是每步在每个坐标上走大约 η = ${HYPER.adam.lr}：像 RMSProp 一样走直线，又像 Momentum 一样带着惯性。当前 m̂ = ${p.mHat ? vec(p.mHat) : ""}。第 ${k} 步 loss ${l}。`,
        tone: "",
      };
  }
}

export default function GradientDescentFigure() {
  const [method, setMethod] = useState<OptimizerName>("gd");
  const [step, setStep] = useState(0);
  const clipId = useId();

  const runs = useMemo(() => {
    const out = {} as Record<OptimizerName, TrajectoryPoint[]>;
    for (const m of METHODS) out[m.key] = runOptimizer(m.key, STEPS, SEED);
    return out;
  }, []);
  const settle = useMemo(() => {
    const out = {} as Record<OptimizerName, number | null>;
    for (const m of METHODS) out[m.key] = stepsToSettle(runs[m.key], SETTLE);
    return out;
  }, [runs]);
  const contours = useMemo(() => LEVELS.map((level) => ({ level, pts: bowlContour(level) })), []);

  const current = METHODS.find((m) => m.key === method)!;
  const point = runs[method][step];
  const st = stateText(method, point);
  const narr = narrate(method, step, point, settle[method]);

  return (
    <VisualizationFrame
      title="同一个碗、同一个起点，五种走法"
      description="loss 是 f(x, y) = ½ (x²/9 + y²)：沿 x 平缓、沿 y 陡峭。每种方法各用一个调好的学习率，从 (−2.6, 2.2) 出发走 40 步。淡色是另外四条路同一步时的位置。"
    >
      <div className="viz-row">
        <Tabs options={METHODS.map((m) => ({ key: m.key, label: m.label }))} value={method} onChange={setMethod} ariaLabel="优化方法" />
        <span className="viz-k">{current.eta}</span>
      </div>
      <StepPlayer step={step} total={STEPS + 1} onStep={setStep} intervalMs={500} caption={`第 ${step} 步 / 共 ${STEPS} 步`} />

      <Figure width={W} height={H} label={`${current.label} 第 ${step} 步，位置 ${vec(point.theta)}，loss ${lossText(point.loss)}`}>
        <Plot
          box={{ x: 0, y: 0, w: W, h: H }}
          xDomain={X_DOMAIN}
          yDomain={Y_DOMAIN}
          xTicks={[-3, -2, -1, 0, 1, 2, 3]}
          yTicks={[-2, -1, 0, 1, 2]}
          xLabel="x（平缓方向，曲率 1/9）"
          yLabel="y（陡峭方向，曲率 1）"
        >
          {(f) => (
            <>
              <clipPath id={clipId}>
                <rect x={f.x0} y={f.y1} width={f.x1 - f.x0} height={f.y0 - f.y1} />
              </clipPath>
              <g clipPath={`url(#${clipId})`}>
                {contours.map((c) => (
                  <Curve key={c.level} frame={f} points={c.pts} color="#c9c4ad" width={1} />
                ))}
                {contours
                  .filter((c) => LABELLED.has(c.level))
                  .map((c) => (
                    <text key={`l${c.level}`} x={f.x(3 * Math.sqrt(2 * c.level)) + 4} y={f.y(0) - 4} fontSize={10.5} fill="#76796f">
                      {c.level}
                    </text>
                  ))}
                <line x1={f.x(0) - 6} y1={f.y(0)} x2={f.x(0) + 6} y2={f.y(0)} stroke="#3b4234" strokeWidth={1.2} />
                <line x1={f.x(0)} y1={f.y(0) - 6} x2={f.x(0)} y2={f.y(0) + 6} stroke="#3b4234" strokeWidth={1.2} />
                <text x={f.x(0) + 8} y={f.y(0) + 14} fontSize={11} fill="#3b4234">最低点 (0, 0)</text>
                {METHODS.filter((m) => m.key !== method).map((m) => {
                  const pts = runs[m.key].slice(0, step + 1).map((p) => p.theta);
                  const last = pts[pts.length - 1];
                  return (
                    <g key={m.key}>
                      <Curve frame={f} points={pts} color={m.color} width={1.4} opacity={0.3} />
                      <circle cx={f.x(last[0])} cy={f.y(last[1])} r={3.5} fill={m.color} opacity={0.45} style={{ transition: "cx .3s, cy .3s" }} />
                    </g>
                  );
                })}
                {(() => {
                  const pts = runs[method].slice(0, step + 1).map((p) => p.theta);
                  return (
                    <g>
                      <Curve frame={f} points={pts} color={current.color} width={2.2} />
                      {pts.slice(0, -1).map((p, i) => (
                        <circle key={i} cx={f.x(p[0])} cy={f.y(p[1])} r={2.4} fill="#fff" stroke={current.color} strokeWidth={1.2} />
                      ))}
                    </g>
                  );
                })()}
              </g>
              <circle cx={f.x(-2.6)} cy={f.y(2.2)} r={4} fill="#fff" stroke="#3b4234" strokeWidth={1.5} />
              <text x={f.x(-2.6) - 8} y={f.y(2.2) + 4} fontSize={11} textAnchor="end" fill="#3b4234">起点</text>
              <Marker frame={f} x={point.theta[0]} y={point.theta[1]} color={current.color} label={current.label} side="above" r={5.5} />
            </>
          )}
        </Plot>
      </Figure>

      <div className="viz-legend" aria-hidden="true">
        {METHODS.map((m) => (
          <span key={m.key}><i style={{ background: m.color }} />{m.label}</span>
        ))}
      </div>

      <div className="viz-grid2 wide-left" style={{ marginTop: 12 }}>
        <div className="viz-panel">
          <h5>第 {step} 步，五种方法各在哪</h5>
          <table className="viz-table">
            <thead>
              <tr><th>方法</th><th className="num">loss</th><th className="num">位置</th><th className="num">稳定 &lt; 0.01</th></tr>
            </thead>
            <tbody>
              {METHODS.map((m) => {
                const p = runs[m.key][step];
                const on = m.key === method;
                return (
                  <tr key={m.key} style={on ? { background: "#f6f4ea", fontWeight: 600 } : undefined}>
                    <td><i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: m.color, marginRight: 6 }} />{m.label}</td>
                    <td className="num">{lossText(p.loss)}</td>
                    <td className="num">{vec(p.theta)}</td>
                    <td className="num">{settle[m.key] === null ? "—" : `第 ${settle[m.key]} 步`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="viz-stat" style={{ gridTemplateColumns: "1fr" }}>
          <div><small>{current.label} 当前 loss</small><b>{lossText(point.loss)}</b></div>
          <div><small>位置 (x, y)</small><b>{vec(point.theta)}</b></div>
          <div><small>{st.label}</small><b>{st.value}</b></div>
        </div>
      </div>

      <div className={`viz-narr${narr.tone ? ` ${narr.tone}` : ""}`}>{narr.text}</div>
    </VisualizationFrame>
  );
}
