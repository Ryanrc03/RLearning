"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Action = "none" | "read" | "k5";

const C1 = "#2a78d6";
const C2 = "#eb6834";
const C3 = "#1baf7a";
const GREY = "#efede4";
const LINE = "#76796f";
const INK = "#3b4234";
const BAD = "#d03b3b";

const THREADS = 4;

function Thread({ x, y, i }: { x: number; y: number; i: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={52} height={30} rx={4} fill={C1} opacity={0.22} />
      <text x={26} y={13} fontSize={9.5} textAnchor="middle" fill={INK}>{`线程 ${i + 1}`}</text>
      <text x={26} y={25} fontSize={8.5} textAnchor="middle" fill={LINE}>{`第 ${i + 1} 个输出`}</text>
    </g>
  );
}

function Dram({ x, y, w, reads, hot }: { x: number; y: number; w: number; reads: string; hot: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={w} height={34} rx={4} fill={hot ? "#f5e3e3" : GREY} stroke={hot ? BAD : "none"} />
      <text x={8} y={14} fontSize={9.5} fontWeight={600} fill={INK}>global memory（显存：大、远、慢）</text>
      <text x={8} y={27} fontSize={9.5} className="mono" fill={hot ? BAD : LINE}>{reads}</text>
    </g>
  );
}

// One row of input cells; each cell is shaded by how many of the 4 threads need it.
function Overlap({ x, y, k }: { x: number; y: number; k: number }) {
  const cols = THREADS + k - 1;
  const cell = Math.min(16, 200 / cols);
  return (
    <g transform={`translate(${x} ${y})`}>
      {Array.from({ length: cols }, (_, c) => {
        const users = Array.from({ length: THREADS }, (_, t) => c >= t && c < t + k).filter(Boolean).length;
        return (
          <g key={c}>
            <rect x={c * (cell + 1)} y={0} width={cell} height={cell} rx={2} fill={C3} opacity={0.2 + users * 0.18} />
            <text x={c * (cell + 1) + cell / 2} y={cell - 4} fontSize={8.5} textAnchor="middle" fill={INK}>{users}</text>
          </g>
        );
      })}
    </g>
  );
}

