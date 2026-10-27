"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
import StepPlayer from "@/components/visualization/ml/primitives/StepPlayer";
import { barsRun } from "@/lib/ml/daefuseRuns";
import { cnnForward } from "@/lib/ml/daefuseTrain";
import { Cells, CurvePanel, diverge, seq, Training, useLazyRun } from "./DfTrainKit";
import { gray } from "./DfPixels";

// 2.1 training dynamics: the 26-parameter CNN trained on 16 bar images with
// Adam. Step through the snapshots: the kernels start as noise, and the
// feature maps of two
// test images separate the two classes. In this run kernel 1 does all the
// work (a horizontal stripe pattern) and kernel 2 stays near zero.

const BLUE = "#2a78d6";
const ORANGE = "#eb6834";
const GREEN = "#1baf7a";

export default function DfCnnTrain() {
  const [ref, run] = useLazyRun(barsRun);
  const [k, setK] = useState(0);
  const snaps = run?.cnn ?? [];
  const s = snaps[Math.min(k, snaps.length - 1)];
  const samples = run ? [run.test[17], run.test[57]] : [];

  return (
    <VisualizationFrame
      title="训练过程：卷积核从一堆随机数长成「横条纹探测器」"
      description="同一个 26 参数的 CNN，用 16 张图（8 横 8 竖，位置随机）训练 300 步（Adam，学习率 0.05）。按播放，看卷积核、两张测试图的特征图和 loss 一起变化。"
      footnote="真实计算：每 10 步存一次参数。测试集是 80 张图，覆盖横线和竖线的所有位置，训练时一张都没见过。"
    >
      <div ref={ref}>
        {!run || !s ? (
          <Training />
        ) : (
          <>
            <StepPlayer step={k} total={snaps.length} onStep={setK} intervalMs={160} caption={`第 ${s.step} 步 / 共 300 步`} />
            <Figure width={700} height={250} label={`第 ${s.step} 步：loss ${s.loss.toFixed(3)}，测试准确率 ${(s.testAcc * 100).toFixed(0)}%`} minWidth={600}>
              <Cells vals={s.params.W.slice(0, 9)} cols={3} x={14} y={40} cell={22} color={(v) => diverge(v, 1.5)} title="卷积核 1" />
              <Cells vals={s.params.W.slice(9, 18)} cols={3} x={14} y={150} cell={22} color={(v) => diverge(v, 1.5)} title="卷积核 2" />
              {samples.map((smp, si) => {
                const f = cnnForward(s.params, smp.x);
                const m = Math.max(f.o[0], f.o[1]);
                const pH = Math.exp(f.o[0] - m) / (Math.exp(f.o[0] - m) + Math.exp(f.o[1] - m));
                const X = 108 + si * 158;
                return (
                  <g key={si}>
                    <Cells vals={smp.x} cols={8} x={X} y={40} cell={7} color={(v) => gray(v)} title={smp.y === 0 ? "测试图：横" : "测试图：竖"} />
                    <Cells vals={f.maps[0]} cols={6} x={X + 64} y={40} cell={8} color={(v) => seq(v, 1.2)} title="图 1" />
                    <Cells vals={f.maps[1]} cols={6} x={X + 64} y={150} cell={8} color={(v) => seq(v, 1.2)} title="图 2" />
                    <text x={X} y={124} fontSize={10} fill="#30332c">预测「横」</text>
                    <rect x={X} y={130} width={56} height={10} rx={2} fill="#efede4" />
                    <rect x={X} y={130} width={56 * pH} height={10} rx={2} fill={ORANGE} />
                    <text x={X} y={154} fontSize={10} fill="#30332c" className="mono">{(pH * 100).toFixed(0)}%</text>
                  </g>
                );
              })}
              <CurvePanel
                box={{ x: 418, y: 8, w: 282, h: 236 }}
                xMax={300}
                yDomain={[0, 1]}
                yTicks={[0, 0.5, 1]}
                cursor={s.step}
                title="loss 与准确率"
                series={[
                  { label: "训练 loss", color: ORANGE, points: snaps.map((p) => [p.step, p.loss]) },
                  { label: "训练准确率", color: GREEN, points: snaps.map((p) => [p.step, p.trainAcc]) },
                  { label: "测试准确率", color: BLUE, points: snaps.map((p) => [p.step, p.testAcc]), dashed: true },
                ]}
              />
            </Figure>
            <div className="viz-legend">
              <span><i style={{ background: diverge(1.5, 1.5) }} />正权重</span>
              <span><i style={{ background: diverge(-1.5, 1.5) }} />负权重</span>
              <span><i style={{ background: seq(1, 1) }} />特征图响应</span>
            </div>
            <div className={`viz-narr${s.step === 0 ? "" : s.testAcc > 0.95 ? " is-good" : " is-warn"}`}>
              {s.step === 0
                ? `第 0 步：卷积核是随机数，两张特征图对横线、竖线的反应差不多，模型在瞎猜（loss ${s.loss.toFixed(2)} ≈ ln 2 = 0.69）。按播放。`
                : s.testAcc < 0.95
                  ? `第 ${s.step} 步：loss 降到 ${s.loss.toFixed(2)}。卷积核 1 开始出现「一行一个颜色」的横条纹：上下两行变橙（正），中间一行变蓝（负）。`
                  : `第 ${s.step} 步：loss ${s.loss.toFixed(3)}，训练和测试准确率都是 ${(s.testAcc * 100).toFixed(0)}%。卷积核 1 是很强的横条纹（上下行 ≈ +6、中间行 ≈ −7），它对横线的上下边缘响应强、对竖线响应弱，两类在特征图 1 上就分开了；卷积核 2 几乎没动，接近 0：一个核就够用，梯度下降没给第二个核分活。没有人告诉它「要找横向条纹」，这是它自己找到的最省事的办法。`}
            </div>
          </>
        )}
      </div>
    </VisualizationFrame>
  );
}
