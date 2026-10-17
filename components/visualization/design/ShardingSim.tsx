"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Strategy = "range" | "hash" | "ring";
const N_KEYS = 120;
const NEW_USERS = 24;
const VNODES = 100;
const COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#7b5cd6"];

// FNV-1a followed by a murmur-style finalizer so similar strings ("shard-0-vnode-1", "shard-0-vnode-2") spread evenly.
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return h >>> 0;
}

const RINGS: Record<number, { pos: number; shard: number }[]> = {};
function ring(shards: number) {
  if (!RINGS[shards]) {
    const pts: { pos: number; shard: number }[] = [];
    for (let s = 0; s < shards; s++) for (let v = 0; v < VNODES; v++) pts.push({ pos: hash(`shard-${s}-vnode-${v}`), shard: s });
    RINGS[shards] = pts.sort((a, b) => a.pos - b.pos);
  }
  return RINGS[shards];
}

function ringOwner(key: string, shards: number) {
  const points = ring(shards);
  const h = hash(key);
  const p = points.find((x) => x.pos >= h) ?? points[0];
  return p.shard;
}

function owner(strategy: Strategy, id: number, shards: number) {
  if (strategy === "range") return Math.min(shards - 1, Math.floor((id - 1) / 40));
  if (strategy === "hash") return hash(`user-${id}`) % shards;
  return ringOwner(`user-${id}`, shards);
}

const INFO: Record<Strategy, { name: string; rule: (n: number) => string }> = {
  range: { name: "按范围（range）", rule: (n) => `id 1–40 → S1，41–80 → S2，81–120 → S3${n === 4 ? "，121 以后 → S4" : ""}` },
  hash: { name: "按哈希取模（hash % n）", rule: (n) => `shard = hash(user_id) % ${n}` },
  ring: { name: "一致性哈希（带虚拟节点）", rule: (n) => `每个分片在环上放 ${VNODES} 个虚拟节点，key 顺时针找最近的；共 ${n} 个分片` },
};

