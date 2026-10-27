"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import { barsRun } from "@/lib/ml/daefuseRuns";
import { accuracy, SIDE } from "@/lib/ml/daefuseTrain";
import { Cells, CurvePanel, seq, Training, useLazyRun } from "./DfTrainKit";
import { gray } from "./DfPixels";

// 2.1 experiment: CNN (26 parameters, weights shared across positions) vs an
// MLP (1,074 parameters, one weight per pixel) on the same 16 training bars.
// Left: which pixels the training set ever lit. Right: both models' train and
// test accuracy over training. The test set holds every bar position.

const BLUE = "#2a78d6";
const ORANGE = "#eb6834";

export default function DfCnnExp() {
  const [ref, run] = useLazyRun(barsRun);
  const [view, setView] = useState<"cnn" | "mlp">("mlp");

  const cover = run ? Array.from({ length: SIDE * SIDE }, (_, i) => run.train.filter((s) => s.x[i] > 0.5).length) : [];
  const final = run ? { cnn: run.cnn.at(-1)!, mlp: run.mlp.at(-1)! } : null;
  const wrong = run && final ? run.test.filter((s) => accuracy(view, final[view].params, [s]) === 0) : [];
  // Share of a test bar's pixels that were never lit in training, averaged over the MLP's wrong / right answers.
  const unseen = (x: number[]) => {
    const px = x.flatMap((v, i) => (v > 0.5 ? [i] : []));
    return px.filter((i) => cover[i] === 0).length / px.length;
  };
  const mlpWrong = run && final ? run.test.filter((s) => accuracy("mlp", final.mlp.params, [s]) === 0) : [];
  const mlpRight = run && final ? run.test.filter((s) => accuracy("mlp", final.mlp.params, [s]) === 1) : [];
  const avgUnseen = (xs: { x: number[] }[]) => (xs.length ? xs.reduce((a, s) => a + unseen(s.x), 0) / xs.length : 0);

  return (
    <VisualizationFrame
      title="实验：CNN vs MLP，只见过 16 张图，能不能认出新位置上的线"
      description="同一份训练数据（16 张）、同一个优化器，测试集是 80 张图，覆盖横线、竖线的每一个位置。左边是训练集里每个像素被线盖到过几次。"
      footnote="真实计算：CNN 26 个参数（Adam 学习率 0.05），MLP 64 → 16 → 2 共 1,074 个参数（学习率 0.02），都训练 300 步，每 10 步在测试集上算一次准确率。"
    >
      <div ref={ref}>
        {!run || !final ? (
          <Training />
        ) : (
          <>
            <Figure width={700} height={250} label={`测试准确率：CNN ${(final.cnn.testAcc * 100).toFixed(0)}%，MLP ${(final.mlp.testAcc * 100).toFixed(0)}%`} minWidth={600}>
              <Cells vals={cover} cols={SIDE} x={14} y={40} cell={18} color={(v) => (v === 0 ? "#fff" : seq(v, 3))} title="训练集盖到过的像素" />
              {cover.map((v, i) => <text key={i} x={14 + (i % SIDE) * 18 + 9} y={40 + Math.floor(i / SIDE) * 18 + 13} fontSize={9} textAnchor="middle" fill={v === 0 ? "#c9c4ad" : "#30332c"} className="mono">{v}</text>)}
              <text x={14} y={200} fontSize={10} fill="#76796f">0 = 训练时从没亮过的像素</text>
              <text x={14} y={214} fontSize={10} fill="#76796f">（共 {cover.filter((v) => v === 0).length} 个）</text>
              <CurvePanel
                box={{ x: 180, y: 8, w: 520, h: 236 }}
                xMax={300}
                yDomain={[0.4, 1.02]}
                yTicks={[0.5, 0.75, 1]}
                title="准确率"
                format={(v) => `${Math.round(v * 100)}%`}
                series={[
                  { label: "CNN 测试", color: BLUE, points: run.cnn.map((p) => [p.step, p.testAcc]) },
                  { label: "CNN 训练", color: BLUE, points: run.cnn.map((p) => [p.step, p.trainAcc]), dashed: true },
                  { label: "MLP 测试", color: ORANGE, points: run.mlp.map((p) => [p.step, p.testAcc]) },
                  { label: "MLP 训练", color: ORANGE, points: run.mlp.map((p) => [p.step, p.trainAcc]), dashed: true },
                ]}
              />
            </Figure>
            <table className="viz-table" style={{ marginTop: 8 }}>
              <thead><tr><th>模型</th><th className="num">参数</th><th className="num">训练准确率</th><th className="num">测试准确率</th></tr></thead>
              <tbody>
                <tr><td style={{ color: BLUE }}>CNN（2 个 3 × 3 核）</td><td className="num">26</td><td className="num">{(final.cnn.trainAcc * 100).toFixed(0)}%</td><td className="num">{(final.cnn.testAcc * 100).toFixed(0)}%</td></tr>
                <tr><td style={{ color: ORANGE }}>MLP（64 → 16 → 2）</td><td className="num">1,074</td><td className="num">{(final.mlp.trainAcc * 100).toFixed(0)}%</td><td className="num">{(final.mlp.testAcc * 100).toFixed(0)}%</td></tr>
              </tbody>
            </table>
            <div className="viz-row" style={{ marginTop: 12 }}>
              <span className="viz-k">看它判错的测试图：</span>
              <Tabs options={[{ key: "mlp", label: "MLP" }, { key: "cnn", label: "CNN" }]} value={view} onChange={setView} ariaLabel="模型" />
              <span className="viz-k">{wrong.length} 张</span>
            </div>
            {wrong.length > 0 && (
              <div className="viz-scroll">
                <svg viewBox={`0 0 ${Math.min(wrong.length, 12) * 58} 62`} role="img" aria-label={`${view} 判错的测试图`} style={{ minWidth: 0, maxWidth: Math.min(wrong.length, 12) * 58 }}>
                  {wrong.slice(0, 12).map((s, i) => (
                    <g key={i}>
                      <Cells vals={s.x} cols={8} x={i * 58 + 2} y={4} cell={6} color={(v) => gray(v)} />
                      <text x={i * 58 + 26} y={60} fontSize={9} textAnchor="middle" fill="#76796f">{s.y === 0 ? "横" : "竖"}</text>
                    </g>
                  ))}
                </svg>
              </div>
            )}
            <div className="viz-narr is-good">
              两个模型都把 16 张训练图背得一字不差（训练准确率 100%），差别全在没见过的位置上：CNN 的测试准确率 {(final.cnn.testAcc * 100).toFixed(0)}%，MLP 只有 {(final.mlp.testAcc * 100).toFixed(0)}%，比瞎猜好不了多少。MLP 判错的 {mlpWrong.length} 张图里，线上平均 {Math.round(avgUnseen(mlpWrong) * 100)}% 的像素训练时从没亮过；判对的图里只有 {Math.round(avgUnseen(mlpRight) * 100)}%。
            </div>
          </>
        )}
      </div>
    </VisualizationFrame>
  );
}
