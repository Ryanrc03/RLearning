"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Action = "none" | "unbounded" | "bounded";
type Side = { queue: number; cap: number | null; mem: string; latest: string; note: string; bad?: boolean };

const C1 = "#2a78d6";
const C2 = "#eb6834";
const LINE = "#76796f";
const COL_W = 300;

const STATES: Record<Action, { left: Side; right: Side; narr: string; tone?: string }> = {
  none: {
    left: { queue: 2, cap: null, mem: "正常", latest: "第 2 帧", note: "感知每秒 30 帧，规划每秒只能消化 10 帧" },
    right: { queue: 2, cap: 3, mem: "正常", latest: "第 2 帧", note: "感知每秒 30 帧，规划每秒只能消化 10 帧" },
    narr: "感知模块每秒产出 30 帧结果，规划模块每秒只能处理 10 帧。中间有一个队列。左边队列没有上限，右边只能放 3 帧。点“跑 10 秒”。",
  },
  unbounded: {
    left: { queue: 200, cap: null, mem: "内存一直涨", latest: "20 秒前的帧", note: "规划在处理 20 秒前的世界，车在用旧数据开", bad: true },
    right: { queue: 3, cap: 3, mem: "稳定", latest: "最新一帧", note: "满了就丢最旧的，规划总是拿到最新的帧" },
    narr: "10 秒后，左边队列里堆了 200 帧，而且还在涨：每秒进 30 出 10，净堆 20。规划现在处理的是 20 秒前的帧，车在按 20 秒前的路况开；再过几分钟内存爆掉，整个进程崩溃。右边队列满了就把最旧的丢掉，规划拿到的永远是最新一帧，只是中间跳过了一些。", 
    tone: "is-bad",
  },
  bounded: {
    left: { queue: 200, cap: null, mem: "内存一直涨", latest: "20 秒前的帧", note: "唯一的出路是让感知减速，或者丢", bad: true },
    right: { queue: 3, cap: 3, mem: "稳定", latest: "最新一帧", note: "有界队列把压力顶回了上游" },
    narr: "这就是 backpressure（背压）：下游处理不过来时，压力要顶回上游，让上游减速或丢弃，而不是在中间无限堆积。有界队列是最简单的实现：满了就阻塞生产者，或者丢旧的。消息队列、TCP 的接收窗口、Reactive Streams，本质上都是这一件事。",
    tone: "is-good",
  },
};

function Column({ x, title, side, color }: { x: number; title: string; side: Side; color: string }) {
  const shown = Math.min(side.queue, 12);
  return (
    <g transform={`translate(${x} 0)`}>
      <text x={COL_W / 2} y={12} fontSize={11} fontWeight={600} textAnchor="middle" fill="#3b4234">{title}</text>
      <rect x={0} y={24} width={64} height={26} rx={5} fill="#3b4234" /><text x={32} y={41} fontSize={10} fontWeight={600} textAnchor="middle" fill="#fff">感知 30/s</text>
      <rect x={COL_W - 64} y={24} width={64} height={26} rx={5} fill="#3b4234" /><text x={COL_W - 32} y={41} fontSize={10} fontWeight={600} textAnchor="middle" fill="#fff">规划 10/s</text>
      <rect x={72} y={22} width={COL_W - 152} height={30} rx={4} fill="#fff" stroke={side.bad ? "#d03b3b" : color} strokeWidth={1.4} strokeDasharray={side.cap === null ? "4 3" : undefined} />
      {Array.from({ length: shown }, (_, k) => <rect key={k} x={76 + k * 12} y={27} width={10} height={20} rx={2} fill={side.bad ? "#d03b3b" : color} opacity={0.7} />)}
      {side.queue > 12 && <text x={COL_W - 84} y={41} fontSize={9.5} textAnchor="end" fill="#d03b3b">…{side.queue} 帧</text>}
      <text x={COL_W / 2} y={66} fontSize={9} textAnchor="middle" fill={LINE}>{side.cap === null ? "队列没有上限" : `队列最多 ${side.cap} 帧，满了丢最旧的`}</text>
      <text x={0} y={88} fontSize={9.5} fill="#30332c">内存：<tspan fill={side.bad ? "#d03b3b" : "#0b7a4b"} fontWeight={600}>{side.mem}</tspan>　规划正在处理：<tspan fill={side.bad ? "#d03b3b" : "#0b7a4b"} fontWeight={600}>{side.latest}</tspan></text>
      <text x={0} y={104} fontSize={9.5} fill={side.bad ? "#d03b3b" : LINE}>{side.note}</text>
    </g>
  );
}

export default function BackpressureDiagram() {
  const [action, setAction] = useState<Action>("none");
  const s = STATES[action];
  const W = COL_W * 2 + 24;
  const H = 110;
  return (
    <VisualizationFrame
      title="下游慢了：攒着，还是顶回去"
      description="感知每秒 30 帧，规划每秒只吃得下 10 帧。左边中间的队列没有上限，右边最多放 3 帧。"
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${action === "unbounded" ? " is-on" : ""}`} onClick={() => setAction("unbounded")}>跑 10 秒</button>
        <button type="button" className={`viz-btn${action === "bounded" ? " is-on" : ""}`} disabled={action === "none"} onClick={() => setAction("bounded")}>这叫什么</button>
        <button type="button" className="viz-btn" onClick={() => setAction("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={s.narr}>
          <Column x={0} title="无界队列：来多少收多少" side={s.left} color={C1} />
          <line x1={COL_W + 12} y1={4} x2={COL_W + 12} y2={H - 4} stroke="#e4dfcb" strokeDasharray="3 3" />
          <Column x={COL_W + 24} title="有界队列：满了就丢旧的" side={s.right} color={C2} />
        </svg>
      </div>
      <div className={`viz-narr${s.tone ? ` ${s.tone}` : ""}`}>{s.narr}</div>
    </VisualizationFrame>
  );
}
