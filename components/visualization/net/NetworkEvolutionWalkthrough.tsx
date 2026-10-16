"use client";

import { useEffect, useRef, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type LayerId = "frame" | "ip" | "udp" | "tcp" | "quic" | "http" | "data";
type PStatus = "ok" | "lost" | "resent" | "queued" | "ack" | "new";
type Packet = { label: string; col: number; lane: number; status: PStatus };
type Step = {
  stage: number;
  title: string;
  narr: string;
  tone?: "is-warn" | "is-bad" | "is-good";
  layers: LayerId[];
  highlight?: LayerId;
  dataLabel?: string;
  columns: string[];
  colNotes?: string[];
  packets: Packet[];
  wireNote?: string;
  timeline?: boolean;
  drawLine?: boolean;
  leftover?: string;
};

const STAGES = ["一根线", "IP", "端口与 UDP", "TCP", "HTTP", "更上面"];
const LAYER: Record<LayerId, { name: string; field: string; color: string }> = {
  frame: { name: "帧头", field: "下一跳的网卡地址（MAC）", color: "#8c8c3a" },
  ip: { name: "IP 头", field: "源 IP、目标 IP", color: "#1baf7a" },
  udp: { name: "UDP 头", field: "源端口、目标端口", color: "#eda100" },
  tcp: { name: "TCP 头", field: "端口、序号、确认号、窗口", color: "#2a78d6" },
  quic: { name: "QUIC 头", field: "每个 stream 自己的序号", color: "#2a78d6" },
  http: { name: "HTTP 头", field: "GET /index.html、Host", color: "#7b5cd6" },
  data: { name: "数据", field: "", color: "#30332c" },
};

const AB = ["机器 A", "机器 B"];
const HOPS = ["发送方", "路由器 A", "路由器 B", "接收方"];
const PORTS = ["发送方", "网络", "接收方 IP 层", "按端口分发"];
const TCPC = ["发送方", "网络", "接收方", "交给应用"];
const T4 = ["时刻 1", "时刻 2", "时刻 3", "时刻 4"];

const STEPS: Step[] = [
  { stage: 0, title: "两台机器，一根线", narr: "最开始只有两台机器和一根线。A 往线上打 0 和 1，B 在另一头收。没有任何头部，就是裸的数据。", layers: ["data"], columns: AB, packets: [{ label: "0101…", col: 0.5, lane: 0, status: "ok" }], drawLine: true },
  { stage: 0, title: "切成帧，加上帧头", narr: "连续的 0 和 1 不知道从哪开始到哪结束，于是切成一段段的帧，前面加帧头：写上长度、校验，还有收件人的网卡地址（MAC）。线上如果挂着几台机器，只有地址对上的那台才收。", layers: ["frame", "data"], highlight: "frame", columns: AB, colNotes: ["套上帧头", "地址是我的，收下"], packets: [{ label: "帧 1", col: 1, lane: 0, status: "ok" }, { label: "帧 2", col: 1, lane: 1, status: "ok" }], drawLine: true },
  { stage: 0, title: "问题：一百万台机器怎么办", narr: "一根线连几台还行，一百万台不可能两两拉线，中间必须有转发设备。但网卡地址是出厂烧死的随机数，没有规律，转发设备没法靠它判断往哪边走。需要一种有规律的地址。", tone: "is-bad", layers: ["frame", "data"], columns: ["机器 A", "？", "机器 Z"], colNotes: ["", "往哪边？", ""], packets: [{ label: "帧", col: 1, lane: 0, status: "queued" }], leftover: "留下的问题：怎么在一百万台机器里找到对方。" },

  { stage: 1, title: "加 IP 头：一个有规律的号码", narr: "给每台机器一个 IP 地址，像邮政编码，前几位就能看出在哪个网。数据外面先套 IP 头（写源地址和目标地址），再套帧头，这一包叫 packet。中间的转发设备叫路由器，只看 IP 头，查自己的表决定下一跳。", layers: ["frame", "ip", "data"], highlight: "ip", columns: HOPS, colNotes: ["套 IP 头\n再套帧头", "查表：往 B", "查表：往接收方", ""], packets: [{ label: "p1", col: 1, lane: 0, status: "ok" }] },
  { stage: 1, title: "每一跳换帧头，IP 头不动", narr: "路由器 A 拆掉帧头，看 IP 头的目标地址，换一个写着“下一跳是 B”的新帧头再发出去。IP 头一路原样不动，帧头每跳换一次。所以只要有路，任何两台机器都能通。", layers: ["frame", "ip", "data"], highlight: "frame", columns: HOPS, colNotes: ["帧头 → A", "换帧头 → B", "换帧头 → 接收方", "拆到数据"], packets: [{ label: "p1", col: 1, lane: 0, status: "queued" }, { label: "p1", col: 2, lane: 0, status: "queued" }, { label: "p1", col: 3, lane: 0, status: "ok" }] },
  { stage: 1, title: "问题：路由器忙了，直接丢", narr: "路由器 B 的队列满了，p2 被扔掉。IP 对此什么都不做：不通知、不重发，接收方也不知道有过 p2。这叫尽力而为（best effort）：IP 只承诺“尽量送到”。底层保持简单，复杂的事往上推，这是网络设计最重要的一个决定。", tone: "is-bad", layers: ["frame", "ip", "data"], columns: HOPS, colNotes: ["", "", "队列满\n扔掉 p2", "只收到\np1、p3"], packets: [{ label: "p1", col: 3, lane: 0, status: "ok" }, { label: "p2", col: 2, lane: 1, status: "lost" }, { label: "p3", col: 3, lane: 2, status: "ok" }], leftover: "留下的问题：丢包没人管；而且 packet 到了机器，该给哪个程序？" },

  { stage: 2, title: "加端口：这台机器上的第几个窗口", narr: "机器上同时开着视频通话、游戏和下载，IP 头只说“给这台机器”。在 IP 头里面再套一层，写源端口和目标端口，接收方按目标端口把数据交给对应的程序。做这件事最薄的一层叫 UDP，头部只有 8 个字节。", layers: ["frame", "ip", "udp", "data"], highlight: "udp", columns: PORTS, colNotes: ["", "", "都是给我的", "5000 → 视频\n7000 → 游戏"], packets: [{ label: ":5000", col: 3, lane: 0, status: "ok" }, { label: ":7000", col: 3, lane: 1, status: "ok" }] },
  { stage: 2, title: "UDP 丢了，还是没人管", narr: "UDP 头里没有序号、没有确认，所以 :5000 的第二个包丢了，UDP 和 IP 一样装作没看见。UDP 几乎就是“IP 加端口”，继承了 IP 的全部不可靠。这不是缺陷，是刻意薄：视频通话正需要“丢了就丢，别为旧帧排队”。", tone: "is-warn", layers: ["frame", "ip", "udp", "data"], columns: PORTS, colNotes: ["", "丢掉一个", "", "视频少一帧\n继续放"], packets: [{ label: ":5000", col: 3, lane: 0, status: "ok" }, { label: ":5000", col: 1, lane: 1, status: "lost" }, { label: ":7000", col: 3, lane: 2, status: "ok" }], leftover: "留下的问题：文件、网页少一个字节就坏，谁来保证送到？" },

  { stage: 3, title: "换 TCP 头：给每个字节编号", narr: "TCP 头比 UDP 头多了序号、确认号和窗口。传数据前先三次握手：SYN（我要连，起始序号 x）、SYN/ACK（收到，我的起始序号 y）、ACK（收到）。两边对上号，之后每个字节都能对上。这是 TCP 比 UDP 多的第一个来回。", layers: ["frame", "ip", "tcp", "data"], highlight: "tcp", columns: TCPC, colNotes: ["SYN x", "", "SYN y\nACK x+1", "ACK y+1"], packets: [{ label: "SYN", col: 2, lane: 0, status: "ok" }, { label: "SYN/ACK", col: 0, lane: 1, status: "ack" }, { label: "ACK", col: 2, lane: 2, status: "ok" }] },
  { stage: 3, title: "丢了一个：发现缺口，重传", narr: "#2 丢了。接收方收到 #1 和 #3，发现缺 #2，确认号停在“我要 #2”。发送方等不到确认，重发 #2。接收方把 #3 攒着，等 #2 补到再按 1、2、3 交给应用。应用看到一条没有缺口的字节流，完全不知道底下丢过包。", tone: "is-good", layers: ["frame", "ip", "tcp", "data"], columns: TCPC, colNotes: ["重发 #2", "丢了 #2", "#3 攒着\n等 #2", "按序交付\n1、2、3"], packets: [{ label: "#1", col: 3, lane: 0, status: "ok" }, { label: "#2", col: 1, lane: 1, status: "lost" }, { label: "#2'", col: 3, lane: 1, status: "resent" }, { label: "#3", col: 2, lane: 2, status: "queued" }] },
  { stage: 3, title: "代价：队头阻塞和忽快忽慢", narr: "可靠不是免费的。#3 明明到了，却要等 #2 重传一个来回才能交付，这叫队头阻塞。TCP 还做拥塞控制：从慢开始发，丢包就减速，防止所有人一起把网络打垮，于是速度忽快忽慢。所以 TCP 什么时候到说不准，UDP 要么很快到要么不到。", tone: "is-warn", layers: ["frame", "ip", "tcp", "data"], columns: TCPC, colNotes: ["发快了 → 丢\n→ 减速", "", "#3 到了\n却要等", ""], packets: [{ label: "#1", col: 3, lane: 0, status: "ok" }, { label: "#2", col: 1, lane: 1, status: "lost" }, { label: "#3", col: 2, lane: 2, status: "queued" }], leftover: "留下的问题：有了可靠的字节流，两个程序在上面说什么？" },

  { stage: 4, title: "加 HTTP 头：字节流上说的话", narr: "TCP 只管把字节送到，字节里写什么要两边约定。HTTP 就是一种约定好格式的文本：“GET /index.html，Host: example.com”，服务器回“200 OK”加正文。它不管丢包、不管路由，那些都交给下面的层。", layers: ["frame", "ip", "tcp", "http", "data"], highlight: "http", dataLabel: "数据：网页正文", columns: ["浏览器", "服务器"], colNotes: ["GET\n/index.html", "200 OK\n+ 正文"], packets: [{ label: "GET", col: 1, lane: 0, status: "ok" }, { label: "200", col: 0, lane: 1, status: "ack" }], drawLine: true },
  { stage: 4, title: "HTTP/1.1：一条连接一次排一个", narr: "下面每一列是一个时刻，时间从左到右。HTTP/1.0 每个请求建一次 TCP 连接，握手就要一个来回。1.1 把连接留着复用，但一条连接上同一时刻只能等一个回复：r2 必须等 r1 回来才能发。一个网页几十个资源，就要几十个来回。", tone: "is-warn", layers: ["frame", "ip", "tcp", "http", "data"], dataLabel: "数据：网页正文", columns: T4, colNotes: ["r1 发出", "r1 回\nr2 发", "r2 回\nr3 发", "r3 回"], packets: [{ label: "r1", col: 0, lane: 0, status: "ok" }, { label: "r2", col: 1, lane: 1, status: "queued" }, { label: "r3", col: 2, lane: 2, status: "queued" }], wireNote: "底层：TCP", timeline: true },
  { stage: 4, title: "HTTP/2：一条 TCP 连接上多路复用", narr: "HTTP/2 把每个请求编成一个 stream（流），三个 stream 的字节交错塞进同一条 TCP 连接，一个来回全回来，头部也压缩了。但撞上 TCP 的队头阻塞：TCP 只认一条字节流，底下丢一个包，三个 stream 全部一起等它重传。", layers: ["frame", "ip", "tcp", "http", "data"], dataLabel: "数据：网页正文", columns: T4, colNotes: ["r1 r2 r3\n一起发", "丢了一个包", "三个一起\n等重传", "一起回来"], packets: [{ label: "r1", col: 0, lane: 0, status: "ok" }, { label: "r2", col: 0, lane: 1, status: "ok" }, { label: "r3", col: 0, lane: 2, status: "ok" }, { label: "一个包", col: 1, lane: 1, status: "lost" }, { label: "全部", col: 2, lane: 1, status: "queued" }], wireNote: "底层：TCP，一条流，丢一个包大家等", timeline: true },
  { stage: 4, title: "HTTP/3：不满意 TCP，就换掉它", narr: "HTTP/3 放弃 TCP，在 UDP 上自己做了一套叫 QUIC 的传输层：每个 stream 独立编号、独立重传，丢一个包只堵它自己；握手和加密合成一个来回。看左边信封：TCP 头没了，换成 UDP 头加 QUIC 头。每一层只依赖下一层的承诺，承诺不够用，就换一个下一层。", tone: "is-good", layers: ["frame", "ip", "udp", "quic", "http", "data"], highlight: "quic", dataLabel: "数据：网页正文", columns: T4, colNotes: ["r1 r2 r3\n一起发", "r2 的包丢了", "r1 r3\n照常交付", "只重发 r2"], packets: [{ label: "r1", col: 0, lane: 0, status: "ok" }, { label: "r2", col: 1, lane: 1, status: "lost" }, { label: "r3", col: 0, lane: 2, status: "ok" }, { label: "r2'", col: 3, lane: 1, status: "resent" }], wireNote: "底层：UDP + QUIC，每个 stream 自己管丢包", timeline: true, leftover: "留下的问题：说话的格式有了，说的内容怎么编码？服务之间几十万次小调用怎么办？" },

  { stage: 5, title: "内容怎么编码：JSON 还是 Protobuf", narr: "HTTP 规定了怎么说话，没规定一个用户对象变成哪些字节。JSON 是人能读的文本，每条都带字段名；Protobuf 是机器读的二进制，字段只带编号，小三倍、解析快得多，字段改名不影响线上。把 Protobuf 装进 HTTP/2 就是 gRPC：让远程调用像本地调用。", layers: ["frame", "ip", "tcp", "http", "data"], highlight: "data", dataLabel: "数据：Protobuf，15 字节", columns: ["app", "后端"], colNotes: ["JSON 52 字节", "Protobuf 15 字节"], packets: [{ label: "52 B", col: 0, lane: 0, status: "queued" }, { label: "15 B", col: 1, lane: 0, status: "ok" }], wireNote: "深入对比：JSON vs Protobuf、HTTP vs gRPC", drawLine: true },
  { stage: 5, title: "很多程序互相说话：Pub/Sub", narr: "前面都是两个程序的事。一辆车上几十个模块，感知的结果要给规划、录制、显示。如果每一对都“我问你答”，加一个收的人就改一次发的人，一个收的人卡住就拖住发的人。Pub/Sub：往一个 topic（频道）喊一声，谁订阅谁听，发收双方互不认识。", layers: ["frame", "ip", "udp", "data"], highlight: "data", dataLabel: "数据：一帧感知结果", columns: ["感知", "topic", "规划 / 录制 / 显示"], colNotes: ["发 1 次", "/perception", "各自收"], packets: [{ label: "帧", col: 1, lane: 0, status: "ok" }, { label: "规划", col: 2, lane: 0, status: "new" }, { label: "录制", col: 2, lane: 1, status: "new" }, { label: "显示", col: 2, lane: 2, status: "new" }], wireNote: "深入对比：Request/Response vs Pub/Sub" },
  { stage: 5, title: "中间要不要存：有没有 broker", narr: "Pub/Sub 还有一个选择：消息要不要先存到中间人（broker）那里。有 broker（Kafka）能回放、扛吞吐，但多一跳；无 broker（车内常用的 DDS、ZeroMQ）直接送，延迟最低，但错过就没了。车内传感器流要后者，云端数据管道要前者。", layers: ["frame", "ip", "tcp", "data"], highlight: "data", dataLabel: "数据：一条日志", columns: ["发送方", "broker 日志", "晚到的订阅者"], colNotes: ["", "m1 … m5\n落盘", "从 m1\n补读"], packets: [{ label: "m1", col: 1, lane: 0, status: "ok" }, { label: "m2", col: 1, lane: 1, status: "ok" }, { label: "m1", col: 2, lane: 0, status: "resent" }, { label: "m2", col: 2, lane: 1, status: "resent" }], wireNote: "图示为有 broker 的情况。深入对比：Broker vs Brokerless" },
  { stage: 5, title: "连起来：一辆车的通信架构", narr: "车内：传感器帧走 UDP 或共享内存，感知结果用 DDS 直连 Pub/Sub 分发。车到云：日志走 TCP 加 Protobuf 回传。云端：进 Kafka 可回放，服务之间用 gRPC。每一层都是为了解决下一层解决不了的那个问题而加的。", tone: "is-good", layers: ["frame", "ip", "tcp", "http", "data"], dataLabel: "数据", columns: ["传感器", "感知", "云端 Kafka", "训练"], colNotes: ["UDP /\n共享内存", "DDS\nPub/Sub", "TCP +\nProtobuf", "gRPC"], packets: [{ label: "帧", col: 1, lane: 0, status: "ok" }, { label: "日志", col: 2, lane: 1, status: "ok" }, { label: "batch", col: 3, lane: 2, status: "ok" }] },
];

const PFILL: Record<PStatus, string> = { ok: "#2a78d6", lost: "#f5e3e3", resent: "#1baf7a", queued: "#e4dfcb", ack: "#eda100", new: "#eaf7f1" };
const PTEXT: Record<PStatus, string> = { ok: "#fff", lost: "#d03b3b", resent: "#fff", queued: "#76796f", ack: "#fff", new: "#0b7a4b" };
const LINE = "#76796f";
const PAD = 16;

function Envelope({ step }: { step: Step }) {
  const W = 300;
  const n = step.layers.length;
  const dataH = 30;
  const H = 22 + (n - 1) * PAD * 2 + dataH;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`信封套信封：${step.layers.map((l) => LAYER[l].name).join("、")}`}>
      <text x={0} y={12} fontSize={11.5} fontWeight={600} fill="#3b4234">信封套信封：发出去的一个包</text>
      {step.layers.map((id, i) => {
        const l = LAYER[id];
        const inset = i * PAD;
        const isData = id === "data";
        const on = step.highlight === id;
        const w = W - inset * 2;
        const h = H - 22 - inset * 2;
        return (
          <g key={id}>
            <rect x={inset} y={22 + inset} width={w} height={h} rx={5} fill={isData ? (on ? "#fdf9e9" : "#fff") : l.color} opacity={isData ? 1 : on ? 0.3 : 0.12} stroke={on ? l.color : isData ? "#e4dfcb" : "none"} strokeWidth={on ? 2 : 1} />
            {!isData && (
              <text x={inset + 6} y={22 + inset + 12} fontSize={10} fontWeight={on ? 700 : 500} fill={l.color}>
                {l.name}{on ? "（新）" : ""}　<tspan fontWeight={400} fill={LINE}>{l.field}</tspan>
              </text>
            )}
          </g>
        );
      })}
      <text x={W / 2} y={22 + (n - 1) * PAD + dataH / 2 + 4} fontSize={10.5} textAnchor="middle" fill="#30332c">{step.dataLabel ?? "数据"}</text>
    </svg>
  );
}

