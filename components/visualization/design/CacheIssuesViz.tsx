"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Tab = "stampede" | "consistency" | "hot";

const RACE = [
  { who: "请求 A（读）", act: "查缓存 miss，去数据库读到 x = 1", cache: "空", db: "x = 1" },
  { who: "请求 B（写）", act: "把数据库改成 x = 2", cache: "空", db: "x = 2" },
  { who: "请求 B（写）", act: "删缓存（本来就是空的）", cache: "空", db: "x = 2" },
  { who: "请求 A（读）", act: "把刚才读到的 x = 1 写进缓存", cache: "x = 1（旧的！）", db: "x = 2" },
];

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="viz-bar-row">
      <span className="viz-bar-label">{label}</span>
      <div className="viz-bar-track"><span style={{ width: `${Math.max(1, (value / max) * 100)}%`, background: color }} /></div>
      <span className="viz-bar-val">{value}</span>
    </div>
  );
}

export default function CacheIssuesViz() {
  const [tab, setTab] = useState<Tab>("stampede");
  const [single, setSingle] = useState(false);
  const [warm, setWarm] = useState(false);
  const [step, setStep] = useState(0);
  const [ttl, setTtl] = useState(false);
  const [fix, setFix] = useState<"none" | "replicate" | "local">("none");

  const dbHits = warm ? 0 : single ? 1 : 1000;
  const hotLoad = fix === "none" ? [900, 50, 50] : fix === "replicate" ? [300, 350, 350] : [90, 50, 50];

  return (
    <VisualizationFrame
      title="缓存的三个常见事故：雪崩、不一致、热 key"
      description="每个标签是一种事故和它的解法。"
    >
      <div className="viz-chips" role="tablist" style={{ marginBottom: 12 }}>
        {([["stampede", "雪崩（stampede）"], ["consistency", "不一致"], ["hot", "热 key"]] as [Tab, string][]).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={`viz-chip${tab === k ? " is-on" : ""}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === "stampede" && (
        <>
          <div className="viz-controls">
            <label className="viz-check"><input type="checkbox" checked={single} onChange={(e) => setSingle(e.target.checked)} />请求合并（single flight）</label>
            <label className="viz-check"><input type="checkbox" checked={warm} onChange={(e) => setWarm(e.target.checked)} />过期前提前刷新（cache warming）</label>
          </div>
          <div className="viz-panel">
            <h5>热门商品详情的缓存在第 0 秒过期，同一秒来了 1000 个请求</h5>
            <div className="viz-bars">
              <Bar label="打到数据库的查询数" value={dbHits} max={1000} color={dbHits > 100 ? "#d03b3b" : "#1baf7a"} />
              <Bar label="缓存命中的请求" value={1000 - (warm ? 0 : single ? 1000 : 1000)} max={1000} color="#2a78d6" />
              <Bar label="等第一个查询结果的请求" value={single && !warm ? 999 : 0} max={1000} color="#eda100" />
            </div>
          </div>
          <div className={`viz-narr${dbHits > 100 ? " is-bad" : " is-good"}`}>
            {warm
              ? "过期之前后台就把它重新算好写回去了，key 根本没有空窗期，1000 个请求全部命中。适合可以预知的热 key。"
              : single
                ? "1000 个请求同时 miss，但只放第一个去查数据库，其余 999 个原地等这一个结果，拿到后一起返回。数据库只挨了 1 下。这叫请求合并或 single flight：同一个 key 同一时刻只回源一次。"
                : "热 key 过期的那一刻，1000 个请求同时 miss，同时去查数据库。数据库本来靠缓存挡着 99% 的流量，一下子被打穿，可能直接挂掉，然后所有请求都失败。这叫缓存雪崩或击穿。勾上两个解法试试。"}
          </div>
        </>
      )}

      {tab === "consistency" && (
        <>
          <div className="viz-controls">
            <button type="button" className="viz-btn" disabled={step === 0} onClick={() => setStep(step - 1)}>← 上一步</button>
            <span className="viz-mono">第 {step + 1} / {RACE.length} 步</span>
            <button type="button" className="viz-btn primary" disabled={step === RACE.length - 1} onClick={() => setStep(step + 1)}>下一步 →</button>
            <label className="viz-check"><input type="checkbox" checked={ttl} onChange={(e) => setTtl(e.target.checked)} />给缓存设一个短 TTL（30 秒）</label>
          </div>
          <table className="viz-table">
            <thead><tr><th>步骤</th><th>谁</th><th>做了什么</th><th>缓存</th><th>数据库</th></tr></thead>
            <tbody>
              {RACE.slice(0, step + 1).map((r, i) => (
                <tr key={i} style={i === step ? { background: "#fdf9e9" } : undefined}>
                  <td className="num">{i + 1}</td><td>{r.who}</td><td>{r.act}</td>
                  <td className="viz-mono" style={{ color: r.cache.includes("旧") ? "#d03b3b" : undefined }}>{r.cache}</td>
                  <td className="viz-mono">{r.db}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={`viz-narr${step === RACE.length - 1 ? (ttl ? " is-warn" : " is-bad") : ""}`}>
            {step < RACE.length - 1
              ? "写的时候删缓存（invalidate on write）是标准做法，但两个请求交错时仍然会出问题。一步步往下走。"
              : ttl
                ? "最后还是写进了旧值，但它最多活 30 秒就过期，下一次读会拿到 2。短 TTL 把“不一致”从永久变成了“最多 30 秒”。对大多数业务这个窗口可以接受；对余额、库存这种数据，不要把缓存当真相，关键操作直接读数据库。"
                : "读请求 A 拿着旧值慢了一步，在写请求删完缓存之后才把旧值写进去。数据库是 2，缓存是 1，而且没有任何东西会去纠正它，这个旧值会一直留着。勾上“短 TTL”看兜底效果。"}
          </div>
        </>
      )}

      {tab === "hot" && (
        <>
          <div className="viz-controls">
            <div className="viz-chips" role="group" aria-label="热 key 解法">
              {([["none", "不处理"], ["replicate", "热 key 复制到 3 个节点"], ["local", "应用本地再缓存一层"]] as ["none" | "replicate" | "local", string][]).map(([k, l]) => (
                <button key={k} type="button" className={`viz-chip${fix === k ? " is-on" : ""}`} onClick={() => setFix(k)}>{l}</button>
              ))}
            </div>
          </div>
          <div className="viz-panel">
            <h5>Taylor Swift 发了一条动态：每秒 1000 次读，同一个 key</h5>
            <div className="viz-bars">
              {["缓存节点 1（存着这个 key）", "缓存节点 2", "缓存节点 3"].map((n, i) => (
                <Bar key={n} label={n} value={hotLoad[i]} max={1000} color={hotLoad[i] > 600 ? "#d03b3b" : "#2a78d6"} />
              ))}
            </div>
            {fix === "local" && <p className="viz-k" style={{ marginTop: 6 }}>另外约 810 次读在应用自己的内存里就命中了，没有离开应用进程。</p>}
          </div>
          <div className={`viz-narr${fix === "none" ? " is-bad" : " is-good"}`}>
            {fix === "none"
              ? "缓存按 key 分到不同节点。一个 key 只在一个节点上，所以这个 key 的全部流量都砸在节点 1 上，其他节点很闲。节点 1 的网卡或 CPU 先打满。"
              : fix === "replicate"
                ? "把热 key 复制成 3 份（比如加后缀 key#1、key#2、key#3）分到 3 个节点，读的时候随机挑一份。负载被摊平，代价是更新时要改 3 份。"
                : "应用进程里再放一个很小、TTL 很短（比如 1 秒）的本地缓存，热 key 大部分读在本地就解决了。代价是每个应用实例的本地副本可能有 1 秒的不一致。"}
          </div>
        </>
      )}
    </VisualizationFrame>
  );
}
