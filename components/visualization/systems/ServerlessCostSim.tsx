"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Pattern = "sparse" | "wave" | "flat";
const PATTERNS: Record<Pattern, { name: string; desc: string; rate: number[] }> = {
  sparse: { name: "偶发", desc: "一天几百次，比如 webhook、上传后生成缩略图", rate: [0, 0, 0, 0, 0, 0, 0.002, 0.005, 0.01, 0.01, 0.005, 0.01, 0.005, 0.005, 0.01, 0.01, 0.005, 0.005, 0.002, 0.002, 0, 0, 0, 0] },
  wave: { name: "日夜波动", desc: "白天 200 req/s，夜里 5 req/s，比如面向用户的 API", rate: [5, 5, 5, 5, 5, 10, 40, 100, 160, 200, 200, 180, 200, 200, 190, 170, 160, 150, 120, 90, 60, 30, 10, 5] },
  flat: { name: "持续满载", desc: "全天 1000 req/s，比如推理服务、消息消费者", rate: Array(24).fill(1000) },
};

const MACHINE_CAP = 100; // req/s one machine handles
const MACHINE_HOUR = 1; // 元 per machine-hour
const PER_REQ = 0.00002; // 元 per serverless invocation (100 ms, 256 MB)
const COLD_MS = 800;
const WARM_MS = 20;

function fmt(n: number) {
  return n >= 100 ? n.toFixed(0) : n >= 1 ? n.toFixed(1) : n >= 0.01 ? n.toFixed(2) : n.toFixed(4);
}

