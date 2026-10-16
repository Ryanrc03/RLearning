"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Action = "none" | "io" | "cpu";
type Seg = { row: number; start: number; end: number; kind: "run" | "wait" };
type Side = { rows: string[]; segs: Seg[]; total: string; note: string; bad?: boolean };

const C1 = "#2a78d6";
const C2 = "#eb6834";
const LINE = "#76796f";
const COL_W = 300;
const T_MAX = 3;
const AXIS_X = 74;
const AXIS_W = COL_W - AXIS_X - 10;
const ROW_H = 18;
const ROWS_Y = 40;


const STATES: Record<Action, { left: Side; right: Side; narr: string; tone?: string }> = {
  none: {
    left: { rows: ["thread 1", "thread 2", "thread 3"], segs: [], total: "—", note: "3 个 thread，内核分派到核上" },
    right: { rows: ["thread 1"], segs: [], total: "—", note: "1 个 thread，上面轮流跑 goroutine A、B、C" },
    narr: "左边：3 个函数各自占一个 thread。右边：同样 3 个函数做成 3 个 goroutine，挤在 1 个 thread 上，谁跑由 Go 运行时决定。点按钮看两种活。",
  },
  io: {
    left: {
      rows: ["thread 1 · A", "thread 2 · B", "thread 3 · C"],
      segs: [0, 1, 2].flatMap((r) => [{ row: r, start: 0, end: 0.05, kind: "run" as const }, { row: r, start: 0.05, end: 2, kind: "wait" as const }, { row: r, start: 2, end: 2.08, kind: "run" as const }]),
      total: "≈ 2 秒",
      note: "3 个 thread 各自挂起等网络，占 3 个栈",
    },
    right: {
      rows: ["thread 1 跑谁", "goroutine A", "goroutine B", "goroutine C"],
      segs: [
        { row: 0, start: 0, end: 0.06, kind: "run" }, { row: 0, start: 0.06, end: 0.12, kind: "run" }, { row: 0, start: 0.12, end: 0.18, kind: "run" },
        { row: 0, start: 2, end: 2.08, kind: "run" }, { row: 0, start: 2.08, end: 2.16, kind: "run" }, { row: 0, start: 2.16, end: 2.24, kind: "run" },
        { row: 1, start: 0, end: 0.06, kind: "run" }, { row: 1, start: 0.06, end: 2, kind: "wait" }, { row: 1, start: 2, end: 2.08, kind: "run" },
        { row: 2, start: 0.06, end: 0.12, kind: "run" }, { row: 2, start: 0.12, end: 2.08, kind: "wait" }, { row: 2, start: 2.08, end: 2.16, kind: "run" },
        { row: 3, start: 0.12, end: 0.18, kind: "run" }, { row: 3, start: 0.18, end: 2.16, kind: "wait" }, { row: 3, start: 2.16, end: 2.24, kind: "run" },
      ],
      total: "≈ 2 秒",
      note: "A 发完请求就让出，B、C 跟上；三段等待重叠",
    },
    narr: "3 个 http.Get，各等 2 秒。左边 3 个 thread 各自发出请求后挂起，2 秒后各自醒来，一共 2 秒，代价是 3 个栈和 3 次内核切换。右边只有 1 个 thread：A 发出请求碰到等待，运行时立刻换 B 上，B 再换 C，三个请求不到 0.2 秒就全在路上，2 秒后依次回来，总时间也是 2 秒。等待重叠了，thread 只用了 1 个。",
    tone: "is-good",
  },
  cpu: {
    left: {
      rows: ["thread 1 · A", "thread 2 · B", "thread 3 · C"],
      segs: [0, 1, 2].map((r) => ({ row: r, start: 0, end: 1, kind: "run" as const })),
      total: "≈ 1 秒",
      note: "内核把 3 个 thread 放到 3 个核上同时算",
    },
    right: {
      rows: ["thread 1 跑谁", "goroutine A", "goroutine B", "goroutine C"],
      segs: [
        { row: 0, start: 0, end: 1, kind: "run" }, { row: 0, start: 1, end: 2, kind: "run" }, { row: 0, start: 2, end: 3, kind: "run" },
        { row: 1, start: 0, end: 1, kind: "run" },
        { row: 2, start: 1, end: 2, kind: "run" },
        { row: 3, start: 2, end: 3, kind: "run" },
      ],
      total: "≈ 3 秒",
      note: "算的中间没有等待，让不出去，只能排队",
      bad: true,
    },
    narr: "3 个纯计算 burn()，各算 1 秒。左边 3 个 thread 被内核分到 3 个核，1 秒完成。右边 1 个 thread：A 从头算到尾，中间没有任何等待，运行时拿不回控制权，B、C 只能排在后面，3 秒完成。coroutine 省的只是等待，计算没有可以让出的时刻。",
    tone: "is-warn",
  },
};

