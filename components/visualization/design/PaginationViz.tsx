"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Mode = "offset" | "cursor";
const PAGE = 5;
const BASE = Array.from({ length: 15 }, (_, i) => 100 - i);

export default function PaginationViz() {
  const [mode, setMode] = useState<Mode>("offset");
  const [page2, setPage2] = useState(false);
  const [inserted, setInserted] = useState(false);
  const list = inserted ? [102, 101, ...BASE] : BASE;
  const page1 = BASE.slice(0, PAGE);
  const lastSeen = page1[page1.length - 1];
  const second = mode === "offset" ? list.slice(PAGE, PAGE * 2) : list.filter((x) => x < lastSeen).slice(0, PAGE);
  const dupes = second.filter((x) => page1.includes(x));
  return (
    <VisualizationFrame
      title="分页：翻第二页时，有人发了两条新帖"
      description="信息流按时间倒序，每页 5 条，帖子用编号表示（越大越新）。先看第一页，再“有人发了 2 条新帖”，再翻到第二页。"
    >
      <div className="viz-chips" role="group" aria-label="分页方式" style={{ marginBottom: 10 }}>
        {([["offset", "offset 分页：?offset=5&limit=5"], ["cursor", "cursor 分页：?after=96&limit=5"]] as [Mode, string][]).map(([k, l]) => (
          <button key={k} type="button" className={`viz-chip mono${mode === k ? " is-on" : ""}`} onClick={() => setMode(k)}>{l}</button>
        ))}
      </div>
      <div className="viz-controls">
        <button type="button" className={`viz-btn${inserted ? " is-on" : ""}`} onClick={() => setInserted(!inserted)}>{inserted ? "撤回新帖" : "有人发了 2 条新帖"}</button>
        <button type="button" className={`viz-btn primary${page2 ? " is-on" : ""}`} onClick={() => setPage2(!page2)}>{page2 ? "收起第二页" : "翻到第二页"}</button>
      </div>
      <div className="viz-grid2">
        <div className="viz-panel">
          <h5>你已经看过的第一页</h5>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{page1.map((x) => <span key={x} className="viz-mono" style={{ padding: "3px 8px", borderRadius: 4, background: "#2a78d6", color: "#fff", fontSize: 12 }}>#{x}</span>)}</div>
          <p className="viz-k" style={{ marginTop: 8 }}>服务端此刻的列表开头：{list.slice(0, 7).map((x) => `#${x}`).join(" ")} …</p>
        </div>
        <div className="viz-panel">
          <h5>第二页</h5>
          {page2 ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{second.map((x) => <span key={x} className="viz-mono" style={{ padding: "3px 8px", borderRadius: 4, background: dupes.includes(x) ? "#d03b3b" : "#1baf7a", color: "#fff", fontSize: 12 }}>#{x}{dupes.includes(x) ? " 重复" : ""}</span>)}</div>
          ) : <span className="viz-k">还没翻</span>}
        </div>
      </div>
      <div className={`viz-narr${page2 ? (dupes.length ? " is-bad" : " is-good") : ""}`}>
        {!page2
          ? "offset 分页说“跳过前 5 条，再给我 5 条”；cursor 分页说“给我比 #96 更旧的 5 条”。列表不变时两者结果一样。"
          : mode === "offset"
            ? dupes.length
              ? `新帖插在最前面，整个列表往后挪了 2 位。“跳过 5 条”现在跳到的是 #98 后面，于是 #97、#96 又出现了一次。另一个问题：offset 越大越慢，翻到第 1 万页时数据库要先数过前 5 万行再丢掉。`
              : "列表没变，offset 分页正常。但它的代价是 offset 越大越慢：数据库要数过前面所有行再丢掉。点“有人发了 2 条新帖”再试。"
            : `cursor 记的是“上一页最后一条是 #${lastSeen}”，第二页从比它旧的开始取，不管前面插了多少新帖都不会重复也不会漏。数据库用索引直接定位到 #${lastSeen}，翻到多深都一样快。信息流、聊天记录这种不断有新数据的列表都用 cursor。代价是不能直接跳到第 37 页。`}
      </div>
    </VisualizationFrame>
  );
}