export default function ShardingSim() {
  const [strategy, setStrategy] = useState<Strategy>("hash");
  const [four, setFour] = useState(false);
  const [newUsers, setNewUsers] = useState(false);
  const shards = four ? 4 : 3;
  const ids = useMemo(() => Array.from({ length: N_KEYS + (newUsers ? NEW_USERS : 0) }, (_, i) => i + 1), [newUsers]);
  const before = useMemo(() => ids.map((id) => owner(strategy, id, 3)), [ids, strategy]);
  const after = useMemo(() => ids.map((id) => owner(strategy, id, shards)), [ids, strategy, shards]);
  const moved = ids.filter((_, i) => before[i] !== after[i] && ids[i] <= N_KEYS).length;
  const counts = Array.from({ length: shards }, (_, s) => after.filter((x) => x === s).length);
  const newCounts = Array.from({ length: shards }, (_, s) => ids.filter((id, i) => id > N_KEYS && after[i] === s).length);

  let narr = "";
  let tone = "";
  if (!four && !newUsers) {
    narr = strategy === "range" ? "按 id 范围切：连续的 id 在同一个分片，范围查询（id 在 100 到 200 之间）只查一个分片，很方便。点“来了 24 个新用户”看它的问题。" : strategy === "hash" ? "按哈希取模：hash 把 key 打散，每个分片大致一样多。点“加一台分片”看它的问题。" : "一致性哈希：把分片和 key 都哈希到一个环上，key 归顺时针遇到的第一个分片。每个分片放很多虚拟节点，让分布更均匀。点“加一台分片”。";
  } else if (four) {
    if (strategy === "hash") { narr = `从 % 3 变成 % 4，${moved} / ${N_KEYS} 个 key 换了分片（约 ${Math.round((moved / N_KEYS) * 100)}%）。几乎所有数据都要搬家，搬的时候数据库压力巨大。这就是取模的致命问题：分片数一变，几乎全部重新分配。`; tone = "is-bad"; }
    else if (strategy === "ring") { narr = `新分片在环上插进来，只接走它的虚拟节点前面那一小段，${moved} / ${N_KEYS} 个 key 换了分片（约 ${Math.round((moved / N_KEYS) * 100)}%），理想值是 1/4。其余的 key 完全不动。这就是一致性哈希存在的理由：加减节点只搬一小部分数据。`; tone = "is-good"; }
    else { narr = `按范围切，加一台 S4 只接 121 以后的新 id，老数据 ${moved} 个都不用动。但看另一个按钮：新用户全部挤在最后一个分片。`; tone = "is-warn"; }
  } else {
    narr = strategy === "range" ? `${NEW_USERS} 个新用户（id 121–144）${four ? "全部进了 S4" : "全部进了 S3"}，因为新 id 永远落在最后一个范围。新用户最活跃，于是最后一个分片又热又满，其他分片很闲。这就是 range 的热点问题。` : `${NEW_USERS} 个新用户被 hash 打散到各个分片（${newCounts.join(" / ")}），没有热点。代价是“查 id 在某个范围内的用户”要去每个分片都问一遍。`;
    tone = strategy === "range" ? "is-bad" : "is-good";
  }

  return (
    <VisualizationFrame
      title="分片：120 个用户分到 3 台机器，然后加一台、来一批新用户"
      description="每个小格子是一个用户，颜色是它所在的分片。红框是“加了一台分片之后需要搬家”的。鼠标停在格子上看是哪个用户。"
      footnote={<>第三种分法“按目录”（directory-based）没有放进图里：单独存一张“用户 → 分片”的查找表，想放哪放哪，最灵活；代价是每次请求多查一次表，而且这张表自己成了单点，要做高可用。</>}
    >
      <div className="viz-chips" role="group" aria-label="分片方式" style={{ marginBottom: 10 }}>
        {(Object.keys(INFO) as Strategy[]).map((k) => (
          <button key={k} type="button" className={`viz-chip${strategy === k ? " is-on" : ""}`} onClick={() => setStrategy(k)}>{INFO[k].name}</button>
        ))}
      </div>
      <div className="viz-controls">
        <button type="button" className={`viz-btn${four ? " is-on" : ""}`} onClick={() => setFour(!four)}>{four ? "撤回第 4 台" : "加一台分片"}</button>
        <button type="button" className={`viz-btn${newUsers ? " is-on" : ""}`} onClick={() => setNewUsers(!newUsers)}>{newUsers ? "撤回新用户" : `来了 ${NEW_USERS} 个新用户`}</button>
        <span className="viz-k">{INFO[strategy].rule(shards)}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(24, minmax(0, 1fr))", gap: 3, marginBottom: 10 }}>
        {ids.map((id, i) => {
          const s = after[i];
          const mv = id <= N_KEYS && before[i] !== s;
          const isNew = id > N_KEYS;
          return (
            <div key={id} title={`user ${id} → S${s + 1}`} aria-label={`user ${id} 在 S${s + 1}${mv ? "，需要搬家" : ""}`} style={{ height: 18, borderRadius: 3, background: COLORS[s], opacity: isNew ? 0.55 : 0.9, outline: mv ? "2px solid #d03b3b" : isNew ? "1.5px dashed #30332c" : "none", outlineOffset: -2 }} />
          );
        })}
      </div>
      <div className="viz-legend">
        {counts.map((c, s) => <span key={s}><i style={{ background: COLORS[s] }} />S{s + 1}：{c} 个</span>)}
        {four && <span><b style={{ color: "#d03b3b" }}>□</b> 需要搬家：{moved} 个</span>}
        {newUsers && <span>虚线框：新用户</span>}
      </div>
      <div className={`viz-narr${tone ? ` ${tone}` : ""}`}>{narr}</div>
    </VisualizationFrame>
  );
}
