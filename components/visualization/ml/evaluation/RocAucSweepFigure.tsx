"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Curve from "@/components/visualization/ml/primitives/Curve";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Marker from "@/components/visualization/ml/primitives/Marker";
import Plot from "@/components/visualization/ml/primitives/Plot";
import Slider from "@/components/visualization/ml/primitives/Slider";
import { confusionAtThreshold, rocPoints, trapezoid } from "@/lib/ml/metrics";

const SAMPLES = [
  { score: 0.2, label: false },
  { score: 0.9, label: true },
  { score: 0.8, label: false },
  { score: 0.8, label: true },
];

const STEPS = rocPoints(SAMPLES).map((point) => ({
  ...point,
  ...confusionAtThreshold(SAMPLES, point.threshold),
}));
const LAST_STEP = STEPS.length - 1;
const COLOR = "var(--v1)";

export default function RocAucSweepFigure() {
  const [step, setStep] = useState(0);
  const point = STEPS[step];
  const threshold = step === 0 ? "∞" : point.threshold.toFixed(1);
  const points = STEPS.slice(0, step + 1).map(({ fpr, tpr }) => [fpr, tpr] as const);
  const area = trapezoid(points);
  const previous = STEPS[step - 1];
  const added = previous ? point.tp - previous.tp + point.fp - previous.fp : 0;
  const narration = step === 0
    ? "阈值高于所有分数，预测正例为空，曲线从 (0, 0) 出发。"
    : added > 1
      ? `分数为 ${threshold} 的 ${added} 个样本同时进入，曲线斜着走到 (${point.fpr}, ${point.tpr})。`
      : `分数为 ${threshold} 的样本进入，曲线${point.tp > previous.tp ? "向上" : "向右"}走到 (${point.fpr}, ${point.tpr})。`;

  return (
    <VisualizationFrame title="四个样本扫一遍 ROC" description="从左到右拖动滑杆，每次纳入一组同分样本。">
      <div className="viz-controls">
        <Slider label="阈值" value={step} min={0} max={LAST_STEP} onChange={setStep} display={threshold} />
        <button type="button" className="viz-btn" onClick={() => setStep(0)}>重置</button>
      </div>
      <div className="viz-grid2 wide-left">
        <Figure width={420} height={300} label={`ROC 点 (${point.fpr}, ${point.tpr})，累计面积 ${area}`}>
          <Plot box={{ x: 0, y: 0, w: 420, h: 300 }} xDomain={[0, 1]} yDomain={[0, 1]} xLabel="FPR" yLabel="TPR">
            {(frame) => (
              <>
                <Curve frame={frame} points={points} color={COLOR} width={2.2} area />
                <Marker frame={frame} x={point.fpr} y={point.tpr} color={COLOR} />
              </>
            )}
          </Plot>
        </Figure>
        <div className="viz-panel">
          <table className="viz-table">
            <thead>
              <tr><th scope="col">分数</th><th scope="col">真实标签</th><th scope="col">预测为正</th></tr>
            </thead>
            <tbody>
              {SAMPLES.map(({ score, label }) => (
                <tr key={`${score}-${label}`}>
                  <td>{score}</td><td>{label ? "正" : "负"}</td><td>{score >= point.threshold ? "是" : "否"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>TP = {point.tp}，FP = {point.fp}</p>
          <p>{step === LAST_STEP ? "AUC" : "累计面积"} = {area}</p>
        </div>
      </div>
      <div className="viz-narr" aria-live="polite">{narration}</div>
    </VisualizationFrame>
  );
}
