"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Curve from "@/components/visualization/ml/primitives/Curve";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Marker from "@/components/visualization/ml/primitives/Marker";
import Plot from "@/components/visualization/ml/primitives/Plot";
import Slider from "@/components/visualization/ml/primitives/Slider";
import { auc, confusionAtThreshold, fpr, makeScoredDataset, recall, rocPoints } from "@/lib/ml/metrics";

// Page 3 of Evaluation: two models scored on the same 60 animals. Sweeping the
// threshold moves one point along each ROC curve; the curves and the AUC do not move.

const C_A = "#2a78d6";
const C_B = "#eb6834";

export default function RocAucFigure() {
  const [t, setT] = useState(0.5);
  const data = useMemo(() => {
    const a = makeScoredDataset({ seed: 11, nPos: 30, nNeg: 30, posMean: 0.68, negMean: 0.36, sd: 0.14 });
    const b = makeScoredDataset({ seed: 12, nPos: 30, nNeg: 30, posMean: 0.58, negMean: 0.45, sd: 0.16 });
    return {
      a: { items: a, roc: rocPoints(a).map((p) => [p.fpr, p.tpr] as const), auc: auc(a) },
      b: { items: b, roc: rocPoints(b).map((p) => [p.fpr, p.tpr] as const), auc: auc(b) },
    };
  }, []);
  const ca = confusionAtThreshold(data.a.items, t);
  const cb = confusionAtThreshold(data.b.items, t);
  const pa = { fpr: fpr(ca), tpr: recall(ca) };
  const pb = { fpr: fpr(cb), tpr: recall(cb) };

  const narr =
    t >= 0.99
      ? "阈值拉到最高：谁都不被叫成 dog，TPR 和 FPR 都是 0，两条曲线都从左下角 (0, 0) 出发。"
      : t <= 0.01
        ? "阈值拉到最低：所有动物都被叫成 dog，TPR 和 FPR 都是 1，两条曲线都在右上角 (1, 1) 结束。"
        : `阈值 ${t.toFixed(2)}：A 找出 ${Math.round(pa.tpr * 100)}% 的 dog，冤枉了 ${Math.round(pa.fpr * 100)}% 的 cat；B 是 ${Math.round(pb.tpr * 100)}% 和 ${Math.round(pb.fpr * 100)}%。点在动，曲线和 AUC 不动：AUC ${data.a.auc.toFixed(2)} 的意思是随机抽一只 dog 和一只 cat，A 给 dog 的分数更高的概率是 ${Math.round(data.a.auc * 100)}%。`;

  return (
    <VisualizationFrame
      title="ROC：把阈值扫一遍，每个阈值留下一个点"
      description="同一批 30 只 dog、30 只 cat，模型 A 和 B 各给一套分数。拖阈值看两个点沿着各自的曲线走；AUC 是曲线下面积，不随阈值变。"
    >
      <Slider label="阈值" value={t} min={0} max={1} step={0.01} onChange={setT} display={t.toFixed(2)} id="roc-threshold" />
      <div className="viz-grid2 wide-left">
        <Figure width={420} height={330} label={`ROC 曲线，模型 A 的 AUC ${data.a.auc.toFixed(2)}，模型 B 的 AUC ${data.b.auc.toFixed(2)}`} minWidth={360}>
          <Plot box={{ x: 0, y: 0, w: 420, h: 330 }} xDomain={[0, 1]} yDomain={[0, 1]} xLabel="FPR = FP / (FP + TN)，冤枉了多少 cat" yLabel="TPR = TP / (TP + FN)，找出了多少 dog" diagonal>
            {(f) => (
              <>
                <Curve frame={f} points={data.a.roc} color={C_A} width={2.2} />
                <Curve frame={f} points={data.b.roc} color={C_B} width={2.2} />
                <Marker frame={f} x={pb.fpr} y={pb.tpr} color={C_B} label="B" side="below" guides />
                <Marker frame={f} x={pa.fpr} y={pa.tpr} color={C_A} label="A" side="above" guides />
                <text x={f.x1 - 4} y={f.y0 - 8} fontSize={11} textAnchor="end" fill="#8e8d78">对角线：瞎猜</text>
              </>
            )}
          </Plot>
        </Figure>
        <div className="viz-panel">
          <h5>阈值 {t.toFixed(2)} 下的两个点</h5>
          <table className="viz-table">
            <thead>
              <tr><th></th><th className="num">TPR</th><th className="num">FPR</th><th className="num">AUC</th></tr>
            </thead>
            <tbody>
              <tr><td><i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: C_A, marginRight: 6 }} />模型 A</td><td className="num">{pa.tpr.toFixed(2)}</td><td className="num">{pa.fpr.toFixed(2)}</td><td className="num">{data.a.auc.toFixed(2)}</td></tr>
              <tr><td><i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: C_B, marginRight: 6 }} />模型 B</td><td className="num">{pb.tpr.toFixed(2)}</td><td className="num">{pb.fpr.toFixed(2)}</td><td className="num">{data.b.auc.toFixed(2)}</td></tr>
            </tbody>
          </table>
          <p className="viz-k" style={{ marginTop: 10 }}>
            越靠左上越好：同样冤枉这么多 cat，找出的 dog 更多。AUC 把所有阈值一次算完，所以比较模型时不用先定阈值。
          </p>
        </div>
      </div>
      <div className="viz-narr">{narr}</div>
    </VisualizationFrame>
  );
}
