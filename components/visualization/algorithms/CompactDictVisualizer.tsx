"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import { dictDelete, dictKeysInOrder, dictLookup, dictSet, DKIX_DUMMY, DKIX_EMPTY, emptyDict, toyHash, usableFraction, type CompactDict } from "@/lib/algorithms/hashMap";

const START: [string, number][] = [["apple", 3], ["banana", 5], ["cherry", 7]];
const MORE = ["date", "elder", "fig", "grape", "kiwi"];

const initial = () => START.reduce((d, [k, v]) => dictSet(d, k, v), emptyDict(8));

// Teaching model of CPython's compact dict: a sparse dk_indices array of small ints that
// point into a dense, append-only dk_entries array. All mutations go through
// lib/algorithms/hashMap.ts, which follows dictobject.c's probe sequence and 2/3 rule.
export default function CompactDictVisualizer() {
  const [d, setD] = useState<CompactDict>(initial);
  const [focusKey, setFocusKey] = useState<string | null>("apple");
  const [focusIx, setFocusIx] = useState<number | null>(null);
  const size = d.indices.length;
  const mask = size - 1;
  const keys = dictKeysInOrder(d);
  const lookup = useMemo(() => (focusKey && keys.includes(focusKey) ? dictLookup(d, focusKey) : null), [d, focusKey, keys]);
  const pathSlots = new Set(lookup ? lookup.path.map((p) => p.slot) : []);
  const hitSlot = lookup && lookup.ix >= 0 ? lookup.slot : null;
  const hitIx = lookup && lookup.ix >= 0 ? lookup.ix : focusIx;

  const pickSlot = (slot: number) => {
    const ix = d.indices[slot];
    if (ix >= 0) { setFocusKey(d.entries[ix].key); setFocusIx(ix); } else { setFocusKey(null); setFocusIx(null); }
  };
  const pickEntry = (ix: number) => { const e = d.entries[ix]; setFocusIx(ix); setFocusKey(e.key); };
  const add = (k: string) => { const next = dictSet(d, k, k.length); setD(next); setFocusKey(k); setFocusIx(null); };
  const del = (k: string) => { setD(dictDelete(d, k)); setFocusKey(null); setFocusIx(null); };
  const reset = () => { setD(initial()); setFocusKey("apple"); setFocusIx(null); };
  const canAdd = MORE.filter((k) => !keys.includes(k));

  const slotLabel = (ix: number) => (ix === DKIX_EMPTY ? "EMPTY" : ix === DKIX_DUMMY ? "DUMMY" : String(ix));

  return (
    <VisualizationFrame
      title="Compact Dict：稀疏的 dk_indices 指向紧凑的 dk_entries"
      description="左边是哈希表本身，只存小整数下标；右边是按插入顺序追加的 entry 数组。点一个 index 看它指向哪条 entry，点一个 entry 看它被哪个 index 指着，以及查这个 key 要走的探测路径。加几个 key 触发扩容，删一个 key 看 DUMMY 和 NULL entry。"
      footnote="hash 列用的是教学哈希（真实 CPython 对 str 用随机加盐的 SipHash），所以探测路径的具体数字和真实解释器不同，但规则一样：i = (i*5 + perturb + 1) & mask，perturb 每步右移 5 位。表大小是 2 的幂，用 & mask 代替取模。"
    >
      <div className="hm-row">
        <span className="viz-k">添加：</span>
        <div className="viz-chips" role="group" aria-label="添加 key">
          {canAdd.map((k) => <button key={k} type="button" className="viz-chip mono" onClick={() => add(k)}>+ {k}</button>)}
          {canAdd.length === 0 && <span className="viz-k">（预设 key 都加完了）</span>}
        </div>
        <span className="viz-k">删除：</span>
        <div className="viz-chips" role="group" aria-label="删除 key">
          {keys.map((k) => <button key={k} type="button" className="viz-chip mono" onClick={() => del(k)}>− {k}</button>)}
        </div>
        <button type="button" className="viz-btn" onClick={reset}>Reset</button>
      </div>
      <div className="viz-stat">
        <div><small>dk_size</small><b>{size}</b></div>
        <div><small>USABLE_FRACTION = 2/3</small><b>{usableFraction(size)}</b></div>
        <div><small>ma_used（活着的 key）</small><b>{d.used}</b></div>
        <div><small>dk_nentries（含 NULL）</small><b>{d.entries.length}</b></div>
      </div>

      <div className="hm-dict" style={{ marginTop: 12 }}>
        <div className="viz-panel hm-dict-col">
          <h5 className="nocase">dk_indices[{size}] · int8</h5>
          <div className="hm-ix">
            {d.indices.map((ix, slot) => (
              <button key={slot} type="button" aria-pressed={slot === hitSlot} className={`${ix === DKIX_EMPTY ? "is-empty" : ix === DKIX_DUMMY ? "is-dummy" : ""}${slot === hitSlot ? " is-on" : pathSlots.has(slot) ? " is-path" : ""}`} onClick={() => pickSlot(slot)}>
                <span>{slot}</span><span>{slotLabel(ix)}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="viz-panel hm-dict-col">
          <h5 className="nocase">dk_entries[{usableFraction(size)}] · (me_hash, me_key, me_value)，按插入顺序</h5>
          <div className="hm-entries">
            {d.entries.map((e, ix) => (
              <button key={ix} type="button" aria-pressed={ix === hitIx} className={`hm-entry${e.key === null ? " is-null" : ""}${ix === hitIx ? " is-on" : hitIx !== null && e.key !== null ? " is-dim" : ""}`} onClick={() => pickEntry(ix)} disabled={e.key === null}>
                <span>{ix}</span>
                <span>{e.key === null ? "NULL（已删除，位置保留）" : <>(&quot;{e.key}&quot;, {e.value})</>}</span>
                <span className="hash">{e.key === null ? "" : `hash ${e.hash}`}</span>
              </button>
            ))}
            {Array.from({ length: Math.max(0, usableFraction(size) - d.entries.length) }, (_, k) => (
              <span key={`free${k}`} className="hm-entry is-null" aria-hidden="true"><span>{d.entries.length + k}</span><span>（未使用）</span><span /></span>
            ))}
          </div>
          <p className="viz-k" style={{ marginTop: 8 }}>遍历 dict 就是从上往下扫这一列、跳过 NULL：这就是插入顺序的来源。</p>
        </div>
      </div>

      <div className={`viz-narr${lookup ? "" : focusKey === null && focusIx === null ? "" : " is-warn"}`}>
        {lookup && focusKey ? (
          <>
            查 <code>&quot;{focusKey}&quot;</code>：hash = {toyHash(focusKey)}，起点 hash &amp; {mask} = {toyHash(focusKey) & mask}。探测路径
            {" "}{lookup.path.map((p, i) => <span key={i}>{i > 0 && " → "}<b>[{p.slot}]</b>{p.kind === "hit" ? ` 指向 entry ${p.ix}，hash 和 key 都相等，命中` : p.kind === "miss" ? ` 指向 entry ${p.ix}（${d.entries[p.ix].key}），不等，继续` : p.kind === "dummy" ? " 是 DUMMY，跨过" : " 是 EMPTY，停"}</span>)}。
            共 {lookup.path.length} 次探测，{lookup.path.length === 1 ? "没有冲突。" : "发生了冲突；注意第二步不是简单的 +1。"}
          </>
        ) : (
          <>点左边任意 index，或右边任意 entry。indices 里存的是 entry 的下标，不是 key 本身，所以每格只要 1 个字节（表 ≤ 128 格时）；entries 才是真正的 (hash, key, value)。</>
        )}
      </div>
    </VisualizationFrame>
  );
}
