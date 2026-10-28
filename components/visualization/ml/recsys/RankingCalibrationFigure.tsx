"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Slider from "@/components/visualization/ml/primitives/Slider";
import Bars from "@/components/visualization/ml/primitives/Bars";
import { samplingExample } from "@/lib/ml/ranking";

const pct = (p: number) => `${(100 * p).toFixed(2)}%`;

export default function RankingCalibrationFigure() {
  const [alpha, setAlpha] = useState(0.1);
  const e = samplingExample(100, 900, alpha);
  return (
    <div className="ranking-viz">
      <VisualizationFrame title="负样本少了，预测的 CTR 为什么变高？" description="固定同一个群体：100 个正样本、900 个负样本。只改变负样本保留率 α；假设模型精确学到了采样分布。">
        <div className="viz-row">
          <Slider label="负样本保留率 α" min={0.01} max={1} step={0.01} value={alpha} onChange={setAlpha} display={alpha.toFixed(2)} />
          <button type="button" className="viz-btn" onClick={() => setAlpha(0.1)}>重置</button>
        </div>
        <div className="viz-grid2">
          {[{ title: "原始数据", negative: e.negative, positiveRate: e.original }, { title: "降采样后（期望数量）", negative: e.negativeKept, positiveRate: e.sampled }].map((d) => <div className="viz-panel" key={d.title}>
            <h5>{d.title}</h5>
            <div className="viz-stack" role="img" aria-label={`100 个正样本、${d.negative.toFixed(0)} 个负样本，正样本占 ${pct(d.positiveRate)}`}>
              <span style={{ width: `${d.positiveRate * 100}%`, background: "var(--v1)" }} />
              <span style={{ flex: 1, background: "var(--vline)" }} />
            </div>
            <div className="viz-legend"><span>正样本 {e.positive}</span><span>负样本 {d.negative.toFixed(0)}</span></div>
          </div>)}
        </div>
        <div className="ranking-block">
          <Bars rows={[
            { label: "原始 CTR", value: e.original, color: "var(--v1)", text: pct(e.original) },
            { label: "采样后 p_pred", value: e.sampled, color: "var(--v2)", text: pct(e.sampled) },
            { label: "校正后 p_true", value: e.corrected, color: "var(--v3)", text: pct(e.corrected) },
          ]} />
        </div>
        <div className="ranking-equation" aria-label="将当前数值代入校准公式">
          p_true = ({alpha.toFixed(2)} × {e.sampled.toFixed(4)}) / (1 − {e.sampled.toFixed(4)} + {alpha.toFixed(2)} × {e.sampled.toFixed(4)}) ≈ {e.corrected.toFixed(4)}
        </div>
        <div className="viz-narr" aria-live="polite">{alpha === 1 ? "α = 1：负样本全部保留，采样分布与原分布相同，无需校正。" : `只保留 ${(alpha * 100).toFixed(0)}% 的负样本后，正样本占比从 ${pct(e.original)} 升到 ${pct(e.sampled)}。用完整精度校正后回到 ${pct(e.corrected)}；原始用户群体的点击倾向没有改变。`}</div>
      </VisualizationFrame>
    </div>
  );
}
