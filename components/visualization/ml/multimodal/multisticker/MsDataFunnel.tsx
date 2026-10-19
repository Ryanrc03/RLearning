"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import { MS_DATA, MS_FUNNEL } from "@/lib/ml/multisticker";

// From raw U-Sticker chat logs to the 30k training samples. Bar widths are on a
// log scale so 8.9M and 30k fit on one row; click a stage for what happened.

const COLORS = ["#8e8d78", "var(--v1)", "var(--v3)", "var(--v4)", "var(--v2)"];
const fmt = (v: number) => v.toLocaleString("en-US");
const logW = (v: number) => (Math.log10(v) / Math.log10(MS_FUNNEL[0].value)) * 100;

const DETAIL: Record<string, string> = {
  rows: "原始数据是 U-Sticker：67 个对话导出的 JSON 文件，每行一条消息，带时间戳、发送者，可能带一张贴纸。还有 141,970 行被标成 offensive。",
  sticker_rows: "只看带贴纸的消息。三种格式都保留：静态 png，动图 gif，短视频贴纸 webm。动图后面要逐帧编码再平均。",
  samples: "同一个文件里，两条消息间隔超过 12 小时就切一刀，得到 8,129 个 session。session 里每一次发贴纸是一个样本：前面最多 12 轮是上下文，这张贴纸是答案，更早的 session 是这个样本可用的「历史」。",
  filtered: "每个文件里按 session 的时间顺序 9 : 1 切训练和验证（328,953 : 39,550），验证的 session 总在训练之后。只出现过一次的贴纸无从学起，min_sticker_frequency = 2 把它们去掉，训练样本剩 181,758 条，贴纸池剩 7,011 张，能解码的 6,758 张组成候选库。",
  train: "medium 规模实验从 181,758 条里随机抽 30,000 条训练（对得上库的 28,819 条），验证 4,998 条：png 1,676、gif 2,284、webm 1,038。",
};

export default function MsDataFunnel() {
  const [sel, setSel] = useState<string>("samples");
  const m = MS_DATA.mediaRows;
  const total = m.png + m.gif + m.webm;
  return (
    <VisualizationFrame
      title="数据：从 895 万行聊天到 3 万个训练样本"
      description="每一行是一道过滤，条的长度是对数刻度。点一行看这一步做了什么。"
      footnote="数字来自 medium 规模运行的日志和 dataset_summary。"
    >
      <div className="ms-funnel" role="list">
        {MS_FUNNEL.map((s, i) => (
          <button key={s.key} type="button" className={sel === s.key ? "is-on" : ""} aria-pressed={sel === s.key} onClick={() => setSel(s.key)}>
            <span>
              <b style={{ fontWeight: 600 }}>{s.label}</b>
              <small className="viz-k" style={{ display: "block", fontSize: 11 }}>{s.note}</small>
            </span>
            <span className="ms-funnel-track"><span style={{ width: `${logW(s.value)}%`, background: COLORS[i] }} /></span>
            <span className="ms-funnel-val">{fmt(s.value)}</span>
          </button>
        ))}
      </div>
      <div className="viz-panel" style={{ marginTop: 12 }}>
        <h5>带贴纸的消息按格式</h5>
        <div className="ms-mix" aria-label="贴纸格式占比">
          <span style={{ width: `${(m.png / total) * 100}%`, background: "var(--v1)" }}>png {((m.png / total) * 100).toFixed(0)}%</span>
          <span style={{ width: `${(m.gif / total) * 100}%`, background: "var(--v4)" }}>gif {((m.gif / total) * 100).toFixed(0)}%</span>
          <span style={{ width: `${(m.webm / total) * 100}%`, background: "var(--v2)" }}>webm {((m.webm / total) * 100).toFixed(0)}%</span>
        </div>
      </div>
      <div className="viz-narr">{DETAIL[sel]}</div>
    </VisualizationFrame>
  );
}
