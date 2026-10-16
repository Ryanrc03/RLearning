"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Action = "none" | "small" | "large";

const C1 = "#2a78d6";
const C2 = "#eb6834";
const C3 = "#1baf7a";
const LINE = "#76796f";
const INK = "#3b4234";
const BAD = "#d03b3b";

type Seg = { label: string; t: number; color: string; gap?: boolean };

const SIZES: Record<Action, { gemm: number; ew: number; name: string }> = {
  none: { gemm: 60, ew: 10, name: "中等矩阵" },
  small: { gemm: 30, ew: 6, name: "小矩阵" },
  large: { gemm: 200, ew: 12, name: "大矩阵" },
};
const LAUNCH = 4;

function Timeline({ x, y, w, segs, scale }: { x: number; y: number; w: number; segs: Seg[]; scale: number }) {
  const starts = segs.map((_, i) => segs.slice(0, i).reduce((a, s) => a + s.t, 0));
  return (
    <g transform={`translate(${x} ${y})`}>
      <line x1={0} y1={34} x2={w} y2={34} stroke="#e4dfcb" />
      {segs.map((s, i) => {
        const left = starts[i] * scale;
        const width = Math.max(s.t * scale, 1.5);
        if (s.gap) return <rect key={i} x={left} y={8} width={width} height={22} fill="url(#sf-hatch)" />;
        return (
          <g key={i}>
            <rect x={left} y={8} width={width} height={22} rx={2} fill={s.color} opacity={0.8} />
            {width > 26 && <text x={left + width / 2} y={23} fontSize={9} textAnchor="middle" fill="#fff">{s.label}</text>}
          </g>
        );
      })}
    </g>
  );
}

export default function SeparateVsFusedDiagram() {
  const [action, setAction] = useState<Action>("none");
  const W = 600;
  const H = 220;
  const { gemm, ew, name } = SIZES[action];

  const separate: Seg[] = [
    { label: "GEMM", t: gemm, color: C1 },
    { label: "", t: LAUNCH, color: "", gap: true },
    { label: "bias", t: ew, color: C2 },
    { label: "", t: LAUNCH, color: "", gap: true },
    { label: "ReLU", t: ew, color: C3 },
  ];
  const fused: Seg[] = [
    { label: "GEMM", t: gemm, color: C1 },
    { label: "", t: LAUNCH, color: "", gap: true },
    { label: "bias+ReLU", t: ew, color: C2 },
  ];
  const tSep = separate.reduce((a, s) => a + s.t, 0);
  const tFused = fused.reduce((a, s) => a + s.t, 0);
  const scale = 250 / tSep;
  const speedup = (tSep / tFused).toFixed(2);

  const narr = {
    none: "同一层 MLP：先做矩阵乘 GEMM，再加 bias，再过 ReLU。左边每一步是一个独立的 kernel，中间结果写回显存再读出来；右边把 bias 和 ReLU 合进一个 kernel。斜线是 kernel 启动和显存往返的空档。点上面的按钮。",
    small: `矩阵变小，GEMM 很快就做完了。左边：两次额外的启动和一次额外的显存往返，在总时间里占比很大。右边省掉了它们，快 ${speedup} 倍。实测 512³ 网络、batch 64 时快 1.18 倍。`,
    large: `矩阵变大，GEMM 占了绝大部分时间。左边多出来的那一步几乎看不见了。右边虽然仍然省掉了一次往返，但只快 ${speedup} 倍。实测 2048³ 网络、batch 512 时只快 1.08 倍。`,
  }[action];

  return (
    <VisualizationFrame
      title="Separate Kernels vs Fused Kernel：省掉的那一次往返值多少"
      description="两边算的是同一层：GEMM → bias → ReLU。点按钮改变矩阵大小，看合并 kernel 省下的时间占比怎么变。"
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${action === "small" ? " is-on" : ""}`} onClick={() => setAction("small")}>矩阵变小</button>
        <button type="button" className={`viz-btn${action === "large" ? " is-on" : ""}`} onClick={() => setAction("large")}>矩阵变大</button>
        <button type="button" className="viz-btn" onClick={() => setAction("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={narr}>
          <defs>
            <pattern id="sf-hatch" width={4} height={4} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width={4} height={4} fill="#fff" />
              <line x1={0} y1={0} x2={0} y2={4} stroke={BAD} strokeWidth={1.5} />
            </pattern>
          </defs>

          <text x={145} y={14} fontSize={11} fontWeight={600} textAnchor="middle" fill={INK}>三个独立的 kernel</text>
          <text x={20} y={40} fontSize={9.5} fill={LINE}>{name}：时间从左往右</text>
          <Timeline x={20} y={48} w={250} segs={separate} scale={scale} />
          <text x={20} y={110} fontSize={10} fill={INK}>kernel 启动：3 次</text>
          <text x={20} y={128} fontSize={10} fill={BAD}>中间结果写回显存再读出：2 次</text>
          <text x={20} y={156} fontSize={10.5} fill={INK}>总耗时：<tspan className="mono">{tSep}</tspan></text>

          <line x1={300} y1={10} x2={300} y2={200} stroke="#e4dfcb" strokeDasharray="3 3" />

          <text x={455} y={14} fontSize={11} fontWeight={600} textAnchor="middle" fill={INK}>bias 和 ReLU 合成一个 kernel</text>
          <text x={330} y={40} fontSize={9.5} fill={LINE}>{name}：同一把时间尺</text>
          <Timeline x={330} y={48} w={250} segs={fused} scale={scale} />
          <text x={330} y={110} fontSize={10} fill={INK}>kernel 启动：2 次</text>
          <text x={330} y={128} fontSize={10} fill={INK}>中间结果写回显存再读出：1 次</text>
          <text x={330} y={156} fontSize={10.5} fill={INK}>
            总耗时：<tspan className="mono">{tFused}</tspan>
            <tspan fill="#087a08">{`（快 ${speedup} 倍）`}</tspan>
          </text>
          <text x={300} y={190} fontSize={9} textAnchor="middle" fill={LINE}>时间单位是示意值；实测加速比写在下方说明里</text>
        </svg>
      </div>
      <div className={`viz-narr${action === "small" ? " is-good" : action === "large" ? " is-warn" : ""}`}>{narr}</div>
    </VisualizationFrame>
  );
}
