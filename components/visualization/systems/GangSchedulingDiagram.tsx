"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Action = "none" | "piece" | "gang";
type Cell = "busy" | "free" | "mine-idle" | "mine-run";
type State = { t: string[]; grid: Cell[][]; narr: string; tone?: string; summary: string };

const C1 = "#2a78d6";
const LINE = "#76796f";
const N = 8;

const base: Cell[] = ["busy", "busy", "free", "busy", "free", "busy", "free", "busy"]; // 3 free at t0

const STATES: Record<Action, State> = {
  none: {
    t: ["现在"],
    grid: [base],
    narr: "集群有 8 张卡，5 张被别的任务占着，3 张空闲。一个训练任务来了，要 4 张卡，而且 4 个 worker 必须同时启动才能开始 all-reduce。点按钮看两种分配方式。",
    summary: "空闲 3 张，任务需要 4 张",
  },
  piece: {
    t: ["现在", "10 分钟后", "30 分钟后"],
    grid: [
      ["busy", "busy", "mine-idle", "busy", "mine-idle", "busy", "mine-idle", "busy"],
      ["busy", "busy", "mine-idle", "busy", "mine-idle", "busy", "mine-idle", "busy"],
      ["busy", "busy", "mine-run", "busy", "mine-run", "busy", "mine-run", "mine-run"],
    ],
    narr: "逐个分配：调度器看到 3 张空卡，先把 3 个 worker 放上去。它们启动后发现第 4 个没来，只能在 all-reduce 那里干等。这 3 张卡被占着却什么都没算，直到 30 分钟后别的任务结束，第 4 张卡空出来，训练才开始。更糟的是，如果同时有另一个任务也在等第 4 张卡，两个任务各占 3 张，谁也凑不齐，永远死锁。",
    tone: "is-bad",
    summary: "3 张卡空转了 30 分钟",
  },
  gang: {
    t: ["现在", "10 分钟后", "30 分钟后"],
    grid: [
      ["busy", "busy", "free", "busy", "free", "busy", "free", "busy"],
      ["busy", "busy", "free", "busy", "free", "busy", "free", "busy"],
      ["busy", "busy", "mine-run", "busy", "mine-run", "busy", "mine-run", "mine-run"],
    ],
    narr: "凑齐再启动（gang scheduling）：调度器知道这个任务要 4 张一起，现在只有 3 张，于是一张都不给，让它排队。这 3 张空卡可以先给只要 1 张的小任务用。30 分钟后 4 张凑齐，4 个 worker 同时启动，立刻开始算。K8s 默认不会这样想，要装 Volcano、Kueue 这类插件；Slurm 天生就是这样想的。",
    tone: "is-good",
    summary: "等待期间 3 张卡让给别人，凑齐一起开工",
  },
};

const FILL: Record<Cell, string> = { busy: "#d9d5c4", free: "#fff", "mine-idle": "#fdf3e3", "mine-run": C1 };
const STROKE: Record<Cell, string> = { busy: "#c9c4ad", free: "#e4dfcb", "mine-idle": "#eda100", "mine-run": C1 };
const LABEL: Record<Cell, string> = { busy: "别人", free: "空", "mine-idle": "等", "mine-run": "算" };

export default function GangSchedulingDiagram() {
  const [action, setAction] = useState<Action>("none");
  const s = STATES[action];
  const W = 620;
  const rowH = 40;
  const H = 24 + s.grid.length * rowH + 14;
  const cw = 60;
  return (
    <VisualizationFrame
      title="8 张卡，任务要 4 张一起：逐个给，还是凑齐再给"
      description="灰色是别的任务占着的卡，白色是空卡。训练任务的 4 个 worker 必须同时在场才能开始。"
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${action === "piece" ? " is-on" : ""}`} onClick={() => setAction("piece")}>有几张给几张</button>
        <button type="button" className={`viz-btn${action === "gang" ? " is-on" : ""}`} onClick={() => setAction("gang")}>凑齐 4 张再启动</button>
        <button type="button" className="viz-btn" onClick={() => setAction("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={s.narr}>
          {Array.from({ length: N }, (_, k) => <text key={k} x={110 + k * cw + cw / 2} y={12} fontSize={9} textAnchor="middle" fill={LINE}>卡 {k + 1}</text>)}
          {s.grid.map((row, r) => (
            <g key={r} transform={`translate(0 ${24 + r * rowH})`}>
              <text x={0} y={22} fontSize={10} fill="#30332c">{s.t[r]}</text>
              {row.map((c, k) => (
                <g key={k} transform={`translate(${110 + k * cw} 0)`}>
                  <rect x={3} y={2} width={cw - 6} height={rowH - 8} rx={5} fill={FILL[c]} stroke={STROKE[c]} strokeWidth={c.startsWith("mine") ? 1.8 : 1} />
                  <text x={cw / 2} y={rowH / 2 + 1} fontSize={10} fontWeight={c.startsWith("mine") ? 700 : 400} textAnchor="middle" fill={c === "mine-run" ? "#fff" : c === "mine-idle" ? "#8a6d00" : LINE}>{LABEL[c]}</text>
                </g>
              ))}
            </g>
          ))}
          <text x={0} y={H - 2} fontSize={9.5} fill={action === "piece" ? "#d03b3b" : LINE}>{s.summary}</text>
        </svg>
      </div>
      <div className="viz-legend"><span><i style={{ background: "#d9d5c4" }} />别的任务</span><span><i style={{ background: "#fff", border: "1px solid #e4dfcb" }} />空闲</span><span><i style={{ background: "#fdf3e3", border: "1px solid #eda100" }} />我的 worker，在等</span><span><i style={{ background: C1 }} />我的 worker，在算</span></div>
      <div className={`viz-narr${s.tone ? ` ${s.tone}` : ""}`}>{s.narr}</div>
    </VisualizationFrame>
  );
}
