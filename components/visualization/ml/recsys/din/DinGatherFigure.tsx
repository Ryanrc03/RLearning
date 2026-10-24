"use client";

import { type CSSProperties, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Slider from "@/components/visualization/ml/primitives/Slider";
import { historyIndex, samplePointers, TOY_EVENTS } from "@/lib/ml/din";

// DIN note, "Architecture › 输入": the event array of three users sorted by
// (user, time). A sample stores only (lo, hi); hi is the first event of its own
// request, so same-request events never enter the history. The window of the
// last N events is right-aligned and padded on the left (kurec/seq.history_index).

const YELLOW = "#d9b24a";
const YELLOW_F = "#fbf1cf";
const YELLOW_G = "#fbe7a1";
const INK = "#3b4234";
const GREY = "#9a9c8d";
const USER_TINT: Record<string, string> = { A: "#2a78d6", B: "#eb6834", C: "#1baf7a" };

const SAMPLES = [
  { idx: 7, label: "A 在 09:20 的一条" },
  { idx: 12, label: "B 在 10:07 的一条" },
  { idx: 16, label: "C 的第一个请求" },
];

const cell = (bg: string, border: string, extra: CSSProperties = {}): CSSProperties => ({
  display: "inline-flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  width: 30,
  height: 40,
  marginRight: 3,
  borderRadius: 5,
  background: bg,
  border: `1.4px solid ${border}`,
  fontSize: 10.5,
  lineHeight: 1.2,
  transition: "background .25s, opacity .25s",
  ...extra,
});

export default function DinGatherFigure() {
  const [sample, setSample] = useState(0);
  const [n, setN] = useState(4);
  const s = SAMPLES[sample];
  const { lo, hi } = samplePointers(TOY_EVENTS, s.idx);
  const { idx, mask } = historyIndex(lo, hi, n);
  const picked = new Set(idx.filter((_, j) => mask[j]));
  const valid = mask.filter(Boolean).length;
  const sameReq = TOY_EVENTS.map((e, i) => i).filter((i) => TOY_EVENTS[i].user === TOY_EVENTS[s.idx].user && TOY_EVENTS[i].time === TOY_EVENTS[s.idx].time);

  const reset = () => {
    setSample(0);
    setN(4);
  };

  const tone = valid === 0 ? "is-warn" : valid < n ? "is-warn" : "is-good";
  const narr =
    valid === 0
      ? `这是用户 ${TOY_EVENTS[s.idx].user} 的第一个请求：lo = hi = ${lo}，历史为空，${n} 个位置全是 padding（下标 0、mask = false）。模型对空历史的池化输出是 0 向量。`
      : `lo = ${lo}，hi = ${hi}：同一请求的 ${sameReq.join("、")} 号事件时间相同，不进历史。idx = hi − ${n} + j 得到 [${idx.join(", ")}]，其中 ${valid} 个 ≥ lo 有效${valid < n ? `，左边 ${n - valid} 个落到别的用户那里，被 mask 掉、下标置 0` : "，全部属于这个用户"}。最近的一条在最右边。`;

  return (
    <VisualizationFrame
      title="取序列：两个指针加一次 gather"
      description="上面是按 (用户, 时间) 排好的事件数组，颜色区分三个用户，同一时间的格子属于同一个请求。选一条样本、拖 N，看它的 (lo, hi) 和右对齐取出的最近 N 条。"
    >
      <div className="viz-controls">
        <div className="viz-chips">
          {SAMPLES.map((x, i) => (
            <button key={x.idx} type="button" className={`viz-chip${i === sample ? " is-on" : ""}`} onClick={() => setSample(i)}>{x.label}</button>
          ))}
        </div>
        <Slider label="N" value={n} min={1} max={8} step={1} onChange={setN} id="din-gather-n" />
        <button type="button" className="viz-btn" onClick={reset}>重置</button>
      </div>

      <div className="viz-scroll">
        <div style={{ minWidth: 680, padding: "4px 0 8px" }}>
          <div className="viz-k" style={{ marginBottom: 4 }}>事件数组（GPU 上常驻）</div>
          <div style={{ display: "flex" }}>
            {TOY_EVENTS.map((e, i) => {
              const isSample = i === s.idx;
              const inReq = sameReq.includes(i) && !isSample;
              const on = picked.has(i);
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <span style={cell(on ? YELLOW_G : isSample ? "#fff" : "#f6f4ec", isSample ? INK : on ? YELLOW : USER_TINT[e.user], { opacity: on || isSample || inReq ? 1 : 0.55, borderWidth: isSample ? 2.4 : 1.4, borderStyle: inReq ? "dashed" : "solid" })}>
                    <b style={{ color: USER_TINT[e.user] }}>{e.user}</b>
                    <small style={{ fontSize: 9, color: "#5d6156" }}>{e.time}</small>
                  </span>
                  <small className="viz-mono" style={{ fontSize: 9.5, color: i === lo || i === hi ? INK : GREY, fontWeight: i === lo || i === hi ? 700 : 400 }}>
                    {i}
                    {i === lo ? " lo" : ""}
                    {i === hi && hi !== lo ? " hi" : ""}
                    {i === hi && hi === lo ? "/hi" : ""}
                  </small>
                </div>
              );
            })}
          </div>

          <div className="viz-k" style={{ margin: "12px 0 4px" }}>这个 batch 里取出的 [N] 窗口（右对齐）</div>
          <div style={{ display: "flex" }}>
            {idx.map((i, j) => (
              <div key={j} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={cell(mask[j] ? YELLOW_G : "#fff", mask[j] ? YELLOW : GREY, { borderStyle: mask[j] ? "solid" : "dashed", width: 38 })}>
                  <b className="viz-mono">{mask[j] ? i : 0}</b>
                  <small style={{ fontSize: 9, color: "#5d6156" }}>{mask[j] ? TOY_EVENTS[i].time : "pad"}</small>
                </span>
                <small className="viz-mono" style={{ fontSize: 9.5, color: GREY }}>{mask[j] ? "T" : "F"}</small>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="viz-legend">
        <span><i style={{ background: YELLOW_G, border: `1.4px solid ${YELLOW}` }} />取进历史</span>
        <span><i style={{ background: "#fff", border: `2.4px solid ${INK}` }} />当前样本</span>
        <span><i style={{ background: "#fff", border: `1.4px dashed ${GREY}` }} />同一请求 / padding</span>
        <span><i style={{ background: YELLOW_F }} />下面一行的 T / F 是 mask</span>
      </div>
      <div className={`viz-narr ${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}