export default function GlobalVsSharedMemoryDiagram() {
  const [action, setAction] = useState<Action>("none");
  const W = 600;
  const H = 250;
  const active = action !== "none";
  const k = action === "k5" ? 5 : 3;
  const perThread = k * k;
  const tile = (THREADS + k - 1) * k;

  const narr = {
    none: "两边都是 4 个相邻的线程，各算卷积输出里相邻的一个点。每个点要读一块 k×k 的输入，相邻的点读的块大部分是重叠的。点上面的按钮。",
    read: `卷积核 3×3，每个线程要读 9 个输入。左边：每个线程自己去显存读，一共 4 × 9 = 36 次显存访问，重叠的数据被反复读。右边：block 先把 4 个输出共同需要的 3 × 6 = 18 个输入搬进 shared memory，只读一次显存；之后 36 次读取都在片上完成。真实的 tile 是 16×16 个输出：2,304 次对 324 次。`,
    k5: `卷积核变成 5×5（概念演示，实验里只测了 3×3）。左边：每个线程读 25 次，一共 100 次显存访问，比 3×3 多了 64 次。右边：tile 变成 5 × 8 = 40 个输入，显存只多读 22 次，多出来的读取都落在片上。卷积核越大，重叠越多，shared memory 省得越多。`,
  }[action];

  return (
    <VisualizationFrame
      title="Global Memory vs Shared Memory：重叠的数据读几次"
      description="两边都是 4 个相邻线程在算卷积。点按钮，看它们从显存读了多少次。"
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${action === "read" ? " is-on" : ""}`} onClick={() => setAction("read")}>相邻线程要同一块数据</button>
        <button type="button" className={`viz-btn${action === "k5" ? " is-on" : ""}`} onClick={() => setAction("k5")}>卷积核从 3×3 变 5×5</button>
        <button type="button" className="viz-btn" onClick={() => setAction("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={narr}>
          <defs>
            <marker id="gs-arr-r" viewBox="0 0 6 6" refX={5} refY={3} markerWidth={6} markerHeight={6} orient="auto"><path d="M0 0 L6 3 L0 6 z" fill={BAD} /></marker>
            <marker id="gs-arr-g" viewBox="0 0 6 6" refX={5} refY={3} markerWidth={6} markerHeight={6} orient="auto"><path d="M0 0 L6 3 L0 6 z" fill={C3} /></marker>
            <marker id="gs-arr-o" viewBox="0 0 6 6" refX={5} refY={3} markerWidth={6} markerHeight={6} orient="auto"><path d="M0 0 L6 3 L0 6 z" fill={C2} /></marker>
          </defs>

          <text x={145} y={14} fontSize={11} fontWeight={600} textAnchor="middle" fill={INK}>每个线程直接读 global memory</text>
          {Array.from({ length: THREADS }, (_, i) => (
            <g key={i}>
              <Thread x={18 + i * 66} y={28} i={i} />
              {active && <line x1={44 + i * 66} y1={190} x2={44 + i * 66} y2={62} stroke={BAD} strokeWidth={1.4} markerEnd="url(#gs-arr-r)" />}
              {active && <text x={50 + i * 66} y={130} fontSize={9.5} className="mono" fill={BAD}>×{perThread}</text>}
            </g>
          ))}
          <Dram x={10} y={192} w={270} reads={active ? `显存读取：4 × ${perThread} = ${THREADS * perThread} 次` : "显存读取：—"} hot={active} />

          <line x1={300} y1={10} x2={300} y2={240} stroke="#e4dfcb" strokeDasharray="3 3" />

          <text x={455} y={14} fontSize={11} fontWeight={600} textAnchor="middle" fill={INK}>先搬进 shared memory，再一起读</text>
          {Array.from({ length: THREADS }, (_, i) => (
            <g key={i}>
              <Thread x={328 + i * 66} y={28} i={i} />
              {active && <line x1={354 + i * 66} y1={98} x2={354 + i * 66} y2={62} stroke={C3} strokeWidth={1.4} markerEnd="url(#gs-arr-g)" />}
              {active && <text x={360 + i * 66} y={84} fontSize={9.5} className="mono" fill={C3}>×{perThread}</text>}
            </g>
          ))}
          <rect x={320} y={100} width={270} height={66} rx={4} fill="#fff" stroke={C3} strokeWidth={1.4} />
          <text x={328} y={114} fontSize={9.5} fontWeight={600} fill={INK}>shared memory（片上：小、近、快）</text>
          {active ? (
            <>
              <text x={328} y={127} fontSize={8.5} fill={LINE}>tile 的一行，数字 = 有几个线程要用这个输入</text>
              <Overlap x={328} y={134} k={k} />
              <text x={582} y={160} fontSize={9.5} className="mono" textAnchor="end" fill={C3}>{`${k} 行 × ${THREADS + k - 1} 个`}</text>
            </>
          ) : (
            <text x={328} y={134} fontSize={9.5} fill={LINE}>还没有搬数据</text>
          )}
          {active && <line x1={455} y1={190} x2={455} y2={168} stroke={C2} strokeWidth={2.2} markerEnd="url(#gs-arr-o)" />}
          {active && <text x={462} y={183} fontSize={9.5} className="mono" fill={C2}>一次搬 {tile} 个</text>}
          <Dram x={320} y={192} w={270} reads={active ? `显存读取：${tile} 次（片上再读 ${THREADS * perThread} 次）` : "显存读取：—"} hot={false} />
        </svg>
      </div>
      <div className={`viz-narr${active ? " is-good" : ""}`}>{narr}</div>
    </VisualizationFrame>
  );
}
