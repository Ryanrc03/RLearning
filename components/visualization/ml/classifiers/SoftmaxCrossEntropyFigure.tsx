"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Bars from "@/components/visualization/ml/primitives/Bars";
import Curve from "@/components/visualization/ml/primitives/Curve";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Marker from "@/components/visualization/ml/primitives/Marker";
import Plot from "@/components/visualization/ml/primitives/Plot";
import Slider from "@/components/visualization/ml/primitives/Slider";
import { crossEntropyFromLogits, logitsForTarget, sigmoid, softmax } from "@/lib/ml/linear";

// Sweep the true-class logit while keeping the other two fixed.
// Presets retain the original probability/loss examples.

const CLASSES = [
  { name: "cat", emoji: "🐱", color: "#2a78d6" },
  { name: "dog", emoji: "🐶", color: "#1baf7a" },
  { name: "bird", emoji: "🐦", color: "#eda100" },
];
const OTHERS = [1, 0];
const TRUE = 0;
const ZMIN = -4;
const ZMAX = 6;
const PRESETS = [
  { key: "good", label: "笔记例 1：p_cat = 0.9", p: 0.9 },
  { key: "bad", label: "笔记例 2：p_cat = 0.2", p: 0.2 },
];
const DEFAULT_Z = 2;
const REF_LOSS = crossEntropyFromLogits([logitsForTarget(0.9, OTHERS), ...OTHERS], TRUE);
const CURVE = Array.from({ length: 100 }, (_, i) => {
  const p = Math.exp(-6 + (6 * i) / 99);
  return [p, -Math.log(p)] as const;
});
const Y_MAX = 6;
const MUTED = "#76796f";

