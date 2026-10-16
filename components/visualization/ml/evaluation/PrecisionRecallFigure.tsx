"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Bars from "@/components/visualization/ml/primitives/Bars";
import ConfusionGrid from "@/components/visualization/ml/primitives/ConfusionGrid";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Slider from "@/components/visualization/ml/primitives/Slider";
import { confusionAtThreshold, DOG_CAT_SCORED, f1, precision, recall } from "@/lib/ml/metrics";

// Page 2 of Evaluation: the same ten animals, now each with a "dog score".
// Drag the threshold: everything to its right is called dog, and precision,
// recall and F1 move against each other.

const W = 720;
const H = 170;
const X0 = 36;
const X1 = W - 24;
const Y_DOG = 58;
const Y_CAT = 108;
const C_DOG = "#2a78d6";
const C_CAT = "#eb6834";
const frac = (a: number, b: number) => `${a}/${b} = ${b === 0 ? "0.00" : (a / b).toFixed(2)}`;

export default function PrecisionRecallFigure() {
  const [t, setT] = useState(0.5);
  const items = DOG_CAT_SCORED;
  const c = confusionAtThreshold(items, t);
  const p = precision(c);
  const r = recall(c);
  const f = f1(c);
  const sx = (s: number) => X0 + s * (X1 - X0);
  const guessed = c.tp + c.fp;

  const narr =
    guessed === 0
      ? `阈值 ${t.toFixed(2)}：没有一只的分数够得上，模型一只 dog 都不猜。recall 是 0，precision 没有定义（这里记 0）。往左拖。`
      : guessed === items.length
        ? `阈值 ${t.toFixed(2)}：所有动物都被叫成 dog。6 只真 dog 全找到了，recall 100%，但 4 只 cat 也全被冤枉，precision 只有 6/10。`
        : `阈值 ${t.toFixed(2)}：分数在线右边的 ${guessed} 只被猜成 dog，其中 ${c.tp} 只真是，precision ${frac(c.tp, guessed)}；6 只真 dog 里找出了 ${c.tp} 只，recall ${frac(c.tp, 6)}。往右拖阈值，模型更谨慎，precision 升、recall 降；往左拖反过来。`;

  return (
    <VisualizationFrame
      title="Precision / Recall：一条阈值线，两边各算一个比例"
      description="每只动物按模型给它的 dog 分数排在横轴上，上一行是真 dog，下一行是真 cat。线右边的都被叫成 dog。"
    >
      <Slider label="阈值" value={t} min={0} max={1} step={0.01} onChange={setT} display={t.toFixed(2)} id="pr-threshold" />
      <Figure width={W} height={H} label={`阈值 ${t.toFixed(2)}，precision ${p.toFixed(2)}，recall ${r.toFixed(2)}`}>
        <rect x={sx(t)} y={22} width={Math.max(0, X1 - sx(t)) + 12} height={118} fill="#fdf3cd" opacity={0.6} rx={6} style={{ transition: "x .2s, width .2s" }} />
        <text x={Math.min(sx(t) + 8, X1 - 50)} y={36} fontSize={11.5} fill="#8a6d00" fontWeight={600} style={{ transition: "x .2s" }}>猜 dog →</text>
        <line x1={X0} y1={Y_DOG} x2={X1} y2={Y_DOG} stroke="#e4dfcb" />
        <line x1={X0} y1={Y_CAT} x2={X1} y2={Y_CAT} stroke="#e4dfcb" />
        <text x={X0 - 4} y={Y_DOG + 4} fontSize={11.5} textAnchor="end" fill={C_DOG} fontWeight={600}>🐶</text>
        <text x={X0 - 4} y={Y_CAT + 4} fontSize={11.5} textAnchor="end" fill={C_CAT} fontWeight={600}>🐱</text>
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line x1={sx(v)} y1={140} x2={sx(v)} y2={146} stroke="#76796f" />
            <text x={sx(v)} y={160} fontSize={11} textAnchor="middle" fill="#76796f">{v.toFixed(2)}</text>
          </g>
        ))}
        <line x1={X0} y1={140} x2={X1} y2={140} stroke="#76796f" strokeWidth={1.2} />
        <text x={(X0 + X1) / 2} y={H - 2} fontSize={11} textAnchor="middle" fill="#30332c">模型给的 dog 分数</text>
        {items.map((it, i) => {
          const guessDog = it.score >= t;
          const right = guessDog === it.label;
          const cy = it.label ? Y_DOG : Y_CAT;
          const color = it.label ? C_DOG : C_CAT;
          return (
            <g key={i} transform={`translate(${sx(it.score)} ${cy})`}>
              <circle r={11} fill="#fff" stroke={color} strokeWidth={2} />
              <text y={4} fontSize={12} textAnchor="middle">{it.label ? "🐶" : "🐱"}</text>
              <text y={right ? -15 : 23} fontSize={11} fontWeight={700} textAnchor="middle" fill={right ? "#087a08" : "#d03b3b"}>{right ? "✓" : "✗"}</text>
            </g>
          );
        })}
        <line x1={sx(t)} y1={18} x2={sx(t)} y2={142} stroke="#3b4234" strokeWidth={2} strokeDasharray="5 3" style={{ transition: "x1 .2s, x2 .2s" }} />
      </Figure>

      <div className="viz-grid2" style={{ marginTop: 12 }}>
        <div className="viz-panel">
          <h5>混淆矩阵（阈值 {t.toFixed(2)}）</h5>
          <ConfusionGrid c={c} compact />
        </div>
        <div className="viz-panel">
          <h5>三个指标</h5>
          <Bars
            rows={[
              { label: "precision", hint: "TP / (TP + FP)", value: p, color: "#2a78d6", text: frac(c.tp, c.tp + c.fp) },
              { label: "recall", hint: "TP / (TP + FN)", value: r, color: "#1baf7a", text: frac(c.tp, c.tp + c.fn) },
              { label: "F1", hint: "2PR / (P + R)", value: f, color: "#eda100", text: f.toFixed(2) },
            ]}
          />
        </div>
      </div>

      <div className={`viz-narr${guessed === 0 || guessed === items.length ? " is-warn" : ""}`}>{narr}</div>
    </VisualizationFrame>
  );
}
