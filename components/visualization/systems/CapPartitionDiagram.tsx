"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Action = "none" | "write" | "heal";
type Side = { a: string; b: string; client: string; note: string; bad?: boolean };

const C1 = "#2a78d6";
const C2 = "#eb6834";
const LINE = "#76796f";
const COL_W = 300;

const STATES: Record<Action, { left: Side; right: Side; narr: string; tone?: string }> = {
  none: {
    left: { a: "count = 5", b: "count = 5", client: "想把 count 改成 6", note: "两台机器各存一份，正常时互相同步" },
    right: { a: "count = 5", b: "count = 5", client: "想把 count 改成 6", note: "两台机器各存一份，正常时互相同步" },
    narr: "同一份数据存在 A、B 两台机器上，平时写 A 会同步到 B。现在 A 和 B 之间的网线断了（分区），客户端来写。点按钮。",
  },
  write: {
    left: { a: "count = 5", b: "count = 5", client: "被拒绝：请稍后再试", note: "A 联系不上 B，不敢单独改，拒绝写入", bad: true },
    right: { a: "count = 6", b: "count = 5", client: "写成功了", note: "A 先改了，B 还是旧的，两边答案不一样" },
    narr: "左边选一致性：A 联系不上 B，不能保证两边一样，干脆拒绝，客户端看到的是“服务不可用”。右边选可用性：A 先改成 6，让客户端走，B 还停在 5，这段时间读 B 的人拿到旧值。分区发生时只能二选一，这就是 CAP 的全部内容。",
    tone: "is-warn",
  },
  heal: {
    left: { a: "count = 6", b: "count = 6", client: "重试成功", note: "网好了，写入同步到两边，中间没有过不一致" },
    right: { a: "count = 6", b: "count = 6", client: "早就成功了", note: "B 补上 6，最终一致；中间有一段两边不一样", bad: false },
    narr: "网线修好。左边客户端重试，这次 A 和 B 一起改成 6，从头到尾没有任何人读到过不一致的值，代价是刚才那几秒服务不可用。右边 A 把 6 补给 B，两边最终一致，代价是刚才那几秒有人读到过 5。哪些数据要左边、哪些数据可以右边，是你要替系统做的决定。",
    tone: "is-good",
  },
};

function Column({ x, title, side, color, cut }: { x: number; title: string; side: Side; color: string; cut: boolean }) {
  return (
    <g transform={`translate(${x} 0)`}>
      <text x={COL_W / 2} y={12} fontSize={11} fontWeight={600} textAnchor="middle" fill="#3b4234">{title}</text>
      <rect x={COL_W / 2 - 60} y={22} width={120} height={24} rx={5} fill="#fdf9e9" stroke="#ddc776" />
      <text x={COL_W / 2} y={38} fontSize={10} textAnchor="middle" fill="#30332c">客户端：{side.client}</text>
      <line x1={COL_W / 2} y1={46} x2={COL_W / 2 - 60} y2={70} stroke={LINE} strokeWidth={1.5} />
      {[{ name: "机器 A", v: side.a, x: 30 }, { name: "机器 B", v: side.b, x: COL_W - 130 }].map((m) => (
        <g key={m.name} transform={`translate(${m.x} 72)`}>
          <rect width={100} height={44} rx={6} fill="#fff" stroke={color} strokeWidth={1.4} />
          <text x={50} y={16} fontSize={10} fontWeight={600} textAnchor="middle" fill="#30332c">{m.name}</text>
          <text x={50} y={34} fontSize={11} textAnchor="middle" fill={m.v === side.a && side.a !== side.b ? C2 : "#30332c"} className="mono">{m.v}</text>
        </g>
      ))}
      <line x1={130} y1={94} x2={COL_W - 130} y2={94} stroke={cut ? "#d03b3b" : "#c9c4ad"} strokeWidth={2} strokeDasharray={cut ? "4 4" : undefined} />
      <text x={COL_W / 2} y={90} fontSize={9} textAnchor="middle" fill={cut ? "#d03b3b" : LINE}>{cut ? "✕ 网线断了" : "同步"}</text>
      <text x={0} y={138} fontSize={9.5} fill={side.bad ? "#d03b3b" : LINE}>{side.note}</text>
    </g>
  );
}

export default function CapPartitionDiagram() {
  const [action, setAction] = useState<Action>("none");
  const s = STATES[action];
  const cut = action !== "heal";
  const W = COL_W * 2 + 24;
  const H = 146;
  return (
    <VisualizationFrame
      title="网线断了，客户端来写：选一致，还是选可用"
      description="同一份数据存在两台机器上。左边的系统选一致性，右边的选可用性。先点“网线断了，客户端来写”，再点“网线修好了”。"
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${action === "write" ? " is-on" : ""}`} onClick={() => setAction("write")}>网线断了，客户端来写</button>
        <button type="button" className={`viz-btn${action === "heal" ? " is-on" : ""}`} disabled={action === "none"} onClick={() => setAction("heal")}>网线修好了</button>
        <button type="button" className="viz-btn" onClick={() => setAction("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={s.narr}>
          <Column x={0} title="选一致性：宁可不可用" side={s.left} color={C1} cut={cut && action !== "none"} />
          <line x1={COL_W + 12} y1={4} x2={COL_W + 12} y2={H - 4} stroke="#e4dfcb" strokeDasharray="3 3" />
          <Column x={COL_W + 24} title="选可用性：宁可暂时不一样" side={s.right} color={C2} cut={cut && action !== "none"} />
        </svg>
      </div>
      <div className={`viz-narr${s.tone ? ` ${s.tone}` : ""}`}>{s.narr}</div>
    </VisualizationFrame>
  );
}
