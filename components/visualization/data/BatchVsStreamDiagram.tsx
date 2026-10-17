"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Action = "none" | "batch" | "stream" | "late";
type Side = { marks: { t: number; label: string; kind: "event" | "run" | "late" }[]; results: string; note: string; bad?: boolean };

const C1 = "#2a78d6";
const C2 = "#eb6834";
const LINE = "#76796f";
const COL_W = 300;
const EVENTS = [0.5, 1.2, 1.8, 2.4, 3.1, 3.6, 4.3, 5.0, 5.7]; // hours, 6-hour window

const STATES: Record<Action, { left: Side; right: Side; narr: string; tone?: string }> = {
  none: {
    left: { marks: EVENTS.map((t) => ({ t, label: "", kind: "event" })), results: "—", note: "车辆日志一条条到达，想算每小时的急刹次数" },
    right: { marks: EVENTS.map((t) => ({ t, label: "", kind: "event" })), results: "—", note: "同样的日志，同样的问题" },
    narr: "车队的日志一条条进来，问题是“每小时有几次急刹”。左边批处理（Spark），右边流处理（Flink）。点按钮看两边什么时候给出答案。",
  },
  batch: {
    left: { marks: [...EVENTS.map((t) => ({ t, label: "", kind: "event" as const })), { t: 6, label: "跑一次", kind: "run" as const }], results: "第 6 小时末：一次性算出 6 个小时的答案", note: "攒够一批再算；结果最晚延迟 6 小时", bad: true },
    right: { marks: [...EVENTS.map((t) => ({ t, label: "", kind: "event" as const })), ...[1, 2, 3, 4, 5, 6].map((t) => ({ t, label: "", kind: "run" as const }))], results: "每个小时结束时给出那个小时的答案", note: "来一条算一条，窗口一到就出结果" },
    narr: "左边 Spark 的世界观是“数据已经在那了，整体跑一遍”：等 6 小时的日志都落盘，启动一个作业，读全部、算全部、写结果。吞吐极高，但第 1 小时的急刹要到第 6 小时末才知道。右边 Flink 来一条算一条，每个小时的窗口一关就输出那个小时的结果，延迟是秒级。",
    tone: "is-warn",
  },
  stream: {
    left: { marks: [...EVENTS.map((t) => ({ t, label: "", kind: "event" as const })), { t: 6, label: "跑一次", kind: "run" as const }], results: "重算很简单：把作业再跑一遍", note: "逻辑简单，出错了重跑整批就行" },
    right: { marks: [...EVENTS.map((t) => ({ t, label: "", kind: "event" as const })), ...[1, 2, 3, 4, 5, 6].map((t) => ({ t, label: "", kind: "run" as const }))], results: "要管窗口、状态、乱序、exactly-once", note: "每个窗口的中间状态都得自己保存", bad: true },
    narr: "代价在右边。流处理要记住每个窗口算到一半的状态，机器挂了状态不能丢（checkpoint）；一条事件不能算两次也不能漏（exactly-once）；还有下一个按钮要讲的乱序。批处理没有这些烦恼，出错就整批重跑。所以能用批的地方不要硬上流。",
    tone: "is-warn",
  },
  late: {
    left: { marks: [...EVENTS.map((t) => ({ t, label: "", kind: "event" as const })), { t: 6, label: "跑一次", kind: "run" as const }, { t: 5.5, label: "第 2 小时的事件", kind: "late" as const }], results: "无所谓：跑的时候它已经在了", note: "批处理天然不怕乱序" },
    right: { marks: [...EVENTS.map((t) => ({ t, label: "", kind: "event" as const })), ...[1, 2, 3, 4, 5, 6].map((t) => ({ t, label: "", kind: "run" as const })), { t: 5.5, label: "第 2 小时的事件", kind: "late" as const }], results: "第 2 小时的窗口早关了，这条怎么办？", note: "用 watermark 决定等多久，再晚的要么丢要么单独修正", bad: true },
    narr: "一条第 2 小时发生的急刹，因为车没信号，第 5.5 小时才传上来。左边批处理无所谓，第 6 小时跑的时候它已经在了。右边第 2 小时的窗口早就关了并输出了结果。Flink 用 watermark 表示“第 2 小时的数据我最多等到第 3 小时”，更晚的要么丢掉，要么走单独的修正通道。乱序是流处理最难的部分。",
    tone: "is-bad",
  },
};

