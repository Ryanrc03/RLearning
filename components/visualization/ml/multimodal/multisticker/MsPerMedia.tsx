"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import { MS_DATA, MS_PER_MEDIA, type MsMedia } from "@/lib/ml/multisticker";

// Experiment 4: the same metrics split by sticker format. A heat table: darker
// is better, each column shares one colour scale so formats can be compared.

type Run = keyof typeof MS_PER_MEDIA;
const RUNS: { key: Run; label: string }[] = [
  { key: "head_no_memory", label: "head（无记忆）" },
  { key: "head_only", label: "head_only" },
  { key: "text_lora", label: "text_lora" },
  { key: "image_lora", label: "image_lora" },
  { key: "dual_lora", label: "dual_lora" },
];
const MEDIA: MsMedia[] = ["png", "gif", "webm"];
type Key = "r5" | "r30" | "g30";
const LABEL: Record<Key, string> = { r5: "Exact R@5", r30: "Exact R@30", g30: "Group R@30" };

export default function MsPerMedia() {
  const [key, setKey] = useState<Key>("r30");
  const vals = RUNS.flatMap((r) => MEDIA.map((m) => MS_PER_MEDIA[r.key][m][key]));
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const shade = (v: number) => {
    const t = hi === lo ? 0 : (v - lo) / (hi - lo);
    return { background: `rgba(42, 120, 214, ${0.08 + 0.72 * t})`, color: t > 0.55 ? "#fff" : "#30332c" };
  };
  const narr: Record<Key, string> = {
    r30: "webm 是最难的一列：最好也只有 2.22%，png 和 gif 是它的 4–9 倍。webm 是短视频贴纸，模型只看到帧平均后的一张「模糊」向量，动作和节奏全丢了；验证集里 webm 也最少（1,038 条）。gif 反而最好，可能是因为同一个群反复用同一套动图。",
    r5: "Exact R@5 上 image_lora 的 gif 一格最亮（6.70%）：让图像编码器也训练，对动图帮助最大。",
    g30: "Group R@30 上三种格式差距小很多（90–96%），webm 依旧最低。语义大类对得上，难在精确到那一张。",
  };
  return (
    <VisualizationFrame
      title="实验 4：按贴纸格式拆开看"
      description={`验证集 png ${MS_DATA.valByMedia.png.toLocaleString("en-US")} 条、gif ${MS_DATA.valByMedia.gif.toLocaleString("en-US")} 条、webm ${MS_DATA.valByMedia.webm.toLocaleString("en-US")} 条。格子越深越好，整张表共用一个色阶。`}
    >
      <Tabs options={(["r5", "r30", "g30"] as Key[]).map((k) => ({ key: k, label: LABEL[k] }))} value={key} onChange={setKey} ariaLabel="指标" />
      <table className="viz-table ms-heat" style={{ marginTop: 10 }}>
        <thead>
          <tr><th>运行</th>{MEDIA.map((m) => <th key={m} style={{ textAlign: "center" }}>{m}</th>)}</tr>
        </thead>
        <tbody>
          {RUNS.map((r) => (
            <tr key={r.key}>
              <td>{r.label}</td>
              {MEDIA.map((m) => {
                const v = MS_PER_MEDIA[r.key][m][key];
                return <td key={m} className="ms-cell" style={shade(v)}>{(v * 100).toFixed(2)}%</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="viz-narr">{narr[key]}</div>
    </VisualizationFrame>
  );
}
