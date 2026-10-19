"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Curve from "@/components/visualization/ml/primitives/Curve";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Plot from "@/components/visualization/ml/primitives/Plot";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import { MS_EPOCH_SECONDS, MS_HISTORY, MS_METHOD_INFO, type MsEpoch } from "@/lib/ml/multisticker";

// Experiment 3: what five epochs look like for each trainable mode, and what
// one epoch costs. Cost bars are log-scale: 2.6 s to 3 h on the same data.

type Run = "head_only" | "text_lora" | "image_lora" | "dual_lora";
const RUNS: Run[] = ["head_only", "text_lora", "image_lora", "dual_lora"];
const COLOR: Record<Run, string> = { head_only: "var(--v1)", text_lora: "var(--v3)", image_lora: "var(--v4)", dual_lora: "var(--v2)" };
type Key = keyof MsEpoch;
const DOMAIN: Record<Key, [number, number]> = { loss: [2, 9], r30: [0, 0.16], g30: [0.9, 0.97] };
const TICKS: Record<Key, number[]> = { loss: [2, 4, 6, 8], r30: [0, 0.04, 0.08, 0.12, 0.16], g30: [0.9, 0.92, 0.94, 0.96] };
const LABEL: Record<Key, string> = { loss: "训练 loss", r30: "验证 Exact R@30", g30: "验证 Group R@30" };

const NARR: Record<Key, string> = {
  loss: "image / dual LoRA 的 loss 在 3 上下，head / text 在 6–8：这不是谁学得好。image 侧 LoRA 每步只把这一批的答案贴纸重新编码（动图最多 4 帧）、塞回缓存的库里，其余 6,000 多张还是旧向量；一个可能的原因是被重编的正例和库里其他贴纸分布不同，更容易被认出来。两组 loss 不在同一个口径上，别拿来比。",
  r30: "head 和 text 在第 1 个 epoch 就到了 5–12%，之后起伏；image / dual 逐 epoch 爬升但一直更低。原因是逐 epoch 验证用的是该 epoch 开头编码的贴纸库，比模型落后一轮；训练结束后用最终的 LoRA 重编整个库，dual 从曲线上的 9.8% 跳到 13.15%，image 从 7.1% 到 11.9%。",
  g30: "Group R@30 全都在 92–96% 之间来回摆，训练几乎不改变「语义上对不对」，只是在同一组里把对的那张往前挪。早停的依据是这条曲线（best_val_group_recall@30），所以保存的 checkpoint 不一定是 Exact 最好的那一轮。",
};

const fmtSec = (s: number) => (s < 60 ? `${s.toFixed(1)} s` : s < 3600 ? `${(s / 60).toFixed(1)} min` : `${(s / 3600).toFixed(2)} h`);

export default function MsTrainingCurves() {
  const [key, setKey] = useState<Key>("r30");
  const [d0, d1] = DOMAIN[key];
  const fmt = key === "loss" ? (v: number) => v.toFixed(0) : (v: number) => `${Math.round(v * 100)}%`;
  const maxLog = Math.log10(MS_EPOCH_SECONDS.dual_lora * 1.5);
  return (
    <VisualizationFrame
      title="实验 3：五个 epoch 的曲线，以及一个 epoch 花多少时间"
      description="四种可训练方式各跑 5 个 epoch。左边换指标看曲线，右边是每个 epoch 的平均耗时（对数刻度）。"
      footnote="head_only 的 batch 是 256，三种 LoRA 是 96；耗时是日志里 5 个 epoch_seconds 的平均。"
    >
      <Tabs options={(["loss", "r30", "g30"] as Key[]).map((k) => ({ key: k, label: LABEL[k] }))} value={key} onChange={setKey} ariaLabel="指标" />
      <Figure width={720} height={270} label={`${LABEL[key]} 逐 epoch`} minWidth={600}>
        <Plot box={{ x: 0, y: 0, w: 420, h: 266 }} xDomain={[1, 5]} yDomain={[d0, d1]} xTicks={[1, 2, 3, 4, 5]} yTicks={TICKS[key]} xLabel="epoch" title={LABEL[key]} format={(v) => (v >= 1 && v === Math.round(v) && key !== "loss" ? String(v) : fmt(v))}>
          {(f) => (
            <>
              {RUNS.map((r) => (
                <g key={r}>
                  <Curve frame={f} points={MS_HISTORY[r].map((e, i) => [i + 1, e[key]] as const)} color={COLOR[r]} width={2.2} />
                  {MS_HISTORY[r].map((e, i) => <circle key={i} cx={f.x(i + 1)} cy={f.y(e[key])} r={3} fill={COLOR[r]} style={{ transition: "cy .35s" }} />)}
                </g>
              ))}
            </>
          )}
        </Plot>
        <text x={450} y={14} fontSize={12.5} fontWeight={600} fill="#30332c">每个 epoch 的耗时</text>
        {RUNS.map((r, i) => {
          const s = MS_EPOCH_SECONDS[r];
          const w = (Math.log10(s * 1.5) / maxLog) * 160;
          const y = 40 + i * 54;
          return (
            <g key={r}>
              <text x={450} y={y} fontSize={11.5} fill="#30332c">{MS_METHOD_INFO[r].label}</text>
              <rect x={450} y={y + 6} width={w} height={16} rx={3} fill={COLOR[r]} opacity={0.85} />
              <text x={456 + w} y={y + 19} fontSize={11.5} fill="#30332c" className="mono">{fmtSec(s)}</text>
            </g>
          );
        })}
        <text x={450} y={262} fontSize={10.5} fill="#76796f">dual 一个 epoch ≈ head 的 {Math.round(MS_EPOCH_SECONDS.dual_lora / MS_EPOCH_SECONDS.head_only).toLocaleString("en-US")} 倍</text>
      </Figure>
      <div className="viz-legend">
        {RUNS.map((r) => <span key={r}><i style={{ display: "inline-block", width: 14, height: 3, background: COLOR[r], verticalAlign: 3, marginRight: 6 }} />{MS_METHOD_INFO[r].label}</span>)}
      </div>
      <div className="viz-narr">{NARR[key]}</div>
    </VisualizationFrame>
  );
}
