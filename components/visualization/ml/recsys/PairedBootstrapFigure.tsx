"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Slider from "@/components/visualization/ml/primitives/Slider";
import { type Interval, PAIRED_USERS, pairedToyIntervals, REAL_RANDOM_CI } from "@/lib/ml/gauc";

// Recommender Systems: two models' own bootstrap intervals overlap even when one
// is better for almost every user; resampling users once and differencing per
// user cancels the user-to-user spread. Top rows: an 80-user toy with a true
// gain δ; bottom rows: kuairank's real random-set numbers (runs #5 and #9).

const W = 720;
const H = 290;
const L0 = 130;
const L1 = 440;
const R0 = 500;
const R1 = 700;
const LD: [number, number] = [0.55, 0.7];
const RD: [number, number] = [-0.01, 0.04];
const lx = (v: number) => L0 + ((v - LD[0]) / (LD[1] - LD[0])) * (L1 - L0);
const rx = (v: number) => R0 + ((v - RD[0]) / (RD[1] - RD[0])) * (R1 - R0);
const C_A = "var(--v1)";
const C_B = "var(--v2)";
const C_D = "var(--v3)";

function Bar({ iv, y, sx, color, label, digits = 3, signed }: { iv: Interval; y: number; sx: (v: number) => number; color: string; label: string; digits?: number; signed?: boolean }) {
  const f = (v: number) => `${signed && v > 0 ? "+" : ""}${v.toFixed(digits)}`;
  return (
    <g>
      <text x={sx === lx ? L0 - 8 : R0 - 8} y={y + 4} fontSize={11} textAnchor="end" fill="#3b4234">{label}</text>
      <line x1={sx(iv.lo)} y1={y} x2={sx(iv.hi)} y2={y} stroke={color} strokeWidth={6} strokeLinecap="round" opacity={0.35} style={{ transition: "x1 .3s, x2 .3s" }} />
      <circle cx={sx(iv.point)} cy={y} r={4.5} fill={color} style={{ transition: "cx .3s" }} />
      <text x={sx(iv.point)} y={y - 9} fontSize={10.5} textAnchor="middle" fill={color} className="mono">
        {f(iv.point)} [{f(iv.lo)}, {f(iv.hi)}]
      </text>
    </g>
  );
}

function Axis({ y, ticks, sx, fmt }: { y: number; ticks: number[]; sx: (v: number) => number; fmt: (v: number) => string }) {
  return (
    <g>
      <line x1={sx(ticks[0])} y1={y} x2={sx(ticks[ticks.length - 1])} y2={y} stroke="#cfcab4" />
      {ticks.map((t) => (
        <text key={t} x={sx(t)} y={y + 13} fontSize={10} textAnchor="middle" fill="#76796f">{fmt(t)}</text>
      ))}
    </g>
  );
}

