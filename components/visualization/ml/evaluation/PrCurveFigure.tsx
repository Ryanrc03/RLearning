"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Curve from "@/components/visualization/ml/primitives/Curve";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Plot from "@/components/visualization/ml/primitives/Plot";
import Slider from "@/components/visualization/ml/primitives/Slider";
import { auc, averagePrecision, makeScoredDataset, precisionAtK, prPoints, rocPoints } from "@/lib/ml/metrics";

// Page 4 of Evaluation: the same 40 positives, with ever more negatives. ROC
// barely notices; the PR curve and precision@k collapse.

const RATIOS = [1, 2, 5, 10, 20, 50, 99];
const N_POS = 40;
const C_ROC = "#2a78d6";
const C_PR = "#eb6834";

export default function PrCurveFigure() {
  const [idx, setIdx] = useState(0);
  const ratio = RATIOS[idx];
  const d = useMemo(() => {
    const items = makeScoredDataset({ seed: 21, nPos: N_POS, nNeg: N_POS * ratio, posMean: 0.64, negMean: 0.4, sd: 0.15 });
    return {
      roc: rocPoints(items).map((p) => [p.fpr, p.tpr] as const),
      pr: prPoints(items).map((p) => [p.recall, p.precision] as const),
      auc: auc(items),
      ap: averagePrecision(items),
      p5: precisionAtK(items, 5),
      p10: precisionAtK(items, 10),
      p20: precisionAtK(items, 20),
      n: items.length,
    };
  }, [ratio]);
  const base = useMemo(() => {
    const items = makeScoredDataset({ seed: 21, nPos: N_POS, nNeg: N_POS, posMean: 0.64, negMean: 0.4, sd: 0.15 });
    return { auc: auc(items), ap: averagePrecision(items) };
  }, []);

  const narr =
    ratio === 1
      ? `1 : 1 时两张图都好看：AUC ${d.auc.toFixed(2)}，PR-AUC ${d.ap.toFixed(2)}。把滑杆往右拖，正例还是这 40 个，负例越来越多。`
      : `每 1 个正例配 ${ratio} 个负例，共 ${d.n} 条。AUC 从 ${base.auc.toFixed(2)} 变成 ${d.auc.toFixed(2)}，几乎没动，因为 FPR 的分母（全部负例）跟着变大；PR-AUC 从 ${base.ap.toFixed(2)} 掉到 ${d.ap.toFixed(2)}，因为同样比例的负例被误判，绝对数量多了 ${ratio} 倍，precision 的分母被撑大。排在最前面的 10 个里${d.p10 >= 0.8 ? "还有" : "只剩"} ${Math.round(d.p10 * 10)} 个是正例。`;

  return (
    <VisualizationFrame
      title="同一个模型，负例越多，哪张图先变脸"
      description="40 个正例固定不动，拖滑杆给它们配越来越多的负例。左边 ROC，右边 PR，下面是排在最前面的 k 个里有几个正例。"
    >
      <Slider label="负例 : 正例" value={idx} min={0} max={RATIOS.length - 1} step={1} onChange={setIdx} display={`${ratio} : 1`} id="pr-ratio" />
      <Figure width={720} height={300} label={`负正比 ${ratio}:1，AUC ${d.auc.toFixed(2)}，PR-AUC ${d.ap.toFixed(2)}`}>
        <Plot box={{ x: 0, y: 0, w: 350, h: 300 }} xDomain={[0, 1]} yDomain={[0, 1]} xLabel="FPR" yLabel="TPR（recall）" title="ROC" diagonal>
          {(f) => <Curve frame={f} points={d.roc} color={C_ROC} width={2.2} area />}
        </Plot>
        <Plot box={{ x: 370, y: 0, w: 350, h: 300 }} xDomain={[0, 1]} yDomain={[0, 1]} xLabel="recall" yLabel="precision" title="PR">
          {(f) => (
            <>
              <line x1={f.x0} y1={f.y(N_POS / d.n)} x2={f.x1} y2={f.y(N_POS / d.n)} stroke="#c9c4ad" strokeDasharray="4 4" style={{ transition: "y1 .3s, y2 .3s" }} />
              <text x={f.x1 - 4} y={f.y(N_POS / d.n) - 5} fontSize={10.5} textAnchor="end" fill="#8e8d78">瞎猜 = 正例占比 {(N_POS / d.n).toFixed(2)}</text>
              <Curve frame={f} points={d.pr} color={C_PR} width={2.2} area step />
            </>
          )}
        </Plot>
      </Figure>
      <div className="viz-stat" style={{ marginTop: 12 }}>
        <div><small>AUC（ROC 下面积）</small><b>{d.auc.toFixed(2)}</b></div>
        <div><small>PR-AUC（average precision）</small><b>{d.ap.toFixed(2)}</b></div>
        <div><small>precision@5</small><b>{d.p5.toFixed(2)}</b></div>
        <div><small>precision@10</small><b>{d.p10.toFixed(2)}</b></div>
        <div><small>precision@20</small><b>{d.p20.toFixed(2)}</b></div>
      </div>
      <div className={`viz-narr${ratio >= 10 ? " is-warn" : ""}`}>{narr}</div>
    </VisualizationFrame>
  );
}
