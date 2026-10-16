"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Action = "none" | "two" | "late" | "fail";
type Side = { slots: { label: string; state: "kept" | "gone" | "new" }[]; consumers: { name: string; at: string }[]; note: string; bad?: boolean };

const C1 = "#2a78d6";
const C2 = "#eb6834";
const LINE = "#76796f";
const COL_W = 300;

const K = (n: number) => Array.from({ length: n }, (_, i) => ({ label: `m${i + 1}`, state: "kept" as const }));

const STATES: Record<Action, { left: Side; right: Side; narr: string; tone?: string }> = {
  none: {
    left: { slots: K(6), consumers: [], note: "消息按顺序追加到一条日志里，每条有编号（offset）" },
    right: { slots: K(6), consumers: [], note: "消息排在队列里，被取走就删" },
    narr: "生产者发了 6 条消息。左边 Kafka 把它们追加到一条带编号的日志里，右边传统消息队列（RabbitMQ 这一类）把它们排进队列。点按钮看消费者来了之后的差别。",
  },
  two: {
    left: { slots: K(6), consumers: [{ name: "训练数据组", at: "读到 m6" }, { name: "监控组", at: "读到 m6" }], note: "两个组各自从头读完全部 6 条，日志不动" },
    right: { slots: [{ label: "m1", state: "gone" }, { label: "m2", state: "gone" }, { label: "m3", state: "gone" }, { label: "m4", state: "gone" }, { label: "m5", state: "gone" }, { label: "m6", state: "gone" }], consumers: [{ name: "worker A", at: "拿到 m1 m3 m5" }, { name: "worker B", at: "拿到 m2 m4 m6" }], note: "6 条被两个 worker 分着拿走，拿走就删" },
    narr: "两个消费者同时来。左边 Kafka：两个消费者组各自记自己读到第几条，各自把 6 条都读一遍，日志本身不变，谁也不影响谁。右边队列：6 条消息被两个 worker 分着拿走，每条只被一个人处理，处理完就从队列删掉。一个是“广播给所有想看的人”，一个是“把活分给工人”。",
  },
  late: {
    left: { slots: K(6), consumers: [{ name: "训练数据组", at: "读到 m6" }, { name: "新来的回放组", at: "从 m1 开始读" }], note: "日志还在，晚来的从任何位置开始读，想读一周前的也行" },
    right: { slots: Array.from({ length: 6 }, (_, i) => ({ label: `m${i + 1}`, state: "gone" as const })), consumers: [{ name: "worker A/B", at: "早就拿完了" }, { name: "新来的", at: "什么都没有" }], note: "消息被取走时就删了，晚来的只能等新消息", bad: true },
    narr: "一个消费者晚来 10 秒。左边 Kafka 的日志按时间保留（几天到永久），新来的组从 m1 开始读，想回放上周的数据也可以，这就是训练平台用 Kafka 的原因。右边队列里的消息被取走时已经删除，晚来的什么都看不到。",
    tone: "is-warn",
  },
  fail: {
    left: { slots: K(6), consumers: [{ name: "训练数据组", at: "m3 处理失败，offset 停在 2" }], note: "offset 不前进，重启后从 m3 再读；要自己保证幂等" },
    right: { slots: [{ label: "m1", state: "gone" }, { label: "m2", state: "gone" }, { label: "m3", state: "new" }, { label: "m4", state: "kept" }, { label: "m5", state: "kept" }, { label: "m6", state: "kept" }], consumers: [{ name: "worker A", at: "m3 没 ack，队列把它交给 B" }], note: "没确认的消息自动重新投递给别的 worker" },
    narr: "消费者处理 m3 时挂了。左边 Kafka 只记录“这个组读到第几条”，m3 没确认，offset 停在 2，重启后从 m3 再读一遍，重复处理要靠你自己做幂等。右边队列看到 m3 没有 ack，自动把它重新投给另一个 worker，这是队列擅长的“任务分发加确认”。",
    tone: "is-good",
  },
};

function Column({ x, title, side, color, log }: { x: number; title: string; side: Side; color: string; log: boolean }) {
  return (
    <g transform={`translate(${x} 0)`}>
      <text x={COL_W / 2} y={12} fontSize={11} fontWeight={600} textAnchor="middle" fill="#3b4234">{title}</text>
      <text x={0} y={32} fontSize={9} fill={LINE}>{log ? "日志（追加，不删）" : "队列（取走就删）"}</text>
      {side.slots.map((sl, i) => (
        <g key={i} transform={`translate(${i * 46} 38)`}>
          <rect width={40} height={22} rx={4} fill={sl.state === "gone" ? "#f3f1e8" : sl.state === "new" ? "#fdf3e3" : color} opacity={sl.state === "kept" ? 0.85 : 1} stroke={sl.state === "gone" ? "#e4dfcb" : sl.state === "new" ? "#eda100" : "none"} strokeDasharray={sl.state === "gone" ? "2 2" : undefined} />
          <text x={20} y={15} fontSize={10} fontWeight={600} textAnchor="middle" fill={sl.state === "gone" ? "#c9c4ad" : sl.state === "new" ? "#8a6d00" : "#fff"} className="mono">{sl.state === "gone" ? "" : sl.label}</text>
          {log && <text x={20} y={72} fontSize={8} textAnchor="middle" fill="#a8a693">{i}</text>}
        </g>
      ))}
      {side.consumers.map((c, i) => (
        <text key={c.name} x={0} y={94 + i * 14} fontSize={9.5} fill="#30332c"><tspan fontWeight={600}>{c.name}</tspan>：{c.at}</text>
      ))}
      <text x={0} y={128} fontSize={9} fill={side.bad ? "#d03b3b" : LINE}>{side.note}</text>
    </g>
  );
}

export default function KafkaVsMqDiagram() {
  const [action, setAction] = useState<Action>("none");
  const s = STATES[action];
  const W = COL_W * 2 + 24;
  const H = 134;
  return (
    <VisualizationFrame
      title="Kafka vs 消息队列：一条日志，还是一个队列"
      description="同样 6 条消息。左边 Kafka 追加到带编号的日志里，右边传统队列取走就删。"
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${action === "two" ? " is-on" : ""}`} onClick={() => setAction("two")}>两个消费者同时来</button>
        <button type="button" className={`viz-btn${action === "late" ? " is-on" : ""}`} onClick={() => setAction("late")}>一个消费者晚来</button>
        <button type="button" className={`viz-btn${action === "fail" ? " is-on" : ""}`} onClick={() => setAction("fail")}>处理到一半挂了</button>
        <button type="button" className="viz-btn" onClick={() => setAction("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={s.narr}>
          <Column x={0} title="Kafka：日志" side={s.left} color={C1} log />
          <line x1={COL_W + 12} y1={4} x2={COL_W + 12} y2={H - 4} stroke="#e4dfcb" strokeDasharray="3 3" />
          <Column x={COL_W + 24} title="消息队列（RabbitMQ）：队列" side={s.right} color={C2} log={false} />
        </svg>
      </div>
      <div className={`viz-narr${s.tone ? ` ${s.tone}` : ""}`}>{s.narr}</div>
    </VisualizationFrame>
  );
}
