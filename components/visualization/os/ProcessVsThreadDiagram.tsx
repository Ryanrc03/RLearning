"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Action = "none" | "write" | "crash";

const C1 = "#2a78d6";
const C2 = "#eb6834";
const GREY = "#efede4";
const LINE = "#76796f";

function Box({ x, y, w, h, title, color, children }: { x: number; y: number; w: number; h: number; title: string; color: string; children?: React.ReactNode }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={w} height={h} rx={6} fill="#fff" stroke={color} strokeWidth={1.5} />
      <text x={w / 2} y={16} fontSize={11} fontWeight={600} textAnchor="middle" fill={color}>{title}</text>
      {children}
    </g>
  );
}

function Mem({ x, y, w, value, dead }: { x: number; y: number; w: number; value: string; dead?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={w} height={30} rx={3} fill={dead ? "#f5e3e3" : GREY} />
      <text x={6} y={12} fontSize={9} fill={LINE}>内存里的变量 count</text>
      <text x={6} y={25} fontSize={11} className="mono" fill={dead ? "#d03b3b" : "#30332c"}>{dead ? "已被内核回收" : `count = ${value}`}</text>
    </g>
  );
}

function Worker({ x, y, w, label, color, dead }: { x: number; y: number; w: number; label: string; color: string; dead?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={w} height={34} rx={4} fill={color} opacity={dead ? 0.15 : 0.25} />
      <text x={w / 2} y={14} fontSize={10} textAnchor="middle" fill={dead ? "#d03b3b" : "#30332c"}>{label}</text>
      <text x={w / 2} y={27} fontSize={9} textAnchor="middle" fill={dead ? "#d03b3b" : LINE}>{dead ? "✕ 崩溃" : "自己的栈"}</text>
    </g>
  );
}

export default function ProcessVsThreadDiagram() {
  const [action, setAction] = useState<Action>("none");
  const W = 600;
  const H = 190;
  const write = action === "write";
  const crash = action === "crash";

  const narr = {
    none: "左边是两个 process，右边是一个 process 里的两个 thread。先看结构：process 各有一份内存，thread 共用一份。然后点上面的按钮。",
    write: "1 号把 count 改成 1。左边：2 号 process 的 count 还是 0，因为那是另一份内存，它根本看不到。右边：2 号 thread 立刻看到 count = 1，因为它们读的是同一个地方。这就是 thread 方便也危险的原因：共享，所以要加锁。",
    crash: "1 号崩了。左边：内核只回收 1 号 process，2 号 process 继续跑。右边：thread 没有自己的内存，崩溃的是整个 process，2 号 thread 跟着一起没了。",
  }[action];

  return (
    <VisualizationFrame
      title="Process vs Thread：同一件事，两种结构"
      description="两边都有 1 号和 2 号两个工人。点按钮，看“改一个变量”和“一个工人崩溃”在两种结构下分别发生什么。"
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${write ? " is-on" : ""}`} onClick={() => setAction("write")}>1 号把 count 改成 1</button>
        <button type="button" className={`viz-btn${crash ? " is-on" : ""}`} onClick={() => setAction("crash")}>1 号崩溃</button>
        <button type="button" className="viz-btn" onClick={() => setAction("none")}>重置</button>
      </div>
      <div className="viz-scroll">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={narr}>
        <text x={140} y={12} fontSize={11} fontWeight={600} textAnchor="middle" fill="#3b4234">两个 process</text>
        <Box x={10} y={22} w={125} h={150} title="process 1" color={C1}>
          <Mem x={10} y={26} w={105} value={write ? "1" : "0"} dead={crash} />
          <Worker x={10} y={66} w={105} label="工人 1 号（thread）" color={C1} dead={crash} />
          <text x={62} y={132} fontSize={9} textAnchor="middle" fill={LINE}>自己的页表、文件</text>
        </Box>
        <Box x={145} y={22} w={125} h={150} title="process 2" color={C2}>
          <Mem x={10} y={26} w={105} value="0" />
          <Worker x={10} y={66} w={105} label="工人 2 号（thread）" color={C2} />
          <text x={62} y={132} fontSize={9} textAnchor="middle" fill={LINE}>自己的页表、文件</text>
        </Box>
        <line x1={137} y1={60} x2={143} y2={60} stroke="#d03b3b" strokeWidth={2} />
        <text x={140} y={185} fontSize={9} textAnchor="middle" fill={LINE}>内存互相看不见，通信要过内核</text>

        <line x1={300} y1={10} x2={300} y2={180} stroke="#e4dfcb" strokeDasharray="3 3" />

        <text x={455} y={12} fontSize={11} fontWeight={600} textAnchor="middle" fill="#3b4234">一个 process，两个 thread</text>
        <Box x={330} y={22} w={250} h={150} title={crash ? "process（已被内核杀掉）" : "process"} color={crash ? "#d03b3b" : "#3b4234"}>
          <Mem x={10} y={26} w={230} value={write ? "1" : "0"} dead={crash} />
          <Worker x={10} y={66} w={110} label="工人 1 号（thread）" color={C1} dead={crash} />
          <Worker x={130} y={66} w={110} label="工人 2 号（thread）" color={C2} dead={crash} />
          {write && !crash && <path d="M65 66 L65 58 L185 58 L185 66" fill="none" stroke={C1} strokeWidth={1.5} markerEnd="url(#arr)" />}
          <text x={125} y={132} fontSize={9} textAnchor="middle" fill={LINE}>一份页表、一份文件表，大家共用</text>
        </Box>
        <text x={455} y={185} fontSize={9} textAnchor="middle" fill={LINE}>内存共用，一个指针到处有效</text>
        <defs><marker id="arr" viewBox="0 0 6 6" refX={5} refY={3} markerWidth={6} markerHeight={6} orient="auto"><path d="M0 0 L6 3 L0 6 z" fill={C1} /></marker></defs>
      </svg>
      </div>
      <div className={`viz-narr${crash ? " is-bad" : write ? " is-warn" : ""}`}>{narr}</div>
    </VisualizationFrame>
  );
}
