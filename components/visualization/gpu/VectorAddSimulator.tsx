"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

const C1 = "#2a78d6";
const C2 = "#eb6834";
const GREY = "#efede4";
const LINE = "#76796f";
const INK = "#3b4234";
const GOOD = "#087a08";

// Simple cost model. Vector add moves 12 bytes per element (read A[i], B[i], write C[i]),
// so both sides are limited by memory bandwidth; the GPU also pays a fixed launch cost.
const BYTES = 12;
const CPU_BW = 50e9; // B/s, typical desktop DDR5
const GPU_BW = 864e9; // B/s, NVIDIA L40S spec
const LAUNCH = 5e-6; // s, typical kernel launch overhead
const cpuTime = (n: number) => (n * BYTES) / CPU_BW;
const gpuTime = (n: number) => LAUNCH + (n * BYTES) / GPU_BW;
const CROSS = LAUNCH / (BYTES / CPU_BW - BYTES / GPU_BW);

const SIZES = [10, 1e3, 1e4, 1e5, 1e6, 1e8];
const SIZE_LABEL: Record<number, string> = { 10: "10", 1e3: "1 千", 1e4: "1 万", 1e5: "10 万", 1e6: "100 万", 1e8: "1 亿" };

function fmt(t: number) {
  if (t < 1e-6) return `${(t * 1e9).toFixed(1)} ns`;
  if (t < 1e-3) return `${(t * 1e6).toFixed(t < 1e-5 ? 2 : 1)} µs`;
  return `${(t * 1e3).toFixed(1)} ms`;
}

// Chart frame: log10(N) in [1, 8], log10(t) in [-9, -1].
const X0 = 70;
const X1 = 570;
const Y0 = 190;
const Y1 = 30;
const sx = (n: number) => X0 + ((Math.log10(n) - 1) / 7) * (X1 - X0);
const sy = (t: number) => Y0 - ((Math.log10(t) + 9) / 8) * (Y0 - Y1);

function path(f: (n: number) => number) {
  const pts: string[] = [];
  for (let e = 1; e <= 8.001; e += 0.1) pts.push(`${sx(10 ** e).toFixed(1)},${sy(f(10 ** e)).toFixed(1)}`);
  return `M${pts.join(" L")}`;
}
const CPU_PATH = path(cpuTime);
const GPU_PATH = path(gpuTime);