function Column({ x, title, side, color }: { x: number; title: string; side: Side; color: string }) {
  const tx = (t: number) => 10 + (t / 6) * (COL_W - 20);
  return (
    <g transform={`translate(${x} 0)`}>
      <text x={COL_W / 2} y={12} fontSize={11} fontWeight={600} textAnchor="middle" fill="#3b4234">{title}</text>
      <line x1={10} y1={50} x2={COL_W - 10} y2={50} stroke="#c9c4ad" />
      {[0, 1, 2, 3, 4, 5, 6].map((h) => (
        <g key={h}><line x1={tx(h)} y1={46} x2={tx(h)} y2={54} stroke="#c9c4ad" /><text x={tx(h)} y={66} fontSize={8.5} textAnchor="middle" fill="#a8a693">{h}h</text></g>
      ))}
      {side.marks.map((m, i) => m.kind === "event" ? (
        <circle key={i} cx={tx(m.t)} cy={50} r={4} fill={color} />
      ) : m.kind === "run" ? (
        <g key={i}><rect x={tx(m.t) - 6} y={26} width={12} height={16} rx={3} fill="#3b4234" /><text x={tx(m.t)} y={22} fontSize={8} textAnchor="middle" fill="#30332c">{m.label || "算"}</text></g>
      ) : (
        <g key={i}><circle cx={tx(m.t)} cy={50} r={5} fill="#fff" stroke="#d03b3b" strokeWidth={2} /><path d={`M ${tx(m.t)} 44 Q ${(tx(m.t) + tx(2)) / 2} 20 ${tx(2)} 40`} fill="none" stroke="#d03b3b" strokeDasharray="3 2" /><text x={COL_W - 10} y={82} fontSize={8.5} textAnchor="end" fill="#d03b3b">{m.label}，第 5.5 小时才到</text></g>
      ))}
      <text x={10} y={100} fontSize={9.5} fill="#30332c">{side.results}</text>
      <text x={10} y={114} fontSize={9} fill={side.bad ? "#d03b3b" : LINE}>{side.note}</text>
    </g>
  );
}

export default function BatchVsStreamDiagram() {
  const [action, setAction] = useState<Action>("none");
  const s = STATES[action];
  const W = COL_W * 2 + 24;
  const H = 120;
  return (
    <VisualizationFrame
      title="Spark vs Flink：攒一批再算，还是来一条算一条"
      description="圆点是一条条到达的日志，黑块是“算一次”。问题是每小时有几次急刹。"
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${action === "batch" ? " is-on" : ""}`} onClick={() => setAction("batch")}>什么时候出结果</button>
        <button type="button" className={`viz-btn${action === "stream" ? " is-on" : ""}`} onClick={() => setAction("stream")}>代价在哪</button>
        <button type="button" className={`viz-btn${action === "late" ? " is-on" : ""}`} onClick={() => setAction("late")}>一条事件迟到了</button>
        <button type="button" className="viz-btn" onClick={() => setAction("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={s.narr}>
          <Column x={0} title="批处理（Spark）" side={s.left} color={C1} />
          <line x1={COL_W + 12} y1={4} x2={COL_W + 12} y2={H - 4} stroke="#e4dfcb" strokeDasharray="3 3" />
          <Column x={COL_W + 24} title="流处理（Flink）" side={s.right} color={C2} />
        </svg>
      </div>
      <div className={`viz-narr${s.tone ? ` ${s.tone}` : ""}`}>{s.narr}</div>
    </VisualizationFrame>
  );
}
