"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Action = "none" | "read" | "wideN";

const C1 = "#2a78d6";
const C2 = "#eb6834";
const GREY = "#efede4";
const LINE = "#76796f";
const INK = "#3b4234";
const BAD = "#d03b3b";

const N = 8;
const CELL = 14;
const STEP = 16;
// Thread t's row of A happens to hit this row of B first: scattered on purpose.
const SCATTER = [5, 1, 7, 2, 6, 0, 3, 4];
const WARP_ROW = 3;

function Workers({ x, y, prefix, color, sub }: { x: number; y: number; prefix: string; color: string; sub: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {Array.from({ length: N }, (_, i) => (
        <g key={i} transform={`translate(${i * 33} 0)`}>
          <rect width={30} height={22} rx={3} fill={color} opacity={0.25} />
          <text x={15} y={15} fontSize={9.5} textAnchor="middle" fill={INK}>{`${prefix}${i}`}</text>
        </g>
      ))}
      <text x={0} y={36} fontSize={9.5} fill={LINE}>{sub}</text>
    </g>
  );
}

function Grid({ x, y, mark, color }: { x: number; y: number; mark: (r: number, c: number) => string | null; color: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <text x={0} y={-6} fontSize={9} fill={LINE}>B 矩阵（按行存，同一行地址连续）</text>
      {Array.from({ length: N * N }, (_, k) => {
        const r = Math.floor(k / N);
        const c = k % N;
        const m = mark(r, c);
        return (
          <g key={k}>
            <rect x={c * STEP} y={r * STEP} width={CELL} height={CELL} rx={2} fill={m ? color : GREY} opacity={m ? 0.8 : 1} />
            {m && <text x={c * STEP + CELL / 2} y={r * STEP + 10.5} fontSize={8} textAnchor="middle" fill="#fff">{m}</text>}
          </g>
        );
      })}
    </g>
  );
}

function Info({ x, y, lines }: { x: number; y: number; lines: { text: string; tone?: "bad" | "good" }[] }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {lines.map((l, i) => (
        <text key={i} x={0} y={i * 17} fontSize={9.5} fill={l.tone === "bad" ? BAD : l.tone === "good" ? "#087a08" : INK}>{l.text}</text>
      ))}
    </g>
  );
}

export default function ThreadVsWarpPerRowDiagram() {
  const [action, setAction] = useState<Action>("none");
  const W = 600;
  const H = 250;
  const read = action === "read";
  const wide = action === "wideN";

  const leftMark = (r: number, c: number) => {
    if (read) return c === 0 && SCATTER.includes(r) ? `${SCATTER.indexOf(r)}` : null;
    if (wide) return r === SCATTER[0] ? "t0" : null;
    return null;
  };
  const rightMark = (r: number, c: number) => (read || wide) && r === WARP_ROW ? `${c}` : null;

  const leftInfo = read
    ? [{ text: "同一时刻 8 个线程" }, { text: "读 8 个分散的地址" }, { text: "→ 8 次访存", tone: "bad" as const }]
    : wide
      ? [{ text: "N 从 64 变成 256" }, { text: "每个线程要循环 256 列" }, { text: "并行线程数仍是 M", tone: "bad" as const }, { text: "实测约 10 GFLOPS 不变", tone: "bad" as const }]
      : [{ text: "一个线程管 A 的一行" }, { text: "要算这一行的全部" }, { text: "N 个输出" }];
  const rightInfo = read
    ? [{ text: "同一时刻 8 个 lane" }, { text: "读同一行的相邻地址" }, { text: "→ 合并成 1 次访存", tone: "good" as const }]
    : wide
      ? [{ text: "N 从 64 变成 256" }, { text: "每个 lane 只管 8 列" }, { text: "并行线程数是 M × 32", tone: "good" as const }, { text: "实测 892 → 1,183 GFLOPS", tone: "good" as const }]
      : [{ text: "32 个 lane 一起管一行" }, { text: "lane j 负责第 j、" }, { text: "j+32、j+64… 列" }];

  const narr = {
    none: "两边都在算稀疏矩阵 A 乘稠密矩阵 B，A 有 M 行，结果有 N 列。左边一个线程独自处理 A 的一行；右边一个 warp 的 32 个 lane 一起处理一行，每个 lane 管几列（图里画 8 个）。点上面的按钮。",
    read: "看同一时刻的一次读内存。左边：8 个线程各自在处理不同的行，要读的是 B 里 8 个不相干的行，地址分散，硬件只能发 8 次访存。右边：8 个 lane 读的是 B 同一行里相邻的 8 个数，硬件把它们合并成一次访存。这叫 coalescing。",
    wideN: "输出列数 N 从 64 变成 256。左边：每个线程要多循环 4 倍，但同时干活的线程数还是 M，吞吐不涨。右边：多出来的列被分给 32 个 lane，同时干活的线程数是 M × 32，N 越大越能把 GPU 喂饱。实测数据来自 2048×2048、密度 0.01 的矩阵。",
  }[action];

  return (
    <VisualizationFrame
      title="Thread-per-row vs Warp-per-row：一行交给几个人"
      description="两边都在算稀疏矩阵 A × 稠密矩阵 B。点按钮，看一次读内存和“输出列变多”在两种分工下分别发生什么。"
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${read ? " is-on" : ""}`} onClick={() => setAction("read")}>看一次读内存</button>
        <button type="button" className={`viz-btn${wide ? " is-on" : ""}`} onClick={() => setAction("wideN")}>输出列 N 变多</button>
        <button type="button" className="viz-btn" onClick={() => setAction("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={narr}>
          <text x={145} y={14} fontSize={11} fontWeight={600} textAnchor="middle" fill={INK}>thread-per-row</text>
          <Workers x={14} y={26} prefix="t" color={C1} sub="线程 t 管 A 的第 t 行" />
          <Grid x={14} y={96} mark={leftMark} color={read ? BAD : C1} />
          <Info x={160} y={108} lines={leftInfo} />

          <line x1={300} y1={10} x2={300} y2={240} stroke="#e4dfcb" strokeDasharray="3 3" />

          <text x={455} y={14} fontSize={11} fontWeight={600} textAnchor="middle" fill={INK}>warp-per-row</text>
          <Workers x={324} y={26} prefix="L" color={C2} sub="一个 warp 管 A 的一行，lane 分列" />
          <Grid x={324} y={96} mark={rightMark} color={C2} />
          <Info x={470} y={108} lines={rightInfo} />
        </svg>
      </div>
      <div className={`viz-narr${read ? " is-warn" : wide ? " is-good" : ""}`}>{narr}</div>
    </VisualizationFrame>
  );
}
