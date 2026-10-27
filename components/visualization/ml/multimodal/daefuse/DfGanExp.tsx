"use client";

import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
import { ganLossRun } from "@/lib/ml/daefuseRuns";
import { CurvePanel, Training, useLazyRun } from "./DfTrainKit";

// 2.4 experiment: the paper writes the generator loss as log(1 − D(G(z)))
// (minimax); most code uses −log D(G(z)) (non-saturating). Same start, same
// confident discriminator, plain SGD on the generator so the raw gradient size
// shows. Left: how fast the generator's mean reaches the data; right: what
// the discriminator thinks of the fakes.

const BLUE = "#2a78d6";
const ORANGE = "#eb6834";

export default function DfGanExp() {
  const [ref, run] = useLazyRun(ganLossRun);
  const reach = (snaps: { step: number; b: number }[]) => snaps.find((s) => s.b > 1.8)?.step ?? null;

  return (
    <VisualizationFrame
      title="实验：生成器损失写成 log(1 − D) 还是 −log D"
      description="两组完全相同的设置：生成器从均值 −1 出发，判别器先单独训练 300 步（一开始就很确定这些是假的，D(假) ≈ 0.01），然后每一步训 D 5 次、G 1 次，G 用普通 SGD（学习率 0.05）。唯一的区别是 G 的损失。"
      footnote="真实计算：每 5 步存一次。为什么 G 要用普通 SGD：Adam 会按梯度的历史大小重新缩放步长，把两种损失的梯度大小差异抹掉，实验就看不出区别了。"
    >
      <div ref={ref}>
        {!run ? (
          <Training />
        ) : (
          <>
            <Figure width={700} height={250} label={`均值到 1.8：minimax 第 ${reach(run.minimax)} 步，non-saturating 第 ${reach(run.nonsat)} 步`} minWidth={600}>
              <CurvePanel
                box={{ x: 0, y: 8, w: 350, h: 236 }}
                xMax={400}
                yDomain={[-1.2, 2.4]}
                yTicks={[-1, 0, 1, 2]}
                title="生成分布的均值 b（目标 2）"
                legend="bottom"
                series={[
                  { label: "minimax：log(1 − D)", color: BLUE, points: run.minimax.map((p) => [p.step, p.b]) },
                  { label: "non-saturating：−log D", color: ORANGE, points: run.nonsat.map((p) => [p.step, p.b]) },
                ]}
              />
              <CurvePanel
                box={{ x: 360, y: 8, w: 340, h: 236 }}
                xMax={400}
                yDomain={[0, 0.7]}
                yTicks={[0, 0.25, 0.5]}
                title="D(假样本) 的平均值"
                series={[
                  { label: "minimax", color: BLUE, points: run.minimax.map((p) => [p.step, p.dFake]) },
                  { label: "non-saturating", color: ORANGE, points: run.nonsat.map((p) => [p.step, p.dFake]) },
                ]}
              />
            </Figure>
            <div className="viz-narr is-good">
              non-saturating 版本第 {reach(run.nonsat)} 步均值就到了 1.8，minimax 版本要到第 {reach(run.minimax)} 步，前 100 步几乎原地不动。原因在梯度：D(假) ≈ 0.01 时，log(1 − D) 对 D 的导数是 −1/(1 − 0.01) ≈ −1，−log D 的导数是 −1/0.01 = −100，后者大了约 100 倍。判别器越确定，minimax 写法越推不动生成器。两种写法的最优点相同（都希望 D(假) → 1），区别只在起步阶段，所以实践中几乎都用 −log D。DAE-Fuse 论文的式 (3)(6)(9) 写的是 minimax 形式，实现里用哪种没有说明。
            </div>
          </>
        )}
      </div>
    </VisualizationFrame>
  );
}
