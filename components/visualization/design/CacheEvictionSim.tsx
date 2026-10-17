"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Policy = "LRU" | "LFU" | "FIFO";
const SEQ = ["A", "B", "C", "A", "A", "D", "B", "A", "E", "A", "C", "B"];
const CAP = 3;

const INFO: Record<Policy, string> = {
  LRU: "Least Recently Used：踢掉最久没被用过的。赌“最近用过的，马上还会用”。",
  LFU: "Least Frequently Used：踢掉被用次数最少的。赌“一直很热的，以后也热”。",
  FIFO: "First In First Out：踢掉最早进来的，不管它热不热。最简单，也最笨。",
};

function simulate(policy: Policy) {
  const cache: string[] = [];
  const lastUsed: Record<string, number> = {};
  const freq: Record<string, number> = {};
  const inserted: Record<string, number> = {};
  return SEQ.map((k, t) => {
    const hit = cache.includes(k);
    let evicted = "";
    if (!hit) {
      if (cache.length >= CAP) {
        let victim = cache[0];
        for (const c of cache) {
          if (policy === "LRU" && lastUsed[c] < lastUsed[victim]) victim = c;
          if (policy === "LFU" && (freq[c] < freq[victim] || (freq[c] === freq[victim] && lastUsed[c] < lastUsed[victim]))) victim = c;
          if (policy === "FIFO" && inserted[c] < inserted[victim]) victim = c;
        }
        evicted = victim;
        cache.splice(cache.indexOf(victim), 1);
      }
      cache.push(k);
      inserted[k] = t;
      freq[k] = 0;
    }
    lastUsed[k] = t;
    freq[k] = (freq[k] ?? 0) + 1;
    return { k, hit, evicted, after: [...cache], freq: { ...freq } };
  });
}

export default function CacheEvictionSim() {
  const [policy, setPolicy] = useState<Policy>("LRU");
  const [upto, setUpto] = useState(SEQ.length);
  const rows = useMemo(() => simulate(policy), [policy]);
  const all = useMemo(() => (["LRU", "LFU", "FIFO"] as Policy[]).map((p) => ({ p, hits: simulate(p).filter((r) => r.hit).length })), []);
  const shown = rows.slice(0, upto);
  const hits = shown.filter((r) => r.hit).length;
  return (
    <VisualizationFrame
      title="淘汰策略：缓存满了，踢谁"
      description={`缓存只能放 ${CAP} 个 key。同一串访问 A B C A A D B A E A C B，换一种策略看命中多少次。拖动滑块逐步看。`}
      footnote={<>TTL（time-to-live）是另一条独立的规则：每个 key 写进去时带一个过期时间，到点就失效，不管缓存满没满。它解决的是“数据会过时”，淘汰策略解决的是“地方不够”。两个通常一起用。</>}
    >
      <div className="viz-controls">
        <div className="viz-chips" role="group" aria-label="淘汰策略">
          {(["LRU", "LFU", "FIFO"] as Policy[]).map((p) => (
            <button key={p} type="button" className={`viz-chip${policy === p ? " is-on" : ""}`} onClick={() => setPolicy(p)}>{p}</button>
          ))}
        </div>
        <label><span className="viz-k">看到第</span><input type="range" min={1} max={SEQ.length} value={upto} onChange={(e) => setUpto(Number(e.target.value))} /><span className="viz-mono">{upto} / {SEQ.length} 次访问</span></label>
      </div>
      <p className="viz-k" style={{ marginBottom: 8 }}>{INFO[policy]}</p>
      <div style={{ overflowX: "auto" }}>
        <table className="viz-table">
          <thead><tr><th>第几次</th><th>访问</th><th>结果</th><th>踢掉</th><th>之后缓存里</th></tr></thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={i} style={i === upto - 1 ? { background: "#fdf9e9" } : undefined}>
                <td className="num">{i + 1}</td>
                <td className="viz-mono">{r.k}</td>
                <td style={{ color: r.hit ? "#0b7a4b" : "#d03b3b", fontWeight: 600 }}>{r.hit ? "命中" : "miss"}</td>
                <td className="viz-mono" style={{ color: "#d03b3b" }}>{r.evicted}</td>
                <td className="viz-mono">{r.after.map((x) => policy === "LFU" ? `${x}(${r.freq[x]})` : x).join("  ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="viz-narr">
        {policy} 在前 {upto} 次访问里命中 {hits} 次。整串访问三种策略的命中次数：{all.map((a) => `${a.p} ${a.hits}`).join("，")}。A 是一直很热的 key：FIFO 不管它热不热，到了先进先出的时候照样把它踢掉；LRU 和 LFU 都会尽量留住它。没有哪种策略永远最好，取决于访问模式，LRU 是默认选择。
      </div>
    </VisualizationFrame>
  );
}
