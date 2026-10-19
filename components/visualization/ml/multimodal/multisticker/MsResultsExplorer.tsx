"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Bars from "@/components/visualization/ml/primitives/Bars";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import { bestMethod, MS_METHOD_INFO, MS_METHODS, MS_METRIC_INFO, MS_RESULTS, type MsMetricKey } from "@/lib/ml/multisticker";

// Experiment 1: five methods on the same validation set. Pick a metric; the
// best method is drawn in the strong colour. Exact and Group metrics disagree
// on who wins, which is the point of the figure.

const EXACT: MsMetricKey[] = ["r1", "r5", "r10", "r30", "mrr"];
const GROUP: MsMetricKey[] = ["g1", "g5", "g10", "g30"];

const NARR: Partial<Record<MsMetricKey, string>> = {
  r1: "Exact R@1：第一张就是用户真发的那张。所有方法都在 1% 左右，6,758 张里猜中一张本来就极难；head_only 以 1.10% 微弱领先。冻结 CLIP 只有 0.02%。",
  r5: "Exact R@5：image_lora 最高（3.76%）。让贴纸向量也能动，前几名排得更准。",
  r10: "Exact R@10：image_lora 仍然领先（5.76%），head_only 5.40% 紧随其后。",
  r30: "Exact R@30：一个贴纸面板大概放 30 张。dual_lora 13.15% 最高，冻结 CLIP 只有 0.28%，差约 47 倍。训练过的四种方法彼此差距不到 1.3 个百分点。",
  mrr: "MRR（单正例时等于 MAP）：1/rank 的平均，image_lora 0.0302 最高。",
  g1: "Group R@1：第一张和答案属于同一个意图组。head_only 79.3% 最高、dual_lora 只有 62.8%，比冻结 CLIP 还低：两侧都训之后，模型更追求「那一张」，第一名反而更常跑到别的意图组。",
  g5: "Group R@5：dual_lora 88.2% 最高，前五张里几乎总有一张语气对得上。",
  g10: "Group R@10：冻结 CLIP 90.8% 最高，训练过的模型在宽松指标上没有优势。",
  g30: "Group R@30：所有方法都在 94% 以上，冻结 CLIP 95.9% 最高。CLIP 本身已经懂「这张图大概什么情绪」，项目真正要解决的是精确那一张。",
};

export default function MsResultsExplorer() {
  const [kind, setKind] = useState<"exact" | "group">("exact");
  const [metric, setMetric] = useState<MsMetricKey>("r30");
  const keys = kind === "exact" ? EXACT : GROUP;
  const best = bestMethod(metric);
  const max = Math.max(...MS_METHODS.map((m) => MS_RESULTS[m][metric]));
  const fmt = (v: number) => (metric === "mrr" ? v.toFixed(4) : `${(v * 100).toFixed(2)}%`);

  return (
    <VisualizationFrame
      title="实验 1：五种训练方式，同一个验证集"
      description="4,998 条验证样本，每条对 6,758 张贴纸排序。Exact 要求排到用户真发的那一张；Group 只要求排到同一个意图组里的任意一张。"
      footnote="数据：organized_runs/rebuild_medium/*.json 的 val.metrics 与 val.semantic_metrics。"
    >
      <div className="viz-row" style={{ gap: 10, flexWrap: "wrap" }}>
        <Tabs options={[{ key: "exact", label: "Exact（精确那一张）" }, { key: "group", label: "Group（同意图组）" }]} value={kind} onChange={(k) => { setKind(k); setMetric(k === "exact" ? "r30" : "g30"); }} ariaLabel="指标类型" />
        <div className="viz-chips" role="group" aria-label="指标">
          {keys.map((k) => (
            <button key={k} type="button" className={`viz-chip${metric === k ? " is-on" : ""}`} aria-pressed={metric === k} onClick={() => setMetric(k)}>
              {MS_METRIC_INFO[k].label}
            </button>
          ))}
        </div>
      </div>
      <div className="viz-panel" style={{ marginTop: 12 }}>
        <h5>{MS_METRIC_INFO[metric].label}</h5>
        <Bars
          rows={MS_METHODS.map((m) => ({
            label: MS_METHOD_INFO[m].label,
            value: MS_RESULTS[m][metric],
            max: max * 1.08,
            color: m === best ? (kind === "exact" ? "var(--v2)" : "var(--v1)") : "var(--vfixed)",
            text: fmt(MS_RESULTS[m][metric]),
            hint: m === best ? "最高" : undefined,
          }))}
        />
      </div>
      <table className="viz-table" style={{ marginTop: 10 }}>
        <thead>
          <tr><th>方法</th>{[...EXACT, ...GROUP].map((k) => <th key={k} className="num">{MS_METRIC_INFO[k].label.replace("Exact ", "").replace("Group ", "G·")}</th>)}</tr>
        </thead>
        <tbody>
          {MS_METHODS.map((m) => (
            <tr key={m}>
              <td>{MS_METHOD_INFO[m].short}</td>
              {[...EXACT, ...GROUP].map((k) => {
                const v = MS_RESULTS[m][k];
                const isBest = bestMethod(k) === m;
                return <td key={k} className="num" style={{ fontWeight: isBest ? 700 : 400, background: k === metric ? "#fbf7e6" : undefined }}>{k === "mrr" ? v.toFixed(4) : (v * 100).toFixed(1)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="viz-narr">{NARR[metric]}</div>
    </VisualizationFrame>
  );
}
