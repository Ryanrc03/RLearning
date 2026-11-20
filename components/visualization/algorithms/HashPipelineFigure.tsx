"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import { toyHash } from "@/lib/algorithms/hashMap";

const PRESETS: [string, number][] = [["apple", 3], ["banana", 5], ["cherry", 7]];

// key → hash(key) → hash % capacity → array slot. The hash is a toy polynomial hash so
// every number on screen can be recomputed by hand; CPython's str hash is SipHash and
// randomised per process, which the note says next to the figure.
export default function HashPipelineFigure() {
  const [text, setText] = useState("apple");
  const [capacity, setCapacity] = useState(8);
  const key = text.trim() || "apple";
  const h = toyHash(key);
  const index = h % capacity;
  const value = PRESETS.find(([k]) => k === key)?.[1] ?? "…";
  const bits = (n: number) => n.toString(2).padStart(Math.log2(capacity), "0");

  return (
    <VisualizationFrame
      title="从 key 到数组下标：apple → hash → index → value"
      description="改 key 或容量，看同一个 key 落到哪一格。哈希把任意 key 变成一个大整数，取模（容量为 2 的幂时等价于按位与）把它压进数组范围，最后就是一次普通的数组随机访问。"
      footnote={`这里的 hash 是教学用的多项式哈希 h = h × 31 + ord(c)，方便手算；CPython 对 str 用的是 SipHash，而且每个进程随机加盐，所以同一个字符串在两次运行里的 hash() 通常不同。整数例外：hash(10) == 10。`}
    >
      <div className="hm-row">
        <div className="viz-chips" role="group" aria-label="预设 key">
          {PRESETS.map(([k, v]) => <button key={k} type="button" className={`viz-chip mono${key === k ? " is-on" : ""}`} onClick={() => setText(k)}>{k} → {v}</button>)}
        </div>
        <label>key <input type="text" value={text} maxLength={16} onChange={(e) => setText(e.target.value)} aria-label="自定义 key" /></label>
        <label>capacity
          <select className="viz-mono" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} aria-label="数组容量">
            {[8, 16, 32].map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      </div>
      <div className="hm-pipe">
        <div className="hm-pipe-box is-key"><small>key</small><b>&quot;{key}&quot;</b><em>任意可哈希对象</em></div>
        <div className="hm-pipe-box"><small>hash(key)</small><b>{h}</b><em>一个很大的整数，和容量无关</em></div>
        <div className="hm-pipe-box is-idx"><small>index = hash % {capacity}</small><b>{index}</b><em>= hash &amp; {capacity - 1} = …{bits(h & (capacity - 1))}₂</em></div>
        <div className="hm-pipe-box is-val"><small>table[{index}]</small><b>{String(value)}</b><em>Base + {index} × ElementSize</em></div>
      </div>
      <div className="hm-scroll" style={{ marginTop: 12 }}>
        <div className="hm-slots" style={{ gridTemplateColumns: `repeat(${capacity}, var(--hm-cell))`, ["--hm-cell" as string]: capacity > 16 ? "34px" : undefined }}>
          {Array.from({ length: capacity }, (_, i) => <span key={`i${i}`} className="hm-index">{i}</span>)}
          {Array.from({ length: capacity }, (_, i) => (
            <span key={`s${i}`} className={`hm-slot${i === index ? " is-now" : " is-empty"}`} style={capacity > 16 ? { height: 30, fontSize: 11 } : undefined}>
              {i === index ? (capacity > 16 ? "●" : key.slice(0, 6)) : ""}
            </span>
          ))}
        </div>
      </div>
    </VisualizationFrame>
  );
}