function Timeline({ x, title, side, color }: { x: number; title: string; side: Side; color: string }) {
  const tx = (t: number) => AXIS_X + (t / T_MAX) * AXIS_W;
  const rowsH = side.rows.length * ROW_H;
  return (
    <g transform={`translate(${x} 0)`}>
      <text x={COL_W / 2} y={12} fontSize={11} fontWeight={600} textAnchor="middle" fill="#3b4234">{title}</text>
      {[0, 1, 2, 3].map((t) => (
        <g key={t}>
          <line x1={tx(t)} y1={ROWS_Y - 4} x2={tx(t)} y2={ROWS_Y + rowsH} stroke="#eceadc" />
          <text x={tx(t)} y={ROWS_Y - 8} fontSize={8} textAnchor="middle" fill="#a8a693">{t}s</text>
        </g>
      ))}
      {side.rows.map((r, i) => (
        <g key={r} transform={`translate(0 ${ROWS_Y + i * ROW_H})`}>
          <text x={0} y={12} fontSize={8.5} fill={i === 0 && side.rows.length === 4 ? "#30332c" : LINE} fontWeight={i === 0 && side.rows.length === 4 ? 600 : 400}>{r}</text>
          <line x1={AXIS_X} y1={ROW_H - 1} x2={AXIS_X + AXIS_W} y2={ROW_H - 1} stroke="#f0eee4" />
        </g>
      ))}
      {side.segs.map((s, i) => {
        const isThreadRow = side.rows.length === 4 && s.row === 0;
        const fill = s.kind === "wait" ? color : isThreadRow ? "#3b4234" : color;
        return (
          <rect key={i} x={tx(s.start)} y={ROWS_Y + s.row * ROW_H + 3} width={Math.max(tx(s.end) - tx(s.start), 3)} height={ROW_H - 7} rx={2} fill={fill} opacity={s.kind === "wait" ? 0.2 : 0.95} />
        );
      })}
      <text x={0} y={ROWS_Y + rowsH + 16} fontSize={10} fill="#30332c">总时间：<tspan fontWeight={600} fill={side.bad ? "#d03b3b" : "#30332c"}>{side.total}</tspan></text>
      <text x={0} y={ROWS_Y + rowsH + 29} fontSize={9} fill={side.bad ? "#d03b3b" : LINE}>{side.note}</text>
    </g>
  );
}

export default function ThreadVsCoroutineDiagram() {
  const [action, setAction] = useState<Action>("none");
  const s = STATES[action];
  const W = COL_W * 2 + 24;
  const H = ROWS_Y + 4 * ROW_H + 36;
  return (
    <VisualizationFrame
      title="Thread vs Coroutine：3 个函数，3 个 thread 还是 1 个 thread"
      description="同一段 Go 程序，左边每个函数一个 thread，右边 3 个函数做成 goroutine 挤在 1 个 thread 上（GOMAXPROCS(1)）。深色是在跑，浅色是在等。"
      footnote={<>右边第一行“thread 1 跑谁”是关键：任何时刻它只跑一个 goroutine。网络请求时它在 A、B、C 之间跳，等待段重叠；纯计算时它被 A 占满，B、C 排队。</>}
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${action === "io" ? " is-on" : ""}`} onClick={() => setAction("io")}>3 个网络请求，各等 2 秒</button>
        <button type="button" className={`viz-btn${action === "cpu" ? " is-on" : ""}`} onClick={() => setAction("cpu")}>3 个纯计算，各算 1 秒</button>
        <button type="button" className="viz-btn" onClick={() => setAction("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={s.narr}>
          <Timeline x={0} title="thread：每个函数一个 thread" side={s.left} color={C1} />
          <line x1={COL_W + 12} y1={4} x2={COL_W + 12} y2={H - 4} stroke="#e4dfcb" strokeDasharray="3 3" />
          <Timeline x={COL_W + 24} title="coroutine：1 个 thread 跑 3 个 goroutine" side={s.right} color={C2} />
        </svg>
      </div>
      <div className="viz-legend"><span><i style={{ background: C1 }} />在跑</span><span><i style={{ background: C1, opacity: 0.2 }} />在等网络</span><span><i style={{ background: "#3b4234" }} />这个 thread 正在跑的 goroutine</span></div>
      <div className={`viz-narr${s.tone ? ` ${s.tone}` : ""}`}>{s.narr}</div>
    </VisualizationFrame>
  );
}
