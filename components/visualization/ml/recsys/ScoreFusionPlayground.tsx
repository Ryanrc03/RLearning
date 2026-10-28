"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Bars from "@/components/visualization/ml/primitives/Bars";
import Slider from "@/components/visualization/ml/primitives/Slider";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import { DEFAULT_CANDIDATES, DEFAULT_FUSION_PARAMETERS, FUSION_TARGETS, scoreCandidates, type FusionMode, type FusionParameters } from "@/lib/ml/scoreFusion";

const labels = { click: "Click", like: "Like", favorite: "Favorite", pay: "Pay", price: "Price" };
const options: { key: FusionMode; label: string }[] = [
  { key: "sum", label: "Weighted Sum" }, { key: "ctr", label: "CTR-weighted" },
  { key: "rank", label: "Rank Fusion" }, { key: "product", label: "Product" },
];
const colors: Record<string, string> = { A: "var(--v1)", B: "var(--v2)", C: "var(--v3)", D: "var(--v4)" };
const format = (value: number) => value === 0 ? "0" : value < 0.001 ? value.toExponential(3) : value.toFixed(4);

export default function ScoreFusionPlayground() {
  const [mode, setMode] = useState<FusionMode>("sum");
  const [parameters, setParameters] = useState<FusionParameters>(DEFAULT_FUSION_PARAMETERS);
  const [target, setTarget] = useState<(typeof FUSION_TARGETS)[number] | "price">("like");
  const results = scoreCandidates(DEFAULT_CANDIDATES, mode, parameters);
  const baseline = scoreCandidates(DEFAULT_CANDIDATES, mode);
  const max = Math.max(...results.map(r => r.score));
  const orderText = [...new Set(results.map(r => r.rank))].map(rank => results.filter(r => r.rank === rank).map(r => r.id).join(" = ")).join(" → ");
  const topTied = results[0].rank === results[1].rank;

  const controls: (typeof target)[] = mode === "product" ? [...FUSION_TARGETS, "price" as const] : FUSION_TARGETS.filter(k => mode !== "ctr" || k !== "click");
  const activeTarget = controls.includes(target) ? target : "like";
  const formula = mode === "sum" ? `S = ${FUSION_TARGETS.map(k => `${parameters.weights[k].toFixed(1)} × p_${k}`).join(" + ")}`
    : mode === "ctr" ? `S = p_click × (1 + ${FUSION_TARGETS.filter(k => k !== "click").map(k => `${parameters.weights[k].toFixed(1)} × p_${k}`).join(" + ")})`
    : mode === "rank" ? `S = Σ w_k / (r_k^${parameters.alpha.toFixed(1)} + ${parameters.beta.toFixed(1)}); w = (${FUSION_TARGETS.map(k => parameters.weights[k].toFixed(1)).join(", ")})`
    : `S = ${FUSION_TARGETS.map(k => `p_${k}^${parameters.powers[k].toFixed(1)}`).join(" × ")} × (price / ${parameters.priceReference})^${parameters.powers.price.toFixed(1)}`;
  const power = mode === "product";
  const currentValue = power ? parameters.powers[activeTarget] : parameters.weights[activeTarget as typeof FUSION_TARGETS[number]];
  return (
    <div className="ranking-viz chapter34-viz">
      <VisualizationFrame title="Multi-Objective Ranking Playground" description="固定四个候选，切换排序偏好。先选一个目标，再修改它的参数；参数行始终显示全部取值。" footnote="教学示例；所有概率均以曝光为分母。仅比较同一模式内的分数。">
        <Tabs options={options} value={mode} onChange={setMode} ariaLabel="融合方式" />
        <div className="viz-body">
          <p className="viz-mono fusion-formula">{formula}</p>
          <label className="viz-k">调整目标 <select aria-label="调整的融合目标" value={activeTarget} onChange={e => setTarget(e.target.value as typeof target)}>{controls.map(k => <option key={k} value={k}>{labels[k]}</option>)}</select></label>
          <Slider label={`${labels[activeTarget]} ${power ? "exponent α" : "weight w"}`} value={currentValue} min={0} max={power ? 3 : 8} step={0.1} display={currentValue.toFixed(1)} onChange={value => setParameters(p => power ? { ...p, powers: { ...p.powers, [activeTarget]: value } } : { ...p, weights: { ...p.weights, [activeTarget]: value } })} />
          {mode === "rank" && <div className="fusion-controls">
            <Slider label="共享 α" value={parameters.alpha} min={0.2} max={3} step={0.1} display={parameters.alpha.toFixed(1)} onChange={alpha => setParameters(p => ({ ...p, alpha }))} />
            <Slider label="共享 β" value={parameters.beta} min={0} max={10} step={0.5} display={parameters.beta.toFixed(1)} onChange={beta => setParameters(p => ({ ...p, beta }))} />
          </div>}
          <button className="viz-btn" type="button" onClick={() => { setParameters(DEFAULT_FUSION_PARAMETERS); setTarget("like"); }}>重置全部参数</button>
          <Bars rows={results.map(r => {
            const movement = baseline.find(b => b.id === r.id)!.rank - r.rank;
            return { label: `#${r.rank} ${r.id}`, value: r.score, max, color: colors[r.id], text: format(r.score), hint: movement === 0 ? "持平" : movement > 0 ? `↑${movement}` : `↓${-movement}` };
          })} />
          <p className="viz-narr" aria-live="polite">当前顺序：{orderText}。{results[0].id} 的分数为 {format(results[0].score)}；{topTied ? "最高分并列" : `与第二名差 ${format(results[0].score - results[1].score)}`}。箭头比较本模式默认参数下的名次。</p>
          <details open={mode === "rank"}>
            <summary>输入数据与分目标名次</summary>
            <div className="fusion-table-wrap"><table className="viz-table"><thead><tr><th>候选</th>{FUSION_TARGETS.map(k => <th key={k}>{labels[k]}</th>)}<th>Price (元)</th>{mode === "rank" && <th>r (Click / Like / Favorite / Pay)</th>}</tr></thead><tbody>{DEFAULT_CANDIDATES.map(c => <tr key={c.id}><th>{c.id}</th>{FUSION_TARGETS.map(k => <td key={k}>{(c[k]*100).toFixed(1)}%</td>)}<td>{c.price}</td>{mode === "rank" && <td>{FUSION_TARGETS.map(k => results.find(r => r.id === c.id)!.componentRanks[k]).join(" / ")}</td>}</tr>)}</tbody></table></div>
          </details>
          <p className="viz-k">Rank 模式先为每个目标计算名次，使用共享 α、β 便于观察；同值并列采用 1、1、3。最终同分也并列，显示顺序按 A–D。Product 将价格除以固定参考价 100 元；α=0 表示忽略该因子。</p>
        </div>
      </VisualizationFrame>
    </div>
  );
}
