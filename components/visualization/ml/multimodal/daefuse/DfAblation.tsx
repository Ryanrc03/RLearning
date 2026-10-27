"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Bars from "@/components/visualization/ml/primitives/Bars";
import { DF_ABLATION, DF_ABLATION_METRICS } from "@/lib/ml/daefuse";

// Section 4.6, Table IV: remove one component at a time. Bars show each
// configuration's drop relative to the full model, as a percentage.

type M = (typeof DF_ABLATION_METRICS)[number];

export default function DfAblation() {
  const [metric, setMetric] = useState<M>("VIF");
  const mi = DF_ABLATION_METRICS.indexOf(metric);
  const full = DF_ABLATION.find((r) => r.key === "full")!.vals[mi];
  const parts = DF_ABLATION.filter((r) => r.key !== "full");
  const drops = parts.map((r) => (r.vals[mi] - full) / full);
  const worst = parts[drops.indexOf(Math.min(...drops))];

  return (
    <VisualizationFrame
      title="表 IV：一次去掉一个部件"
      description="三个消融各只改一处：去掉 Phase 1 的判别器、去掉 Phase 2 的判别器、把 cross-attention 换成直接拼接。条形是相对完整模型的变化。"
      footnote="数字抄自论文表 IV（标注为 TNO）。注意「完整 DAE-Fuse」一行的 EN / SD / VIF 和表 I 的 MSRS 一行相同，与 TNO 一行不同，所以只比较同一张表里的相对差距。"
    >
      <div className="viz-chips" role="group" aria-label="指标">
        {DF_ABLATION_METRICS.map((k) => (
          <button key={k} type="button" className={`viz-chip${metric === k ? " is-on" : ""}`} aria-pressed={metric === k} onClick={() => setMetric(k)}>{k}</button>
        ))}
      </div>
      <div className="viz-panel" style={{ marginTop: 12 }}>
        <h5>{metric}：完整模型 {full}</h5>
        <Bars
          rows={DF_ABLATION.map((r, i) => ({
            label: r.label,
            value: r.vals[mi],
            max: Math.max(...DF_ABLATION.map((x) => x.vals[mi])) * 1.02,
            color: r.key === "full" ? "#2a78d6" : "#cfcab4",
            text: r.key === "full" ? `${r.vals[mi]}` : `${r.vals[mi]}（${drops[i] >= 0 ? "+" : ""}${(drops[i] * 100).toFixed(1)}%）`,
          }))}
        />
      </div>
      <div className="viz-narr">
        {metric === "SD"
          ? `SD 是唯一的例外：去掉 Phase 2 判别器之后 SD 反而更高（45.31 > 44.05）。没有判别器拉着，融合图更容易偏向某一种模态的高对比，SD 上去了，但 VIF（${DF_ABLATION[1].vals[2]}）和 Qabf（${DF_ABLATION[1].vals[3]}）都是三个消融里最低的。`
          : `${metric} 上掉得最多的是「${worst.label}」（${(Math.min(...drops) * 100).toFixed(1)}%）。${metric === "VIF" || metric === "Qabf" ? "VIF 和 Qabf 衡量的是 F 有没有同时保住两张源图的信息和边缘，去掉 Phase 2 判别器时它们掉得最多：这正是判别器「不偏向任何一边」的作用。" : "三个部件去掉任何一个，EN 都降到 6.78–6.81。"}`}
      </div>
    </VisualizationFrame>
  );
}