function Wire({ step }: { step: Step }) {
  const cols = step.columns.length;
  const W = 420;
  const cw = W / cols;
  const laneY = (l: number) => 68 + l * 30;
  const H = 176;
  const cx = (c: number) => c * cw + cw / 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`在网络里的样子：${step.columns.join("、")}`}>
      <text x={0} y={12} fontSize={11.5} fontWeight={600} fill="#3b4234">在网络里的样子{step.timeline ? "（每列一个时刻，从左到右）" : ""}</text>
      {step.drawLine && <line x1={cx(0)} y1={33} x2={cx(cols - 1)} y2={33} stroke="#c9c4ad" strokeWidth={2} />}
      {step.columns.map((c, i) => (
        <g key={i} transform={`translate(${i * cw} 22)`}>
          <rect x={4} y={0} width={cw - 8} height={22} rx={4} fill={c === "？" ? "#fdf9e9" : "#3b4234"} stroke={c === "？" ? "#ddc776" : "none"} />
          <text x={cw / 2} y={15} fontSize={10.5} fontWeight={600} textAnchor="middle" fill={c === "？" ? "#30332c" : "#fff"}>{c}</text>
          {step.colNotes?.[i] && step.colNotes[i].split("\n").map((line, k) => (
            <text key={k} x={cw / 2} y={35 + k * 11} fontSize={9.5} textAnchor="middle" fill={LINE}>{line}</text>
          ))}
        </g>
      ))}
      {[0, 1, 2].map((l) => <line key={l} x1={0} y1={laneY(l) + 22} x2={W} y2={laneY(l) + 22} stroke="#eceadc" />)}
      {step.packets.map((p, i) => {
        const px = cx(p.col) - 27;
        const py = laneY(p.lane);
        return (
          <g key={i} transform={`translate(${px} ${py})`}>
            <rect width={54} height={21} rx={4} fill={PFILL[p.status]} stroke={p.status === "lost" ? "#d03b3b" : p.status === "new" ? "#1baf7a" : "none"} />
            <text x={27} y={14.5} fontSize={10.5} fontWeight={600} textAnchor="middle" fill={PTEXT[p.status]}>{p.status === "lost" ? `✕ ${p.label}` : p.label}</text>
          </g>
        );
      })}
      {step.wireNote && <text x={0} y={H - 4} fontSize={9.5} fill={LINE}>{step.wireNote}</text>}
    </svg>
  );
}

