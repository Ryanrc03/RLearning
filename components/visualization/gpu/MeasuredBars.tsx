"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Series = { name: string; color: string };
type Group = { label: string; values: number[] };

type MeasuredBarsProps = {
  title: string;
  description?: string;
  footnote?: string;
  series: Series[];
  groups: Group[];
  unit: string;
  decimals?: number;
  /** "higher" when bigger is better (throughput), "lower" when smaller is better (time, memory). */
  better?: "higher" | "lower";
  /** Show "快 x 倍" under each group label, comparing the last series against the first. */
  showRatio?: boolean;
};

const LABEL_W = 132;
const BAR_X = LABEL_W + 8;
const BAR_MAX = 360;
const BAR_H = 12;
const GAP = 2;
const GROUP_PAD = 14;
const INK = "#3b4234";
const MUTED = "#76796f";
const TRACK = "#ece8d8";

// One grouped horizontal bar chart for every measured table in the GPU Kernels notes.
export default function MeasuredBars({ title, description, footnote, series, groups, unit, decimals = 0, better = "higher", showRatio = true }: MeasuredBarsProps) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...groups.flatMap((g) => g.values));
  const groupH = series.length * (BAR_H + GAP) - GAP;
  const height = groups.length * (groupH + GROUP_PAD) + 8;
  const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const ratio = (g: Group) => {
    const a = g.values[0];
    const b = g.values[g.values.length - 1];
    if (a === 0 || b === 0) return null;
    return better === "higher" ? b / a : a / b;
  };
  const active = hover === null ? null : groups[hover];
  const times = (r: number) => (r >= 10 ? r.toFixed(0) : r.toFixed(2));

  return (
    <VisualizationFrame title={title} description={description} footnote={footnote}>
      <div className="viz-legend" style={{ marginTop: 0, marginBottom: 10 }}>
        {series.map((s) => (
          <span key={s.name}><i style={{ background: s.color }} />{s.name}</span>
        ))}
        <span>单位：{unit}</span>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 600 ${height}`} role="img" aria-label={`${title}：${groups.map((g) => `${g.label} ${g.values.map((v, i) => `${series[i].name} ${fmt(v)} ${unit}`).join("，")}`).join("；")}`} onMouseLeave={() => setHover(null)}>
          {groups.map((g, gi) => {
            const y = gi * (groupH + GROUP_PAD) + 4;
            const r = showRatio ? ratio(g) : null;
            return (
              <g key={g.label} transform={`translate(0 ${y})`} onMouseEnter={() => setHover(gi)} style={{ cursor: "default" }}>
                <rect x={0} y={-5} width={600} height={groupH + 10} fill={hover === gi ? "#fbf6e2" : "transparent"} rx={4} />
                <text x={LABEL_W} y={groupH / 2 + (r ? -2 : 4)} fontSize={10.5} textAnchor="end" fill={INK} fontWeight={600}>{g.label}</text>
                {r && <text x={LABEL_W} y={groupH / 2 + 11} fontSize={9.5} textAnchor="end" fill={MUTED}>{`快 ${times(r)} 倍`}</text>}
                {g.values.map((v, si) => {
                  const w = Math.max((v / max) * BAR_MAX, v > 0 ? 2 : 0);
                  const by = si * (BAR_H + GAP);
                  return (
                    <g key={si}>
                      <rect x={BAR_X} y={by} width={BAR_MAX} height={BAR_H} fill={TRACK} opacity={0.5} rx={2} />
                      {v > 0 && <path d={`M${BAR_X} ${by} h${Math.max(w - 4, 0)} a4 4 0 0 1 4 4 v${BAR_H - 8} a4 4 0 0 1 -4 4 h${-Math.max(w - 4, 0)} z`} fill={series[si].color} />}
                      <text x={BAR_X + w + 6} y={by + BAR_H - 2} fontSize={9.5} className="mono" fill={INK}>{fmt(v)}</text>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="viz-narr" style={{ minHeight: 22 }}>
        {active
          ? `${active.label}：${active.values.map((v, i) => `${series[i].name} ${fmt(v)} ${unit}`).join("，")}${showRatio && ratio(active) ? `，快 ${times(ratio(active)!)} 倍` : ""}。`
          : "把鼠标移到某一组上，看这一组的具体数字。"}
      </div>
    </VisualizationFrame>
  );
}
