"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import { fmt, hm } from "@/lib/systems/ads/case";
import { DEFAULT_JOIN, LABEL_WINDOW_MIN, SIM_CLICKS, SIM_CONVERSIONS, simulateJoin, type ConversionOutcome, type JoinParams } from "@/lib/systems/ads/streaming";

const T0 = hm(9, 45);
const T1 = hm(12, 35);
const W = 660;
const X0 = 70;
const X1 = W - 12;
const x = (t: number) => X0 + ((Math.min(Math.max(t, T0), T1) - T0) / (T1 - T0)) * (X1 - X0);
const USERS = ["user_1", "user_2", "user_3", "user_4", "user_5"];
const LANE = 30;

const OUTCOME: Record<ConversionOutcome, { text: string; cls: string }> = {
  joined: { text: "Join 成功", cls: "is-good" },
  late: { text: "迟到", cls: "is-warn" },
  expired: { text: "状态已过期", cls: "is-bad" },
  no_click: { text: "无点击", cls: "" },
};
const FIX: Record<string, { text: string; cls: string }> = {
  none: { text: "—", cls: "" },
  side_output: { text: "side output → 修正为 1", cls: "is-warn" },
  backfill: { text: "离线 backfill → 修正为 1", cls: "is-warn" },
  lost: { text: "被丢弃，永远是 0", cls: "is-bad" },
};

