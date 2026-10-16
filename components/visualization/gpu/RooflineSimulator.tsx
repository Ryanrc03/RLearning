"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

const C1 = "#2a78d6";
const C2 = "#eb6834";
const GREY = "#efede4";
const LINE = "#76796f";
const INK = "#3b4234";
const BAD = "#d03b3b";

// NVIDIA L40S spec sheet values, FP32 without tensor cores.
const PEAK = 91.6e12; // FLOP/s
const BW = 864e9; // B/s
const RIDGE = PEAK / BW;

type Task = { id: string; label: string; ai: number; flops: number; bytes: number; desc: string };
const gemm = (n: number): Task => ({ id: `g${n}`, label: `矩阵乘 N=${n}`, ai: n / 6, flops: 2 * n ** 3, bytes: 12 * n ** 2, desc: `${n}×${n} 矩阵相乘` });
const TASKS: Task[] = [
  { id: "vadd", label: "数组相加", ai: 1 / 12, flops: 1e8, bytes: 12e8, desc: "1 亿个元素的数组相加" },
  gemm(64),
  gemm(256),
  gemm(1024),
  gemm(4096),
];

const attainable = (ai: number) => Math.min(PEAK, ai * BW);

// Chart frame: log10(AI) in [-2, 4], log10(FLOP/s) in [10, 14].
const X0 = 70;
const X1 = 570;
const Y0 = 200;
const Y1 = 26;
const sx = (ai: number) => X0 + ((Math.log10(ai) + 2) / 6) * (X1 - X0);
const sy = (f: number) => Y0 - ((Math.log10(f) - 10) / 4) * (Y0 - Y1);

function rate(f: number) {
  return f >= 1e12 ? `${(f / 1e12).toFixed(1)} TFLOP/s` : `${(f / 1e9).toFixed(0)} GFLOP/s`;
}

