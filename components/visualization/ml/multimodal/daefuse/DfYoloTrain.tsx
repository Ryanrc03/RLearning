"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
import StepPlayer from "@/components/visualization/ml/primitives/StepPlayer";
import { detRun } from "@/lib/ml/daefuseRuns";
import { boxIou, detForward, GRID, SIDE } from "@/lib/ml/daefuseTrain";
import { Cells, CurvePanel, Training, useLazyRun } from "./DfTrainKit";
import { gray } from "./DfPixels";

// 2.6 training dynamics: the grid detector on two test images. Each cell is
// tinted by its predicted objectness; the blue box is the box of the most
// confident cell, the orange one is the label. Right: the two loss terms and
// the share of test images boxed with IoU ≥ 0.5.

const BLUE = "#2a78d6";
const ORANGE = "#eb6834";
const GREEN = "#1baf7a";
const INK = "#3b4234";

export default function DfYoloTrain() {
  const [ref, run] = useLazyRun(detRun);
  const [k, setK] = useState(0);
  const snaps = run?.snaps ?? [];
  const s = snaps[Math.min(k, snaps.length - 1)];
  const C = 20;

  return (
    <VisualizationFrame
      title="训练过程：每个格子的「有物体」概率和预测框一起变准"
      description="检测器在 160 张图（每张一个亮矩形，大小、位置随机）上训练 600 步（Adam，每批 8 张）。左边是两张没见过的测试图：格子的绿色深浅 = 这一格认为自己负责物体的概率，蓝框 = 最自信那一格画的框，橙框 = 标注。"
      footnote="真实计算：每 20 步存一次参数；「IoU ≥ 0.5 的比例」在 60 张测试图上算，就是 AP@50 里判对错的那条线。框损失前面乘了 λ = 5（YOLOv1 的设置）。"
    >
      <div ref={ref}>
        {!run || !s ? (
          <Training />
        ) : (
          <>
            <StepPlayer step={k} total={snaps.length} onStep={setK} intervalMs={160} caption={`第 ${s.step} 步 / 共 600 步`} />
            <Figure width={700} height={250} label={`第 ${s.step} 步：测试集 IoU ≥ 0.5 的比例 ${(s.hit50 * 100).toFixed(0)}%`} minWidth={600}>
              {run.show.map((smp, si) => {
                const preds = detForward(s.params, smp.x);
                const best = preds.reduce((a, b) => (b.obj > a.obj ? b : a));
                const X = 14 + si * 196;
                const Y = 40;
                const iou = boxIou(best.box, smp.box);
                return (
                  <g key={si}>
                    <Cells vals={smp.x} cols={SIDE} x={X} y={Y} cell={C} color={(v) => gray(v)} title={`测试图 ${si + 1}`} />
                    {preds.map((p, ci) => (
                      <g key={ci}>
                        <rect x={X + (ci % GRID) * 2 * C} y={Y + Math.floor(ci / GRID) * 2 * C} width={2 * C} height={2 * C} fill={GREEN} fillOpacity={p.obj * 0.7} stroke="#d9b24a" strokeWidth={0.6} />
                        <text x={X + (ci % GRID) * 2 * C + 3} y={Y + Math.floor(ci / GRID) * 2 * C + 11} fontSize={8} fill={p.obj > 0.5 ? "#fff" : "#9a9c8d"} className="mono">{Math.round(p.obj * 100)}</text>
                      </g>
                    ))}
                    <rect x={X + smp.box.x * C} y={Y + smp.box.y * C} width={smp.box.w * C} height={smp.box.h * C} fill="none" stroke={ORANGE} strokeWidth={2} />
                    <rect x={X + best.box.x * C} y={Y + best.box.y * C} width={Math.max(1, best.box.w * C)} height={Math.max(1, best.box.h * C)} fill="none" stroke={BLUE} strokeWidth={2.4} style={{ transition: "all .15s" }} />
                    <text x={X} y={Y + 8 * C + 16} fontSize={10.5} fill={iou >= 0.5 ? "#087a08" : INK}>IoU {iou.toFixed(2)}{iou >= 0.5 ? "，算对" : ""}</text>
                  </g>
                );
              })}
              <CurvePanel
                box={{ x: 418, y: 8, w: 282, h: 236 }}
                xMax={600}
                yDomain={[0, 4.2]}
                yTicks={[0, 1, 2, 4]}
                cursor={s.step}
                title="损失（左轴）与命中率 × 4"
                series={[
                  { label: "objectness 损失", color: GREEN, points: snaps.map((p) => [p.step, p.lossObj]) },
                  { label: "框损失", color: ORANGE, points: snaps.map((p) => [p.step, p.lossBox]) },
                  { label: "IoU≥0.5 比例 ×4", color: BLUE, points: snaps.map((p) => [p.step, p.hit50 * 4]), dashed: true },
                ]}
              />
            </Figure>
            <div className={`viz-narr${s.step === 0 ? "" : s.hit50 > 0.9 ? " is-good" : " is-warn"}`}>
              {s.step === 0
                ? "第 0 步：16 个格子的「有物体」概率都在 10% 左右（偏置初始化成 −2），框是随机的，测试图几乎没有一张框对。按播放。"
                : s.hit50 < 0.6
                  ? `第 ${s.step} 步：先学会的是 objectness：大部分格子学会说「我这里没有」（绿色变淡），亮矩形附近的格子开始变绿。框还画不准，IoU ≥ 0.5 的只有 ${(s.hit50 * 100).toFixed(0)}%。`
                  : s.hit50 < 0.9
                    ? `第 ${s.step} 步：负责物体的那一格越来越确定，框也开始往标注框上套，命中率 ${(s.hit50 * 100).toFixed(0)}%。`
                    : `第 ${s.step} 步：测试图上 ${(s.hit50 * 100).toFixed(0)}% 的框 IoU ≥ 0.5，平均 IoU ${s.meanIou.toFixed(2)}。远离物体的格子都接近 0；物体附近那一格的 obj 是全图最高，但不一定很高：物体中心落在格子边界附近时，相邻几格都拿不准「中心归谁」，所以 objectness 损失停在 1 左右下不去。只要负责的那一格比别的格子高，取最高那一格的框就是对的。`}
            </div>
          </>
        )}
      </div>
    </VisualizationFrame>
  );
}
