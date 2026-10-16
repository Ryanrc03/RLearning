"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Action = "none" | "add" | "crash";
type Consumer = { name: string; state: "ok" | "new" | "dead" };
type Side = { consumers: Consumer[]; producer: string; note: string; bad?: boolean };

const C1 = "#2a78d6";
const C2 = "#eb6834";
const LINE = "#76796f";
const COL_W = 290;

const BASE: Consumer[] = [{ name: "规划", state: "ok" }, { name: "录制", state: "ok" }, { name: "显示", state: "ok" }];

const STATES: Record<Action, { left: Side; right: Side; narr: string; tone?: string }> = {
  none: {
    left: { consumers: BASE, producer: "感知：发 3 次，等 3 次回复", note: "感知必须知道有谁、在哪、等每个人答" },
    right: { consumers: BASE, producer: "感知：往 topic 发 1 次", note: "感知只认识 topic，不认识订阅者" },
    narr: "感知模块每秒产出几十帧结果，规划、录制、显示三个模块都要。左边请求响应：感知挨个发给每个人并等回复。右边 Pub/Sub：感知发到一个 topic，谁订阅谁收。点按钮。",
  },
  add: {
    left: { consumers: [...BASE, { name: "新：远程监控", state: "new" }], producer: "感知：改代码，发 4 次，等 4 次", note: "加一个消费者，感知就得改一次、重新部署", bad: true },
    right: { consumers: [...BASE, { name: "新：远程监控", state: "new" }], producer: "感知：还是发 1 次，一行没改", note: "新模块自己订阅 topic 就行" },
    narr: "要加一个远程监控模块。左边感知的代码里写着“发给谁”，加人就得改感知、重新部署感知，而感知是最不该动的模块。右边新模块自己去订阅 topic，感知根本不知道多了个人。发的人和收的人解耦了。",
    tone: "is-warn",
  },
  crash: {
    left: { consumers: [{ name: "规划", state: "ok" }, { name: "录制", state: "dead" }, { name: "显示", state: "ok" }], producer: "感知：等录制回复… 超时…", note: "录制挂了，感知卡在等它，规划也拿不到新帧", bad: true },
    right: { consumers: [{ name: "规划", state: "ok" }, { name: "录制", state: "dead" }, { name: "显示", state: "ok" }], producer: "感知：往 topic 发 1 次", note: "录制挂了，规划和显示照常收" },
    narr: "录制模块崩了。左边感知发给录制后在等回复，等到超时才轮到下一个，这期间规划拿不到新的感知结果，车在用旧数据开。右边感知发完就走，录制收不到是录制自己的事，规划照常。一个不重要的模块，不该能拖垮重要的。",
    tone: "is-bad",
  },
};

function Column({ x, title, side, color, topic }: { x: number; title: string; side: Side; color: string; topic: boolean }) {
  const n = side.consumers.length;
  const cw = Math.min(64, (COL_W - 6 * (n - 1)) / n);
  const hubX = COL_W / 2;
  return (
    <g transform={`translate(${x} 0)`}>
      <text x={COL_W / 2} y={12} fontSize={11} fontWeight={600} textAnchor="middle" fill="#3b4234">{title}</text>
      <rect x={hubX - 50} y={22} width={100} height={26} rx={5} fill="#3b4234" />
      <text x={hubX} y={39} fontSize={10} fontWeight={600} textAnchor="middle" fill="#fff">感知</text>
      {topic && (
        <>
          <line x1={hubX} y1={48} x2={hubX} y2={70} stroke={color} strokeWidth={2} />
          <rect x={hubX - 60} y={70} width={120} height={20} rx={10} fill="#fdf9e9" stroke="#ddc776" />
          <text x={hubX} y={84} fontSize={9.5} textAnchor="middle" fill="#30332c">topic: /perception</text>
        </>
      )}
      {side.consumers.map((c, i) => {
        const cx = i * (cw + 6) + cw / 2;
        const dead = c.state === "dead";
        return (
          <g key={c.name}>
            <line x1={topic ? hubX : hubX} y1={topic ? 90 : 48} x2={cx} y2={112} stroke={dead && !topic ? "#d03b3b" : color} strokeWidth={dead && !topic ? 2 : 1.5} strokeDasharray={topic ? "3 2" : undefined} opacity={dead && topic ? 0.3 : 1} />
            {!topic && !dead && <line x1={cx + 6} y1={112} x2={hubX + 6} y2={48} stroke="#c9c4ad" strokeWidth={1} />}
            <rect x={cx - cw / 2} y={112} width={cw} height={30} rx={5} fill={dead ? "#f5e3e3" : c.state === "new" ? "#eaf7f1" : "#fff"} stroke={dead ? "#d03b3b" : c.state === "new" ? "#1baf7a" : "#e4dfcb"} />
            <text x={cx} y={131} fontSize={9.5} textAnchor="middle" fill={dead ? "#d03b3b" : "#30332c"}>{dead ? `✕ ${c.name}` : c.name}</text>
          </g>
        );
      })}
      <text x={0} y={162} fontSize={9.5} fill={side.bad ? "#d03b3b" : "#30332c"}>{side.producer}</text>
      <text x={0} y={176} fontSize={9} fill={side.bad ? "#d03b3b" : LINE}>{side.note}</text>
    </g>
  );
}

export default function ReqRespVsPubSubDiagram() {
  const [action, setAction] = useState<Action>("none");
  const s = STATES[action];
  const W = COL_W * 2 + 24;
  const H = 184;
  return (
    <VisualizationFrame
      title="Request/Response vs Pub/Sub：一个发，三个收"
      description="感知模块的结果要给三个模块。左边请求响应，感知挨个发并等回复；右边 Pub/Sub，感知发到 topic，谁订阅谁收。"
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${action === "add" ? " is-on" : ""}`} onClick={() => setAction("add")}>新加一个消费者</button>
        <button type="button" className={`viz-btn${action === "crash" ? " is-on" : ""}`} onClick={() => setAction("crash")}>录制模块崩溃</button>
        <button type="button" className="viz-btn" onClick={() => setAction("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={s.narr}>
          <Column x={0} title="Request/Response：我问你答" side={s.left} color={C1} topic={false} />
          <line x1={COL_W + 12} y1={4} x2={COL_W + 12} y2={H - 4} stroke="#e4dfcb" strokeDasharray="3 3" />
          <Column x={COL_W + 24} title="Pub/Sub：我喊一声，谁订谁听" side={s.right} color={C2} topic />
        </svg>
      </div>
      <div className={`viz-narr${s.tone ? ` ${s.tone}` : ""}`}>{s.narr}</div>
    </VisualizationFrame>
  );
}
