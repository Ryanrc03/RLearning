"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Action = "none" | "late" | "flood";
type Side = { log: string[]; sub: string; latency: string; note: string; bad?: boolean };

const C1 = "#2a78d6";
const C2 = "#eb6834";
const LINE = "#76796f";
const COL_W = 290;

const STATES: Record<Action, { left: Side; right: Side; narr: string; tone?: string }> = {
  none: {
    left: { log: ["m1", "m2", "m3", "m4", "m5"], sub: "订阅者", latency: "发 → broker 落盘 → 订阅者", note: "消息先存在 broker 的日志里，谁来读都从日志读" },
    right: { log: [], sub: "订阅者", latency: "发 → 订阅者", note: "消息直接从发送方送到订阅者，中间不存" },
    narr: "左边有 broker（Kafka 这一类）：发送方把消息交给中间人，中间人存下来，订阅者从中间人那里读。右边无 broker（ROS2 的 DDS、ZeroMQ 这一类）：发送方直接送到订阅者手里。点按钮。",
  },
  late: {
    left: { log: ["m1", "m2", "m3", "m4", "m5"], sub: "晚到的订阅者：从 m1 补读", latency: "回放：按自己的速度读", note: "错过的都在日志里，连一周前的也能读" },
    right: { log: [], sub: "晚到的订阅者：只有 m6 以后", latency: "直达", note: "之前的消息没存，错过就没了", bad: true },
    narr: "一个订阅者晚上线 10 秒。左边 broker 的日志里 m1 到 m5 都在，它从头补读，读多快自己定；训练任务回放上周的数据，用的就是这个能力。右边没人存消息，晚来的只能从下一条开始，之前的永远错过了。对传感器流来说这反而正好，旧帧本来就没用。",
    tone: "is-warn",
  },
  flood: {
    left: { log: ["m1", "…", "m9999", "m10000"], sub: "订阅者", latency: "多一跳：毫秒级", note: "每条要先落盘再转发，吞吐高但延迟多一截", bad: true },
    right: { log: [], sub: "订阅者", latency: "直达：几十微秒", note: "没有中间人，发送方和订阅者之间就一段网络" },
    narr: "每秒 1 万条。左边每条消息要先写进 broker 的磁盘，再由 broker 发给订阅者，多一跳也多一次落盘，延迟是毫秒级，换来的是扛得住海量吞吐、随时能回放。右边直接送，几十微秒就到，但发送方得自己认识每个订阅者，消息也不留底。车上要的是右边，云端要的是左边。",
    tone: "is-good",
  },
};

function Column({ x, title, side, color, broker }: { x: number; title: string; side: Side; color: string; broker: boolean }) {
  const cx = COL_W / 2;
  return (
    <g transform={`translate(${x} 0)`}>
      <text x={cx} y={12} fontSize={11} fontWeight={600} textAnchor="middle" fill="#3b4234">{title}</text>
      <rect x={cx - 50} y={22} width={100} height={24} rx={5} fill="#3b4234" />
      <text x={cx} y={38} fontSize={10} fontWeight={600} textAnchor="middle" fill="#fff">发送方</text>
      {broker ? (
        <>
          <line x1={cx} y1={46} x2={cx} y2={62} stroke={color} strokeWidth={2} markerEnd="url(#arr-bk)" />
          <rect x={cx - 110} y={64} width={220} height={44} rx={6} fill="#fdf9e9" stroke="#ddc776" />
          <text x={cx - 102} y={78} fontSize={9} fill={LINE}>broker 的日志（落盘，可回放）</text>
          {side.log.map((m, i) => (
            <g key={i} transform={`translate(${cx - 102 + i * 42} 84)`}>
              <rect width={38} height={18} rx={3} fill={color} opacity={0.85} />
              <text x={19} y={13} fontSize={9} textAnchor="middle" fill="#fff" className="mono">{m}</text>
            </g>
          ))}
          <line x1={cx} y1={108} x2={cx} y2={126} stroke={color} strokeWidth={2} markerEnd="url(#arr-bk)" />
        </>
      ) : (
        <>
          <line x1={cx} y1={46} x2={cx} y2={126} stroke={color} strokeWidth={2} markerEnd="url(#arr-bk)" />
          <text x={cx + 8} y={90} fontSize={9} fill={LINE}>直接送，不存</text>
        </>
      )}
      <rect x={cx - 90} y={128} width={180} height={24} rx={5} fill="#fff" stroke={color} strokeWidth={1.4} />
      <text x={cx} y={144} fontSize={9.5} textAnchor="middle" fill="#30332c">{side.sub}</text>
      <text x={0} y={170} fontSize={9.5} fill="#30332c">延迟：{side.latency}</text>
      <text x={0} y={184} fontSize={9} fill={side.bad ? "#d03b3b" : LINE}>{side.note}</text>
    </g>
  );
}

export default function BrokerVsBrokerlessDiagram() {
  const [action, setAction] = useState<Action>("none");
  const s = STATES[action];
  const W = COL_W * 2 + 24;
  const H = 192;
  return (
    <VisualizationFrame
      title="Broker vs Brokerless：中间存一下，还是直接送"
      description="Pub/Sub 的两种实现。左边有 broker（Kafka），消息先存进中间人的日志；右边无 broker（DDS、ZeroMQ），直接送到订阅者。"
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${action === "late" ? " is-on" : ""}`} onClick={() => setAction("late")}>订阅者晚到 10 秒</button>
        <button type="button" className={`viz-btn${action === "flood" ? " is-on" : ""}`} onClick={() => setAction("flood")}>每秒 1 万条</button>
        <button type="button" className="viz-btn" onClick={() => setAction("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={s.narr}>
          <defs><marker id="arr-bk" viewBox="0 0 6 6" refX={5} refY={3} markerWidth={6} markerHeight={6} orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="#76796f" /></marker></defs>
          <Column x={0} title="有 broker：Kafka" side={s.left} color={C1} broker />
          <line x1={COL_W + 12} y1={4} x2={COL_W + 12} y2={H - 4} stroke="#e4dfcb" strokeDasharray="3 3" />
          <Column x={COL_W + 24} title="无 broker：DDS / ZeroMQ" side={s.right} color={C2} broker={false} />
        </svg>
      </div>
      <div className={`viz-narr${s.tone ? ` ${s.tone}` : ""}`}>{s.narr}</div>
    </VisualizationFrame>
  );
}
