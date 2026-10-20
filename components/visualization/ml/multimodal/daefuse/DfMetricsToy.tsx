"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import { entropy, fuse, fusionMI, lossInt, lossText, spatialFrequency, stdDev, toyInfrared, toyVisible, type FusionRule } from "@/lib/ml/daefuse";

// Section 4.1: the no-reference metrics, computed on the same toy scene as the
// Phase 2 loss figure so each formula has a number next to it. Fusion has no
// ground-truth image, so every metric scores F against itself or against the
// two sources; the table shows where that can mislead.

type Key = "EN" | "SD" | "SF" | "MI";
const ROWS: { key: string; label: string; rule: FusionRule; w?: number }[] = [
  { key: "ir", label: "只用红外", rule: "ir" },
  { key: "vis", label: "只用可见光", rule: "vis" },
  { key: "mean", label: "平均（w = 0.5）", rule: "weighted", w: 0.5 },
  { key: "max", label: "逐像素取大", rule: "max" },
];
const INFO: Record<Key, { name: string; formula: string; reads: string }> = {
  EN: { name: "Entropy", formula: "EN = −Σ p_g log₂ p_g，p_g 是灰度 g 的像素占比", reads: "灰度分布越分散，信息量越大" },
  SD: { name: "Standard deviation", formula: "SD = √( Σ (F − μ)² / HW )，在 0–255 的灰度上算", reads: "整体对比度" },
  SF: { name: "Spatial frequency", formula: "SF = √(RF² + CF²)，RF / CF 是横向 / 纵向相邻像素差的均方根", reads: "边缘和纹理有多丰富" },
  MI: { name: "Mutual information", formula: "MI = I(F; α) + I(F; β)，用 16 级联合直方图估计", reads: "F 从两张源图里各带过来多少信息" },
};

export default function DfMetricsToy() {
  const [key, setKey] = useState<Key>("EN");
  const table = useMemo(() => {
    const ir = toyInfrared();
    const vis = toyVisible();
    return ROWS.map((r) => {
      const f = fuse(ir, vis, r.rule, r.w);
      return { ...r, EN: entropy(f), SD: stdDev(f), SF: spatialFrequency(f), MI: fusionMI(f, ir, vis), Lint: lossInt(f, ir, vis), Ltext: lossText(f, ir, vis) };
    });
  }, []);
  const best = table.reduce((b, r) => (r[key] > b[key] ? r : b));
  const NARR: Record<Key, string> = {
    EN: `平均融合的 EN 最高（${table[2].EN.toFixed(2)}），可它恰恰是对比度最差的那张。原因：示意图只有十几个灰度级，平均之后两两组合出很多新灰度，直方图更「分散」。EN 不看空间结构，噪声和发灰都能把它刷高。`,
    SD: `SD 最高的是只用红外（${table[0].SD.toFixed(1)}），平均融合最低（${table[2].SD.toFixed(1)}）：平均把亮的和暗的往中间拉，对比度最差。SD 抓得住「发灰」，但它同样奖励噪声。`,
    SF: `逐像素取大的 SF 最高（${table[3].SF.toFixed(1)}）：它同时保住了砖墙纹理和人的轮廓。平均融合只有 ${table[2].SF.toFixed(1)}。SF 和 L_text 看的是同一类东西，表里两列的排序几乎一致。`,
    MI: `只用可见光的 MI 最高（${table[1].MI.toFixed(2)}）：它和自己的互信息拉满了一半。MI 是两项之和，偏向某一种模态也能得高分，所以它要和 SCD、Qabf 这类「两边都要」的指标一起看。`,
  };

  return (
    <VisualizationFrame
      title="无参考指标在示意图上各是多少"
      description="融合没有标准答案图，指标只能看 F 自己（EN、SD、SF）或者看 F 和两张源图的关系（MI、SCD、VIF、Qabf）。选一个指标，看它在四种手工融合上的排序，和 Phase 2 的两个损失放在一起比。"
      footnote="示意计算：24 × 16 的玩具图，灰度量化到 0–255。SCD、VIF、Qabf 需要多尺度或滑动窗口，这里只给定义不算。"
    >
      <div className="viz-chips" role="group" aria-label="指标">
        {(Object.keys(INFO) as Key[]).map((k) => (
          <button key={k} type="button" className={`viz-chip${key === k ? " is-on" : ""}`} aria-pressed={key === k} onClick={() => setKey(k)}>{k}</button>
        ))}
      </div>
      <p className="viz-mono" style={{ margin: "10px 0 2px" }}>{INFO[key].formula}</p>
      <p className="viz-k">{INFO[key].name}：{INFO[key].reads}，越大越好。</p>
      <div className="viz-scroll"><table className="viz-table" style={{ marginTop: 8, minWidth: 480 }}>
        <thead><tr><th>融合方式</th>{(["EN", "SD", "SF", "MI"] as Key[]).map((k) => <th key={k} className="num" style={{ background: k === key ? "#fbf7e6" : undefined }}>{k} ↑</th>)}<th className="num">L_int ↓</th><th className="num">L_text ↓</th></tr></thead>
        <tbody>
          {table.map((r) => (
            <tr key={r.key} style={{ fontWeight: r === best ? 700 : 400 }}>
              <td>{r.label}</td>
              <td className="num" style={{ background: key === "EN" ? "#fbf7e6" : undefined }}>{r.EN.toFixed(2)}</td>
              <td className="num" style={{ background: key === "SD" ? "#fbf7e6" : undefined }}>{r.SD.toFixed(1)}</td>
              <td className="num" style={{ background: key === "SF" ? "#fbf7e6" : undefined }}>{r.SF.toFixed(1)}</td>
              <td className="num" style={{ background: key === "MI" ? "#fbf7e6" : undefined }}>{r.MI.toFixed(2)}</td>
              <td className="num">{r.Lint.toFixed(3)}</td>
              <td className="num">{r.Ltext.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      <div className="viz-narr is-warn">{NARR[key]}</div>
    </VisualizationFrame>
  );
}
