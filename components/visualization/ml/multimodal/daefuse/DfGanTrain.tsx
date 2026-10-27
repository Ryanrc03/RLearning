"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Curve from "@/components/visualization/ml/primitives/Curve";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Plot from "@/components/visualization/ml/primitives/Plot";
import StepPlayer from "@/components/visualization/ml/primitives/StepPlayer";
import { ganRun } from "@/lib/ml/daefuseRuns";
import { dOf, GAN_REAL } from "@/lib/ml/daefuseTrain";
import { CurvePanel, Training, useLazyRun } from "./DfTrainKit";

// 2.4 training dynamics: a one-dimensional GAN. Left, the real distribution,
// what the generator currently produces, and the discriminator's D(x). Right,
// the generator's mean and spread against their targets. The run shows the
// usual GAN behaviour: the mean is found first, the spread collapses, the
// discriminator pushes it back out, and the two keep oscillating.

const GREEN = "#1baf7a";
const BLUE = "#2a78d6";
const INK = "#3b4234";
const ORANGE = "#eb6834";
const xs = Array.from({ length: 161 }, (_, i) => -3 + i * 0.05);
const pdf = (x: number, m: number, s: number) => Math.exp(-((x - m) ** 2) / (2 * s * s)) / (s * Math.sqrt(2 * Math.PI));

export default function DfGanTrain() {
  const [ref, snaps] = useLazyRun(ganRun);
  const [k, setK] = useState(0);
  const s = snaps?.[Math.min(k, snaps.length - 1)];
  const sd = s ? Math.max(Math.abs(s.a), 0.02) : 1;
  const collapsed = s ? Math.abs(s.a) < 0.15 : false;

  return (
    <VisualizationFrame
      title="训练过程：生成器的分布一步步被判别器推向真数据"
      description="真数据是 N(2, 0.5²)。生成器 G(z) = a·z + b 从 a = 0.4、b = −1 出发；判别器 D(x) = σ(w₂x² + w₁x + w₀)。每一步先训练 D 5 次，再训练 G 1 次（Adam），共 800 步。"
      footnote="真实计算：每 10 步存一次。生成分布是 N(b, a²)；a 太小时绿色真分布旁边那根蓝线会变得很尖，图里截到 1.2。"
    >
      <div ref={ref}>
        {!snaps || !s ? (
          <Training />
        ) : (
          <>
            <StepPlayer step={k} total={snaps.length} onStep={setK} intervalMs={120} caption={`第 ${s.step} 步 / 共 800 步`} />
            <Figure width={700} height={250} label={`第 ${s.step} 步：生成分布均值 ${s.b.toFixed(2)}、标准差 ${Math.abs(s.a).toFixed(2)}`} minWidth={600}>
              <Plot box={{ x: 0, y: 0, w: 400, h: 246 }} xDomain={[-3, 5]} yDomain={[0, 1.2]} xTicks={[-3, -1, 0, 2, 5]} yTicks={[0, 0.5, 1]} xLabel="x" title="真分布、生成分布与 D(x)">
                {(f) => (
                  <>
                    <Curve frame={f} points={xs.map((x) => [x, pdf(x, GAN_REAL.mean, GAN_REAL.sd)] as const)} color={GREEN} width={2.4} area />
                    <Curve frame={f} points={xs.map((x) => [x, Math.min(1.2, pdf(x, s.b, sd))] as const)} color={BLUE} width={2.4} area />
                    <Curve frame={f} points={xs.map((x) => [x, dOf(s.w, x)] as const)} color={INK} width={1.6} dashed />
                    <text x={f.x(2.6)} y={f.y(0.75)} fontSize={10.5} fill={GREEN} fontWeight={600}>真</text>
                    <text x={f.x(Math.max(-2.8, Math.min(4.2, s.b - 0.9)))} y={f.y(Math.min(1.1, pdf(s.b, s.b, sd) * 0.6 + 0.08))} fontSize={10.5} fill={BLUE} fontWeight={600}>生成</text>
                    <text x={f.x(-2.9)} y={f.y(dOf(s.w, -2.9)) - 6} fontSize={10} fill={INK}>D(x)</text>
                  </>
                )}
              </Plot>
              <CurvePanel
                box={{ x: 418, y: 8, w: 282, h: 236 }}
                xMax={800}
                yDomain={[-1.2, 2.4]}
                yTicks={[-1, 0, 0.5, 2]}
                cursor={s.step}
                title="生成分布的均值 b、标准差 a"
                series={[
                  { label: "均值 b（目标 2）", color: BLUE, points: snaps.map((p) => [p.step, p.b]) },
                  { label: "标准差 a（目标 0.5）", color: ORANGE, points: snaps.map((p) => [p.step, Math.abs(p.a)]) },
                ]}
              />
            </Figure>
            <div className="viz-legend">
              <span><i style={{ background: GREEN }} />真数据 N(2, 0.5²)</span>
              <span><i style={{ background: BLUE }} />生成器的分布</span>
              <span><i style={{ background: INK }} />D(x)：判别器认为是真的概率（虚线）</span>
            </div>
            <div className={`viz-narr${s.step === 0 ? "" : collapsed ? " is-warn" : s.step > 450 ? " is-good" : ""}`}>
              {s.step === 0
                ? "第 0 步：生成的数集中在 −1 附近，真数据在 2 附近。D(x) 在右边高、左边低：它已经能分清真假。G 要做的就是顺着 D(x) 往上爬。按播放。"
                : s.b < 1.7
                  ? `第 ${s.step} 步：蓝色分布顺着 D(x) 的坡往右挪，均值到了 ${s.b.toFixed(2)}。D 也在跟着调整，坡的位置一直在变：G 追的是一个会动的目标。`
                  : collapsed && s.w[2] <= 0
                    ? `第 ${s.step} 步：均值对上了（${s.b.toFixed(2)}），可标准差缩到了 ${Math.abs(s.a).toFixed(2)}，生成器几乎只吐同一个数。这是「模式塌缩」的一维版本：D(x) 在中间最高，G 只要把所有样本都放在那一点，损失就很小，它没有动力去覆盖整个分布。`
                    : collapsed
                      ? `第 ${s.step} 步：生成器还挤在一点上（标准差 ${Math.abs(s.a).toFixed(2)}），这是「模式塌缩」。但 D 已经反应过来：它把假样本扎堆的正中间判成假的、两边判成真的，虚线变成了 U 形。问题是 G 的样本全在 U 形的最低点，那里坡度几乎为 0，梯度很小，要过一会儿才会被推开。`
                    : s.step < 450
                      ? `第 ${s.step} 步：D 发现假样本全挤在中间，开始把中间判成假、两边判成真（D(x) 变成两边高的 U 形），G 被迫把分布摊开，标准差回升到 ${Math.abs(s.a).toFixed(2)}。`
                      : `第 ${s.step} 步：均值 ${s.b.toFixed(2)}、标准差 ${Math.abs(s.a).toFixed(2)}，D(x) 在真数据附近接近 0.5。之后它不会停在一个点上，而是围着目标来回震荡：GAN 的训练是两个网络的博弈，不是单纯的下坡。`}
            </div>
          </>
        )}
      </div>
    </VisualizationFrame>
  );
}