export default function ServerlessCostSim() {
  const [pattern, setPattern] = useState<Pattern>("sparse");
  const [coldOk, setColdOk] = useState(false);
  const p = PATTERNS[pattern];
  const sim = useMemo(() => {
    const peak = Math.max(...p.rate);
    const reqs = p.rate.reduce((a, b) => a + b, 0) * 3600;
    const fixedMachines = Math.max(1, Math.ceil(peak / MACHINE_CAP));
    const fixedCost = fixedMachines * 24 * MACHINE_HOUR;
    const autoInst = p.rate.map((r) => Math.max(1, Math.ceil(r / MACHINE_CAP)));
    const autoCost = autoInst.reduce((a, b) => a + b, 0) * MACHINE_HOUR;
    const slInst = p.rate.map((r) => Math.ceil(r / 10));
    const slCost = reqs * PER_REQ;
    // cold-start share: requests arriving after > 15 min idle. Approximate: hours with rate < 1/900 req/s are "mostly cold".
    const coldShare = pattern === "sparse" ? 0.7 : pattern === "wave" ? 0.01 : 0;
    const slP99 = coldShare > 0.05 ? COLD_MS : coldShare > 0 ? 120 : WARM_MS;
    const autoP99 = pattern === "wave" ? 400 : WARM_MS; // scale-up lag when load climbs
    return { reqs, fixedMachines, fixedCost, autoInst, autoCost, slInst, slCost, coldShare, slP99, autoP99, peak };
  }, [p, pattern]);

  const rows = [
    { name: "常驻机器", sub: `按峰值备 ${sim.fixedMachines} 台，全天开着`, cost: sim.fixedCost, p99: WARM_MS, color: "#8c8c3a" },
    { name: "容器自动扩缩", sub: "按负载增减副本，至少留 1 个", cost: sim.autoCost, p99: sim.autoP99, color: "#1baf7a" },
    { name: "Serverless", sub: "按调用次数和毫秒计费，闲时 0 实例", cost: sim.slCost, p99: sim.slP99, color: "#2a78d6" },
  ];
  const maxCost = Math.max(...rows.map((r) => r.cost));
  const W = 560;
  const chartH = 70;
  const maxRate = Math.max(1, sim.peak);

  const cheapest = rows.reduce((a, b) => (a.cost < b.cost ? a : b));
  const narr = pattern === "sparse"
    ? `一天只有 ${Math.round(sim.reqs)} 次调用。常驻机器 95% 的时间在空转，还是要付 24 小时的钱；serverless 只为这 ${Math.round(sim.reqs)} 次付费，便宜几千倍。代价是 ${Math.round(sim.coldShare * 100)}% 的请求碰上冷启动，p99 接近 1 秒。${coldOk ? "你说这个活不在乎等 1 秒，那 serverless 就是最优解。" : "如果这个活不能等，要么接受贵几千倍的常驻机器，要么用预热实例。"}`
    : pattern === "wave"
      ? `白天 200 req/s、夜里 5 req/s。常驻机器按峰值备 ${sim.fixedMachines} 台，夜里大半在睡觉；自动扩缩夜里缩到 1 台，省了一半，但早高峰爬坡时副本启动要几十秒，p99 会抖一下；serverless 跟得最紧，可是一天 ${(sim.reqs / 1e6).toFixed(1)} 百万次调用按次计费，已经比容器贵 ${(sim.slCost / sim.autoCost).toFixed(1)} 倍。运维最省心，账单最贵。`
      : `全天 1000 req/s 从不停歇。serverless 按次计费一天 ${fmt(sim.slCost)} 元，是常驻机器的 ${(sim.slCost / sim.fixedCost).toFixed(1)} 倍：跑得越多越亏。持续满载的活，比如推理服务和训练，要的是常驻的、调度精细的集群，不是 serverless。`;

  return (
    <VisualizationFrame
      title="按流量形状选执行模型：成本与延迟"
      description="选一种一天的流量形状，比较三种跑法的成本和尾延迟。数字是示意的相对量级，规律不依赖具体价格。"
      footnote={<>假设：一台机器扛 100 req/s、每小时 1 元；serverless 每次调用 0.00002 元（100 ms、256 MB）；冷启动约 800 ms，热调用约 20 ms；自动扩缩在爬坡时有几十秒的滞后。</>}
    >
      <div className="viz-controls">
        <div className="viz-chips" role="group" aria-label="流量形状">
          {(Object.keys(PATTERNS) as Pattern[]).map((k) => (
            <button key={k} type="button" className={`viz-chip${pattern === k ? " is-on" : ""}`} onClick={() => setPattern(k)}>{PATTERNS[k].name}</button>
          ))}
        </div>
        <span className="viz-k">{p.desc}</span>
        {pattern === "sparse" && <label className="viz-check"><input type="checkbox" checked={coldOk} onChange={(e) => setColdOk(e.target.checked)} />这个活等 1 秒也没关系</label>}
      </div>
      <div className="viz-panel">
        <h5>一天 24 小时的负载，和每种跑法同时开着几个实例</h5>
        <div className="viz-scroll">
          <svg viewBox={`0 0 ${W} ${chartH + 82}`} role="img" aria-label={`${p.name}：一天的负载曲线与三种跑法的实例数`}>
            {p.rate.map((r, h) => (
              <rect key={h} x={40 + h * ((W - 40) / 24)} y={chartH - (r / maxRate) * chartH + 4} width={(W - 40) / 24 - 2} height={Math.max((r / maxRate) * chartH, r > 0 ? 1.5 : 0)} fill="#d9d5c4" />
            ))}
            <text x={0} y={12} fontSize={9} fill="#76796f">req/s</text>
            <text x={0} y={chartH + 4} fontSize={9} fill="#76796f">0</text>
            {[0, 6, 12, 18, 23].map((h) => <text key={h} x={h === 23 ? W : 40 + h * ((W - 40) / 24) + 4} y={chartH + 16} fontSize={8.5} fill="#a8a693" textAnchor={h === 23 ? "end" : "start"}>{h}:00</text>)}
            {[{ label: "常驻", data: Array(24).fill(sim.fixedMachines), color: "#8c8c3a" }, { label: "扩缩", data: sim.autoInst, color: "#1baf7a" }, { label: "无服务器", data: sim.slInst, color: "#2a78d6" }].map((row, ri) => (
              <g key={row.label} transform={`translate(0 ${chartH + 26 + ri * 18})`}>
                <text x={0} y={11} fontSize={9} fill="#76796f">{row.label}</text>
                {row.data.map((n, h) => (
                  <g key={h}>
                    <rect x={40 + h * ((W - 40) / 24)} y={2} width={(W - 40) / 24 - 2} height={12} rx={2} fill={row.color} opacity={n === 0 ? 0.08 : Math.min(1, 0.25 + n / Math.max(1, Math.max(...row.data)) * 0.75)} />
                    {h % 6 === 0 && <text x={40 + h * ((W - 40) / 24) + ((W - 40) / 24 - 2) / 2} y={11} fontSize={8} textAnchor="middle" fill={n === 0 ? "#a8a693" : "#fff"}>{n}</text>}
                  </g>
                ))}
              </g>
            ))}
          </svg>
        </div>
      </div>
      <table className="viz-table">
        <thead><tr><th>跑法</th><th>一天的成本（元，示意）</th><th className="num">p99 延迟</th><th>为什么</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} style={r === cheapest ? { fontWeight: 600 } : undefined}>
              <td>{r.name}<br /><span className="viz-k">{r.sub}</span></td>
              <td>
                <div className="viz-bar-track" style={{ maxWidth: 180, display: "inline-block", width: 180, verticalAlign: "middle" }}><span style={{ width: `${Math.max(1, (r.cost / maxCost) * 100)}%`, background: r.color }} /></div>
                <span className="viz-bar-val" style={{ marginLeft: 8 }}>{fmt(r.cost)}</span>
              </td>
              <td className="num">{r.p99} ms</td>
              <td className="viz-k">{r.name === "Serverless" ? (sim.coldShare > 0.05 ? `${Math.round(sim.coldShare * 100)}% 的请求冷启动` : sim.coldShare > 0 ? "偶尔冷启动" : "一直热") : r.name === "容器自动扩缩" ? (sim.autoP99 > WARM_MS ? "爬坡时副本还在启动" : "副本够用") : "机器一直开着"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={`viz-narr${pattern === "flat" ? " is-warn" : pattern === "sparse" && !coldOk ? " is-warn" : " is-good"}`}>{narr}</div>
    </VisualizationFrame>
  );
}