export default function PairedBootstrapFigure() {
  const [delta, setDelta] = useState(0.0075);
  const r = useMemo(() => pairedToyIntervals(delta), [delta]);
  const overlap = r.a.hi > r.b.lo;
  const sig = r.diff.lo > 0;
  const real = REAL_RANDOM_CI;

  let tone = "is-good";
  let narr = `δ = ${delta.toFixed(4)}：A 和 B 各自的区间宽约 ±${((r.a.hi - r.a.lo) / 2).toFixed(3)}，${overlap ? "仍然大面积重叠，看区间会说「分不出来」" : "已经分开"}；配对差值的区间是 [${r.diff.lo.toFixed(4)}, ${r.diff.hi.toFixed(4)}]，${sig ? "整个在 0 的右边：B 对几乎每个用户都更好，这个差是真的。" : "还跨着 0。"}`;
  if (!sig) {
    tone = "is-warn";
    narr = `δ = ${delta.toFixed(4)}：配对区间 [${r.diff.lo.toFixed(4)}, ${r.diff.hi.toFixed(4)}] 跨过 0，说不出 B 更好。两个模型各自的区间宽约 ±${((r.a.hi - r.a.lo) / 2).toFixed(3)}，大部分来自「用户和用户本来就不一样」，配对把这部分抵掉了。往右拖。`;
  }

  return (
    <VisualizationFrame
      title="两个区间重叠不等于没差别：配对用户 bootstrap"
      description={`上半是玩具：${PAIRED_USERS} 个用户，各自 AUC 差别很大（标准差 0.1），模型 B 在每个用户上平均比 A 高 δ。下半是 kuairank 在随机曝光集上的真实数字。左边是各自重采样用户得到的 GAUC 区间，右边是同一批重采样用户上两个模型差值的区间。`}
      footnote="区间都是按用户重采样 1,000 次的 2.5% / 97.5% 分位。真实数字来自 kuairank docs/EXPERIMENT_LOG.md：#5 LightGBM F1、#9 DCN-v2 F1，is_click，random 集；配对差值由 kurec/compare.py 计算。"
    >
      <div className="viz-controls">
        <Slider label="δ：B 比 A 每个用户平均高多少" value={delta} min={0} max={0.03} step={0.0025} onChange={setDelta} display={delta.toFixed(4)} id="pb-delta" />
        <button type="button" className="viz-btn" onClick={() => setDelta(0.0075)}>重置</button>
      </div>
      <Figure width={W} height={H} label={`玩具配对差值区间 [${r.diff.lo.toFixed(4)}, ${r.diff.hi.toFixed(4)}]；真实 DCN-v2 减 LightGBM +0.0073 [+0.0012, +0.0131]`}>
        <text x={L0} y={16} fontSize={11.5} fontWeight={600} fill="#3b4234">各自的 GAUC 区间</text>
        <text x={R0} y={16} fontSize={11.5} fontWeight={600} fill="#3b4234">配对差值 B − A</text>
        <line x1={rx(0)} y1={26} x2={rx(0)} y2={H - 24} stroke="#3b4234" strokeDasharray="4 3" opacity={0.6} />
        <text x={rx(0) + 4} y={34} fontSize={10.5} fill="#3b4234">0</text>

        <text x={8} y={50} fontSize={11} fill="#76796f">玩具</text>
        <Bar iv={r.a} y={62} sx={lx} color={C_A} label="模型 A" />
        <Bar iv={r.b} y={100} sx={lx} color={C_B} label="模型 B" />
        <Bar iv={r.diff} y={81} sx={rx} color={C_D} label="B − A" digits={4} signed />
        <Axis y={118} ticks={[0.55, 0.6, 0.65, 0.7]} sx={lx} fmt={(v) => v.toFixed(2)} />
        <Axis y={118} ticks={[-0.01, 0, 0.01, 0.02, 0.03, 0.04]} sx={rx} fmt={(v) => v.toFixed(2)} />

        <line x1={8} y1={148} x2={W - 8} y2={148} stroke="#eceadc" />
        <text x={8} y={172} fontSize={11} fill="#76796f">kuairank 真实</text>
        <Bar iv={real.lightgbm} y={186} sx={lx} color={C_A} label="LightGBM #5" />
        <Bar iv={real.dcnv2} y={226} sx={lx} color={C_B} label="DCN-v2 #9" />
        <Bar iv={real.diff} y={206} sx={rx} color={C_D} label="DCN − LGBM" digits={4} signed />
        <Axis y={246} ticks={[0.55, 0.6, 0.65, 0.7]} sx={lx} fmt={(v) => v.toFixed(2)} />
        <Axis y={246} ticks={[-0.01, 0, 0.01, 0.02, 0.03, 0.04]} sx={rx} fmt={(v) => v.toFixed(2)} />
        <text x={L0} y={H - 6} fontSize={10.5} fill="#76796f">random 集：849 个用户、43,027 条曝光，每人中位 22 条</text>
      </Figure>
      <div className={`viz-narr ${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}
