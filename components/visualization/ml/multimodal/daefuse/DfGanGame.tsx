"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Curve from "@/components/visualization/ml/primitives/Curve";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Plot from "@/components/visualization/ml/primitives/Plot";
import Slider from "@/components/visualization/ml/primitives/Slider";
import { ganLosses } from "@/lib/ml/daefuse";

// Section 2.4: the two-player loss. Drag what the discriminator currently says
// about a real image and about a generated one; read off both losses and how
// hard each generator form pushes. Left plot: generator loss against D(fake).

const C_D = "#9a9c8d"; // discriminator: training-only
const C_MM = "#2a78d6";
const C_NS = "#eb6834";

const xs = Array.from({ length: 99 }, (_, i) => (i + 1) / 100);

export default function DfGanGame() {
  const [dReal, setDReal] = useState(0.9);
  const [dFake, setDFake] = useState(0.1);
  const g = ganLosses(dReal, dFake);
  const early = dFake < 0.3;

  return (
    <VisualizationFrame
      title="GAN 的两个玩家：判别器的损失与生成器的损失"
      description="D(x) 是判别器认为 x 是真图的概率。拖动它对真图和对生成图的打分，看两边的损失。左边画的是生成器损失随 D(生成图) 的变化：蓝线是论文式 (9) 的 minimax 写法 log(1 − D)，橙线是实践中常用的 non-saturating 写法 −log D。"
      footnote="论文写的是 minimax 形式（式 3、6、9）；实现里用哪一种论文没有说明。两者最优点相同，区别在训练早期的梯度大小。"
    >
      <div className="viz-grid2">
        <Slider label="D(真图)" value={dReal} min={0.01} max={0.99} step={0.01} onChange={setDReal} display={dReal.toFixed(2)} />
        <Slider label="D(生成图)" value={dFake} min={0.01} max={0.99} step={0.01} onChange={setDFake} display={dFake.toFixed(2)} />
      </div>
      <div className="viz-grid2 wide-left">
        <Figure width={380} height={240} minWidth={260} label={`D(生成图) = ${dFake.toFixed(2)}：minimax 梯度 ${g.gradMinimax.toFixed(2)}，non-saturating 梯度 ${g.gradNonSat.toFixed(2)}`}>
          <Plot box={{ x: 0, y: 0, w: 380, h: 240 }} xDomain={[0, 1]} yDomain={[-3, 4]} xTicks={[0, 0.25, 0.5, 0.75, 1]} yTicks={[-3, -1, 0, 1, 2, 4]} xLabel="D(生成图)" title="生成器损失">
            {(f) => (
              <>
                <Curve frame={f} points={xs.map((x) => [x, Math.max(-3, Math.log(1 - x))] as const)} color={C_MM} width={2.4} />
                <Curve frame={f} points={xs.map((x) => [x, Math.min(4, -Math.log(x))] as const)} color={C_NS} width={2.4} />
                <line x1={f.x(dFake)} y1={f.y(-3)} x2={f.x(dFake)} y2={f.y(4)} stroke="#3b4234" strokeWidth={1} strokeDasharray="3 3" />
                <circle cx={f.x(dFake)} cy={f.y(Math.max(-3, g.genMinimax))} r={4.5} fill={C_MM} />
                <circle cx={f.x(dFake)} cy={f.y(Math.min(4, g.genNonSat))} r={4.5} fill={C_NS} />
                <text x={f.x(0.62)} y={f.y(-1.6)} fontSize={10.5} fill={C_MM} fontWeight={600}>log(1 − D)</text>
                <text x={f.x(0.08)} y={f.y(3.3)} fontSize={10.5} fill={C_NS} fontWeight={600}>−log D</text>
              </>
            )}
          </Plot>
        </Figure>
        <div className="viz-panel">
          <h5>这一步的数</h5>
          <table className="viz-table">
            <tbody>
              <tr><td style={{ color: C_D }}>判别器损失（式 12）<br /><span className="viz-k">−log D(真) − log(1 − D(生成))</span></td><td className="num">{g.disc.toFixed(3)}</td></tr>
              <tr><td style={{ color: C_MM }}>生成器 minimax<br /><span className="viz-k">log(1 − D(生成))，要最小化</span></td><td className="num">{g.genMinimax.toFixed(3)}</td></tr>
              <tr><td style={{ color: C_MM }}>它对 D(生成) 的梯度</td><td className="num">{g.gradMinimax.toFixed(2)}</td></tr>
              <tr><td style={{ color: C_NS }}>生成器 non-saturating<br /><span className="viz-k">−log D(生成)</span></td><td className="num">{g.genNonSat.toFixed(3)}</td></tr>
              <tr><td style={{ color: C_NS }}>它对 D(生成) 的梯度</td><td className="num">{g.gradNonSat.toFixed(2)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className={`viz-narr${early ? " is-warn" : Math.abs(dFake - 0.5) < 0.06 && Math.abs(dReal - 0.5) < 0.06 ? " is-good" : ""}`}>
        {early
          ? `判别器一眼就认出生成图（D = ${dFake.toFixed(2)}）。这时 minimax 写法的梯度只有 ${g.gradMinimax.toFixed(2)}，曲线在左边几乎是平的，生成器学不动；non-saturating 写法的梯度是 ${g.gradNonSat.toFixed(1)}，推力大得多。这就是训练早期为什么常把 log(1 − D) 换成 −log D。`
          : Math.abs(dFake - 0.5) < 0.06 && Math.abs(dReal - 0.5) < 0.06
            ? `两边都是 0.5：判别器完全分不出真假，判别器损失 = 2 ln 2 ≈ ${g.disc.toFixed(3)}，这是理论上的均衡点。注意均衡只说明「分布像」，并不保证每一处细节都对：这正是 GAN 融合方法容易糊的原因。`
            : `判别器损失 ${g.disc.toFixed(3)}。判别器想让 D(真) → 1、D(生成) → 0；生成器只关心第二项，想让 D(生成) → 1。两者轮流更新，就是式 (3) 里的 min_AE max_D。`}
      </div>
    </VisualizationFrame>
  );
}
