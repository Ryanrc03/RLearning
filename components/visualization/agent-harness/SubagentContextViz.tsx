"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

const BASE_MAIN = 6000; // system prompt + CLAUDE.md + tool schemas
const BASE_SUB = 4500; // a subagent reloads its own prompt and tool schemas
const PER_FILE_OVERHEAD = 120; // the tool_use + framing around each file read
const SUMMARY = 400; // the final answer written in the main context
const DELEGATE = 350; // the delegation prompt + tool_use
const REPORT = 1200; // what each subagent hands back

function fmt(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);
}

export default function SubagentContextViz() {
  const [files, setFiles] = useState(6);
  const [size, setSize] = useState(6000);
  const [k, setK] = useState(3);

  const direct = BASE_MAIN + files * (size + PER_FILE_OVERHEAD) + SUMMARY;
  const perSub = Math.ceil(files / k);
  const subCtx = BASE_SUB + perSub * (size + PER_FILE_OVERHEAD) + REPORT;
  const delegatedMain = BASE_MAIN + DELEGATE + k * REPORT;
  const totalDelegated = delegatedMain + k * subCtx;
  const roundsDirect = files + 1;
  const roundsDelegated = perSub + 2;
  const scale = Math.max(direct, subCtx, delegatedMain);
  const saved = Math.round((1 - delegatedMain / direct) * 100);
  const extra = Math.round((totalDelegated / direct - 1) * 100);

  const rows = [
    { label: "直接做 · 主上下文", value: direct, color: "var(--v1)" },
    { label: "委派 · 主上下文", value: delegatedMain, color: "var(--v1)" },
    { label: `委派 · 每个 subagent（×${k}）`, value: subCtx, color: "var(--v2)" },
  ];
  return (
    <VisualizationFrame
      title="委派给 subagent：主上下文省了什么，多花了什么"
      description="任务：读 N 个文件，总结所有调用 parseDate 的位置。拖动滑块比较“父代理自己读完”和“分给 k 个 subagent 并行读、各交一份报告”两种做法。"
      footnote={<>基数是示意值：主上下文固定部分 6k、subagent 固定部分 4.5k、每份报告 1.2k。规律不依赖这些数字：委派省的是<b>主上下文</b>，花的是<b>总 token</b>和<b>信息细节</b>，换来的是并行和隔离。</>}
    >
      <div className="viz-controls">
        <label><span className="viz-k">文件数 N</span><input type="range" min={2} max={12} value={files} onChange={(e) => setFiles(Number(e.target.value))} /><span className="viz-mono">{files}</span></label>
        <label><span className="viz-k">每个文件</span><input type="range" min={1000} max={16000} step={1000} value={size} onChange={(e) => setSize(Number(e.target.value))} /><span className="viz-mono">{fmt(size)} tok</span></label>
        <label><span className="viz-k">subagent 数 k</span><input type="range" min={1} max={4} value={k} onChange={(e) => setK(Number(e.target.value))} /><span className="viz-mono">{k}</span></label>
      </div>
      <div className="viz-panel">
        <h5>上下文占用（token）</h5>
        <div className="viz-bars" role="img" aria-label={`直接做时主上下文 ${direct} token；委派后主上下文 ${delegatedMain} token，每个 subagent ${subCtx} token。`}>
          {rows.map((r) => (
            <div className="viz-bar-row" key={r.label}>
              <span className="viz-bar-label">{r.label}</span>
              <div className="viz-bar-track"><span style={{ width: `${Math.max(1, (r.value / scale) * 100)}%`, background: r.color }} /></div>
              <span className="viz-bar-val">{r.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div className="viz-legend"><span><i style={{ background: "var(--v1)" }} />主上下文</span><span><i style={{ background: "var(--v2)" }} />subagent 的独立上下文</span></div>
        {direct > 160000 && <p className="viz-k" style={{ marginTop: 6 }}>直接做已经逼近 200k 的窗口，harness 会开始压缩，早期读到的内容会被摘要替代。</p>}
      </div>
      <table className="viz-table">
        <thead><tr><th></th><th className="num">直接做</th><th className="num">委派给 {k} 个 subagent</th></tr></thead>
        <tbody>
          <tr><td>主上下文占用</td><td className="num">{direct.toLocaleString()}</td><td className="num">{delegatedMain.toLocaleString()}（−{saved}%）</td></tr>
          <tr><td>总 token 消耗（计费）</td><td className="num">{direct.toLocaleString()}</td><td className="num">{totalDelegated.toLocaleString()}（+{extra}%）</td></tr>
          <tr><td>轮次（墙钟时间的近似）</td><td className="num">{roundsDirect}</td><td className="num">{roundsDelegated}</td></tr>
          <tr><td>父代理最后看到的</td><td>每个文件的原文</td><td>{k} 份 1.2k 的报告，看不到原文</td></tr>
        </tbody>
      </table>
      <div className="viz-narr">
        委派后主上下文少了 {saved}%，但总 token 多了 {extra}%：每个 subagent 都要重新装一遍系统提示和工具 schema。轮次从 {roundsDirect} 降到 {roundsDelegated}，因为 {k} 个 subagent 同时读。代价是父代理只拿到报告：如果报告漏了什么，父代理无从知道。
      </div>
    </VisualizationFrame>
  );
}