export default function SoftmaxCrossEntropyFigure() {
  const [z, setZ] = useState(DEFAULT_Z);
  const logits = [z, ...OTHERS];
  const probs = softmax(logits);
  const p = probs[TRUE];
  const loss = crossEntropyFromLogits(logits, TRUE);
  // Require a strict lead so the narration also describes ties accurately.
  const catLeads = p > Math.max(...probs.slice(1)) + 1e-9;
  const twoClass = sigmoid(z - OTHERS[0]);
  const onPreset = (pp: number) => Math.abs(p - pp) < 1e-6;

  const narr =
    !catLeads
      ? `z_cat = ${z.toFixed(2)}：cat 没有单独排在第一，p_cat 只有 ${p.toFixed(3)}，loss = −log ${p.toFixed(3)} = ${loss.toFixed(2)}，是 0.9 那个例子（${REF_LOSS.toFixed(3)}）的 ${(loss / REF_LOSS).toFixed(0)} 倍。对概率 p 的斜率越来越陡；对 logits 的梯度为 p − y。`
      : p < 0.5
        ? `z_cat = ${z.toFixed(2)}：cat 还是三个里最大的，但只有 ${p.toFixed(3)}，dog 为 ${probs[1].toFixed(3)}、bird 为 ${probs[2].toFixed(3)}。loss = −log ${p.toFixed(3)} = ${loss.toFixed(2)}：答对了，但把握不大，罚得不轻。`
        : `z_cat = ${z.toFixed(2)}：softmax 给 cat ${p.toFixed(3)}、dog ${probs[1].toFixed(3)}、bird ${probs[2].toFixed(3)}，三个加起来是 1。loss = −log ${p.toFixed(3)} = ${loss.toFixed(3)}：真实类排在最前，继续提高它的分数会让损失进一步降低。`;
  const tone = !catLeads ? " is-bad" : p < 0.5 ? " is-warn" : " is-good";

  return (
    <VisualizationFrame
      title="Softmax 与 Cross-Entropy：三个分数变三个概率，只罚真实类那一项"
      description="真实类是 cat。dog 的 logit 固定为 1、bird 固定为 0，只拖 cat 的 logit：左边是 softmax 后的三个概率，右边是 −log p 曲线上当前 p_cat 的位置。"
    >
      <Slider label="z_cat（真实类的 logit）" value={z} min={ZMIN} max={ZMAX} step={0.01} onChange={(value) => { if (Number.isFinite(value)) setZ(Math.max(ZMIN, Math.min(ZMAX, value))); }} display={z.toFixed(2)} id="softmax-z" />
      <div className="viz-row">
        <div className="viz-chips" role="group" aria-label="笔记里的两个例子">
          {PRESETS.map((pr) => (
            <button key={pr.key} type="button" className={`viz-chip${onPreset(pr.p) ? " is-on" : ""}`} aria-pressed={onPreset(pr.p)} onClick={() => setZ(logitsForTarget(pr.p, OTHERS))}>
              {pr.label}
            </button>
          ))}
        </div>
        <button type="button" className="viz-btn" onClick={() => setZ(DEFAULT_Z)}>重置</button>
      </div>

      <div className="viz-grid2">
        <div className="viz-panel">
          <h5>logits → softmax → 概率</h5>
          <div className="viz-stat" style={{ marginBottom: 10 }}>
            {CLASSES.map((c, i) => (
              <div key={c.name}>
                <small>
                  z_{c.name}
                  {i !== TRUE && <span className="delta">固定</span>}
                </small>
                <b style={{ color: c.color }}>{logits[i].toFixed(2)}</b>
              </div>
            ))}
          </div>
          <Bars rows={CLASSES.map((c, i) => ({ label: `${c.emoji} ${c.name}${i === TRUE ? "（真实类）" : ""}`, value: probs[i], color: c.color, text: probs[i].toFixed(3) }))} />
          <p className="viz-k" style={{ marginTop: 10 }}>
            loss = −log p<sub>cat</sub> = −log {p.toFixed(3)} = <b style={{ color: "#3b4234" }}>{loss.toFixed(3)}</b>
          </p>
          <p className="viz-k" style={{ marginTop: 4 }}>
            只留 cat / dog 两类时：softmax 退化成 σ(z<sub>cat</sub> − z<sub>dog</sub>) = σ({(z - OTHERS[0]).toFixed(2)}) = {twoClass.toFixed(3)}
          </p>
        </div>

        <Figure width={420} height={300} label={`p_cat ${p.toFixed(3)}，loss ${loss.toFixed(3)}`} minWidth={320}>
          <Plot box={{ x: 0, y: 0, w: 420, h: 300 }} xDomain={[0, 1]} yDomain={[0, Y_MAX]} xTicks={[0, 0.2, 0.5, 0.9, 1]} yTicks={[0, 1, 2, 3, 4, 5, 6]} xLabel="p_true：softmax 给真实类的概率" yLabel="loss = −log p" title="−log p 曲线">
            {(fr) => (
              <>
                <Curve frame={fr} points={CURVE} color={MUTED} width={2} />
                {PRESETS.map((pr) => (
                  <g key={pr.key} opacity={onPreset(pr.p) ? 0 : 0.7}>
                    <circle cx={fr.x(pr.p)} cy={fr.y(-Math.log(pr.p))} r={3.5} fill="#fff" stroke="#c9c4ad" strokeWidth={1.5} />
                    <text x={fr.x(pr.p) + 7} y={fr.y(-Math.log(pr.p)) - 6} fontSize={11} fill={MUTED} className="mono">
                      {pr.p} → {(-Math.log(pr.p)).toFixed(3)}
                    </text>
                  </g>
                ))}
                <Marker frame={fr} x={p} y={Math.min(loss, Y_MAX)} color={CLASSES[TRUE].color} label={`−log ${p.toFixed(2)} = ${loss.toFixed(2)}`} side={p > 0.55 ? "left" : "right"} guides r={5.5} />
              </>
            )}
          </Plot>
        </Figure>
      </div>

      <p className="viz-k">对 logits 的梯度 p − y = [{probs.map((value, i) => (value - Number(i === TRUE)).toFixed(3)).join(", ")}]。直接更新 logits 时，沿梯度反方向走。</p>
      <div aria-live="polite" className={`viz-narr${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}
