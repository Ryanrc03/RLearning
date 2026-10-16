"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Action = "none" | "wideInput" | "wideHidden";

const C1 = "#2a78d6";
const C2 = "#eb6834";
const LINE = "#76796f";
const INK = "#3b4234";

const CASES: Record<Action, { fin: number; h: number; data: string; speedup: string }> = {
  none: { fin: 1433, h: 64, data: "Cora", speedup: "2.14" },
  wideInput: { fin: 3703, h: 64, data: "Citeseer", speedup: "3.40" },
  wideHidden: { fin: 1433, h: 256, data: "Cora", speedup: "1.52" },
};

const MAT_H = 70;
const TOP = 58;
const px = (w: number) => 6 + (w / 3703) * 80;

function Mat({ x, w, label, spmm }: { x: number; w: number; label: string; spmm?: boolean }) {
  const width = px(w);
  return (
    <g transform={`translate(${x} ${TOP})`}>
      <rect width={width} height={MAT_H} rx={2} fill={spmm ? C2 : C1} opacity={spmm ? 0.35 : 0.2} stroke={spmm ? C2 : C1} strokeWidth={spmm ? 2 : 1} />
      <text x={width / 2} y={MAT_H + 14} fontSize={9.5} textAnchor="middle" fill={INK}>{label}</text>
      <text x={width / 2} y={MAT_H + 26} fontSize={9} className="mono" textAnchor="middle" fill={LINE}>{`宽 ${w}`}</text>
    </g>
  );
}

function Op({ x, top, bottom, spmm }: { x: number; top: string; bottom: string; spmm?: boolean }) {
  return (
    <g transform={`translate(${x} ${TOP + MAT_H / 2})`}>
      <text x={17} y={-12} fontSize={10} textAnchor="middle" fill={spmm ? C2 : INK} fontWeight={600}>{top}</text>
      <line x1={4} y1={0} x2={28} y2={0} stroke={LINE} strokeWidth={1.2} markerEnd="url(#ap-arr)" />
      <text x={17} y={14} fontSize={8.5} textAnchor="middle" fill={LINE}>{bottom}</text>
    </g>
  );
}

function Flow({ x, steps }: { x: number; steps: ({ kind: "mat"; w: number; label: string; spmm?: boolean } | { kind: "op"; top: string; bottom: string; spmm?: boolean })[] }) {
  const width = (s: (typeof steps)[number]) => (s.kind === "mat" ? px(s.w) : 34);
  const starts = steps.map((_, i) => x + steps.slice(0, i).reduce((a, s) => a + width(s), 0));
  return (
    <g>
      {steps.map((s, i) => {
        const at = starts[i];
        if (s.kind === "mat") return <Mat key={i} x={at} w={s.w} label={s.label} spmm={s.spmm} />;
        return <Op key={i} x={at} top={s.top} bottom={s.bottom} spmm={s.spmm} />;
      })}
    </g>
  );
}

export default function AggregateVsProjectFirstDiagram() {
  const [action, setAction] = useState<Action>("none");
  const W = 600;
  const H = 220;
  const { fin, h, data, speedup } = CASES[action];
  const ratio = (fin / h).toFixed(1);

  const narr = {
    none: `GCN 的一层要算 Â·H·W：Â 是稀疏的邻接矩阵，H 是节点特征（宽 ${fin}），W 把特征压到 hidden 宽度（${h}）。两种顺序的 GEMM 一样大，差别只在 SpMM 处理的矩阵有多宽（橙色）。左边要处理宽 ${fin} 的矩阵，右边只要处理宽 ${h} 的，差 ${ratio} 倍。实测 ${data} 上先降维快 ${speedup} 倍。`,
    wideInput: `输入特征从 1433 维变成 3703 维（从 Cora 换成 Citeseer）。左边 SpMM 要处理的宽度跟着变成 3703；右边先乘 W，SpMM 仍然只处理宽 64，完全不受影响。差距从 22 倍拉大到 ${ratio} 倍，实测加速比从 2.14 倍升到 ${speedup} 倍。`,
    wideHidden: `hidden 从 64 变成 256（仍是 Cora）。左边 SpMM 的宽度不变；右边 SpMM 要处理的宽度变成 256，先降维压缩得没那么狠了。差距从 22 倍缩小到 ${ratio} 倍，实测加速比从 2.14 倍降到 ${speedup} 倍。`,
  }[action];

  return (
    <VisualizationFrame
      title="Aggregate-first vs Project-first：稀疏乘法处理多宽"
      description="两边算的是同一个 Â·H·W，只是结合顺序不同。矩形的宽度代表特征维度。点按钮，看 SpMM（橙色）要处理的宽度怎么变。"
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${action === "wideInput" ? " is-on" : ""}`} onClick={() => setAction("wideInput")}>输入特征维度变大</button>
        <button type="button" className={`viz-btn${action === "wideHidden" ? " is-on" : ""}`} onClick={() => setAction("wideHidden")}>hidden 变大</button>
        <button type="button" className="viz-btn" onClick={() => setAction("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={narr}>
          <defs>
            <marker id="ap-arr" viewBox="0 0 6 6" refX={5} refY={3} markerWidth={6} markerHeight={6} orient="auto"><path d="M0 0 L6 3 L0 6 z" fill={LINE} /></marker>
          </defs>

          <text x={145} y={14} fontSize={11} fontWeight={600} textAnchor="middle" fill={INK}>(ÂH)W：先聚合</text>
          <Flow
            x={14}
            steps={[
              { kind: "mat", w: fin, label: "H", spmm: true },
              { kind: "op", top: "Â ×", bottom: "SpMM", spmm: true },
              { kind: "mat", w: fin, label: "ÂH" },
              { kind: "op", top: "× W", bottom: "GEMM" },
              { kind: "mat", w: h, label: "输出" },
            ]}
          />
          <text x={14} y={192} fontSize={10.5} fill={INK}>SpMM 处理的宽度：<tspan className="mono" fill={C2}>{fin}</tspan></text>

          <line x1={300} y1={10} x2={300} y2={210} stroke="#e4dfcb" strokeDasharray="3 3" />

          <text x={455} y={14} fontSize={11} fontWeight={600} textAnchor="middle" fill={INK}>Â(HW)：先降维</text>
          <Flow
            x={324}
            steps={[
              { kind: "mat", w: fin, label: "H" },
              { kind: "op", top: "× W", bottom: "GEMM" },
              { kind: "mat", w: h, label: "HW", spmm: true },
              { kind: "op", top: "Â ×", bottom: "SpMM", spmm: true },
              { kind: "mat", w: h, label: "输出" },
            ]}
          />
          <text x={324} y={192} fontSize={10.5} fill={INK}>
            SpMM 处理的宽度：<tspan className="mono" fill={C2}>{h}</tspan>
            <tspan fill="#087a08">{`（实测快 ${speedup} 倍）`}</tspan>
          </text>
        </svg>
      </div>
      <div className={`viz-narr${action === "wideInput" ? " is-good" : action === "wideHidden" ? " is-warn" : ""}`}>{narr}</div>
    </VisualizationFrame>
  );
}
