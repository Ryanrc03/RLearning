"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Action = "none" | "lost" | "naive" | "idem" | "herd";
type Msg = { from: "c" | "s"; label: string; lost?: boolean; t: number };
type State = { msgs: Msg[]; balance: number; seen: string[]; narr: string; tone?: string; note: string };

const C1 = "#2a78d6";
const LINE = "#76796f";

const STATES: Record<Action, State> = {
  none: { msgs: [{ from: "c", label: "扣 100 元", t: 0 }, { from: "s", label: "OK", t: 1 }], balance: 900, seen: [], narr: "客户端发“扣 100 元”，服务端扣完回 OK。正常情况一来一回。现在让回复在路上丢掉。", note: "余额 1000 → 900" },
  lost: { msgs: [{ from: "c", label: "扣 100 元", t: 0 }, { from: "s", label: "OK", t: 1, lost: true }], balance: 900, seen: [], narr: "服务端其实扣成功了，余额已经是 900，但 OK 在路上丢了。客户端等了 5 秒没回音，它只知道“超时”，不知道到底扣没扣。这是分布式里最阴险的一种失败：你无法区分“没执行”和“执行了但没告诉我”。", tone: "is-warn", note: "余额 900，但客户端不知道" },
  naive: { msgs: [{ from: "c", label: "扣 100 元", t: 0 }, { from: "s", label: "OK", t: 1, lost: true }, { from: "c", label: "扣 100 元（重试）", t: 2 }, { from: "s", label: "OK", t: 3 }], balance: 800, seen: [], narr: "客户端直接重试。服务端看到的是一个全新的“扣 100 元”，又扣了一次，余额 800。用户被扣了两次钱。不重试会漏，重试会重，两边都不对。", tone: "is-bad", note: "余额 800：扣了两次" },
  idem: { msgs: [{ from: "c", label: "扣 100 元 #req-7", t: 0 }, { from: "s", label: "OK", t: 1, lost: true }, { from: "c", label: "扣 100 元 #req-7（重试）", t: 2 }, { from: "s", label: "#req-7 做过了，OK", t: 3 }], balance: 900, seen: ["req-7"], narr: "每个请求带一个唯一 ID。服务端记着处理过的 ID，重试来了一看 req-7 做过，不再扣，直接把上次的结果回给客户端。重复执行和执行一次结果一样，这叫幂等。有了幂等，重试才是安全的。", tone: "is-good", note: "余额 900：第二次被去重" },
  herd: { msgs: [], balance: 900, seen: [], narr: "服务挂了 10 秒，一万个客户端同时超时。如果大家都在第 1 秒一起重试，服务刚起来就被一万个请求再砸死，这叫惊群。指数退避加随机抖动：第一次等 1 秒，第二次 2 秒，第三次 4 秒，每次再加一点随机，一万个重试被摊开到几十秒里，服务有机会喘过来。", tone: "is-warn", note: "" },
};

