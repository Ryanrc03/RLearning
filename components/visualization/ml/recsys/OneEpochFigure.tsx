"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Curve from "@/components/visualization/ml/primitives/Curve";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Plot from "@/components/visualization/ml/primitives/Plot";
import Slider from "@/components/visualization/ml/primitives/Slider";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import { bestCheckpoint, dropFromBest, ID_RUNS } from "@/lib/ml/oneEpoch";

// Recommender Systems: the real per-quarter-epoch curves of four kuairank Day 2
// runs (DCN-v2, is_click). Step through the 12 evaluations: nothing happens in
// epoch 1; the moment epoch 2 starts, the runs with author_id / video_id
// embeddings see their training rows a second time and the valid AUC falls.

type Metric = "auc" | "loss";
const METRICS = [
  { key: "auc" as Metric, label: "valid AUC" },
  { key: "loss" as Metric, label: "train loss" },
];
const COLOR: Record<string, string> = { f1: "var(--v1)", uid: "var(--v3)", aid: "var(--v4)", vid: "var(--vcrit)" };
const W = 720;
const H = 320;
const fmtParams = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : `${Math.round(n / 1e3)}k`);

export default function OneEpochFigure() {
  const [metric, setMetric] = useState<Metric>("auc");
  const [k, setK] = useState(12);
  const epoch = k * 0.25;
  const yDomain: [number, number] = metric === "auc" ? [0.7, 0.81] : [0.24, 0.54];
  const val = (p: { validAuc: number; trainLoss: number }) => (metric === "auc" ? p.validAuc : p.trainLoss);
  const vid = ID_RUNS.find((r) => r.key === "vid")!;
  const aid = ID_RUNS.find((r) => r.key === "aid")!;
  const f1 = ID_RUNS.find((r) => r.key === "f1")!;
  const cur = (r: (typeof ID_RUNS)[number]) => r.history[k - 1];

  const reset = () => {
    setMetric("auc");
    setK(12);
  };

  let tone = "is-good";
  let narr = `第 ${epoch.toFixed(2)} 个 epoch：四条曲线几乎重合，valid AUC 都在 ${cur(f1).validAuc.toFixed(3)} 左右。每条训练样本到这里都只见过一次，id embedding 还没机会把哪一条背下来。`;
  if (epoch > 1 && epoch < 2.25) {
    tone = "is-bad";
    narr = `第 2 个 epoch 一开始，训练样本第二次出现：加了 author_id 的运行 valid AUC 掉到 ${aid.history[4].validAuc.toFixed(3)}，再加 video_id 掉到 ${vid.history[4].validAuc.toFixed(3)}，train loss 同时从 ${vid.history[3].trainLoss.toFixed(2)} 跳到 ${vid.history[4].trainLoss.toFixed(2)}；不加 id 的 F1 和只加 user_id 的几乎不动。`;
  } else if (epoch >= 2.25) {
    tone = "is-bad";
    narr = `第 3 个 epoch：+video_id 的 valid AUC 只剩 ${cur(vid).validAuc.toFixed(3)}，比它在 epoch 1.0 的最好值低 ${dropFromBest(vid.history, epoch).toFixed(3)}；train loss 降到 ${cur(vid).trainLoss.toFixed(2)}。F1 运行同期只差 ${dropFromBest(f1.history, epoch).toFixed(4)}。所以带稀疏 id 的模型只训 1 个 epoch，或者按 valid 取最好的权重。`;
  }

  return (
    <VisualizationFrame
      title="one-epoch 现象：第二遍见到同一条样本时，id embedding 已经把它背下来了"
      description="kuairank Day 2 的四个真实运行（DCN-v2，is_click，d = 16，batch 4096，每 1/4 epoch 在 valid 上评一次）。拖动看 12 次评估依次出现；切换看 valid AUC 或这 1/4 epoch 内的平均 train loss。"
      footnote="数字取自各运行的 runs/<run_id>/metrics.json → model.history：#9 20261022_144035、#11 20261022_144701、#12 20261022_144915、#13 20261022_145140。圆圈是到当前为止 valid AUC 最好的检查点，也就是训练结束时保留的权重。"
    >
      <div className="viz-controls">
        <Tabs ariaLabel="指标" value={metric} onChange={setMetric} options={METRICS} />
        <Slider label="评估到第几次" value={k} min={1} max={12} step={1} onChange={setK} display={`epoch ${epoch.toFixed(2)}`} id="oe-step" />
        <button type="button" className="viz-btn" onClick={reset}>重置</button>
      </div>
      <Figure width={W} height={H} label={`epoch ${epoch}：${ID_RUNS.map((r) => `${r.label} ${val(cur(r)).toFixed(3)}`).join("，")}`}>
        <Plot
          box={{ x: 0, y: 0, w: W, h: H }}
          xDomain={[0, 3]}
          yDomain={yDomain}
          xTicks={[0, 1, 2, 3]}
          yTicks={metric === "auc" ? [0.7, 0.72, 0.74, 0.76, 0.78, 0.8] : [0.25, 0.3, 0.35, 0.4, 0.45, 0.5]}
          xLabel="epoch"
          yLabel={metric === "auc" ? "valid AUC" : "train loss（BCE）"}
        >
          {(f) => (
            <>
              {[1, 2].map((e) => (
                <line key={e} x1={f.x(e)} y1={f.y1} x2={f.x(e)} y2={f.y0} stroke="#9a9c8d" strokeDasharray="4 3" />
              ))}
              <text x={f.x(1) + 4} y={f.y1 + 12} fontSize={10.5} fill="#76796f">第 2 个 epoch 开始</text>
              {ID_RUNS.map((r) => {
                const seen = r.history.slice(0, k);
                const best = bestCheckpoint(seen);
                const last = seen[seen.length - 1];
                return (
                  <g key={r.key}>
                    <Curve frame={f} points={seen.map((p) => [p.epoch, val(p)] as const)} color={COLOR[r.key]} width={2.2} />
                    {seen.map((p) => (
                      <circle key={p.epoch} cx={f.x(p.epoch)} cy={f.y(val(p))} r={2.6} fill={COLOR[r.key]} />
                    ))}
                    {metric === "auc" && <circle cx={f.x(best.epoch)} cy={f.y(best.validAuc)} r={6.5} fill="none" stroke={COLOR[r.key]} strokeWidth={1.6} />}
                    <circle cx={f.x(last.epoch)} cy={f.y(val(last))} r={4.5} fill={COLOR[r.key]} stroke="#fff" strokeWidth={1.5} />
                  </g>
                );
              })}
            </>
          )}
        </Plot>
      </Figure>
      <div className="viz-legend">
        {ID_RUNS.map((r) => (
          <span key={r.key}><i style={{ background: COLOR[r.key] }} />#{r.runNo} {r.label}</span>
        ))}
      </div>
      <div className="viz-scroll">
        <table className="viz-table" style={{ marginTop: 10, minWidth: 560 }}>
          <thead>
            <tr><th>运行</th><th>新增 id</th><th className="num">参数量</th><th className="num">valid AUC</th><th className="num">train loss</th><th className="num">最好检查点</th></tr>
          </thead>
          <tbody>
            {ID_RUNS.map((r) => {
              const best = bestCheckpoint(r.history.slice(0, k));
              return (
                <tr key={r.key}>
                  <td><i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: COLOR[r.key], marginRight: 6 }} />#{r.runNo}</td>
                  <td>{r.ids}</td>
                  <td className="num">{fmtParams(r.params)}</td>
                  <td className="num">{cur(r).validAuc.toFixed(4)}</td>
                  <td className="num">{cur(r).trainLoss.toFixed(4)}</td>
                  <td className="num">epoch {best.epoch.toFixed(2)} · {best.validAuc.toFixed(4)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className={`viz-narr ${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}