const STAGE_TITLES = [
  "一根线：两台机器怎么传",
  "IP：一百万台机器怎么找到对方",
  "端口与 UDP：一台机器上很多程序",
  "TCP：在不可靠的 IP 上造出可靠",
  "HTTP：字节流上说的话，和它的三代",
  "更上面：编码、调用、很多程序",
];

export default function NetworkEvolutionWalkthrough({ stage }: { stage?: number }) {
  const steps = stage === undefined ? STEPS : STEPS.filter((st) => st.stage === stage);
  const [i, setI] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const step = steps[i];
  const total = steps.length;
  const scoped = stage !== undefined;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const r = box.current?.getBoundingClientRect();
      if (!r || r.bottom < 0 || r.top > window.innerHeight) return;
      if (e.key === "ArrowRight") setI((k) => Math.min(total - 1, k + 1));
      if (e.key === "ArrowLeft") setI((k) => Math.max(0, k - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total]);
  const stageFirst = (s: number) => STEPS.findIndex((st) => st.stage === s);
  return (
    <VisualizationFrame
      title={scoped ? `${stage! + 1}. ${STAGE_TITLES[stage!]}` : "从一根线到 Pub/Sub：每遇到一个问题，加一层"}
      description={scoped ? `这一阶段 ${total} 步。左边是一个包被套上的信封，高亮这一阶段新加的那一层；右边是它在网络里的样子。` : "按“下一步”往前走，或者点上面的阶段直接跳。左边是一个包被套上的信封，每一步高亮新加的那一层；右边是它在网络里的样子。图在视口内时键盘左右键也可以。"}
      footnote={scoped ? undefined : <>六个阶段共 {total} 步。每个阶段的最后一步都写着“留下的问题”，那就是下一阶段存在的理由。</>}
    >
      <div ref={box}>
        {!scoped && (
          <>
            <div className="viz-chips" role="tablist" style={{ marginBottom: 10 }}>
              {STAGES.map((s, k) => (
                <button key={s} type="button" role="tab" aria-selected={step.stage === k} className={`viz-chip${step.stage === k ? " is-on" : ""}`} onClick={() => setI(stageFirst(k))}>{k + 1}. {s}</button>
              ))}
            </div>
            <div className="viz-stack" aria-hidden style={{ marginBottom: 12 }}>
              {STEPS.map((st, k) => <span key={k} style={{ flex: 1, background: k <= i ? (st.stage % 2 ? "#2a78d6" : "#3b4234") : "#efede4" }} />)}
            </div>
          </>
        )}
        <div className="viz-controls">
          <button type="button" className="viz-btn" disabled={i === 0} onClick={() => setI(i - 1)}>← 上一步</button>
          <span className="viz-mono">第 {i + 1} / {total} 步</span>
          <button type="button" className="viz-btn primary" disabled={i === total - 1} onClick={() => setI(i + 1)}>下一步 →</button>
          {scoped ? (
            <div className="viz-chips">
              {steps.map((st, k) => (
                <button key={k} type="button" className={`viz-chip${i === k ? " is-on" : ""}`} onClick={() => setI(k)}>{st.title}</button>
              ))}
            </div>
          ) : (
            <button type="button" className="viz-btn" onClick={() => setI(0)}>回到开头</button>
          )}
        </div>
        <div className="viz-envwire">
          <Envelope step={step} />
          <Wire step={step} />
        </div>
        <div className="viz-legend"><span><i style={{ background: "#2a78d6" }} />送到了</span><span><i style={{ background: "#e4dfcb" }} />在等 / 路过</span><span><i style={{ background: "#1baf7a" }} />重发的 / 补读的</span><span><i style={{ background: "#eda100" }} />回复 / 确认</span><span><b style={{ color: "#d03b3b" }}>✕</b> 丢了</span></div>
        <div className={`viz-narr${step.tone ? ` ${step.tone}` : ""}`}>
          <b>{scoped ? step.title : `${STAGES[step.stage]} · ${step.title}`}</b>　{step.narr}
        </div>
        {step.leftover && <div className="viz-narr is-warn" style={{ marginTop: 8 }}>{step.leftover}</div>}
      </div>
    </VisualizationFrame>
  );
}
