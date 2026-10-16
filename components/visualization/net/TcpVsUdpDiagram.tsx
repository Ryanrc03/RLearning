"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Action = "none" | "lose" | "later";
type Slot = { label: string; kind: "ok" | "lost" | "wait" | "late" | "new" | "empty" };
type Side = { slots: Slot[]; note: string; bad?: boolean };

const C1 = "#2a78d6";
const C2 = "#eb6834";
const LINE = "#76796f";
const COL_W = 290;

const FILL: Record<Slot["kind"], string> = { ok: C1, lost: "#f5e3e3", wait: "#e4dfcb", late: "#fab219", new: "#1baf7a", empty: "#f3f1e8" };
const TEXT: Record<Slot["kind"], string> = { ok: "#fff", lost: "#d03b3b", wait: "#76796f", late: "#30332c", new: "#fff", empty: "#c9c4ad" };

const STATES: Record<Action, { left: Side; right: Side; narr: string; tone?: string }> = {
  none: {
    left: { slots: [1, 2, 3, 4, 5].map((n) => ({ label: `${n}`, kind: "empty" })), note: "发送方按顺序发 5 个包" },
    right: { slots: [1, 2, 3, 4, 5].map((n) => ({ label: `${n}`, kind: "empty" })), note: "发送方按顺序发 5 个包" },
    narr: "两边都要把 5 个包送到接收方。网络会丢包，假设第 3 个在路上丢了。点“丢一个包”。",
  },
  lose: {
    left: { slots: [{ label: "1", kind: "ok" }, { label: "2", kind: "ok" }, { label: "3", kind: "lost" }, { label: "4", kind: "wait" }, { label: "5", kind: "wait" }], note: "3 号重传中，4、5 到了也不交付，排队等 3" },
    right: { slots: [{ label: "1", kind: "ok" }, { label: "2", kind: "ok" }, { label: "3", kind: "lost" }, { label: "4", kind: "ok" }, { label: "5", kind: "ok" }], note: "3 号没了就没了，4、5 立刻交付" },
    narr: "第 3 个包丢了。左边 TCP：接收方发现少了 3，发送方重传；4、5 其实已经到了，但 TCP 保证顺序，只能攒着等 3。右边 UDP：3 号丢了没人管，4、5 到了直接交给应用，应用自己看着办。",
    tone: "is-warn",
  },
  later: {
    left: { slots: [{ label: "1", kind: "ok" }, { label: "2", kind: "ok" }, { label: "3", kind: "late" }, { label: "4", kind: "ok" }, { label: "5", kind: "ok" }], note: "3 号 50 ms 后补到，4、5 这才交付；都过期了", bad: true },
    right: { slots: [{ label: "1", kind: "ok" }, { label: "2", kind: "ok" }, { label: "3", kind: "lost" }, { label: "6", kind: "new" }, { label: "7", kind: "new" }], note: "3 号永远空着，新的 6、7 已经到了" },
    narr: "50 ms 过去。左边 TCP：3 号终于重传到了，4、5 跟着一起交付，但对雷达帧来说这三个包都已经过期，应用拿到的是旧世界。右边 UDP：3 号那一帧就是没了，但 6、7 这些新帧照常到达，应用一直在看最新的。可靠和及时，只能选一个。",
    tone: "is-bad",
  },
};

function Column({ x, title, side, color }: { x: number; title: string; side: Side; color: string }) {
  return (
    <g transform={`translate(${x} 0)`}>
      <text x={COL_W / 2} y={12} fontSize={11} fontWeight={600} textAnchor="middle" fill="#3b4234">{title}</text>
      <rect x={COL_W / 2 - 50} y={22} width={100} height={26} rx={5} fill="#3b4234" />
      <text x={COL_W / 2} y={39} fontSize={10} fontWeight={600} textAnchor="middle" fill="#fff">发送方</text>
      <line x1={COL_W / 2} y1={48} x2={COL_W / 2} y2={92} stroke={color} strokeWidth={2} markerEnd="url(#arr-net)" />
      <text x={COL_W / 2 + 6} y={74} fontSize={9} fill={LINE}>网络，会丢包</text>
      <rect x={COL_W / 2 - 50} y={96} width={100} height={26} rx={5} fill="#3b4234" />
      <text x={COL_W / 2} y={113} fontSize={10} fontWeight={600} textAnchor="middle" fill="#fff">接收方</text>
      <text x={0} y={142} fontSize={9} fill={LINE}>接收方拿到的包</text>
      {side.slots.map((s, i) => (
        <g key={i} transform={`translate(${i * 44} 148)`}>
          <rect width={38} height={28} rx={4} fill={FILL[s.kind]} stroke={s.kind === "empty" ? "#e4dfcb" : s.kind === "lost" ? "#d03b3b" : "none"} strokeDasharray={s.kind === "empty" ? "2 2" : undefined} />
          <text x={19} y={18} fontSize={11} fontWeight={600} textAnchor="middle" fill={TEXT[s.kind]}>{s.kind === "lost" ? "✕" : s.label}</text>
        </g>
      ))}
      <text x={0} y={196} fontSize={9} fill={side.bad ? "#d03b3b" : LINE}>{side.note}</text>
    </g>
  );
}

export default function TcpVsUdpDiagram() {
  const [action, setAction] = useState<Action>("none");
  const s = STATES[action];
  const W = COL_W * 2 + 24;
  const H = 204;
  return (
    <VisualizationFrame
      title="TCP vs UDP：丢了一个包之后"
      description="同样发 5 个包，第 3 个在路上丢了。左边 TCP，右边 UDP。先点“丢一个包”，再点“50 ms 后再看”。"
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${action === "lose" ? " is-on" : ""}`} onClick={() => setAction("lose")}>丢一个包</button>
        <button type="button" className={`viz-btn${action === "later" ? " is-on" : ""}`} onClick={() => setAction("later")} disabled={action === "none"}>50 ms 后再看</button>
        <button type="button" className="viz-btn" onClick={() => setAction("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={s.narr}>
          <defs><marker id="arr-net" viewBox="0 0 6 6" refX={5} refY={3} markerWidth={6} markerHeight={6} orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="#76796f" /></marker></defs>
          <Column x={0} title="TCP：保证送到、按顺序" side={s.left} color={C1} />
          <line x1={COL_W + 12} y1={4} x2={COL_W + 12} y2={H - 4} stroke="#e4dfcb" strokeDasharray="3 3" />
          <Column x={COL_W + 24} title="UDP：发了就不管" side={s.right} color={C2} />
        </svg>
      </div>
      <div className="viz-legend"><span><i style={{ background: C1 }} />已交付</span><span><i style={{ background: "#e4dfcb" }} />到了但排队等前面的</span><span><i style={{ background: "#fab219" }} />补到了，已过期</span><span><i style={{ background: "#1baf7a" }} />新来的</span><span><b style={{ color: "#d03b3b" }}>✕</b> 丢了</span></div>
      <div className={`viz-narr${s.tone ? ` ${s.tone}` : ""}`}>{s.narr}</div>
    </VisualizationFrame>
  );
}
