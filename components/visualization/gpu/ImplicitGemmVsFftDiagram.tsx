"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Action = "none" | "batch" | "kernel";

const C1 = "#2a78d6";
const C2 = "#eb6834";
const GREY = "#efede4";
const LINE = "#76796f";
const INK = "#3b4234";
const BAD = "#d03b3b";

const WS_MAX = 7; // MB, axis for the workspace bar
const WORK_MAX = 121; // relative work units, axis for the per-output work bar
const BAR_W = 170;

function Pipe({ x, y, boxes }: { x: number; y: number; boxes: { label: string; w: number; color: string }[] }) {
  const starts = boxes.map((_, i) => boxes.slice(0, i).reduce((a, b) => a + b.w + 12, 0));
  return (
    <g transform={`translate(${x} ${y})`}>
      {boxes.map((b, i) => {
        const at = starts[i];
        return (
          <g key={i}>
            <rect x={at} y={0} width={b.w} height={26} rx={4} fill={b.color} opacity={0.22} />
            <text x={at + b.w / 2} y={17} fontSize={9.5} textAnchor="middle" fill={INK}>{b.label}</text>
            {i < boxes.length - 1 && <line x1={at + b.w + 1} y1={13} x2={at + b.w + 10} y2={13} stroke={LINE} markerEnd="url(#if-arr)" />}
          </g>
        );
      })}
    </g>
  );
}

function Meter({ x, y, label, value, max, text, color, hot }: { x: number; y: number; label: string; value: number; max: number; text: string; color: string; hot?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <text x={0} y={-5} fontSize={9.5} fill={LINE}>{label}</text>
      <rect width={BAR_W} height={16} rx={3} fill={GREY} />
      <rect width={Math.max((value / max) * BAR_W, value > 0 ? 2 : 0)} height={16} rx={3} fill={color} opacity={0.75} />
      <text x={BAR_W + 8} y={12} fontSize={10} className="mono" fill={hot ? BAD : INK}>{text}</text>
    </g>
  );
}

export default function ImplicitGemmVsFftDiagram() {
  const [action, setAction] = useState<Action>("none");
  const W = 600;
  const H = 210;
  const batch = action === "batch" ? 128 : 64;
  const k = action === "kernel" ? 11 : 5;
  const fftWs = batch === 128 ? 6.69 : 3.34;
  const gemmWork = k * k;
  const fftWork = k === 11 ? 45 : 40;

  const narr = {
    none: "两边都是 cuDNN 在算同一个卷积（batch 64，5×5 卷积核）。左边 implicit GEMM 边读输入边按矩阵乘的方式算，不需要额外显存。右边 FFT 先把输入和卷积核变换到频域，逐点相乘后再变回来，中间结果要放在一块 workspace 里。点上面的按钮。",
    batch: "batch 从 64 变成 128。左边：workspace 仍然是 0。右边：要同时变换的输入多了一倍，workspace 从 3.3 MB 涨到 6.7 MB。这两个数字都是 exp6 在 V100 上实测的。",
    kernel: "卷积核从 5×5 变成 11×11（概念演示，LeNet 只用了 5×5）。左边：每个输出要乘加的次数按 k² 增长，从 25 次变成 121 次。右边：频域里卷积变成逐点乘，计算量几乎不随卷积核变大，FFT 开始占优。",
  }[action];

  return (
    <VisualizationFrame
      title="Implicit GEMM vs FFT：用额外显存换计算"
      description="两边是 cuDNN 的两种卷积算法，算的是同一个卷积。点按钮，看 workspace 和计算量分别怎么变。"
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${action === "batch" ? " is-on" : ""}`} onClick={() => setAction("batch")}>batch 翻倍</button>
        <button type="button" className={`viz-btn${action === "kernel" ? " is-on" : ""}`} onClick={() => setAction("kernel")}>卷积核变大</button>
        <button type="button" className="viz-btn" onClick={() => setAction("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={narr}>
          <defs>
            <marker id="if-arr" viewBox="0 0 6 6" refX={5} refY={3} markerWidth={6} markerHeight={6} orient="auto"><path d="M0 0 L6 3 L0 6 z" fill={LINE} /></marker>
          </defs>

          <text x={145} y={14} fontSize={11} fontWeight={600} textAnchor="middle" fill={INK}>implicit GEMM</text>
          <Pipe x={14} y={28} boxes={[{ label: "输入", w: 52, color: C1 }, { label: "边读边按矩阵乘算", w: 126, color: C1 }, { label: "输出", w: 52, color: C1 }]} />
          <Meter x={14} y={96} label={`workspace（batch ${batch}）`} value={0} max={WS_MAX} text="0 B" color={C1} />
          <Meter x={14} y={146} label={`每个输出的计算量（${k}×${k}，示意）`} value={gemmWork} max={WORK_MAX} text={`${gemmWork}`} color={C1} hot={k === 11} />

          <line x1={300} y1={10} x2={300} y2={200} stroke="#e4dfcb" strokeDasharray="3 3" />

          <text x={455} y={14} fontSize={11} fontWeight={600} textAnchor="middle" fill={INK}>FFT</text>
          <Pipe x={324} y={28} boxes={[{ label: "输入", w: 40, color: C2 }, { label: "FFT", w: 40, color: C2 }, { label: "逐点乘", w: 46, color: C2 }, { label: "IFFT", w: 40, color: C2 }, { label: "输出", w: 40, color: C2 }]} />
          <Meter x={324} y={96} label={`workspace（batch ${batch}）`} value={fftWs} max={WS_MAX} text={`${fftWs} MB`} color={C2} hot={batch === 128} />
          <Meter x={324} y={146} label={`每个输出的计算量（${k}×${k}，示意）`} value={fftWork} max={WORK_MAX} text={`${fftWork}`} color={C2} />
          <text x={300} y={196} fontSize={9} textAnchor="middle" fill={LINE}>workspace 是实测值；计算量是相对示意值</text>
        </svg>
      </div>
      <div className={`viz-narr${action === "batch" ? " is-warn" : action === "kernel" ? " is-good" : ""}`}>{narr}</div>
    </VisualizationFrame>
  );
}
