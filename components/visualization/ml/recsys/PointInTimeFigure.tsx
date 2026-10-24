"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Slider from "@/components/visualization/ml/primitives/Slider";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import {
  countedRows,
  DAY_LABELS,
  evalRows,
  FEATURE_MODES,
  type FeatureMode,
  featureAuc,
  RANDOM_FIRST_DAY,
  splitOfDay,
  splitTotals,
  STANDARD_DAILY,
  TOY_SMOOTH_A,
  TOY_VIDEOS,
  toyExposures,
  videoFeature,
} from "@/lib/ml/pointInTime";

// Recommender Systems: the top strip is the real KuaiRand-1K calendar (daily
// exposures, split by PLAN §4). The rows below are a toy on the same calendar:
// 8 videos, dots are exposures (filled = clicked). Pick a test-period sample;
// the highlighted dots are what its video click-rate feature may count.

const W = 720;
const H = 330;
const X0 = 44;
const X1 = W - 12;
const x = (t: number) => X0 + (t / 31) * (X1 - X0);
const SPLIT_COLOR = { train: "var(--v1)", valid: "var(--v4)", test: "var(--v2)" } as const;
const SPLIT_NAME = { train: "train", valid: "valid", test: "test" } as const;
const BAR_TOP = 26;
const BAR_BOTTOM = 112;
const ROW0 = 168;
const ROW_H = 18;
const fmt = (n: number) => n.toLocaleString("en-US");

