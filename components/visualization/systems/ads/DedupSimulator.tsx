"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import { fmt } from "@/lib/systems/ads/case";
import { DEFAULT_DEDUP, simulateDedup, type DedupParams } from "@/lib/systems/ads/dedup";

const SOURCE: Record<string, string> = { pixel: "Pixel", events_api: "Events API（retry）", replay: "Region B replay" };

export default function DedupSimulator() {
  const [p, setP] = useState<DedupParams>(DEFAULT_DEDUP);
  const set = (patch: Partial<DedupParams>) => setP((prev) => ({ ...prev, ...patch }));
  const r = simulateDedup(p);
  const dupAttr = r.attributionRows.reduce((s, a) => s + a.count - 1, 0);

  let narr: string;
  let tone: string;
  if (r.duplicateSamples === 0 && r.passed > r.trueUnique) {
    narr = `去重层放过了 ${r.passed - r.trueUnique} 条重复，但最终表按 sample_id / attribution_id 唯一写入，重复在最后一道关被吸收了。这就是“多层防御”：上游去重省下计算，下游幂等写入兜底正确性。`;
    tone = "is-good";
  } else if (r.duplicateSamples === 0) {
    narr = "4 条消息 → 2 个逻辑事件 → 2 条训练样本，没有重复。";
    tone = "is-good";
  } else {
    // Messages that passed although an earlier message with the same event_id had already passed.
    const slipped = r.messages.filter((m, i) => m.passed && r.messages.slice(0, i).some((e) => e.passed && e.delivery.eventId === m.delivery.eventId));
    const lesson = !p.dedupOn
      ? "没有去重层，三条 event_501 全部流到下游。"
      : slipped.some((m) => m.why.includes("另一个 Region"))
        ? "两个 Region 各自的本地去重加起来不等于全局去重。"
        : "去重必须说清楚“在多长时间范围内”唯一：TTL 短于重试 / 重放的间隔，就等于没去重。";
    const why = p.dedupOn ? `${slipped.map((m) => `#${m.delivery.seq}：${m.why}`).join(" ")} ${lesson}` : lesson;
    narr = `${why} 结果：归因表多了 ${dupAttr} 行（报表里转化被多算），append-only 样本表多了 ${r.duplicateSamples} 行（模型把同一个正样本学了两遍）。`;
    tone = "is-bad";
  }

  return (
    <VisualizationFrame
      title="Dedup Simulator"
      description="四条消息依次到达：event_501（Pixel）、event_502、event_501（Events API 重试）、event_501（Region B 故障恢复后重放）。打开或关掉每一层，看最后落到训练表里的是什么。"
      footnote="dedup key = {pixel_id}:{event}:{event_id}；attribution_id = attr:{event_id}:{policy}；sample_id = s:{task}:{click_id}:{label_policy}。三个键各管一层，不能混用。所有消息与时间是模拟数据。"
    >
      <div className="viz-controls">
        <label className="viz-check"><input type="checkbox" checked={p.dedupOn} onChange={() => set({ dedupOn: !p.dedupOn })} />Event dedup 层</label>
        <div className="viz-tabs" role="tablist" aria-label="去重状态范围">
          <button type="button" role="tab" aria-selected={p.scope === "regional"} disabled={!p.dedupOn} className={`viz-tab${p.scope === "regional" ? " is-on" : ""}`} onClick={() => set({ scope: "regional" })}>每个 Region 各一份状态</button>
          <button type="button" role="tab" aria-selected={p.scope === "global"} disabled={!p.dedupOn} className={`viz-tab${p.scope === "global" ? " is-on" : ""}`} onClick={() => set({ scope: "global" })}>全局 dedup authority</button>
        </div>
      </div>
      <div className="viz-slider"><span>Dedup TTL</span><input type="range" min={1} max={60} value={p.ttl} disabled={!p.dedupOn} onChange={(e) => set({ ttl: Number(e.target.value) })} aria-label="去重 TTL（分钟）" /><b>{p.ttl} min</b></div>
      <div className="viz-controls">
        <span className="viz-k">最终写入：</span>
        <div className="viz-tabs" role="tablist" aria-label="写入方式">
          <button type="button" role="tab" aria-selected={p.sink === "append"} className={`viz-tab${p.sink === "append" ? " is-on" : ""}`} onClick={() => set({ sink: "append" })}>Append-only</button>
          <button type="button" role="tab" aria-selected={p.sink === "unique_key"} className={`viz-tab${p.sink === "unique_key" ? " is-on" : ""}`} onClick={() => set({ sink: "unique_key" })}>唯一键 upsert（幂等）</button>
        </div>
        <button type="button" className="viz-btn" onClick={() => setP(DEFAULT_DEDUP)}>Reset</button>
      </div>

      <div className="ads-msgcards">
        {r.messages.map((m) => (
          <div key={m.delivery.seq} className={`ads-msgcard ${m.passed ? "is-pass" : "is-dup"}`}>
            <h6><span>#{m.delivery.seq} {m.delivery.eventId}</span><span className={`ads-tag ${m.passed ? "is-good" : "is-warn"}`}>{m.passed ? "放行" : "判为重复"}</span></h6>
            <div className="viz-k">{SOURCE[m.delivery.source]} · Region {m.delivery.region} · recv {fmt(m.delivery.receiveTime)}</div>
            <div style={{ marginTop: 4 }}>{m.why}</div>
          </div>
        ))}
      </div>

      <div className="ads-funnel" style={{ marginTop: 10 }}>
        <div><small>Messages received</small><b>{r.received}</b></div>
        <div><small>Duplicate detected</small><b>{r.duplicatesCaught}</b></div>
        <div className={r.passed > r.trueUnique ? "is-bad" : "is-good"}><small>当作新事件放行（真实只有 {r.trueUnique} 个）</small><b>{r.passed}</b></div>
        <div className={dupAttr ? "is-bad" : "is-good"}><small>Attribution 行</small><b>{r.attributionRows.reduce((s, a) => s + a.count, 0)}</b></div>
        <div className={r.duplicateSamples ? "is-bad" : "is-good"}><small>Final training samples</small><b>{r.sampleRows.reduce((s, a) => s + a.count, 0)}</b></div>
      </div>

      <div className="ads-table-wrap" style={{ marginTop: 10 }}>
        <table className="viz-table">
          <thead><tr><th>训练表里的 sample_id</th><th className="num">行数</th></tr></thead>
          <tbody>
            {r.sampleRows.map((s) => (
              <tr key={s.sampleId} className={s.count > 1 ? "is-hit" : ""}><td className="viz-mono">{s.sampleId}</td><td className="num">{s.count}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={`viz-narr ${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}
