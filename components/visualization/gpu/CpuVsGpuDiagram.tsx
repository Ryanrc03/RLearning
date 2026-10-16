"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Action = "none" | "one" | "many";

const C1 = "#2a78d6";
const C2 = "#eb6834";
const GREY = "#efede4";
const LINE = "#76796f";
const INK = "#3b4234";
const BAD = "#d03b3b";
const GOOD = "#087a08";

// Illustrative cost model: a CPU core finishes one task in 1 unit; the GPU pays a fixed
// launch cost, then every lane takes 3 units, but all lanes run at once.
const CPU_CORES = 4;
const GPU_LAUNCH = 8;
const GPU_TASK = 3;
const AXIS = 40; // time units that fit on the drawn axis
const AXIS_PX = 240;

function cpuTime(tasks: number) {
  return Math.ceil(tasks / CPU_CORES) * 1;
}
function gpuTime(tasks: number) {
  return tasks === 0 ? 0 : GPU_LAUNCH + GPU_TASK;
}

function TimeBar({ x, y, time, color, launch, verdict }: { x: number; y: number; time: number; color: string; launch?: number; verdict: "win" | "lose" | null }) {
  const clipped = time > AXIS;
  const px = (Math.min(time, AXIS) / AXIS) * AXIS_PX;
  const launchPx = launch ? (launch / AXIS) * AXIS_PX : 0;
  return (
    <g transform={`translate(${x} ${y})`}>
      <text x={0} y={-6} fontSize={9.5} fill={LINE}>耗时（时间往右走）</text>
      <rect width={AXIS_PX} height={18} rx={3} fill={GREY} />
      {launch && time > 0 && <rect width={launchPx} height={18} rx={3} fill="url(#cg-hatch)" />}
      {time > 0 && <rect x={launchPx} width={Math.max(px - launchPx, 2)} height={18} rx={3} fill={color} opacity={0.75} />}
      {clipped && <text x={AXIS_PX - 4} y={13} fontSize={11} textAnchor="end" fill="#fff" fontWeight={600}>⋯</text>}
      {time > 0 && (
        <text x={0} y={34} fontSize={10.5} fill={verdict === "win" ? GOOD : verdict === "lose" ? BAD : INK}>
          <tspan className="mono">{time.toLocaleString()}</tspan>
          {` 个时间单位${clipped ? "（远超出图的右边）" : ""}`}
        </text>
      )}
    </g>
  );
}

export default function CpuVsGpuDiagram() {
  const [action, setAction] = useState<Action>("none");
  const W = 600;
  const H = 200;
  const tasks = action === "one" ? 1 : action === "many" ? 10000 : 0;
  const tc = cpuTime(tasks);
  const tg = gpuTime(tasks);
  const cpuVerdict = tasks === 0 ? null : tc < tg ? "win" : "lose";
  const gpuVerdict = tasks === 0 ? null : tg < tc ? "win" : "lose";

  const narr = {
    none: "两边处理同一批互不相关的小任务。左边 CPU 有 4 个快核，一个任务 1 个时间单位就做完。右边 GPU 有上万个慢核，每个任务要 3 个单位，而且开工前要先付一笔启动开销（斜线）。点上面的按钮。",
    one: "只有 1 个任务。左边：CPU 1 个单位就做完了。右边：GPU 先花 8 个单位启动，再花 3 个单位算，一共 11 个单位，反而慢了 10 倍。活太少时，GPU 的核再多也用不上。",
    many: "来了 1 万个任务。左边：CPU 4 个核一轮做 4 个，要排 2,500 轮。右边：GPU 还是那笔启动开销，然后 1 万个任务一起开工，3 个单位后全部做完，一共 11 个单位，和只有 1 个任务时一样。这就是吞吐优先：单个任务不快，但一大批一起做完。",
  }[action];

  return (
    <VisualizationFrame
      title="CPU vs GPU：任务少和任务多时，谁先做完"
      description="两边处理的是同一批任务。时间单位是示意值，用来说明趋势。点按钮，看任务数量变化时两边的耗时。"
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${action === "one" ? " is-on" : ""}`} onClick={() => setAction("one")}>只有 1 个任务</button>
        <button type="button" className={`viz-btn${action === "many" ? " is-on" : ""}`} onClick={() => setAction("many")}>来了 1 万个任务</button>
        <button type="button" className="viz-btn" onClick={() => setAction("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={narr}>
          <defs>
            <pattern id="cg-hatch" width={4} height={4} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width={4} height={4} fill="#fff" />
              <line x1={0} y1={0} x2={0} y2={4} stroke={C2} strokeWidth={1.5} />
            </pattern>
          </defs>

          <text x={145} y={14} fontSize={11} fontWeight={600} textAnchor="middle" fill={INK}>CPU：4 个快核，延迟优先</text>
          {Array.from({ length: CPU_CORES }, (_, i) => (
            <g key={i} transform={`translate(${20 + i * 64} 30)`}>
              <rect width={56} height={40} rx={5} fill={C1} opacity={tasks > 0 && i < tasks ? 0.35 : 0.12} stroke={C1} />
              <text x={28} y={18} fontSize={10} textAnchor="middle" fill={INK}>{`core ${i + 1}`}</text>
              <text x={28} y={32} fontSize={8.5} textAnchor="middle" fill={LINE}>1 单位/任务</text>
            </g>
          ))}
          <TimeBar x={20} y={110} time={tc} color={C1} verdict={cpuVerdict} />

          <line x1={300} y1={10} x2={300} y2={190} stroke="#e4dfcb" strokeDasharray="3 3" />

          <text x={455} y={14} fontSize={11} fontWeight={600} textAnchor="middle" fill={INK}>GPU：上万个慢核，吞吐优先</text>
          {Array.from({ length: 64 }, (_, i) => (
            <rect key={i} x={330 + (i % 16) * 15} y={30 + Math.floor(i / 16) * 10} width={13} height={8} rx={1.5} fill={C2} opacity={tasks === 1 ? (i === 0 ? 0.85 : 0.1) : tasks > 1 ? 0.75 : 0.15} />
          ))}
          <text x={330} y={84} fontSize={8.5} fill={LINE}>每个小格是一个慢核（3 单位/任务），真实数量远比图里多</text>
          <TimeBar x={330} y={110} time={tg} color={C2} launch={GPU_LAUNCH} verdict={gpuVerdict} />
          {tasks > 0 && <text x={330} y={165} fontSize={9} fill={LINE}>斜线：启动 kernel、准备数据的固定开销</text>}
        </svg>
      </div>
      <div className={`viz-narr${action === "one" ? " is-warn" : action === "many" ? " is-good" : ""}`}>{narr}</div>
    </VisualizationFrame>
  );
}
