"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import { STREAM_EVENTS, TRAFFIC_SHARE, keyOf, lagAfter, partitionOf, type PartitionKey } from "@/lib/systems/ads/streaming";

const KEYS: { id: PartitionKey; name: string }[] = [
  { id: "user_id", name: "key = user_id" },
  { id: "event_id", name: "key = event_id" },
  { id: "advertiser_id", name: "key = advertiser_id" },
];
const USER_COLOR: Record<string, string> = { user_1: "#2a78d6", user_2: "#eb6834", user_3: "#1baf7a", user_4: "#eda100", user_5: "#8b6fe0" };
const PRODUCE = 30_000;
const MINUTES = 10;
const DEFAULT_CONSUMER = 11_000;

export default function PartitionViz() {
  const [key, setKey] = useState<PartitionKey>("user_id");
  const [consumer, setConsumer] = useState(DEFAULT_CONSUMER);
  const lag = lagAfter(key, PRODUCE, consumer, MINUTES);
  const user1 = new Set(STREAM_EVENTS.filter((e) => e.user === "user_1").map((e) => partitionOf(e, key)));
  const maxLag = Math.max(1, ...lag.lag);
  const reset = () => { setKey("user_id"); setConsumer(DEFAULT_CONSUMER); };

  const narrParts: string[] = [];
  if (key === "user_id") narrParts.push("同一个用户的 click 和 conversion 进了同一个 partition：只要 clicks 和 conversions 两个 topic 用同样的 key、同样的分区数和分区函数，Joiner 的同一个实例就能在本地找到它们，并且同一用户内有序。");
  if (key === "event_id") narrParts.push("每条消息分到哪个 partition 只看自己的 event_id：负载最均匀，但 user_1 的三条消息散在不同 partition。Join 之前必须再按 user_id 做一次 repartition（Flink 里的 keyBy，就是一次网络 shuffle），而且不同 partition 之间没有顺序。");
  if (key === "advertiser_id") narrParts.push("按广告主分区，大广告主 adv_42 的所有消息都挤进同一个 partition：一个 partition 只能被组里的一个 consumer 读，它成了热点。");
  if (lag.pipelineDelay > 0.05) narrParts.push(`10 分钟后最慢的 partition 积压 ${Math.round(Math.max(...lag.lag)).toLocaleString()} 条，新消息要等约 ${lag.pipelineDelay.toFixed(1)} 分钟才被读到。下游按事件时间推进时取所有输入的最小值，一个慢 partition 会拖住整个 join，训练数据整体变旧。`);
  else narrParts.push("每个 consumer 都跟得上，lag 不增长，训练数据的新鲜度主要由 join 等待和 label window 决定。");

  return (
    <VisualizationFrame
      title="Partition Key 与 Consumer Lag"
      description="9 条消息写入一个 3-partition 的 topic。换 partition key 看它们落到哪；再拖每个 consumer 的处理速度，看 lag 怎样变成训练数据的延迟。"
      footnote={`toy 流量：生产者每秒 ${PRODUCE.toLocaleString()} 条，持续 ${MINUTES} 分钟；每个 partition 一个 consumer。分区用 FNV-1a 哈希取模，真实 Kafka 默认分区器用的是 murmur2。`}
    >
      <div className="viz-controls">
        <div className="viz-tabs" role="tablist" aria-label="partition key">
          {KEYS.map((k) => (
            <button key={k.id} type="button" role="tab" aria-selected={key === k.id} className={`viz-tab${key === k.id ? " is-on" : ""}`} onClick={() => setKey(k.id)}>{k.name}</button>
          ))}
        </div>
      </div>

      <div className="ads-regions" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        {[0, 1, 2].map((p) => (
          <div key={p} className="ads-region">
            <b>P{p}</b> <span className="viz-k">流量 {Math.round(TRAFFIC_SHARE[key][p] * 100)}%</span>
            <div className="viz-chips" style={{ marginTop: 6 }}>
              {STREAM_EVENTS.filter((e) => partitionOf(e, key) === p).map((e) => (
                <span key={e.id} className="ads-tag" style={{ borderColor: USER_COLOR[e.user], color: USER_COLOR[e.user] }} title={`${e.user} · ${e.advertiser} · key=${keyOf(e, key)}`}>
                  {e.kind === "click" ? "◉" : "◆"} {e.id}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="viz-legend">
        {Object.entries(USER_COLOR).map(([u, c]) => <span key={u}><i style={{ background: c }} />{u}</span>)}
        <span>◉ click　◆ conversion</span>
        <span className={`ads-tag ${user1.size === 1 ? "is-good" : "is-warn"}`}>user_1 分布在 {user1.size} 个 partition</span>
      </div>

      <div className="ads-section">
        <h5>Consumer lag</h5>
        <div className="viz-slider">
          <span>每个 consumer</span>
          <input type="range" min={6000} max={24000} step={1000} value={consumer} onChange={(e) => setConsumer(Number(e.target.value))} aria-label="每个 consumer 每秒处理条数" />
          <b>{(consumer / 1000).toFixed(0)}k/s</b>
        </div>
        <div className="viz-bars">
          {lag.lag.map((l, p) => (
            <div key={p} className="viz-bar-row">
              <span className="viz-bar-label">P{p} · 进 {(TRAFFIC_SHARE[key][p] * PRODUCE / 1000).toFixed(1)}k/s</span>
              <span className="viz-bar-track"><span style={{ width: `${(l / maxLag) * 100}%`, background: l > 0 ? "var(--vcrit)" : "var(--v3)" }} /></span>
              <span className="viz-bar-val">{l > 0 ? `lag ${(l / 1e6).toFixed(1)}M · 晚 ${lag.freshness[p].toFixed(1)} min` : "lag 0"}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="viz-controls" style={{ marginTop: 10, marginBottom: 0 }}>
        <button type="button" className="viz-btn" onClick={reset}>Reset</button>
      </div>
      <div className={`viz-narr${lag.pipelineDelay > 0.05 ? " is-bad" : user1.size > 1 ? " is-warn" : " is-good"}`}>{narrParts.join(" ")}</div>
    </VisualizationFrame>
  );
}
