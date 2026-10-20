"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Bars from "@/components/visualization/ml/primitives/Bars";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import { DF_DATASETS, DF_METHOD_KIND, DF_METHODS, DF_METRICS, dfPodium, dfRank, dfValue, type DfDataset, type DfMetric } from "@/lib/ml/daefuse";

// Sections 4.2 and 4.5: Tables I and II. Pick a dataset and a metric; bars are
// coloured by method family so "GAN methods score low on SF" is visible at a
// glance. The podium table under it counts 1st / 2nd places per dataset.

const COLOR: Record<string, string> = { Ours: "#2a78d6", GAN: "#eb6834", Diffusion: "#1baf7a", AE: "#cfcab4", "AE（双分支）": "#b9b39b" };

export default function DfResults({ initial = "TNO" }: { initial?: DfDataset }) {
  const [ds, setDs] = useState<DfDataset>(initial);
  const [metric, setMetric] = useState<DfMetric>("Qabf");
  const vals = DF_METHODS.map((m) => dfValue(ds, m, metric));
  const max = Math.max(...vals);
  const rank = dfRank(ds, "DAE-Fuse", metric);
  const ours = dfValue(ds, "DAE-Fuse", metric);
  const winner = DF_METHODS[vals.indexOf(max)];
  const second = [...vals].sort((a, b) => b - a)[1];
  const fmt = (v: number) => v.toFixed(2);

  return (
    <VisualizationFrame
      title="表 I / II：8 种方法、4 个数据集、7 个指标"
      description="TNO、MSRS、RoadScene 是红外-可见光融合；MRI-CT 是医学图像融合，模型没有重新训练直接拿来用。所有指标都是越大越好。"
      footnote="数字抄自论文表 I、表 II。颜色按方法类别：蓝 = DAE-Fuse，橙 = GAN，绿 = 扩散模型，灰 = AE。"
    >
      <div className="viz-row">
        <Tabs options={DF_DATASETS.map((d) => ({ key: d, label: d }))} value={ds} onChange={setDs} ariaLabel="数据集" />
        <div className="viz-chips" role="group" aria-label="指标">
          {DF_METRICS.map((k) => (
            <button key={k} type="button" className={`viz-chip${metric === k ? " is-on" : ""}`} aria-pressed={metric === k} onClick={() => setMetric(k)}>{k}</button>
          ))}
        </div>
      </div>
      <div className="viz-panel">
        <h5>{ds} · {metric}</h5>
        <Bars
          rows={DF_METHODS.map((m, i) => ({
            label: m,
            value: vals[i],
            max: max * 1.05,
            color: COLOR[DF_METHOD_KIND[m]],
            text: fmt(vals[i]),
            hint: `${DF_METHOD_KIND[m] === "Ours" ? "" : DF_METHOD_KIND[m] + " · "}第 ${dfRank(ds, m, metric)}`,
          }))}
        />
      </div>
      <div className="viz-scroll"><table className="viz-table" style={{ marginTop: 10 }}>
        <thead><tr><th>名次</th>{DF_METRICS.map((k) => <th key={k} className="num">{k}</th>)}<th className="num">第 1 / 第 2</th></tr></thead>
        <tbody>
          {DF_DATASETS.map((d) => {
            const p = dfPodium(d, "DAE-Fuse");
            return (
              <tr key={d} style={{ background: d === ds ? "#fbf7e6" : undefined }}>
                <td>{d}</td>
                {p.ranks.map((r, i) => <td key={i} className="num" style={{ fontWeight: r === 1 ? 700 : 400 }}>{r}</td>)}
                <td className="num">{p.first} / {p.second}</td>
              </tr>
            );
          })}
        </tbody>
      </table></div>
      <div className={`viz-narr${rank === 1 ? " is-good" : " is-warn"}`}>
        {rank === 1
          ? `${ds} 上 ${metric} 第一：${fmt(ours)}，比第二名高 ${fmt(ours - second)}。${metric === "SF" ? "两个 GAN 方法（DDcGAN、TarDAL）在 SF 上几乎垫底，对应论文说的「GAN 融合发糊」。" : metric === "SCD" || metric === "Qabf" ? "SCD 和 Qabf 都要求两张源图的信息同时出现在 F 里，这正是 Phase 2 两个判别器的目标。" : ""}`
          : `${ds} 上 ${metric} 排第 ${rank}：${fmt(ours)}，第一是 ${winner} 的 ${fmt(max)}。${winner === "DDFM" ? (metric === "SD" ? "DDFM 是扩散模型，SD 高说明它生成的图对比度更强。" : "DDFM 是扩散模型，推理要几十上百步去噪，比一次前向的 AE 慢得多。") : winner === "CDDFuse" ? "CDDFuse 是 DAE-Fuse 的直接前身（同样的双分支 + 相关性分解），去掉判别器和 cross-attention 之后 VIF 反而略高。" : winner === "RFN-Nest" ? "RFN-Nest 的 SF / EN 高，但 MI、Qabf 低：边缘多不等于两边的信息都保住了。" : ""}`}
        {" "}整张表 28 个格子里，DAE-Fuse 21 个第一，其余 7 个全是第二。
      </div>
    </VisualizationFrame>
  );
}
