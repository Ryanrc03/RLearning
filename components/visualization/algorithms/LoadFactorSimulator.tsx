"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import { probesFor, sampleKeys, simulateLoad, type LoadSnapshot, type Slot } from "@/lib/algorithms/hashMap";

const MAX_N = 60;
const KEYS = sampleKeys(MAX_N, 1);
const THRESHOLDS: { v: number; label: string; who: string }[] = [
  { v: 0.5, label: "0.5", who: "本文手写版" },
  { v: 2 / 3, label: "2/3", who: "CPython dict" },
  { v: 0.75, label: "0.75", who: "Java HashMap" },
  { v: 0.9, label: "0.9", who: "几乎塞满" },
];

const fmt = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(2));

function SlotGrid({ slots, keys, pick, onPick, fresh }: { slots: Slot[]; keys: number[]; pick: number | null; onPick: (k: number | null) => void; fresh?: number }) {
  const cap = slots.length;
  const cols = cap <= 16 ? cap : cap <= 32 ? 16 : 32;
  const present = new Set(keys);
  return (
    <div className="hm-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }} role="list" aria-label={`容量 ${cap} 的表`}>
      {slots.map((s, i) => {
        const occupied = s.state === "occupied" && present.has(s.key!);
        const p = occupied ? probesFor(slots, s.key!) : 0;
        const cls = ["hm-cellbox"];
        if (occupied) cls.push(p === 1 ? "p1" : p === 2 ? "p2" : p <= 4 ? "p3" : "p4");
        if (occupied && s.key === pick) cls.push("is-pick");
        if (pick !== null && pick % cap === i) cls.push("is-pickhome");
        if (occupied && s.key === fresh) cls.push("is-new");
        return (
          <span key={i} role="listitem" className={cls.join(" ")} title={occupied ? `index ${i}: key ${s.key}（home ${s.key! % cap}，${p} 次探测）` : `index ${i}: EMPTY`} onMouseEnter={() => onPick(occupied ? s.key! : null)} onClick={() => onPick(occupied ? s.key! : null)}>
            {occupied && cap <= 64 ? s.key : ""}
          </span>
        );
      })}
    </div>
  );
}

