"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import Bars from "@/components/visualization/ml/primitives/Bars";
import { DEMO_CONFUSION, LABELS, perClass, summary, type Label } from "@/lib/ml/finetune";

// BERT fine-tuning, figure 5: the 3 × 3 confusion matrix on a dev set. Pick a
// class: its column gives precision, its row gives recall. Accuracy, macro-F1
// and weighted-F1 below show why a minority neutral class drags macro-F1 down.

const COLORS = ["#eb6834", "#76796f", "#1baf7a"];
const OPTIONS: { key: string; label: string }[] = LABELS.map((l, k) => ({ key: String(k), label: `看「${l}」` }));

const pct = (x: number) => x.toFixed(3);

export default function ConfusionMatrixFigure() {
  const [sel, setSel] = useState<Label>(1);
  const cm = DEMO_CONFUSION;
  const pc = perClass(cm);
  const sm = summary(cm);
  const c = pc[sel];
  const colSum = cm.reduce((s, r) => s + r[sel], 0);
  const max = Math.max(...cm.flat());

  const cellBg = (v: number, i: number, j: number) => {
    const t = v / max;
    const base = i === j ? `rgba(27, 175, 122, ${0.12 + 0.6 * t})` : `rgba(235, 104, 52, ${0.08 + 0.7 * t})`;
    return base;
  };
  const inFocus = (i: number, j: number) => i === sel || j === sel;

  const narr =
    sel === 1
      ? { tone: " is-bad", text: `中性只有 ${c.support} 条，只有另外两类的四成。真实是中性的 ${c.support} 条里只认对 ${cm[1][1]} 条（召回 ${pct(c.recall)}），被判成中性的 ${colSum} 条里只有 ${cm[1][1]} 条真是中性（精确率 ${pct(c.precision)}），F1 只有 ${pct(c.f1)}。准确率 ${pct(sm.accuracy)} 看起来不错，是因为大头的两类撑着；macro-F1 让三类等权，掉到 ${pct(sm.macroF1)}，把问题暴露出来。` }
      : { tone: "", text: `「${LABELS[sel]}」这一行是真实为${LABELS[sel]}的 ${c.support} 条，对角线上 ${cm[sel][sel]} 条认对，召回 = ${cm[sel][sel]} / ${c.support} = ${pct(c.recall)}；这一列是被判成${LABELS[sel]}的 ${colSum} 条，精确率 = ${cm[sel][sel]} / ${colSum} = ${pct(c.precision)}。注意错误多半流向「中性」：情感分类里中性是两端之间的缓冲带，最容易混。` };

  return (
    <VisualizationFrame
      title="三分类的混淆矩阵：准确率之外还要看什么"
      description="行是真实标签，列是模型预测，对角线是认对的。选一个类：它那一列决定精确率，那一行决定召回。数字是一个 600 条验证集的示意值，下面的指标都按它算出。"
    >
      <div className="viz-row">
        <Tabs options={OPTIONS} value={String(sel)} onChange={(k) => setSel(Number(k) as Label)} ariaLabel="选一个类别" />
      </div>

      <div className="viz-grid2">
        <div className="viz-scroll">
          <table className="viz-table" style={{ margin: 0, minWidth: 300 }} aria-label="混淆矩阵">
            <thead>
              <tr>
                <th>真实 ↓ / 预测 →</th>
                {LABELS.map((l, j) => (
                  <th key={j} className="num" style={{ color: COLORS[j], fontWeight: j === sel ? 700 : 500 }}>{l}</th>
                ))}
                <th className="num">合计</th>
              </tr>
            </thead>
            <tbody>
              {cm.map((row, i) => (
                <tr key={i}>
                  <td style={{ color: COLORS[i], fontWeight: i === sel ? 700 : 500 }}>{LABELS[i]}</td>
                  {row.map((v, j) => (
                    <td key={j} className="num" style={{ background: cellBg(v, i, j), opacity: inFocus(i, j) ? 1 : 0.3, fontWeight: i === j ? 700 : 400, outline: i === sel && j === sel ? "2px solid #3b4234" : undefined, transition: "opacity .3s" }}>
                      {v}
                    </td>
                  ))}
                  <td className="num">{row.reduce((a, b) => a + b, 0)}</td>
                </tr>
              ))}
              <tr>
                <td>合计</td>
                {LABELS.map((_, j) => (
                  <td key={j} className="num">{cm.reduce((s, r) => s + r[j], 0)}</td>
                ))}
                <td className="num">{sm.total}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="viz-panel">
          <h5 className="nocase">「{LABELS[sel]}」这一类</h5>
          <Bars
            rows={[
              { label: "精确率", value: c.precision, color: COLORS[sel], text: pct(c.precision), hint: "看列" },
              { label: "召回", value: c.recall, color: COLORS[sel], text: pct(c.recall), hint: "看行" },
              { label: "F1", value: c.f1, color: "#3b4234", text: pct(c.f1) },
            ]}
          />
          <h5 className="nocase" style={{ marginTop: 12 }}>整体</h5>
          <Bars
            rows={[
              { label: "准确率", value: sm.accuracy, color: "#2a78d6", text: pct(sm.accuracy), hint: "对角线 / 总数" },
              { label: "weighted-F1", value: sm.weightedF1, color: "#2a78d6", text: pct(sm.weightedF1), hint: "按条数加权" },
              { label: "macro-F1", value: sm.macroF1, color: "#eb6834", text: pct(sm.macroF1), hint: "三类等权" },
            ]}
          />
        </div>
      </div>

      <div className={`viz-narr${narr.tone}`}>{narr.text}</div>
    </VisualizationFrame>
  );
}
