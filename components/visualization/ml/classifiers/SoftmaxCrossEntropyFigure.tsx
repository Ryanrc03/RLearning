"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Bars from "@/components/visualization/ml/primitives/Bars";
import Curve from "@/components/visualization/ml/primitives/Curve";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Marker from "@/components/visualization/ml/primitives/Marker";
import Plot from "@/components/visualization/ml/primitives/Plot";
import Slider from "@/components/visualization/ml/primitives/Slider";
import { argmax } from "@/lib/ml/clip";
import { crossEntropy, logitsForTarget, sigmoid, softmax } from "@/lib/ml/linear";

// Page 3 of Classifiers: three logits, cat is the true class. Drag z_cat with
// dog and bird fixed at 0; the probability bars renormalise and the marker
// slides along −log p. The two chips reproduce the notes: 0.9 → 0.105, 0.2 → 1.61.

const CLASSES = [
  { name: "cat", emoji: "🐱", color: "#2a78d6" },
  { name: "dog", emoji: "🐶", color: "#1baf7a" },
  { name: "bird", emoji: "🐦", color: "#eda100" },
];
const OTHERS = [0, 0];
const TRUE = 0;
const ZMIN = -4;
const ZMAX = 6;
const PRESETS = [
  { key: "good", label: "笔记例 1：p_cat = 0.9", p: 0.9 },
  { key: "bad", label: "笔记例 2：p_cat = 0.2", p: 0.2 },
];
const DEFAULT_Z = logitsForTarget(PRESETS[0].p, OTHERS);
const REF_LOSS = crossEntropy(softmax([DEFAULT_Z, ...OTHERS]), TRUE);
const CURVE = Array.from({ length: 100 }, (_, i) => {
  const p = (i + 1) / 100;
  return [p, -Math.log(p)] as const;
});
const Y_MAX = 5;
const MUTED = "#76796f";

export default function SoftmaxCrossEntropyFigure() {
  const [z, setZ] = useState(DEFAULT_Z);
  const logits = [z, ...OTHERS];
  const probs = softmax(logits);
  const p = probs[TRUE];
  const loss = crossEntropy(probs, TRUE);
  // On an exact tie argmax picks index 0; treat that as "not leading" so the narr is honest at z = 0.
  const catLeads = argmax(probs) === TRUE && p > probs[1] + 1e-9;
  const twoClass = sigmoid(z - OTHERS[0]);
  const onPreset = (pp: number) => Math.abs(p - pp) < 1e-6;

  const narr =
    !catLeads
      ? `z_cat = ${z.toFixed(2)}：cat 被排到了 dog 和 bird 后面，p_cat 只有 ${p.toFixed(3)}，loss = −log ${p.toFixed(3)} = ${loss.toFixed(2)}，是 0.9 那个例子（${REF_LOSS.toFixed(3)}）的 ${(loss / REF_LOSS).toFixed(0)} 倍。曲线在 p → 0 时越来越陡：真实类排得越靠后，每再低一点罚得越重。`
      : p < 0.5
        ? `z_cat = ${z.toFixed(2)}：cat 还是三个里最大的，但只有 ${p.toFixed(3)}，dog 和 bird 各 ${probs[1].toFixed(3)}。loss = −log ${p.toFixed(3)} = ${loss.toFixed(2)}：答对了，但把握不大，罚得不轻。`
        : `z_cat = ${z.toFixed(2)}：softmax 给 cat ${p.toFixed(3)}、dog ${probs[1].toFixed(3)}、bird ${probs[2].toFixed(3)}，三个加起来是 1。loss = −log ${p.toFixed(3)} = ${loss.toFixed(3)}：真实类排在最前而且把握大，曲线在这一段几乎是平的，再往右拖 loss 也只掉一点点。`;
  const tone = !catLeads ? " is-bad" : p < 0.5 ? " is-warn" : " is-good";

  return (
    <VisualizationFrame
      title="Softmax 与 Cross-Entropy：三个分数变三个概率，只罚真实类那一项"
      description="真实类是 cat。dog 和 bird 的 logit 固定为 0，只拖 cat 的 logit：左边是 softmax 后的三个概率，右边是 −log p 曲线上当前 p_cat 的位置。"
    >
      <Slider label="z_cat（真实类的 logit）" value={z} min={ZMIN} max={ZMAX} step={0.01} onChange={setZ} display={z.toFixed(2)} id="softmax-z" />
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
          <Plot box={{ x: 0, y: 0, w: 420, h: 300 }} xDomain={[0, 1]} yDomain={[0, Y_MAX]} xTicks={[0, 0.2, 0.5, 0.9, 1]} yTicks={[0, 1, 2, 3, 4, 5]} xLabel="p_true：softmax 给真实类的概率" yLabel="loss = −log p" title="−log p 曲线">
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

      <div className={`viz-narr${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}
