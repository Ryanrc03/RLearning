"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Action = "none" | "fail" | "recover";

const C1 = "#2a78d6";
const LINE = "#76796f";
const SAVE_MIN = 3; // minutes per checkpoint
const FAIL_AT = 137; // minute of failure in the demo

export default function CheckpointFailoverSim() {
  const [interval, setInterval_] = useState(60);
  const [action, setAction] = useState<Action>("none");
  const stats = useMemo(() => {
    const lastCkpt = Math.floor(FAIL_AT / interval) * interval;
    const lost = FAIL_AT - lastCkpt;
    const overhead = SAVE_MIN / (interval + SAVE_MIN);
    const mtbfHours = 4; // 1000 GPUs: a failure every ~4 h
    const expectedLost = interval / 2;
    const wastePerDay = (24 / mtbfHours) * (expectedLost + 15); // 15 min restart
    return { lastCkpt, lost, overhead, wastePerDay, expectedLost };
  }, [interval]);
  const W = 620;
  const H = 120;
  const span = 240;
  const x = (m: number) => 40 + (m / span) * (W - 50);
  const ckpts = Array.from({ length: Math.floor(span / interval) + 1 }, (_, k) => k * interval).filter((m) => m > 0 && m <= span);

  const narr = action === "none"
    ? `1000 张卡做数据并行，每一步结束所有卡一起 all-reduce 梯度。每 ${interval} 分钟存一次 checkpoint，每次存要 ${SAVE_MIN} 分钟。拖动滑块，然后点“第 137 分钟一张卡挂了”。`
    : action === "fail"
      ? `第 137 分钟，卡 #412 挂了。all-reduce 等不到它，其余 999 张卡全部卡在那里，什么都算不了。心跳几秒内发现是哪张卡没了。现在能回到的最近一个 checkpoint 在第 ${stats.lastCkpt} 分钟，中间 ${stats.lost} 分钟的训练白算了。`
      : `整个任务停下，从第 ${stats.lastCkpt} 分钟的 checkpoint 恢复，用备用节点替换坏卡，1000 个 worker 重新一起启动（gang），大约再花 15 分钟。这次故障总共损失 ${stats.lost + 15} 分钟。1000 张卡的集群平均每 4 小时坏一张，按这个频率，每 ${interval} 分钟存一次，一天大约白算 ${Math.round(stats.wastePerDay)} 分钟，存盘本身占掉 ${(stats.overhead * 100).toFixed(1)}% 的时间。`;
  const tone = action === "fail" ? "is-bad" : action === "recover" ? "is-good" : "";

  return (
    <VisualizationFrame
      title="1000 张卡挂了一张：从 checkpoint 恢复要丢多少"
      description="滑块控制多久存一次 checkpoint。存太勤，训练一直在等存盘；存太少，挂一次丢几个小时。"
      footnote={<>示意假设：每次存盘 3 分钟，重启 15 分钟，1000 张卡平均每 4 小时出一次硬件故障。真实集群按自己的故障率算最优间隔，公式大致是 √(2 × 存盘时间 × 平均无故障时间)。</>}
    >
      <div className="viz-controls">
        <label><span className="viz-k">每隔</span><input type="range" min={10} max={120} step={10} value={interval} onChange={(e) => { setInterval_(Number(e.target.value)); }} /><span className="viz-mono">{interval} 分钟存一次</span></label>
        <button type="button" className={`viz-btn${action === "fail" ? " is-on" : ""}`} onClick={() => setAction("fail")}>第 137 分钟一张卡挂了</button>
        <button type="button" className={`viz-btn${action === "recover" ? " is-on" : ""}`} disabled={action === "none"} onClick={() => setAction("recover")}>从 checkpoint 恢复</button>
        <button type="button" className="viz-btn" onClick={() => setAction("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={narr}>
          <text x={0} y={30} fontSize={9.5} fill={LINE}>训练</text>
          <rect x={x(0)} y={20} width={x(action === "none" ? span : FAIL_AT) - x(0)} height={16} rx={3} fill={C1} opacity={0.85} />
          {action !== "none" && stats.lost > 0 && <rect x={x(stats.lastCkpt)} y={20} width={x(FAIL_AT) - x(stats.lastCkpt)} height={16} rx={3} fill="#d03b3b" opacity={0.6} />}
          {action === "recover" && <rect x={x(FAIL_AT)} y={20} width={x(Math.min(span, FAIL_AT + 15)) - x(FAIL_AT)} height={16} rx={3} fill="#eda100" opacity={0.7} />}
          {action === "recover" && <rect x={x(Math.min(span, FAIL_AT + 15))} y={20} width={Math.max(0, x(span) - x(Math.min(span, FAIL_AT + 15)))} height={16} rx={3} fill={C1} opacity={0.5} />}
          {ckpts.map((m) => (
            <g key={m}>
              <rect x={x(m) - 2} y={18} width={Math.max(2, x(SAVE_MIN) - x(0))} height={20} fill="#3b4234" opacity={0.6} />
              <text x={x(m)} y={52} fontSize={8.5} textAnchor="middle" fill={action !== "none" && m === stats.lastCkpt ? "#0b7a4b" : LINE}>{m}</text>
              <text x={x(m)} y={62} fontSize={8} textAnchor="middle" fill={action !== "none" && m === stats.lastCkpt ? "#0b7a4b" : "#a8a693"}>{action !== "none" && m === stats.lastCkpt ? "回到这" : "存盘"}</text>
            </g>
          ))}
          {action !== "none" && (
            <g>
              <line x1={x(FAIL_AT)} y1={12} x2={x(FAIL_AT)} y2={44} stroke="#d03b3b" strokeWidth={2} />
              <text x={x(FAIL_AT) + 4} y={14} fontSize={9.5} fontWeight={700} fill="#d03b3b">✕ 第 137 分钟，卡 #412 挂了</text>
            </g>
          )}
          <text x={x(0)} y={80} fontSize={8.5} fill="#a8a693">0 分钟</text>
          <text x={x(span)} y={80} fontSize={8.5} textAnchor="end" fill="#a8a693">240 分钟</text>
          <text x={0} y={104} fontSize={10} fill="#30332c">
            存盘开销 <tspan fontWeight={700}>{(stats.overhead * 100).toFixed(1)}%</tspan>　　挂一次平均白算 <tspan fontWeight={700}>{stats.expectedLost} 分钟</tspan>　　按每 4 小时坏一张算，一天白算 <tspan fontWeight={700} fill={stats.wastePerDay > 180 ? "#d03b3b" : "#30332c"}>{Math.round(stats.wastePerDay)} 分钟</tspan>
          </text>
        </svg>
      </div>
      <div className="viz-legend"><span><i style={{ background: C1 }} />在训练</span><span><i style={{ background: "#3b4234", opacity: 0.6 }} />存 checkpoint</span><span><i style={{ background: "#d03b3b", opacity: 0.6 }} />白算了</span><span><i style={{ background: "#eda100", opacity: 0.7 }} />换卡重启</span></div>
      <div className={`viz-narr ${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}
