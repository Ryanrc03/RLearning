"use client";

import { useId, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Curve from "@/components/visualization/ml/primitives/Curve";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Marker from "@/components/visualization/ml/primitives/Marker";
import Plot from "@/components/visualization/ml/primitives/Plot";
import StepPlayer from "@/components/visualization/ml/primitives/StepPlayer";
import { boundarySegment, logit, makeBlobs, pickShowcasePoint, predictProb, sigmoid, trainLogistic } from "@/lib/ml/linear";

// Page 2 of Classifiers: two blobs, one line. Each step is one batch gradient
// descent update on (w1, w2, b); the boundary rotates into place, the BCE loss
// falls, and one highlighted point slides along the sigmoid from "almost 0" to "almost 1".

const SEED = 11;
const LR = 0.5;
const STEPS = 30;
const W = 720;
const H = 360;
const XD: [number, number] = [-4, 4];
const YD: [number, number] = [-4, 4];
const ZD: [number, number] = [-8, 8];
const C0 = "#2a78d6";
const C1 = "#eb6834";
const C_LOSS = "#1baf7a";
const INK = "#3b4234";
const MUTED = "#76796f";
const CRIT = "#d03b3b";

const DATA = makeBlobs(SEED);
const HISTORY = trainLogistic(DATA, LR, STEPS);
const SHOW = pickShowcasePoint(DATA, HISTORY[0].params, HISTORY[STEPS].params);
const LOSS_PTS = HISTORY.map((s) => [s.step, s.loss] as const);
const LOSS_MAX = Math.ceil(Math.max(...HISTORY.map((s) => s.loss)) * 10) / 10 + 0.1;
const SIGMOID_PTS = Array.from({ length: 81 }, (_, i) => {
  const z = ZD[0] + ((ZD[1] - ZD[0]) * i) / 80;
  return [z, sigmoid(z)] as const;
});
const BEST_ACC = Math.max(...HISTORY.map((s) => s.accuracy));
const BEST_STEP = HISTORY.findIndex((s) => s.accuracy === BEST_ACC);
const N = DATA.length;

const f2 = (x: number) => (x >= 0 ? " " : "") + x.toFixed(2);
const count = (acc: number) => Math.round(acc * N);

export default function LogisticRegressionFigure() {
  const [step, setStep] = useState(0);
  const rawId = useId();
  const clipId = `lr-clip-${rawId.replace(/\W/g, "")}`;
  const cur = HISTORY[step];
  const prev = HISTORY[Math.max(0, step - 1)];
  const { w1, w2, b } = cur.params;
  const seg = boundarySegment(cur.params, XD, YD);
  const pt = DATA[SHOW];
  const z = logit(cur.params, pt);
  const p = sigmoid(z);
  const zPrev = logit(prev.params, pt);
  const pPrev = sigmoid(zPrev);
  const crossed = step > 0 && (pPrev >= 0.5) !== (p >= 0.5);
  const right = count(cur.accuracy);
  const showColor = pt.label === 1 ? C1 : C0;

  const narr =
    step === 0
      ? `初始边界是随手画的一条水平线：w = (0, 1)，b = 0，上半边猜 1，和数据正好拧着。32 个点只分对 ${right} 个，loss ${cur.loss.toFixed(2)}。带圈的那个点 z = ${z.toFixed(2)}，σ(z) = ${p.toFixed(3)}：模型说它几乎肯定是 ${p >= 0.5 ? 1 : 0}，其实它是 ${pt.label}。按「下一步」做一次 gradient descent。`
      : step < STEPS
        ? `第 ${step} 步：沿负梯度走了一步，w = (${w1.toFixed(2)}, ${w2.toFixed(2)})，b = ${b.toFixed(2)}，边界转了过来。loss 从 ${prev.loss.toFixed(3)} 降到 ${cur.loss.toFixed(3)}，分对 ${right}/32。带圈的点 z 从 ${zPrev.toFixed(2)} 变成 ${z.toFixed(2)}，p = ${p.toFixed(3)}${crossed ? "，刚刚跨过 0.5，预测翻成了 " + (p >= 0.5 ? 1 : 0) : ""}。`
        : `${STEPS} 步后 loss 降到 ${cur.loss.toFixed(3)}，w = (${w1.toFixed(2)}, ${w2.toFixed(2)})，b = ${b.toFixed(2)}，分对 ${right}/32。分对的个数早在第 ${BEST_STEP} 步就到了 ${count(BEST_ACC)}/32${right < count(BEST_ACC) ? "，最后反而回落了" : ""}，loss 却一直在降：loss 看的是概率离 0 / 1 有多远，不是对错的个数。两团重叠处的几个点，直线再怎么转也分不开。`;
  const tone = step === 0 ? " is-bad" : step === STEPS ? " is-good" : "";

  return (
    <VisualizationFrame
      title="Logistic Regression：一条直线边界，一步一步转到位"
      description="左：32 个点（蓝 0、橙 1）和当前的边界 w₁x + w₂y + b = 0，红圈是分错的点。右上：BCE loss 随步数下降。右下：sigmoid 曲线和带圈那个点现在的 z、p。"
    >
      <StepPlayer step={step} total={STEPS + 1} onStep={setStep} intervalMs={500} caption={`第 ${step} 步 / 共 ${STEPS} 步 · lr ${LR}`} />

      <Figure width={W} height={H} label={`第 ${step} 步，w1 ${w1.toFixed(2)}，w2 ${w2.toFixed(2)}，b ${b.toFixed(2)}，loss ${cur.loss.toFixed(3)}，分对 ${right} / ${N}`} minWidth={640}>
        <Plot box={{ x: 0, y: 0, w: 400, h: H }} xDomain={XD} yDomain={YD} xTicks={[-4, -2, 0, 2, 4]} yTicks={[-4, -2, 0, 2, 4]} xLabel="x₁" yLabel="x₂" title="数据和边界">
          {(fr) => {
            const ax = fr.x(seg?.[0][0] ?? 0);
            const ay = fr.y(seg?.[0][1] ?? 0);
            const bx = fr.x(seg?.[1][0] ?? 0);
            const by = fr.y(seg?.[1][1] ?? 0);
            const norm = Math.hypot(w1, w2) || 1;
            // Direction of w in svg coordinates (y axis flipped): the side the model calls 1.
            const nx = (w1 / norm) * 1000;
            const ny = (-w2 / norm) * 1000;
            return (
              <>
                <defs>
                  <clipPath id={clipId}>
                    <rect x={fr.x0} y={fr.y1} width={fr.x1 - fr.x0} height={fr.y0 - fr.y1} />
                  </clipPath>
                </defs>
                {seg && (
                  <g clipPath={`url(#${clipId})`}>
                    <path d={`M${ax} ${ay} L${bx} ${by} L${bx + nx} ${by + ny} L${ax + nx} ${ay + ny} Z`} fill={C1} opacity={0.09} style={{ transition: "d .35s" }} />
                    <path d={`M${ax} ${ay} L${bx} ${by} L${bx - nx} ${by - ny} L${ax - nx} ${ay - ny} Z`} fill={C0} opacity={0.09} style={{ transition: "d .35s" }} />
                  </g>
                )}
                {DATA.map((d, i) => {
                  const wrong = (predictProb(cur.params, d) >= 0.5 ? 1 : 0) !== d.label;
                  return (
                    <circle
                      key={i}
                      cx={fr.x(d.x)}
                      cy={fr.y(d.y)}
                      r={5}
                      fill={d.label === 1 ? C1 : C0}
                      stroke={wrong ? CRIT : "#fff"}
                      strokeWidth={wrong ? 2.2 : 1.2}
                      style={{ transition: "stroke .3s" }}
                    />
                  );
                })}
                <circle cx={fr.x(pt.x)} cy={fr.y(pt.y)} r={10} fill="none" stroke={INK} strokeWidth={1.6} strokeDasharray="3 2" />
                {seg && (
                  <g clipPath={`url(#${clipId})`}>
                    <path d={`M${ax} ${ay} L${bx} ${by}`} stroke={INK} strokeWidth={2.2} fill="none" style={{ transition: "d .35s" }} />
                  </g>
                )}
                <text x={fr.x1 - 4} y={fr.y1 + 14} fontSize={11.5} textAnchor="end" fill={MUTED}>
                  w = ({w1.toFixed(2)}, {w2.toFixed(2)})，b = {b.toFixed(2)}
                </text>
              </>
            );
          }}
        </Plot>

        <Plot box={{ x: 400, y: 0, w: 320, h: 180 }} xDomain={[0, STEPS]} yDomain={[0, LOSS_MAX]} xTicks={[0, 10, 20, 30]} yTicks={[0, 0.5, 1]} xLabel="步数" title="BCE loss">
          {(fr) => (
            <>
              <Curve frame={fr} points={LOSS_PTS} color="#c9c4ad" width={1.5} dashed />
              <Curve frame={fr} points={LOSS_PTS.slice(0, step + 1)} color={C_LOSS} width={2.2} />
              <Marker frame={fr} x={step} y={cur.loss} color={C_LOSS} label={cur.loss.toFixed(3)} side={step > STEPS * 0.6 ? "left" : "right"} r={4.5} />
            </>
          )}
        </Plot>

        <Plot box={{ x: 400, y: 180, w: 320, h: 180 }} xDomain={ZD} yDomain={[0, 1]} xTicks={[-8, -4, 0, 4, 8]} yTicks={[0, 0.5, 1]} xLabel="z = w₁x₁ + w₂x₂ + b" title="σ(z)：带圈那个点现在在哪">
          {(fr) => (
            <>
              <line x1={fr.x0} y1={fr.y(0.5)} x2={fr.x1} y2={fr.y(0.5)} stroke="#c9c4ad" strokeDasharray="4 4" />
              <Curve frame={fr} points={SIGMOID_PTS} color={MUTED} width={2} />
              <Marker frame={fr} x={Math.max(ZD[0], Math.min(ZD[1], z))} y={p} color={showColor} label={`p = ${p.toFixed(3)}`} side={z > 2 ? "left" : "right"} guides r={5} />
            </>
          )}
        </Plot>
      </Figure>

      <div className="viz-stat" style={{ marginTop: 12 }}>
        <div><small>w₁</small><b>{f2(w1)}</b></div>
        <div><small>w₂</small><b>{f2(w2)}</b></div>
        <div><small>b</small><b>{f2(b)}</b></div>
        <div><small>BCE loss</small><b>{cur.loss.toFixed(3)}</b></div>
        <div><small>分对</small><b>{right} / {N}</b></div>
      </div>
      <div className="viz-legend">
        <span><i style={{ background: C0 }} />标签 0</span>
        <span><i style={{ background: C1 }} />标签 1</span>
        <span><i style={{ background: "#fff", border: `2px solid ${CRIT}` }} />分错</span>
        <span><i style={{ background: "#fff", border: `1.5px dashed ${INK}` }} />右下图跟踪的点</span>
      </div>

      <div className={`viz-narr${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}