export default function WatermarkSimulator() {
  const [p, setP] = useState<JoinParams>(DEFAULT_JOIN);
  const set = (patch: Partial<JoinParams>) => setP((prev) => ({ ...prev, ...patch }));
  const r = simulateJoin(p);
  const count = (o: ConversionOutcome) => r.conversions.filter((c) => c.outcome === o).length;
  const wrong = r.samples.filter((s) => s.streamLabel !== s.trueLabel);
  const lost = r.samples.filter((s) => s.fix === "lost");

  const narr = lost.length
    ? `${lost.map((s) => s.clickId).join("、")} 的转化迟到并被直接丢弃：它的 label 永远停在 0，模型会把一次真实购买当成负样本学。迟到数据至少要旁路到 side output，交给修正链路。`
    : wrong.length
      ? `流式结果里有 ${wrong.length} 个 label 暂时是错的（${wrong.map((s) => s.clickId).join("、")}），需要修正链路补回来。把 watermark delay 调大可以减少迟到，代价是结果更晚；把 TTL 调长可以接住更晚的转化，代价是状态更大。`
      : "所有转化都在流式 join 里接住了。注意代价：watermark delay 让按事件时间关窗的结果至少晚这么久输出，TTL 决定了状态里要存多少 click。";

  return (
    <VisualizationFrame
      title="Flink Watermark Simulator"
      description="5 个用户的点击和转化。每条泳道里，浅蓝条是 click 在 join 状态里存活的时间，◆ 是转化的事件时间，▲ 是它到达 Flink 的时间，红色竖线是它到达那一刻的 watermark。"
      footnote={`假设背景流量让“见过的最大事件时间”约等于处理时间，所以 watermark ≈ 处理时间 − watermark delay，转化的到达延迟超过 watermark delay 就算迟到。State TTL 按处理时间计（与 Flink 的 StateTtlConfig 一致）。Label window 固定为 ${LABEL_WINDOW_MIN / 60} 小时，是业务规则，不是这几个滑块中的任何一个。`}
    >
      <div className="viz-slider"><span>event_502 到达延迟</span><input type="range" min={0} max={30} value={p.delay502} onChange={(e) => set({ delay502: Number(e.target.value) })} aria-label="event_502 到达延迟（分钟）" /><b>{p.delay502} min</b></div>
      <div className="viz-slider"><span>Watermark delay</span><input type="range" min={0} max={20} value={p.watermarkDelay} onChange={(e) => set({ watermarkDelay: Number(e.target.value) })} aria-label="watermark delay（分钟）" /><b>{p.watermarkDelay} min</b></div>
      <div className="viz-slider"><span>Join state TTL</span><input type="range" min={30} max={180} step={10} value={p.stateTtl} onChange={(e) => set({ stateTtl: Number(e.target.value) })} aria-label="join state TTL（分钟）" /><b>{p.stateTtl} min</b></div>
      <div className="viz-controls">
        <span className="viz-k">迟到数据：</span>
        <div className="viz-tabs" role="tablist" aria-label="迟到数据处理">
          <button type="button" role="tab" aria-selected={p.late === "side_output"} className={`viz-tab${p.late === "side_output" ? " is-on" : ""}`} onClick={() => set({ late: "side_output" })}>旁路到 side output</button>
          <button type="button" role="tab" aria-selected={p.late === "drop"} className={`viz-tab${p.late === "drop" ? " is-on" : ""}`} onClick={() => set({ late: "drop" })}>直接丢弃</button>
        </div>
        <button type="button" className="viz-btn" onClick={() => setP(DEFAULT_JOIN)}>Reset</button>
      </div>

      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${USERS.length * LANE + 34}`} role="img" aria-label="每个用户的点击状态与转化到达时间">
          {[hm(10, 0), hm(10, 30), hm(11, 0), hm(11, 30), hm(12, 0), hm(12, 30)].map((t) => (
            <g key={t}><line x1={x(t)} y1={6} x2={x(t)} y2={USERS.length * LANE + 10} stroke="#ededed" /><text x={x(t)} y={USERS.length * LANE + 26} fontSize={9.5} textAnchor="middle" fill="#8b8b8b">{fmt(t)}</text></g>
          ))}
          {USERS.map((u, i) => {
            const y = 10 + i * LANE;
            const clicks = SIM_CLICKS.filter((c) => c.user === u);
            const conv = r.conversions.find((c) => c.user === u);
            const outcome = conv ? OUTCOME[conv.outcome] : null;
            const color = outcome?.cls === "is-good" ? "#0ca30c" : outcome?.cls === "is-warn" ? "#c98a00" : outcome?.cls === "is-bad" ? "#d03b3b" : "#8b8b8b";
            return (
              <g key={u}>
                <text x={0} y={y + 14} fontSize={10.5} fill="#3f3f3f" className="mono">{u}</text>
                {clicks.map((c) => (
                  <g key={c.id}>
                    <rect x={x(c.arrival)} y={y + 6} width={Math.max(2, x(c.arrival + p.stateTtl) - x(c.arrival))} height={12} fill="#d6e7fa" rx={3} />
                    <circle cx={x(c.eventTime)} cy={y + 12} r={4} fill="#2a78d6" />
                  </g>
                ))}
                {clicks.length > 0 && <text x={x(clicks[0].eventTime) + 6} y={y + 4} fontSize={8.5} fill="#2a78d6" className="mono">{clicks.map((c) => c.id).join(" · ")}</text>}
                {conv && (
                  <g>
                    <line x1={x(conv.eventTime)} y1={y + 12} x2={x(conv.arrival)} y2={y + 12} stroke={color} strokeWidth={1.5} />
                    <rect x={x(conv.eventTime) - 4} y={y + 8} width={8} height={8} fill={color} transform={`rotate(45 ${x(conv.eventTime)} ${y + 12})`} />
                    <polygon points={`${x(conv.arrival)},${y + 6} ${x(conv.arrival) - 5},${y + 16} ${x(conv.arrival) + 5},${y + 16}`} fill={color} />
                    <line x1={x(conv.watermarkAtArrival)} y1={y + 2} x2={x(conv.watermarkAtArrival)} y2={y + 22} stroke="#d03b3b" strokeDasharray="2 2" />
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="ads-funnel" style={{ marginTop: 10 }}>
        <div className="is-good"><small>Join 成功</small><b>{count("joined")}</b></div>
        <div className={count("late") ? "is-bad" : ""}><small>迟到（watermark 之后）</small><b>{count("late")}</b></div>
        <div className={count("expired") ? "is-bad" : ""}><small>状态已过期，未匹配</small><b>{count("expired")}</b></div>
        <div><small>无点击（本来就不归因）</small><b>{count("no_click")}</b></div>
        <div><small>状态里的 click（toy：每分钟 20 万次点击）</small><b>{(r.clicksInState / 1e6).toFixed(1)}M</b></div>
      </div>

      <div className="ads-table-wrap" style={{ marginTop: 10 }}>
        <table className="viz-table">
          <thead><tr><th>转化</th><th>事件时间</th><th>到达</th><th>到达时 watermark</th><th>结果</th><th>原因</th></tr></thead>
          <tbody>
            {r.conversions.map((c) => (
              <tr key={c.id}>
                <td className="viz-mono">{c.id}</td>
                <td className="num">{fmt(c.eventTime)}</td>
                <td className="num">{fmt(c.arrival)}</td>
                <td className="num">{fmt(c.watermarkAtArrival)}</td>
                <td><span className={`ads-tag ${OUTCOME[c.outcome].cls}`}>{OUTCOME[c.outcome].text}</span></td>
                <td>{c.explain}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ads-table-wrap" style={{ marginTop: 10 }}>
        <table className="viz-table">
          <thead><tr><th>Click 样本</th><th className="num">流式写出的 label</th><th className="num">数据到齐后应为</th><th>怎么补</th></tr></thead>
          <tbody>
            {r.samples.map((s) => (
              <tr key={s.clickId} className={s.streamLabel !== s.trueLabel ? "is-hit" : ""}>
                <td className="viz-mono">{s.clickId}</td>
                <td className="num">{s.streamLabel}{s.streamLabel !== s.trueLabel ? "（provisional）" : ""}</td>
                <td className="num">{s.trueLabel}</td>
                <td><span className={`ads-tag ${FIX[s.fix].cls}`}>{FIX[s.fix].text}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="viz-k" style={{ marginTop: 4 }}>{SIM_CONVERSIONS.length} 个转化、{SIM_CLICKS.length} 个点击；user_1 的转化按 last-click 给 click_101，所以 click_100 仍是 0。</div>

      <div className={`viz-narr${lost.length ? " is-bad" : wrong.length ? " is-warn" : " is-good"}`}>{narr}</div>
    </VisualizationFrame>
  );
}
