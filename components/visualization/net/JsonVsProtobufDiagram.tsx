"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Action = "none" | "parse" | "rename";
type Side = { bytes: string; lines: string[]; result: string; bad?: boolean };

const C1 = "#2a78d6";
const C2 = "#eb6834";
const LINE = "#76796f";
const COL_W = 290;

const JSON_LINES = ['{"sender_id": 10086,', ' "text": "hi",', ' "ts": 1700000000}'];
const PB_LINES = ["08 86 4E", "12 02 68 69", "18 80 A8 F3 AA 06"];

const STATES: Record<Action, { left: Side; right: Side; narr: string; tone?: string }> = {
  none: {
    left: { bytes: "52 字节", lines: JSON_LINES, result: "字段名每条都带着，数字是十进制文本" },
    right: { bytes: "15 字节", lines: PB_LINES, result: "每个字段只带一个编号和类型，数字是二进制" },
    narr: "同一条消息：发送者 10086，内容 hi，时间戳。左边 JSON 是给人看的文本，右边 Protobuf 是给机器看的二进制。先看大小，再点按钮。",
  },
  parse: {
    left: { bytes: "52 字节", lines: ["逐字符扫描：找 { 和 \"", "读到 sender_id，查这是哪个字段", "把 \"10086\" 五个字符转成整数"], result: "几百纳秒到几微秒，字段越多越慢" },
    right: { bytes: "15 字节", lines: ["读 1 字节 08：字段 1，类型 varint", "读 2 字节 86 4E：直接是 10086", "读 12：字段 2，长度 2，拿走"], result: "几十纳秒，不用猜，不用转换" },
    narr: "解析一次。左边 JSON 要一个字符一个字符扫，碰到字段名还要拿字符串去对照，数字要从文本转回来。右边 Protobuf 读一个字节就知道是第几个字段、什么类型、多长，直接按位取。消息大了以后，解析可能比网络传输本身还慢，这就是序列化的成本。",
    tone: "is-warn",
  },
  rename: {
    left: { bytes: "52 字节", lines: ['{"from": 10086,', ' "text": "hi",', ' "ts": 1700000000}'], result: "老客户端找 sender_id：找不到，拿到空值，悄悄出错", bad: true },
    right: { bytes: "15 字节", lines: PB_LINES, result: "字节一个没变：编号 1 还是编号 1，名字只在代码里" },
    narr: "服务端把 sender_id 改名叫 from。左边 JSON 线上的字节真的变了，没更新的老客户端去找 sender_id，找不到，拿到一个空值，程序不报错但数据错了。右边 Protobuf 线上只传编号 1，名字只是各自代码里的叫法，改名不影响任何人。接口要活很多年，这条比大小和速度更重要。",
    tone: "is-bad",
  },
};

function Column({ x, title, side, color }: { x: number; title: string; side: Side; color: string }) {
  return (
    <g transform={`translate(${x} 0)`}>
      <text x={COL_W / 2} y={12} fontSize={11} fontWeight={600} textAnchor="middle" fill="#3b4234">{title}</text>
      <rect x={0} y={22} width={COL_W} height={92} rx={6} fill="#fff" stroke={color} strokeWidth={1.4} />
      {side.lines.map((l, i) => (
        <text key={i} x={10} y={44 + i * 22} fontSize={10} className="mono" fill="#30332c">{l}</text>
      ))}
      <rect x={COL_W - 70} y={28} width={64} height={18} rx={9} fill={color} opacity={0.9} />
      <text x={COL_W - 38} y={41} fontSize={9.5} fontWeight={600} textAnchor="middle" fill="#fff">{side.bytes}</text>
      <text x={0} y={134} fontSize={9} fill={side.bad ? "#d03b3b" : LINE}>{side.result}</text>
    </g>
  );
}

export default function JsonVsProtobufDiagram() {
  const [action, setAction] = useState<Action>("none");
  const s = STATES[action];
  const W = COL_W * 2 + 24;
  const H = 142;
  return (
    <VisualizationFrame
      title="JSON vs Protobuf：同一条消息，两种编码"
      description="一条聊天消息，左边 JSON，右边 Protobuf。点“解析一次”看机器要做多少事，点“字段改名”看老客户端会不会坏。"
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${action === "parse" ? " is-on" : ""}`} onClick={() => setAction("parse")}>解析一次</button>
        <button type="button" className={`viz-btn${action === "rename" ? " is-on" : ""}`} onClick={() => setAction("rename")}>服务端把 sender_id 改名</button>
        <button type="button" className="viz-btn" onClick={() => setAction("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={s.narr}>
          <Column x={0} title="JSON：人能读的文本" side={s.left} color={C1} />
          <line x1={COL_W + 12} y1={4} x2={COL_W + 12} y2={H - 4} stroke="#e4dfcb" strokeDasharray="3 3" />
          <Column x={COL_W + 24} title="Protobuf：机器读的二进制" side={s.right} color={C2} />
        </svg>
      </div>
      <div className={`viz-narr${s.tone ? ` ${s.tone}` : ""}`}>{s.narr}</div>
    </VisualizationFrame>
  );
}
