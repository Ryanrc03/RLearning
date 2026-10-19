"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Curve from "@/components/visualization/ml/primitives/Curve";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Plot from "@/components/visualization/ml/primitives/Plot";
import { lift, MS_HISTORY, MS_METRIC_INFO, MS_NO_MEMORY_DIRECT_R30, MS_NO_MEMORY_HEAD, MS_PER_MEDIA, MS_RESULTS, type MsMetricKey } from "@/lib/ml/multisticker";

// Experiment 2: the same head_only model with and without retrieved memory.
// Left: final metrics side by side; right: Exact R@30 per epoch for both runs.

const KEYS: MsMetricKey[] = ["r1", "r5", "r10", "r30", "mrr", "g1", "g30"];
const ON = "var(--v1)";
const OFF = "#b9b39b";

export default function MsMemoryAblation() {
  const [metric, setMetric] = useState<MsMetricKey>("r30");
  const on = MS_RESULTS.head_only[metric];
  const off = MS_NO_MEMORY_HEAD[metric];
  const ratio = lift(on, off);
  const isGroup = MS_METRIC_INFO[metric].group === "group";
  const fmt = (v: number) => (metric === "mrr" ? v.toFixed(4) : `${(v * 100).toFixed(2)}%`);
  const max = Math.max(on, off) * 1.15;
  const BW = 330;
  const bh = (v: number) => (v / max) * 170;

  return (
    <VisualizationFrame
      title="实验 2：去掉对话记忆，同一个 head 掉多少"
      description="两次运行只有一处不同：memory_strategy = retrieved_topk 还是 disabled（记忆文本换成 &quot;memory disabled&quot;）。数据、模型、超参数全一样。"
      footnote={`对照组：冻结 CLIP 只读上下文，开不开记忆 Exact R@30 都是 ${(MS_NO_MEMORY_DIRECT_R30 * 100).toFixed(2)}%，说明差别确实来自记忆这一路输入。`}
    >
      <div className="viz-chips" role="group" aria-label="指标">
        {KEYS.map((k) => (
          <button key={k} type="button" className={`viz-chip${metric === k ? " is-on" : ""}`} aria-pressed={metric === k} onClick={() => setMetric(k)}>
            {MS_METRIC_INFO[k].label}
          </button>
        ))}
      </div>
      <Figure width={720} height={250} label={`${MS_METRIC_INFO[metric].label}：有记忆 ${fmt(on)}，无记忆 ${fmt(off)}`} minWidth={560}>
        <text x={16} y={18} fontSize={12.5} fontWeight={600} fill="#30332c">{MS_METRIC_INFO[metric].label}（最终）</text>
        {[{ v: off, label: "无记忆", c: OFF, x: 70 }, { v: on, label: "有记忆", c: ON, x: 190 }].map((b) => (
          <g key={b.label}>
            <rect x={b.x} y={210 - bh(b.v)} width={84} height={Math.max(bh(b.v), 2)} rx={4} fill={b.c} style={{ transition: "y .35s, height .35s" }} />
            <text x={b.x + 42} y={204 - bh(b.v)} fontSize={12} textAnchor="middle" fill="#30332c" className="mono" style={{ transition: "y .35s" }}>{fmt(b.v)}</text>
            <text x={b.x + 42} y={228} fontSize={12} textAnchor="middle" fill="#30332c">{b.label}</text>
          </g>
        ))}
        <line x1={40} y1={210} x2={300} y2={210} stroke="#76796f" />
        <text x={160} y={246} fontSize={12} textAnchor="middle" fontWeight={700} fill={ratio >= 1.05 ? "#087a08" : "#76796f"}>
          {ratio >= 1.05 ? `× ${ratio.toFixed(2)}` : `几乎不变（× ${ratio.toFixed(2)}）`}
        </text>
        <Plot box={{ x: BW + 20, y: 4, w: 370, h: 244 }} xDomain={[1, 5]} yDomain={[0, 0.16]} xTicks={[1, 2, 3, 4, 5]} yTicks={[0, 0.04, 0.08, 0.12, 0.16]} xLabel="epoch" title="Exact R@30 逐 epoch" format={(v) => (v < 1 ? `${Math.round(v * 100)}%` : String(v))}>
          {(f) => (
            <>
              <Curve frame={f} points={MS_HISTORY.head_no_memory.map((e, i) => [i + 1, e.r30] as const)} color={OFF} width={2.2} dashed />
              <Curve frame={f} points={MS_HISTORY.head_only.map((e, i) => [i + 1, e.r30] as const)} color={ON} width={2.4} />
              {MS_HISTORY.head_only.map((e, i) => <circle key={`a${i}`} cx={f.x(i + 1)} cy={f.y(e.r30)} r={3.5} fill={ON} />)}
              {MS_HISTORY.head_no_memory.map((e, i) => <circle key={`b${i}`} cx={f.x(i + 1)} cy={f.y(e.r30)} r={3.5} fill={OFF} />)}
              <text x={f.x(5) - 4} y={f.y(MS_HISTORY.head_only[4].r30) - 8} fontSize={11} textAnchor="end" fill={ON} fontWeight={600}>有记忆</text>
              <text x={f.x(5) - 4} y={f.y(MS_HISTORY.head_no_memory[4].r30) - 8} fontSize={11} textAnchor="end" fill="#76796f" fontWeight={600}>无记忆</text>
            </>
          )}
        </Plot>
      </Figure>
      <div className="viz-panel">
        <h5>按贴纸格式看 Exact R@30</h5>
        <table className="viz-table">
          <thead><tr><th>格式</th><th className="num">无记忆</th><th className="num">有记忆</th><th className="num">倍数</th></tr></thead>
          <tbody>
            {(["png", "gif", "webm"] as const).map((md) => {
              const a = MS_PER_MEDIA.head_no_memory[md].r30;
              const b = MS_PER_MEDIA.head_only[md].r30;
              return <tr key={md}><td>{md}</td><td className="num">{(a * 100).toFixed(2)}%</td><td className="num">{(b * 100).toFixed(2)}%</td><td className="num">× {lift(b, a).toFixed(1)}</td></tr>;
            })}
          </tbody>
        </table>
      </div>
      <div className={`viz-narr${isGroup ? " is-warn" : " is-good"}`}>
        {isGroup
          ? `Group 指标几乎不受记忆影响（${fmt(off)} → ${fmt(on)}）：没有记忆，模型也能从上下文看出「该发个开心的」。记忆帮的是更细的那一步：这群人习惯用哪一套贴纸。`
          : `记忆让 ${MS_METRIC_INFO[metric].label} 从 ${fmt(off)} 到 ${fmt(on)}，× ${ratio.toFixed(2)}。右边的曲线说明这不是偶然：五个 epoch 里有记忆的那条线每一轮都在上面。gif 受益最大（× 8.2）。一个可能的解释：同一个群反复用同一套动图，记忆里「这群人平时聊什么、什么语气」帮模型缩小到那一套；这一点日志没有直接验证。`}
      </div>
    </VisualizationFrame>
  );
}
