"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Bars from "@/components/visualization/ml/primitives/Bars";
import { DEMO_K, DEMO_LIBRARY_TOTAL, demoFlags, hitAtK, hitsInTopK, LIBRARY_TOTALS, MEASURED, precisionAtK, recallAtK } from "@/lib/ml/retrieval";

// Recommender Systems, page 4: one meme-search query and its first 30 results.
// Click a result to flip it between relevant and not; P@30, Recall@30, hit@30
// and P@1 follow. The right-hand panel holds the three numbers measured in the
// MeMe project, which are read off the project rather than computed here.

type Total = (typeof LIBRARY_TOTALS)[number];
const MEASURED_COLORS: Record<(typeof MEASURED)[number]["key"], string> = { exact: "#c9c4ad", semantic: "#2a78d6", group: "#1baf7a" };

const pct = (x: number) => x.toFixed(2);

export default function RetrievalMetricsFigure() {
  const [flags, setFlags] = useState<boolean[]>(() => demoFlags());
  const [total, setTotal] = useState<Total>(DEMO_LIBRARY_TOTAL);
  const k = DEMO_K;

  const hits = hitsInTopK(flags, k);
  const overflow = hits > total;
  // The library cannot hold fewer relevant memes than we already found in the top 30.
  const effectiveTotal = overflow ? hits : total;
  const p30 = precisionAtK(flags, k);
  const r30 = hits === 0 ? 0 : recallAtK(flags, k, effectiveTotal);
  const hit30 = hitAtK(flags, k);
  const p1 = precisionAtK(flags, 1);

  const flip = (i: number) => setFlags((f) => f.map((v, j) => (j === i ? !v : v)));
  const reset = () => {
    setFlags(demoFlags());
    setTotal(DEMO_LIBRARY_TOTAL);
  };

  const narr =
    hits === 0
      ? `前 ${k} 个里一个相关的都没有：P@${k} = 0，Recall@${k} = 0，hit@${k} = 否，P@1 = 0。按笔记的口径，这条 query 记 0 分：它的「P@${k}」只问前 ${k} 里有没有命中。点几个结果标成相关再看。`
      : overflow
        ? `前 ${k} 个里标了 ${hits} 个相关，可库里总相关数设成了 ${total}，前 ${k} 里不可能找出比库里更多的：这里按 ${hits} 算，Recall@${k} = ${hits}/${hits} = 1.00。把总数切到 ${LIBRARY_TOTALS.find((t) => t >= hits) ?? LIBRARY_TOTALS[LIBRARY_TOTALS.length - 1]} 再看 recall 怎么变。`
        : `前 ${k} 个里有 ${hits} 个相关：P@${k} = ${hits}/${k} = ${pct(p30)}；库里一共 ${total} 个相关，Recall@${k} = ${hits}/${total} = ${pct(r30)}。P@1 只看第一个结果，${flags[0] ? "它是相关的，P@1 = 1" : "它不相关，P@1 = 0"}。笔记里 exact 0.23、semantic 0.9344 的「P@${k}」不是这里的 ${pct(p30)}：它是 100 条 query 里「前 ${k} 有没有命中」的比例，也就是这条 query 的 hit@${k} = ${hit30 ? 1 : 0} 这种 0 / 1 在所有 query 上的平均，严格说是 hit rate，不是每条 query 的 precision。`;
  const tone = hits === 0 ? " is-bad" : overflow ? " is-warn" : "";

  return (
    <VisualizationFrame
      title="P@30 与 Recall@30：一条 query 的前 30 个结果"
      description="搜一条 meme，系统按相似度排出前 30 个。从左到右是排名 1 → 30，点任意一个把它在「相关 / 不相关」之间切换；右边的实测是 MeMe 项目里 100 条 query 的结果，不是由这张图算出来的。"
    >
      <div className="viz-row">
        <div className="viz-chips" role="group" aria-label="库里总共有多少个相关的 meme">
          <span className="viz-k">库里总相关数</span>
          {LIBRARY_TOTALS.map((t) => (
            <button key={t} type="button" className={`viz-chip mono${total === t ? " is-on" : ""}`} aria-pressed={total === t} onClick={() => setTotal(t)}>{t}</button>
          ))}
        </div>
        <button type="button" className="viz-btn" onClick={reset}>重置</button>
      </div>

      <div className="viz-grid2 wide-left">
        <div className="viz-panel">
          <h5>前 {k} 个结果：点击切换相关 / 不相关</h5>
          <div className="cm-samples" role="group" aria-label={`排名 1 到 ${k} 的结果`}>
            {flags.map((rel, i) => (
              <button
                type="button"
                key={i}
                className={`cm-sample${rel ? " is-right" : ""}`}
                style={i === 0 ? { boxShadow: "0 0 0 2px #fdf3cc" } : undefined}
                onClick={() => flip(i)}
                aria-pressed={rel}
                aria-label={`结果 ${i + 1}：${rel ? "相关" : "不相关"}，点击切换`}
              >
                <small>结果 {i + 1}</small>
                <span className="mark" style={rel ? undefined : { color: "#76796f", fontWeight: 400 }}>{rel ? "✓ 相关" : "— 不相关"}</span>
              </button>
            ))}
          </div>
          <p className="viz-k" style={{ marginTop: 8 }}>P@1 只看结果 1；P@{k} 数前 {k} 个里的 ✓；Recall@{k} 把这个数除以库里的总相关数。</p>
        </div>

        <div>
          <div className="viz-stat">
            <div><small>P@{k} = 前 {k} 里相关数 / {k}</small><b>{hits}/{k} = {pct(p30)}</b></div>
            <div><small>Recall@{k} = 前 {k} 里相关数 / 总相关数</small><b>{hits}/{effectiveTotal} = {pct(r30)}</b></div>
            <div><small>hit@{k}：前 {k} 里有没有命中</small><b>{hit30 ? `有（${hits} 个）` : "没有"}</b></div>
            <div><small>P@1：第一个结果对不对</small><b>{flags[0] ? 1 : 0}/1 = {pct(p1)}</b></div>
          </div>
          <div className="viz-panel" style={{ marginTop: 12 }}>
            <h5 className="nocase">MeMe 项目实测：100 条 query（实测，不是算出来的）</h5>
            <Bars rows={MEASURED.map((m) => ({ label: m.label, value: m.value, color: MEASURED_COLORS[m.key], text: m.value.toFixed(m.key === "exact" ? 2 : 4) }))} />
            <div style={{ display: "grid", gap: 4, marginTop: 10 }}>
              {MEASURED.map((m) => (
                <p key={m.key} className="viz-k"><i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: MEASURED_COLORS[m.key], marginRight: 6, verticalAlign: -1 }} />{m.value.toFixed(m.key === "exact" ? 2 : 4)}：{m.gloss}</p>
              ))}
            </div>
            <p className="viz-k" style={{ marginTop: 8 }}>这里的「P@{k}」是每条 query 问一次「前 {k} 里有没有相关的」，再在 100 条上取比例，是 hit rate。</p>
          </div>
        </div>
      </div>

      <div className={`viz-narr${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}
