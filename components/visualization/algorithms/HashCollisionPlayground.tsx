"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import StepControls from "./StepControls";
import {
  emptyBuckets, emptyTable, nonEmptyCount, occupiedCount, traceChaining, traceOpenAddressing,
  type Chain, type ChainTrace, type ProbeOp, type ProbeTrace, type Slot,
} from "@/lib/algorithms/hashMap";

const CAP = 8;
const PRESET = [10, 18, 26];
type Mode = "probing" | "chaining";
type Entry = { op: ProbeOp; key: number; result: string };

const OPS: { id: ProbeOp; label: string }[] = [
  { id: "insert", label: "Insert" },
  { id: "search", label: "Search" },
  { id: "delete", label: "Delete" },
];

// Every operation is executed by lib/algorithms/hashMap.ts against the committed table;
// the visualizer only replays the recorded probe steps. "Previous step" rewinds the
// display inside the last operation; the table itself has already moved on.
export default function HashCollisionPlayground() {
  const [mode, setMode] = useState<Mode>("probing");
  const [slots, setSlots] = useState<Slot[]>(() => emptyTable(CAP));
  const [buckets, setBuckets] = useState<Chain[]>(() => emptyBuckets(CAP));
  const [probe, setProbe] = useState<ProbeTrace | null>(null);
  const [chain, setChain] = useState<ChainTrace | null>(null);
  const [step, setStep] = useState(0);
  const [keyText, setKeyText] = useState("34");
  const [error, setError] = useState("");
  const [history, setHistory] = useState<Entry[]>([]);

  const parseKey = () => {
    const k = Number(keyText);
    if (!Number.isInteger(k) || k < 0 || k > 999) { setError("key：0 到 999 的整数。"); return null; }
    setError("");
    return k;
  };

  const act = (op: ProbeOp) => {
    const key = parseKey();
    if (key === null) return;
    if (mode === "probing") {
      const t = traceOpenAddressing(slots, op, key, `v${key}`);
      if (t.result === "inserted" && nonEmptyCount(slots) >= CAP - 1) { setError(`教学表要始终保留一个 EMPTY，否则找不到的 key 会让探测绕圈。已经有 ${CAP - 1} 个非 EMPTY 格：先删一个、Reset，或者想一想真实实现为什么会在这之前 resize。`); return; }
      setSlots(t.slots); setProbe(t); setStep(t.steps.length - 1);
      setHistory((h) => [...h, { op, key, result: t.result }]);
    } else {
      const t = traceChaining(buckets, op, key, `v${key}`);
      setBuckets(t.buckets); setChain(t); setStep(t.steps.length - 1);
      setHistory((h) => [...h, { op, key, result: t.result }]);
    }
  };
  const loadPreset = () => {
    setError("");
    if (mode === "probing") {
      let s = emptyTable(CAP); let last: ProbeTrace | null = null;
      for (const k of PRESET) { last = traceOpenAddressing(s, "insert", k, `v${k}`); s = last.slots; }
      setSlots(s); setProbe(last); setStep(last ? last.steps.length - 1 : 0);
    } else {
      let b = emptyBuckets(CAP); let last: ChainTrace | null = null;
      for (const k of PRESET) { last = traceChaining(b, "insert", k, `v${k}`); b = last.buckets; }
      setBuckets(b); setChain(last); setStep(last ? last.steps.length - 1 : 0);
    }
    setHistory(PRESET.map((key) => ({ op: "insert", key, result: "inserted" })));
  };
  const reset = () => { setSlots(emptyTable(CAP)); setBuckets(emptyBuckets(CAP)); setProbe(null); setChain(null); setStep(0); setHistory([]); setError(""); };
  const switchMode = (m: Mode) => { setMode(m); reset(); };

  const trace = mode === "probing" ? probe : chain;
  const total = trace ? trace.steps.length : 1;
  const cur = Math.min(step, total - 1);

  // ---- rendering helpers for the probing table ----
  const pStep = probe?.steps[cur];
  const shown: Slot[] = pStep ? pStep.slots : slots;
  const visited = new Set<number>(probe ? probe.steps.slice(0, cur).map((s) => s.idx) : []);
  const slotClass = (i: number) => {
    const s = shown[i];
    const c = ["hm-slot", `is-${s.state}`];
    if (probe && i === probe.home) c.push("is-home");
    if (pStep && i === pStep.idx) {
      if (pStep.kind === "found" || pStep.kind === "place" || pStep.kind === "update") c.push("is-hit");
      else if (pStep.kind === "compare" || pStep.kind === "tombstone" || pStep.kind === "full") c.push("is-bad");
      else c.push("is-now");
    } else if (visited.has(i)) c.push("is-visited");
    return c.join(" ");
  };

  // ---- chaining ----
  const cStep = chain?.steps[cur];
  const shownBuckets: Chain[] = cStep ? cStep.buckets : buckets;
  const nodeClass = (b: number, pos: number) => {
    const c = ["hm-node"];
    if (!chain || !cStep || b !== chain.home) return c.join(" ");
    if (pos === cStep.pos) c.push(cStep.kind === "found" || cStep.kind === "append" || cStep.kind === "update" ? "is-hit" : cStep.kind === "compare" ? "is-now" : "is-now");
    else if (pos < cStep.pos) c.push("is-visited");
    return c.join(" ");
  };

  const note = trace ? trace.steps[cur].note : mode === "probing" ? "表是空的。先点「载入 10, 18, 26」，或者自己输入一个 key 再 Insert。" : "所有 bucket 都是空链表。先点「载入 10, 18, 26」看三个 key 排进同一条链。";
  const tone = !trace ? "" : trace.result === "missing" || trace.result === "full" ? " is-bad" : trace.result === "deleted" ? " is-warn" : cur === total - 1 ? " is-good" : "";
  const size = mode === "probing" ? occupiedCount(slots) : buckets.reduce((a, b) => a + b.length, 0);
  const tomb = slots.filter((s) => s.state === "deleted").length;

  return (
    <VisualizationFrame
      title="Collision Playground：容量 8，hash(key) = key"
      description="输入一个整数 key，选择 Insert / Search / Delete。每一步探测到哪一格、比较了什么、为什么停下来，都来自真实执行的表，不是预先画好的图。切到 Separate Chaining 看同样的操作在链表里长什么样。"
      footnote="颜色：黄色是正在看的格子，红色是比较后不相等（冲突）或正在被删除，绿色是命中或放入，蓝色是这次操作已经走过的格子，蓝色底线标记 home slot。斜纹格是 DELETED（tombstone），虚线格是 EMPTY。"
    >
      <div className="viz-tabs" role="tablist" aria-label="冲突解决方式">
        <button type="button" role="tab" aria-selected={mode === "probing"} className={`viz-tab${mode === "probing" ? " is-on" : ""}`} onClick={() => switchMode("probing")}>Open Addressing · Linear Probing</button>
        <button type="button" role="tab" aria-selected={mode === "chaining"} className={`viz-tab${mode === "chaining" ? " is-on" : ""}`} onClick={() => switchMode("chaining")}>Separate Chaining</button>
      </div>
      <form className="hm-row" style={{ marginTop: 12 }} onSubmit={(e) => { e.preventDefault(); act("insert"); }}>
        <label>key <input type="number" min={0} max={999} value={keyText} onChange={(e) => setKeyText(e.target.value)} aria-label="要操作的 key" /></label>
        {OPS.map((o) => <button key={o.id} type="button" className={`viz-btn${o.id === "insert" ? " primary" : ""}`} onClick={() => act(o.id)}>{o.label}</button>)}
        <button type="button" className="viz-btn" onClick={loadPreset}>载入 10, 18, 26</button>
        <button type="button" className="viz-btn" onClick={reset} disabled={!trace && history.length === 0}>Reset</button>
      </form>
      {error && <p className="hm-error" role="alert">{error}</p>}

      <div className="viz-grid2 wide-left">
        <div>
          <div className="viz-panel">
            <h5 className="nocase">{mode === "probing" ? `table[8]  ·  index_i = (key % 8 + i) % 8` : `buckets[8]  ·  index = key % 8`}</h5>
            {mode === "probing" ? (
              <div className="hm-scroll">
                <div className="hm-slots" style={{ gridTemplateColumns: `repeat(${CAP}, var(--hm-cell))` }}>
                  {shown.map((_, i) => <span key={`i${i}`} className="hm-index">{i}</span>)}
                  {shown.map((s, i) => (
                    <span key={`s${i}`} className={slotClass(i)}>
                      {s.state === "occupied" ? <>{s.key}<small>{s.value}</small></> : s.state === "deleted" ? <small>DELETED</small> : <small>EMPTY</small>}
                    </span>
                  ))}
                  {shown.map((_, i) => <span key={`m${i}`} className="hm-mark">{probe && i === probe.home ? "home" : pStep && i === pStep.idx && pStep.i > 0 ? `i=${pStep.i}` : ""}</span>)}
                </div>
              </div>
            ) : (
              <div className="hm-buckets">
                {shownBuckets.map((c, b) => (
                  <div key={b} className={`hm-bucket${chain && b === chain.home ? " is-home" : ""}`}>
                    <span>[{b}]</span>
                    <div className="hm-chain">
                      {c.length === 0 && <span className="nil">∅</span>}
                      {c.map((e, pos) => (
                        <span key={e.key} style={{ display: "contents" }}>
                          {pos > 0 && <span className="hm-arrow">→</span>}
                          <span className={nodeClass(b, pos)}>{e.key}<small>{e.value}</small></span>
                        </span>
                      ))}
                      {cStep && cStep.kind === "unlink" && b === chain!.home && <span className="hm-node is-gone" style={{ marginLeft: 6 }}>{chain!.key}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="viz-stat bs-stat">
              <div><small>size</small><b>{size}</b></div>
              {mode === "probing" && <div><small>tombstones</small><b>{tomb}</b></div>}
              <div><small>{mode === "probing" ? "非 EMPTY / 容量" : "最长链"}</small><b>{mode === "probing" ? `${nonEmptyCount(slots)} / ${CAP}` : Math.max(0, ...buckets.map((c) => c.length))}</b></div>
              <div><small>本次探测次数</small><b>{trace ? trace.steps.filter((s) => s.kind !== "home").length : "–"}</b></div>
            </div>
          </div>
          <StepControls step={cur} total={total} onStep={setStep} />
          <div className={`viz-narr${tone}`}>{note}</div>
        </div>
        <div>
          <div className="viz-panel">
            <h5>本次操作的探测记录</h5>
            {!trace && <p className="viz-k">还没有操作。</p>}
            {trace && (
              <ol className="hm-log">
                {trace.steps.map((s, i) => (
                  <li key={i} className={i === cur ? "is-on" : i > cur ? "is-future" : ""}>
                    <span>{"i" in s && s.kind !== "home" ? `i=${s.i}` : ""}</span>
                    <span>{"idx" in s ? `[${s.idx}]` : `[${(s as { bucket: number }).bucket}]`}</span>
                    <span>{s.kind}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
          <div className="viz-panel" style={{ marginTop: 12 }}>
            <h5>操作历史</h5>
            {history.length === 0 && <p className="viz-k">空。</p>}
            {history.length > 0 && (
              <ol className="hm-log" style={{ marginTop: 0 }}>
                {history.map((h, i) => <li key={i} className={i === history.length - 1 ? "is-on" : ""}><span>{i + 1}</span><span>{h.op}</span><span>key {h.key} → {h.result}</span></li>)}
              </ol>
            )}
          </div>
        </div>
      </div>
    </VisualizationFrame>
  );
}