export default function PointInTimeFigure() {
  const rows = useMemo(() => toyExposures(), []);
  const samples = useMemo(() => evalRows(rows), [rows]);
  const aucs = useMemo(() => Object.fromEntries(FEATURE_MODES.map((m) => [m.key, featureAuc(rows, m.key)])) as Record<FeatureMode, number>, [rows]);
  const totals = useMemo(() => splitTotals(), []);
  const defaultIdx = Math.max(0, samples.findIndex((s) => countedRows(rows, s, "strict").length >= 4));
  const [mode, setMode] = useState<FeatureMode>("strict");
  const [idx, setIdx] = useState(defaultIdx);
  const s = samples[Math.min(idx, samples.length - 1)];
  const used = new Set(countedRows(rows, s, mode).map((r) => r.id));
  const f = videoFeature(rows, s, mode);
  const strictF = videoFeature(rows, s, "strict");
  const maxDaily = Math.max(...STANDARD_DAILY);
  const day = Math.floor(s.t);
  const hour = Math.round((s.t - day) * 24);

  const reset = () => {
    setMode("strict");
    setIdx(defaultIdx);
  };

  let tone = "is-good";
  let narr = `样本是视频 ${s.video + 1} 在 ${DAY_LABELS[day]} ${hour} 时的一次曝光（${s.click ? "点了" : "没点"}）。严格早于 t 只能看到这支视频之前的 ${f.n} 次曝光、${f.clicks} 次点击，平滑后特征 = ${f.value.toFixed(3)}；线上打分时拿到的就是这个数。用这个规则，特征单独排 test 期点击的 AUC 是 ${aucs.strict.toFixed(3)}。`;
  if (mode === "same-time") {
    tone = "is-bad";
    narr = `把 ≤ t 也算进来，同一请求里的行和 t 完全相同，本条曝光自己就在里面：特征从 ${strictF.value.toFixed(3)} 变成 ${f.value.toFixed(3)}，${s.click ? "往上" : "往下"}挪了一点，方向正好是它自己的 label。每条样本都这样偷看一眼，test 期 AUC 从 ${aucs.strict.toFixed(3)} 涨到 ${aucs["same-time"].toFixed(3)}，上线后这部分立刻消失。`;
  } else if (mode === "monthly") {
    tone = "is-bad";
    narr = `整月统计（video_features_statistic 的做法）把这支视频 ${f.n} 次曝光全算上，包括 ${DAY_LABELS[day]} 之后还没发生的 ${f.n - strictF.n - 1} 次和它自己。这等于提前知道视频后来火不火，test 期 AUC ${aucs.monthly.toFixed(3)}，比只用过去的 ${aucs.strict.toFixed(3)} 高，但这个数线上永远拿不到。`;
  }

  return (
    <VisualizationFrame
      title="只用过去：一条样本的特征能数哪些行"
      description="上面是 KuaiRand-1K 的真实日历（每天的常规曝光量，按 PLAN §4 切成三段）；下面是放在同一日历上的玩具：8 支视频，每个点是一次曝光，实心 = 点击。选一条 test 期样本，看它的视频点击率特征在三种规则下各数了哪些点。"
      footnote={`玩具数据：8 支视频各有固定的真实点击率，上传后 4 天内每个请求有 75% 概率被曝光，一天 4 个请求；平滑用 (clicks + ${TOY_SMOOTH_A}·0.38) / (n + ${TOY_SMOOTH_A})，kuairank 实际用 a = 20。上方柱子与切分人数来自 kuairank docs/eda_output.md、EDA.zh-CN.md §1。`}
    >
      <div className="viz-controls">
        <Tabs ariaLabel="统计规则" value={mode} onChange={setMode} options={FEATURE_MODES} />
        <Slider label="选一条 test 样本" value={idx} min={0} max={samples.length - 1} step={1} onChange={setIdx} display={`${idx + 1} / ${samples.length}`} id="pit-sample" />
        <button type="button" className="viz-btn" onClick={reset}>重置</button>
      </div>

      <Figure width={W} height={H} label={`样本在 ${DAY_LABELS[day]}，${FEATURE_MODES.find((m) => m.key === mode)?.label}：数了 ${f.n} 次曝光，特征 ${f.value.toFixed(3)}`}>
        {STANDARD_DAILY.map((n, d) => {
          const h = ((BAR_BOTTOM - BAR_TOP) * n) / maxDaily;
          return <rect key={d} x={x(d) + 1.5} y={BAR_BOTTOM - h} width={x(d + 1) - x(d) - 3} height={h} fill={SPLIT_COLOR[splitOfDay(d)]} opacity={0.75} />;
        })}
        {(["train", "valid", "test"] as const).map((sp) => {
          const days = STANDARD_DAILY.map((_, d) => d).filter((d) => splitOfDay(d) === sp);
          const mid = (x(days[0]) + x(days[days.length - 1] + 1)) / 2;
          return (
            <text key={sp} x={mid} y={16} fontSize={11.5} textAnchor="middle" fill={SPLIT_COLOR[sp]} fontWeight={600}>
              {SPLIT_NAME[sp]} {fmt(totals[sp])}
            </text>
          );
        })}
        <line x1={x(RANDOM_FIRST_DAY)} y1={BAR_BOTTOM + 8} x2={x(31)} y2={BAR_BOTTOM + 8} stroke="var(--v3)" strokeWidth={3} />
        <text x={x(RANDOM_FIRST_DAY)} y={BAR_BOTTOM + 22} fontSize={11} fill="var(--v3)" fontWeight={600}>
          随机曝光 {fmt(totals.randomValid + totals.randomTest)} 条：4/22 起单独成为无偏测试集
        </text>
        {[0, 7, 14, 21, 28].map((d) => (
          <text key={d} x={x(d)} y={BAR_BOTTOM + 22} fontSize={10.5} textAnchor="middle" fill="#76796f" opacity={d >= RANDOM_FIRST_DAY ? 0 : 1}>
            {DAY_LABELS[d]}
          </text>
        ))}
        <text x={x(0)} y={ROW0 - 18} fontSize={11} fill="#76796f">玩具：8 支视频的曝光（同一竖线上的点属于同一个请求）</text>

        {/* allowed region: strictly before t */}
        <rect x={X0} y={ROW0 - 10} width={Math.max(0, x(s.t) - X0)} height={ROW_H * TOY_VIDEOS.length + 4} fill="var(--v1)" opacity={0.06} style={{ transition: "width .3s" }} />
        {TOY_VIDEOS.map((v, r) => (
          <g key={v.video}>
            <line x1={X0} y1={ROW0 + r * ROW_H} x2={X1} y2={ROW0 + r * ROW_H} stroke="#e4dfcb" />
            <text x={X0 - 6} y={ROW0 + r * ROW_H + 4} fontSize={10.5} textAnchor="end" fill={v.video === s.video ? "#3b4234" : "#9a9c8d"} fontWeight={v.video === s.video ? 700 : 400}>
              v{v.video + 1}
            </text>
          </g>
        ))}
        {rows.map((r) => {
          const on = used.has(r.id);
          const self = r.id === s.id;
          const future = r.t > s.t || self;
          const color = on ? (future ? "var(--vcrit)" : "var(--v1)") : "#9a9c8d";
          return (
            <circle
              key={r.id}
              cx={x(r.t)}
              cy={ROW0 + r.video * ROW_H}
              r={on ? 4.6 : 3.6}
              fill={r.click ? color : "#fff"}
              stroke={color}
              strokeWidth={1.5}
              opacity={on || self ? 1 : 0.4}
              style={{ transition: "opacity .25s, r .25s" }}
            />
          );
        })}
        <circle cx={x(s.t)} cy={ROW0 + s.video * ROW_H} r={8.5} fill="none" stroke="#3b4234" strokeWidth={2} />
        <line x1={x(s.t)} y1={ROW0 - 12} x2={x(s.t)} y2={ROW0 + ROW_H * (TOY_VIDEOS.length - 1) + 10} stroke="#3b4234" strokeDasharray="4 3" style={{ transition: "x1 .3s, x2 .3s" }} />
        <text x={Math.min(x(s.t) + 5, X1 - 40)} y={ROW0 - 12} fontSize={11} fill="#3b4234" fontWeight={600}>t</text>
      </Figure>
      <div className="viz-legend">
        <span><i style={{ background: "var(--v1)" }} />被计入、且早于 t</span>
        <span><i style={{ background: "var(--vcrit)" }} />被计入、但不早于 t（本条或未来）</span>
        <span><i style={{ background: "#fff", border: "1.5px solid #9a9c8d" }} />没被计入</span>
      </div>

      <div className="viz-stat" style={{ marginTop: 12 }}>
        <div><small>本条 label</small><b>{s.click ? "点了" : "没点"}</b></div>
        <div><small>计入曝光 / 点击</small><b>{f.n}</b><span className="delta">/ {f.clicks}</span></div>
        <div><small>特征值</small><b>{f.value.toFixed(3)}</b></div>
        {FEATURE_MODES.map((m) => (
          <div key={m.key} style={{ opacity: m.key === mode ? 1 : 0.55 }}>
            <small>{m.label} 的 test AUC</small>
            <b>{aucs[m.key].toFixed(3)}</b>
          </div>
        ))}
      </div>

      <div className={`viz-narr ${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}
