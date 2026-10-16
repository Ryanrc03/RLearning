"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Action = "none" | "one" | "hundred";
type Side = { header: number; body: number; conn: string; bars: { start: number; len: number }[]; total: string; note: string; bad?: boolean };

const C1 = "#2a78d6";
const C2 = "#eb6834";
const LINE = "#76796f";
const COL_W = 290;

const STATES: Record<Action, { left: Side; right: Side; narr: string; tone?: string }> = {
  none: {
    left: { header: 0, body: 0, conn: "", bars: [], total: "—", note: "每次请求：文本头部 + JSON 正文" },
    right: { header: 0, body: 0, conn: "", bars: [], total: "—", note: "每次调用：压缩头部 + Protobuf 正文，像调本地函数" },
    narr: "手机要向服务器查一个用户资料。左边用 HTTP/1.1 加 JSON，右边用 gRPC，也就是 HTTP/2 加 Protobuf。点按钮比较一次和一百次。",
  },
  one: {
    left: { header: 220, body: 52, conn: "建连 + TLS 握手 1 到 2 个来回", bars: [{ start: 0, len: 1 }], total: "≈ 272 字节，1 个来回", note: "头部比正文还大" },
    right: { header: 30, body: 15, conn: "连接复用，不用重新握手", bars: [{ start: 0, len: 1 }], total: "≈ 45 字节，1 个来回", note: "头部压缩过，正文是二进制" },
    narr: "发一次。左边 HTTP/1.1 的头部是纯文本，Host、User-Agent、Content-Type 一行行写，220 字节，正文 JSON 52 字节，头比身子大。右边 gRPC 的头部用 HTTP/2 的压缩表只占 30 字节，正文 Protobuf 15 字节。一次看不出差别，网络延迟都是一个来回。",
  },
  hundred: {
    left: { header: 22000, body: 5200, conn: "6 条连接轮流用", bars: Array.from({ length: 12 }, (_, i) => ({ start: Math.floor(i / 6), len: 1 })), total: "≈ 27 KB，17 个来回", note: "一条连接上一次只能排一个请求", bad: true },
    right: { header: 3000, body: 1500, conn: "1 条连接，100 个 stream 同时飞", bars: Array.from({ length: 12 }, () => ({ start: 0, len: 1 })), total: "≈ 4.5 KB，1 个来回", note: "多路复用：所有请求一起发、一起回" },
    narr: "刷一次首页要 100 个小请求。左边 HTTP/1.1 一条连接上同一时刻只能有一个请求在等回复，浏览器开 6 条连接轮着用，也要 17 个来回；头部重复发 100 遍，27 KB。右边 HTTP/2 在一条连接上开 100 个 stream 同时发，1 个来回全部回来，4.5 KB。差距在“多次小调用”这个场景里才显出来，而 app 和微服务之间全是这种调用。",
    tone: "is-warn",
  },
};

function Column({ x, title, side, color }: { x: number; title: string; side: Side; color: string }) {
  const maxBytes = 27200;
  const bw = (n: number) => Math.max((n / maxBytes) * (COL_W - 80), n > 0 ? 3 : 0);
  return (
    <g transform={`translate(${x} 0)`}>
      <text x={COL_W / 2} y={12} fontSize={11} fontWeight={600} textAnchor="middle" fill="#3b4234">{title}</text>
      <text x={0} y={32} fontSize={9} fill={LINE}>发出去的字节</text>
      <rect x={0} y={38} width={bw(side.header)} height={14} rx={2} fill={color} opacity={0.35} />
      <rect x={bw(side.header)} y={38} width={bw(side.body)} height={14} rx={2} fill={color} />
      <text x={bw(side.header) + bw(side.body) + 6} y={49} fontSize={9} fill="#30332c">{side.total}</text>
      <text x={0} y={68} fontSize={9} fill={LINE}>时间线（每格一个来回）</text>
      {Array.from({ length: 4 }, (_, k) => (
        <line key={k} x1={k * 60} y1={72} x2={k * 60} y2={118} stroke="#eceadc" />
      ))}
      {side.bars.map((b, i) => (
        <rect key={i} x={b.start * 60 + 2} y={74 + (i % 6) * 7} width={b.len * 56} height={5} rx={1} fill={color} opacity={0.85} />
      ))}
      {side.bars.length > 6 && <text x={128} y={110} fontSize={8} fill={LINE}>…共 100 个</text>}
      <text x={0} y={134} fontSize={9} fill={LINE}>{side.conn}</text>
      <text x={0} y={147} fontSize={9} fill={side.bad ? "#d03b3b" : LINE}>{side.note}</text>
    </g>
  );
}

export default function HttpVsGrpcDiagram() {
  const [action, setAction] = useState<Action>("none");
  const s = STATES[action];
  const W = COL_W * 2 + 24;
  const H = 154;
  return (
    <VisualizationFrame
      title="HTTP vs gRPC：一次调用，和一百次调用"
      description="手机查一个用户资料。左边 HTTP/1.1 + JSON，右边 gRPC（HTTP/2 + Protobuf）。浅色是头部，深色是正文。"
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${action === "one" ? " is-on" : ""}`} onClick={() => setAction("one")}>发 1 次</button>
        <button type="button" className={`viz-btn${action === "hundred" ? " is-on" : ""}`} onClick={() => setAction("hundred")}>刷一次首页，100 次</button>
        <button type="button" className="viz-btn" onClick={() => setAction("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={s.narr}>
          <Column x={0} title="HTTP/1.1 + JSON" side={s.left} color={C1} />
          <line x1={COL_W + 12} y1={4} x2={COL_W + 12} y2={H - 4} stroke="#e4dfcb" strokeDasharray="3 3" />
          <Column x={COL_W + 24} title="gRPC = HTTP/2 + Protobuf" side={s.right} color={C2} />
        </svg>
      </div>
      <div className={`viz-narr${s.tone ? ` ${s.tone}` : ""}`}>{s.narr}</div>
    </VisualizationFrame>
  );
}