export default function RooflineSimulator() {
  const [id, setId] = useState("vadd");
  const task = TASKS.find((t) => t.id === id)!;
  const perf = attainable(task.ai);
  const memBound = task.ai < RIDGE;
  const tMem = task.bytes / BW;
  const tComp = task.flops / PEAK;
  const share = (perf / PEAK) * 100;

  const narr = memBound
    ? `${task.desc}：每字节 ${task.ai < 1 ? task.ai.toFixed(2) : task.ai.toFixed(1)} 次运算，落在斜线上，是 memory-bound。搬数据的时间是计算时间的 ${(tMem / tComp).toFixed(tMem / tComp < 10 ? 1 : 0)} 倍，计算单元大部分时间在等数据，只能用到峰值算力的 ${share < 1 ? share.toFixed(2) : share.toFixed(0)}%。`
    : `${task.desc}：每字节 ${task.ai.toFixed(0)} 次运算，已经越过拐点（约 ${RIDGE.toFixed(0)}），碰到了平顶，是 compute-bound。计算时间是搬数据时间的 ${(tComp / tMem).toFixed(1)} 倍，算力被用满了，N 再大吞吐也不会再涨。`;

  const roof = `M${sx(1e10 / BW)},${sy(1e10)} L${sx(RIDGE)},${sy(PEAK)} L${sx(1e4)},${sy(PEAK)}`;

  return (
    <VisualizationFrame
      title="模拟实验：同一块 GPU 上的两类任务"
      description="选一个任务。上面是 roofline 图（两个轴都是对数刻度）：横轴是每字节能算几次，纵轴是能达到的吞吐。下面是这个任务搬数据和计算各要多久。"
      footnote={`模拟参数：L40S 标称的 FP32 峰值 91.6 TFLOP/s、显存带宽 864 GB/s，拐点约 ${RIDGE.toFixed(0)} 次/字节。矩阵乘按“每个数只从显存搬一次”的理想情况计算，这需要 tiling 才能做到（下一页）。数字是估算，不是实测。`}
    >
      <div className="viz-controls">
        <span className="viz-k">任务</span>
        {TASKS.map((t) => (
          <button key={t.id} type="button" className={`viz-btn${id === t.id ? " is-on" : ""}`} onClick={() => setId(t.id)}>{t.label}</button>
        ))}
      </div>
      <div className="viz-scroll">
        <svg viewBox="0 0 600 320" role="img" aria-label={narr}>
          {[1e10, 1e11, 1e12, 1e13, 1e14].map((f) => (
            <g key={f}>
              <line x1={X0} y1={sy(f)} x2={X1} y2={sy(f)} stroke="#ece8d8" />
              <text x={X0 - 6} y={sy(f) + 3} fontSize={9} textAnchor="end" fill={LINE}>{f >= 1e12 ? `${f / 1e12} T` : `${f / 1e9} G`}</text>
            </g>
          ))}
          {[0.01, 0.1, 1, 10, 100, 1000, 10000].map((a) => (
            <text key={a} x={sx(a)} y={Y0 + 14} fontSize={9} textAnchor="middle" fill={LINE}>{a < 1 ? a : a.toLocaleString()}</text>
          ))}
          <line x1={X0} y1={Y0} x2={X1} y2={Y0} stroke={LINE} />
          <line x1={X0} y1={Y0} x2={X0} y2={Y1 - 6} stroke={LINE} />
          <text x={X0} y={Y1 - 12} fontSize={9} fill={LINE}>吞吐（FLOP/s）</text>
          <text x={X1} y={Y0 + 28} fontSize={9} textAnchor="end" fill={LINE}>每搬 1 字节能算几次 →</text>

          <path d={roof} fill="none" stroke={INK} strokeWidth={2} />
          <text x={sx(0.3)} y={sy(attainable(0.3)) - 10} fontSize={9.5} fill={INK} transform={`rotate(-30 ${sx(0.3)} ${sy(attainable(0.3)) - 10})`}>斜线：被带宽卡住</text>
          <text x={sx(1500)} y={sy(PEAK) - 8} fontSize={9.5} textAnchor="middle" fill={INK}>平顶：被算力卡住</text>
          <line x1={sx(RIDGE)} y1={sy(PEAK)} x2={sx(RIDGE)} y2={Y0} stroke={LINE} strokeDasharray="3 3" />
          <text x={sx(RIDGE) + 4} y={Y0 - 6} fontSize={9} fill={LINE}>{`拐点 ≈ ${RIDGE.toFixed(0)}`}</text>

          {TASKS.map((t) => {
            const on = t.id === id;
            return (
              <g key={t.id}>
                <circle cx={sx(t.ai)} cy={sy(attainable(t.ai))} r={on ? 6 : 4} fill={t.id === "vadd" ? C1 : C2} opacity={on ? 1 : 0.35} stroke="#fff" strokeWidth={2} />
                {on && <text x={sx(t.ai) + (t.ai > 300 ? -10 : 10)} y={sy(attainable(t.ai)) + (t.ai > 100 ? 18 : -10)} fontSize={10} textAnchor={t.ai > 300 ? "end" : "start"} fill={INK} fontWeight={600}>{`${t.label}：${rate(perf)}`}</text>}
              </g>
            );
          })}

          <text x={14} y={250} fontSize={10.5} fontWeight={600} fill={INK}>{`${task.desc}：两件事各要多久（线性刻度）`}</text>
          {[
            { label: "搬数据", t: tMem, color: C1, bottleneck: memBound },
            { label: "计算", t: tComp, color: C2, bottleneck: !memBound },
          ].map((row, i) => {
            const w = (row.t / Math.max(tMem, tComp)) * 380;
            return (
              <g key={row.label} transform={`translate(14 ${262 + i * 26})`}>
                <text x={44} y={12} fontSize={10} textAnchor="end" fill={INK}>{row.label}</text>
                <rect x={52} width={380} height={16} rx={3} fill={GREY} />
                <rect x={52} width={Math.max(w, 2)} height={16} rx={3} fill={row.color} opacity={0.8} />
                <text x={440} y={12} fontSize={10} fill={row.bottleneck ? BAD : INK}>{row.bottleneck ? "← 瓶颈，决定总耗时" : "可以和另一件事重叠"}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className={`viz-narr${memBound ? " is-warn" : " is-good"}`}>{narr}</div>
    </VisualizationFrame>
  );
}