export default function VectorAddSimulator() {
  const [n, setN] = useState(10);
  const tc = cpuTime(n);
  const tg = gpuTime(n);
  const gpuWins = tg < tc;
  const ratio = gpuWins ? tc / tg : tg / tc;
  const launchShare = LAUNCH / tg;

  const narr = gpuWins
    ? `N = ${SIZE_LABEL[n]}：CPU 要 ${fmt(tc)}，GPU 要 ${fmt(tg)}，GPU 快 ${ratio.toFixed(1)} 倍。` +
      (n >= 1e6 ? "数组越大，GPU 的启动开销越可以忽略，差距最后停在约 17 倍，正好是两边内存带宽之比（864 ÷ 50）。" : "启动开销还占不小的一部分，但已经被大量并行的工作抵掉了。")
    : `N = ${SIZE_LABEL[n]}：CPU 只要 ${fmt(tc)}，GPU 却要 ${fmt(tg)}，CPU 快 ${ratio < 10 ? ratio.toFixed(1) : Math.round(ratio).toLocaleString()} 倍。GPU 的时间里 ${Math.round(launchShare * 100)}% 是启动 kernel 的固定开销，真正干活的时间几乎为零。`;

  return (
    <VisualizationFrame
      title="模拟实验：两个长度为 N 的数组相加"
      description="选一个数组长度 N。上面是两条耗时曲线（两个轴都是对数刻度），下面是选中的 N 下两边的耗时。"
      footnote={`模拟参数：CPU 内存带宽 50 GB/s（台式机 DDR5 的量级），GPU 显存带宽 864 GB/s（L40S 标称值），kernel 启动开销 5 µs，每个元素读 2 个 float、写 1 个 float 共 12 字节。假设数据已经在各自的内存里，不算 CPU 到 GPU 的拷贝。数字是估算，不是实测。`}
    >
      <div className="viz-controls">
        <span className="viz-k">数组长度 N</span>
        {SIZES.map((s) => (
          <button key={s} type="button" className={`viz-btn${n === s ? " is-on" : ""}`} onClick={() => setN(s)}>{SIZE_LABEL[s]}</button>
        ))}
      </div>
      <div className="viz-scroll">
        <svg viewBox="0 0 600 310" role="img" aria-label={narr}>
          <defs>
            <pattern id="va-hatch" width={4} height={4} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width={4} height={4} fill="#fff" />
              <line x1={0} y1={0} x2={0} y2={4} stroke={C2} strokeWidth={1.5} />
            </pattern>
          </defs>

          {/* axes */}
          {[1e-9, 1e-6, 1e-3].map((t) => (
            <g key={t}>
              <line x1={X0} y1={sy(t)} x2={X1} y2={sy(t)} stroke="#ece8d8" />
              <text x={X0 - 6} y={sy(t) + 3} fontSize={9} textAnchor="end" fill={LINE}>{t === 1e-9 ? "1 ns" : t === 1e-6 ? "1 µs" : "1 ms"}</text>
            </g>
          ))}
          {SIZES.map((s) => (
            <text key={s} x={sx(s)} y={Y0 + 14} fontSize={9} textAnchor="middle" fill={s === n ? INK : LINE} fontWeight={s === n ? 600 : 400}>{SIZE_LABEL[s]}</text>
          ))}
          <line x1={X0} y1={Y0} x2={X1} y2={Y0} stroke={LINE} />
          <line x1={X0} y1={Y0} x2={X0} y2={Y1 - 6} stroke={LINE} />
          <text x={X0} y={Y1 - 12} fontSize={9} fill={LINE}>耗时</text>
          <text x={X1} y={Y0 + 28} fontSize={9} textAnchor="end" fill={LINE}>数组长度 N →</text>

          {/* crossover */}
          <line x1={sx(CROSS)} y1={Y1} x2={sx(CROSS)} y2={Y0} stroke={LINE} strokeDasharray="3 3" />
          <text x={sx(CROSS) + 4} y={Y1 + 8} fontSize={9} fill={LINE}>{`交叉点：N ≈ ${(CROSS / 1e4).toFixed(1)} 万`}</text>
          <text x={sx(CROSS) - 6} y={Y1 + 22} fontSize={9} textAnchor="end" fill={C1}>← CPU 更快</text>
          <text x={sx(CROSS) + 4} y={Y1 + 22} fontSize={9} fill={C2}>GPU 更快 →</text>

          <path d={CPU_PATH} fill="none" stroke={C1} strokeWidth={2} />
          <path d={GPU_PATH} fill="none" stroke={C2} strokeWidth={2} />
          <text x={X1 + 8} y={sy(cpuTime(1e8)) + 3} fontSize={9.5} fill={C1}>CPU</text>
          <text x={X1 + 8} y={sy(gpuTime(1e8)) + 3} fontSize={9.5} fill={C2}>GPU</text>
          <text x={sx(30)} y={sy(LAUNCH) - 6} fontSize={9} fill={C2}>GPU 再小也要付 5 µs 启动开销</text>

          <line x1={sx(n)} y1={Y1} x2={sx(n)} y2={Y0} stroke={INK} strokeWidth={1} opacity={0.35} />
          <circle cx={sx(n)} cy={sy(tc)} r={4.5} fill={C1} />
          <circle cx={sx(n)} cy={sy(tg)} r={4.5} fill={C2} />

          {/* bars for the selected N, linear scale */}
          <text x={14} y={240} fontSize={10.5} fontWeight={600} fill={INK}>{`N = ${SIZE_LABEL[n]} 时（线性刻度）`}</text>
          {[
            { label: "CPU", t: tc, color: C1, win: !gpuWins },
            { label: "GPU", t: tg, color: C2, win: gpuWins },
          ].map((row, i) => {
            const max = Math.max(tc, tg);
            const w = (row.t / max) * 400;
            const lw = row.label === "GPU" ? (LAUNCH / max) * 400 : 0;
            return (
              <g key={row.label} transform={`translate(14 ${252 + i * 26})`}>
                <text x={30} y={12} fontSize={10} textAnchor="end" fill={row.color} fontWeight={600}>{row.label}</text>
                <rect x={38} width={400} height={16} rx={3} fill={GREY} />
                {lw > 0 && <rect x={38} width={Math.max(lw, 1.5)} height={16} rx={3} fill="url(#va-hatch)" />}
                <rect x={38 + lw} width={Math.max(w - lw, 1.5)} height={16} rx={3} fill={row.color} opacity={0.8} />
                <text x={446} y={12} fontSize={10} className="mono" fill={row.win ? GOOD : INK}>{`${fmt(row.t)}${row.win ? `（快 ${ratio < 10 ? ratio.toFixed(1) : Math.round(ratio).toLocaleString()} 倍）` : ""}`}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className={`viz-narr${gpuWins ? " is-good" : " is-warn"}`}>{narr}</div>
    </VisualizationFrame>
  );
}
