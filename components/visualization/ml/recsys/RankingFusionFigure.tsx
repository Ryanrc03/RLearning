"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Slider from "@/components/visualization/ml/primitives/Slider";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import Bars from "@/components/visualization/ml/primitives/Bars";
import { fusionScore, type FusionMode } from "@/lib/ml/ranking";

const candidates = [
  { name: "A · 点击突出", probabilities: [0.8, 0.01, 0.01, 0.01] },
  { name: "B · 行为均衡", probabilities: [0.3, 0.15, 0.12, 0.08] },
];
const epsilon = 1e-6;

export default function RankingFusionFigure() {
  const [mode, setMode] = useState<FusionMode>("sum");
  const [ctrWeight, setCtrWeight] = useState(0.4);
  const weights = [ctrWeight, (1 - ctrWeight) / 2, (1 - ctrWeight) / 3, (1 - ctrWeight) / 6];
  const scores = candidates.map((c) => fusionScore(c.probabilities, weights, mode, epsilon));
  const tied = Math.abs(scores[0] - scores[1]) < 1e-12;
  const winner = scores[0] > scores[1] ? "A" : "B";
  return (
    <div className="ranking-viz">
      <VisualizationFrame title="同一组概率，融合方式会改变排序" description="假设四个任务都在曝光空间上定义，且已校准。以下概率与权重仅为教学示例，分数没有概率含义。">
        <div className="viz-row">
          <Tabs options={[{ key: "sum", label: "Weighted Sum" }, { key: "product", label: "Multiplicative" }]} value={mode} onChange={setMode} ariaLabel="融合方式" />
          <button type="button" className="viz-btn" onClick={() => { setMode("sum"); setCtrWeight(0.4); }}>重置</button>
        </div>
        <Slider label="点击权重 w_CTR" min={0} max={1} step={0.05} value={ctrWeight} onChange={setCtrWeight} display={ctrWeight.toFixed(2)} />
        <div className="viz-scroll ranking-block">
          <table className="viz-table">
            <caption>各候选的已校准概率与当前融合权重</caption>
            <thead><tr><th scope="col">候选 / 权重</th>{["CTR", "Like", "Favorite", "Share"].map((t) => <th scope="col" key={t}>{t}</th>)}</tr></thead>
            <tbody>
              {candidates.map((c) => <tr key={c.name}><th scope="row">{c.name}</th>{c.probabilities.map((p, i) => <td key={i}>{(p * 100).toFixed(0)}%</td>)}</tr>)}
              <tr><th scope="row">w</th>{weights.map((w, i) => <td key={i}>{w.toFixed(3)}</td>)}</tr>
            </tbody>
          </table>
        </div>
        <div className="ranking-equation">{mode === "sum" ? "S = Σ wₖ pₖ" : "S = exp(Σ wₖ ln(pₖ + ε)) · ε = 10⁻⁶"}</div>
        <Bars rows={candidates.map((c, i) => ({ label: c.name, value: scores[i], max: 1, color: `var(--v${i + 1})`, text: scores[i].toFixed(4) }))} />
        <div className="viz-narr" aria-live="polite">{tied ? "两个候选并列。" : `当前 ${winner} 排在前面。`}{mode === "sum" ? "加法允许高 CTR 补偿其他目标的低概率。" : "乘法通常更惩罚被赋予正权重的低概率目标；点击权重为 1 时，其余目标不再参与。"} 剩余权重始终按 Like : Favorite : Share = 3 : 2 : 1 分配。</div>
      </VisualizationFrame>
    </div>
  );
}