export default function IdempotentRetryDiagram() {
  const [action, setAction] = useState<Action>("none");
  const s = STATES[action];
  const W = 620;
  const H = 150;
  const rows = s.msgs.length;
  return (
    <VisualizationFrame
      title="回复丢了，重不重试？"
      description="客户端让服务端扣 100 元。按顺序点四个按钮，看余额怎么变。"
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${action === "lost" ? " is-on" : ""}`} onClick={() => setAction("lost")}>回复在路上丢了</button>
        <button type="button" className={`viz-btn${action === "naive" ? " is-on" : ""}`} onClick={() => setAction("naive")}>直接重试</button>
        <button type="button" className={`viz-btn${action === "idem" ? " is-on" : ""}`} onClick={() => setAction("idem")}>带请求 ID 重试</button>
        <button type="button" className={`viz-btn${action === "herd" ? " is-on" : ""}`} onClick={() => setAction("herd")}>一万个人同时重试</button>
        <button type="button" className="viz-btn" onClick={() => setAction("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={s.narr}>
          {action !== "herd" ? (
            <>
              <rect x={20} y={6} width={90} height={22} rx={5} fill="#3b4234" /><text x={65} y={21} fontSize={10.5} fontWeight={600} textAnchor="middle" fill="#fff">客户端</text>
              <rect x={330} y={6} width={90} height={22} rx={5} fill="#3b4234" /><text x={375} y={21} fontSize={10.5} fontWeight={600} textAnchor="middle" fill="#fff">服务端</text>
              <line x1={65} y1={28} x2={65} y2={H - 6} stroke="#e4dfcb" /><line x1={375} y1={28} x2={375} y2={H - 6} stroke="#e4dfcb" />
              {s.msgs.map((m, i) => {
                const y = 44 + i * 24;
                const x1 = m.from === "c" ? 65 : 375;
                const x2 = m.from === "c" ? 375 : 65;
                const xm = m.lost ? (x1 + x2) / 2 : x2;
                return (
                  <g key={i}>
                    <line x1={x1} y1={y} x2={xm} y2={y} stroke={m.lost ? "#d03b3b" : C1} strokeWidth={1.5} strokeDasharray={m.lost ? "4 3" : undefined} />
                    {!m.lost && <polygon points={m.from === "c" ? `${x2},${y} ${x2 - 7},${y - 4} ${x2 - 7},${y + 4}` : `${x2},${y} ${x2 + 7},${y - 4} ${x2 + 7},${y + 4}`} fill={C1} />}
                    {m.lost && <text x={xm + 4} y={y + 4} fontSize={10} fill="#d03b3b">✕ 丢了</text>}
                    <text x={220} y={y - 4} fontSize={9.5} textAnchor="middle" fill={m.lost ? "#d03b3b" : "#30332c"}>{m.label}</text>
                  </g>
                );
              })}
              <g transform="translate(450 40)">
                <rect width={160} height={70} rx={6} fill="#fff" stroke="#e4dfcb" />
                <text x={10} y={16} fontSize={9.5} fill={LINE}>服务端的账本</text>
                <text x={10} y={36} fontSize={13} fontWeight={700} fill={s.balance === 800 ? "#d03b3b" : "#30332c"} className="mono">余额 {s.balance}</text>
                <text x={10} y={56} fontSize={9.5} fill={LINE}>{s.seen.length ? `已处理：${s.seen.join(", ")}` : action === "idem" ? "" : "没有记录处理过谁"}</text>
              </g>
              {rows > 0 && <text x={20} y={H - 8} fontSize={9.5} fill={s.balance === 800 ? "#d03b3b" : LINE}>{s.note}</text>}
            </>
          ) : (
            <>
              <text x={0} y={14} fontSize={10.5} fontWeight={600} fill="#3b4234">一万个客户端的重试落在哪一秒</text>
              <text x={0} y={34} fontSize={9.5} fill={LINE}>一起重试</text>
              {Array.from({ length: 30 }, (_, k) => <rect key={k} x={60 + k * 18} y={k === 0 ? 24 : 42} width={14} height={k === 0 ? 20 : 2} fill={k === 0 ? "#d03b3b" : "#e4dfcb"} />)}
              <text x={60} y={60} fontSize={9} fill="#d03b3b">第 1 秒：10000 个请求，服务刚起来又被砸死</text>
              <text x={0} y={94} fontSize={9.5} fill={LINE}>退避 + 抖动</text>
              {Array.from({ length: 30 }, (_, k) => { const h = [6, 9, 12, 14, 15, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 6, 5, 5, 4, 4, 3, 3, 3, 2, 2, 2, 2, 1, 1, 1][k]; return <rect key={k} x={60 + k * 18} y={104 - h} width={14} height={h} fill="#1baf7a" />; })}
              <text x={60} y={120} fontSize={9} fill="#0b7a4b">摊开到 30 秒里，每秒几百个，服务扛得住</text>
              <text x={60} y={140} fontSize={9} fill={LINE}>第 1 秒　　　　　　　　　　　　　　　　　　　　　　　　　　　第 30 秒</text>
            </>
          )}
        </svg>
      </div>
      <div className={`viz-narr${s.tone ? ` ${s.tone}` : ""}`}>{s.narr}</div>
    </VisualizationFrame>
  );
}