// The simulator inserts a fixed, seeded key stream into a linear-probing table and lets
// the reader drag n. Everything shown (α, displaced keys, probe lengths, the table before
// and after the last resize, the per-insert cost bars) is computed by simulateLoad().
export default function LoadFactorSimulator() {
  const [n, setN] = useState(12);
  const [ti, setTi] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const maxLoad = THRESHOLDS[ti].v;
  const snaps = useMemo(() => simulateLoad(KEYS, maxLoad), [maxLoad]);
  const cur: LoadSnapshot = snaps[n - 1];
  const keys = KEYS.slice(0, n);
  const lastResize = [...snaps.slice(0, n)].reverse().find((s) => s.resizedFrom);
  const resizes = snaps.slice(0, n).filter((s) => s.resizedFrom).length;
  const costs = snaps.slice(0, n).map((s, i) => s.totalWrites - (i ? snaps[i - 1].totalWrites : 0));
  const maxCost = Math.max(...costs, 1);

  // cost chart geometry
  const W = 520, H = 100, padL = 28, padB = 16;
  const bw = (W - padL - 4) / MAX_N;
  const sy = (c: number) => H - padB - (c / maxCost) * (H - padB - 8);

  return (
    <VisualizationFrame
      title="Load Factor Simulator：α = n / capacity"
      description="拖动 n，往一张初始容量 8 的线性探测表里依次放入同一串 key。看负载因子一升高，离开 home slot 的 key 和平均探测次数怎么涨；超过阈值时表翻倍、所有 key 重新计算位置。"
      footnote="格子颜色是找到这个 key 需要的探测次数：绿 1 次（就在 home slot），黄 2 次，橙 3–4 次，红 5 次以上。悬停或点击一个 key，会同时在 resize 前后的两张表里标出它（实心边框）和它的 home slot（蓝色内框）。"
    >
      <div className="hm-row">
        <label>n = <b className="viz-mono">{n}</b>
          <input type="range" min={1} max={MAX_N} value={n} onChange={(e) => { setN(Number(e.target.value)); setPick(null); }} aria-label="已插入的 key 数量" />
        </label>
        <div className="viz-chips" role="group" aria-label="扩容阈值">
          {THRESHOLDS.map((t, i) => <button key={t.label} type="button" className={`viz-chip${i === ti ? " is-on" : ""}`} aria-pressed={i === ti} onClick={() => { setTi(i); setPick(null); }}>α &gt; {t.label} 扩容 · {t.who}</button>)}
        </div>
      </div>
      <div className="viz-stat">
        <div><small>capacity</small><b>{cur.capacity}</b></div>
        <div><small>α = {n} / {cur.capacity}</small><b>{cur.n / cur.capacity < 0.995 ? (cur.n / cur.capacity).toFixed(2) : "1.00"}</b></div>
        <div><small>离开 home slot 的 key</small><b>{cur.displaced}<span className="delta">/ {n}</span></b></div>
        <div><small>平均 / 最长探测</small><b>{fmt(cur.avgProbes)}<span className="delta">/ {cur.maxProbes}</span></b></div>
        <div><small>已 resize 次数</small><b>{resizes}</b></div>
        <div><small>总写入 / n（均摊）</small><b>{(cur.totalWrites / n).toFixed(2)}</b></div>
      </div>

      <div className="viz-panel" style={{ marginTop: 12 }}>
        <h5 className="nocase">当前的表 · capacity = {cur.capacity}，刚放入 key {keys[n - 1]}（home = {keys[n - 1] % cur.capacity}）</h5>
        <SlotGrid slots={cur.slots} keys={keys} pick={pick} onPick={setPick} fresh={keys[n - 1]} />
        {pick !== null && <p className="viz-k" style={{ marginTop: 8 }}>key {pick}：home = {pick} % {cur.capacity} = {pick % cur.capacity}，实际在 index {cur.slots.findIndex((s) => s.state === "occupied" && s.key === pick)}，查找需要 {probesFor(cur.slots, pick)} 次探测。</p>}
      </div>

      <div className="viz-grid2" style={{ marginTop: 12 }}>
        <div className="viz-panel">
          <h5>最近一次 Resize / Rehash</h5>
          {!lastResize && <p className="viz-k">还没有触发过扩容。继续加大 n，当 (n + 1) / capacity 超过 {THRESHOLDS[ti].label} 时会翻倍。</p>}
          {lastResize && (
            <div className="hm-resize-pair">
              <p className="viz-k">放入第 {lastResize.n} 个 key（{KEYS[lastResize.n - 1]}）之前：{lastResize.n} / {lastResize.resizedFrom!.capacity} 会超过 {THRESHOLDS[ti].label}，于是先把 {lastResize.n - 1} 个已有 key 逐个重新计算 key % {lastResize.capacity}，写进新表，再放入它。</p>
              <div><h6>之前 · capacity {lastResize.resizedFrom!.capacity}</h6><SlotGrid slots={lastResize.resizedFrom!.slots} keys={KEYS.slice(0, lastResize.n - 1)} pick={pick} onPick={setPick} /></div>
              <div><h6>之后 · capacity {lastResize.capacity}</h6><SlotGrid slots={lastResize.slots} keys={KEYS.slice(0, lastResize.n)} pick={pick} onPick={setPick} fresh={KEYS[lastResize.n - 1]} /></div>
              {pick !== null && KEYS.indexOf(pick) < lastResize.n - 1 && (
                <p className="viz-k">key {pick}：{pick} % {lastResize.resizedFrom!.capacity} = {pick % lastResize.resizedFrom!.capacity} → {pick} % {lastResize.capacity} = {pick % lastResize.capacity}。容量翻倍后，每个 key 要么留在原下标，要么挪到「原下标 + 旧容量」，取决于 hash 新多出来的那一位。</p>
              )}
            </div>
          )}
        </div>
        <div className="viz-panel">
          <h5>每次插入写了多少格</h5>
          <svg className="hm-cost" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="每次插入的写入次数，扩容时出现尖峰">
            {costs.map((c, i) => <rect key={i} className={c > 1 ? "spike" : "base"} x={padL + i * bw} y={sy(c)} width={Math.max(bw - 1, 1)} height={H - padB - sy(c)} />)}
            <line className="avg" x1={padL} x2={W - 4} y1={sy(cur.totalWrites / n)} y2={sy(cur.totalWrites / n)} />
            <text x={padL - 4} y={sy(cur.totalWrites / n)} textAnchor="end">均摊 {(cur.totalWrites / n).toFixed(1)}</text>
            <text x={padL - 4} y={sy(maxCost)} textAnchor="end">{maxCost}</text>
            <text x={padL} y={H - 3}>第 1 次</text>
            <text x={W - 4} y={H - 3} textAnchor="end">第 {n} 次插入</text>
          </svg>
          <p className="viz-k">红色尖峰是 resize：那一次插入要重写表里全部 n 个 key，代价 O(n)。但尖峰之间的间隔每次翻倍，把尖峰摊到每次插入上，总写入 / n 一直停在一个常数附近。这就是「单次 O(n)，均摊 O(1)」。</p>
        </div>
      </div>
    </VisualizationFrame>
  );
}
