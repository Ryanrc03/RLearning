"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Curve from "@/components/visualization/ml/primitives/Curve";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Plot from "@/components/visualization/ml/primitives/Plot";
import Slider from "@/components/visualization/ml/primitives/Slider";
import { gray } from "./DfPixels";
import { klGauss, mixRatio, vaeExpectedRecon } from "@/lib/ml/daefuse";

// Section 2.5: why a VAE trained with a pixel (Gaussian / MSE) likelihood blurs.
// Two training rows differ only in where the edge sits; the encoder maps them
// to μ = −1 and μ = +1 with spread σ. The best MSE decoder for a code z is the
// posterior-weighted average of the rows that could have produced z, so once
// the two Gaussians overlap, the decoded edge smears. σ → 0 is a plain AE.

const A = "#2a78d6";
const B = "#eb6834";
const ROW_A = Array.from({ length: 24 }, (_, i) => (i < 10 ? 0.1 : 0.9));
const ROW_B = Array.from({ length: 24 }, (_, i) => (i < 14 ? 0.1 : 0.9));
const MUS = [-1, 1];
const gauss = (z: number, m: number, s: number) => Math.exp(-((z - m) ** 2) / (2 * s * s)) / (s * Math.sqrt(2 * Math.PI));

function Strip({ row, x, y, label }: { row: number[]; x: number; y: number; label: string }) {
  return (
    <g>
      <text x={x} y={y - 5} fontSize={10.5} fill="#30332c" fontWeight={600}>{label}</text>
      {row.map((v, i) => <rect key={i} x={x + i * 12} y={y} width={12.4} height={22} fill={gray(v)} />)}
      <rect x={x} y={y} width={24 * 12} height={22} fill="none" stroke="#9a9c8d" />
    </g>
  );
}

export default function DfVaeBlur() {
  const [sigma, setSigma] = useState(0.6);
  const rec = useMemo(() => vaeExpectedRecon([ROW_A, ROW_B], MUS, sigma), [sigma]);
  const mix = mixRatio(rec, ROW_A, ROW_B); // 0 = sample 1 exactly, 0.5 = average of both
  const kl = klGauss(MUS[0], sigma);
  const zs = Array.from({ length: 121 }, (_, i) => -3 + i * 0.05);
  const peak = gauss(0, 0, Math.max(sigma, 0.05));

  return (
    <VisualizationFrame
      title="VAE 为什么容易糊：两张图的编码一重叠，解码出来就是平均"
      description="两条训练样本只差在边缘的位置（第 10 格 vs 第 14 格）。编码器把它们放在 μ = −1 和 μ = +1，每个编码带一个宽度 σ。用 MSE 训练的解码器，对一个 z 的最优输出是「可能产生这个 z 的样本」的加权平均。"
      footnote="示意计算：一维 latent，解码器取 MSE 下的最优解（后验加权平均），重建结果对 z ~ N(μ₁, σ²) 取期望。KL 是 KL(N(μ, σ²) ‖ N(0, 1)) 的闭式解；σ → 0 就是普通 AE（不再是 VAE，KL 也趋于无穷）。"
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${sigma <= 0.05 ? " is-on" : ""}`} onClick={() => setSigma(0.05)}>普通 AE（σ → 0）</button>
        <button type="button" className={`viz-btn${Math.abs(sigma - 1) < 0.01 ? " is-on" : ""}`} onClick={() => setSigma(1)}>先验那么宽（σ = 1）</button>
      </div>
      <Slider label="编码宽度 σ" value={sigma} min={0.05} max={1.5} step={0.05} onChange={setSigma} display={sigma.toFixed(2)} />
      <Figure width={660} height={250} label={`σ = ${sigma.toFixed(2)}：混入样本 2 的比例 ${(mix * 100).toFixed(0)}%，KL ${kl.toFixed(2)}`} minWidth={560}>
        <Plot box={{ x: 0, y: 0, w: 320, h: 240 }} xDomain={[-3, 3]} yDomain={[0, Math.min(2.2, peak * 1.15)]} xTicks={[-3, -1, 0, 1, 3]} yTicks={[0]} xLabel="latent z" title="两个编码 q(z|x)">
          {(f) => (
            <>
              <Curve frame={f} points={zs.map((z) => [z, Math.min(peak * 1.15, gauss(z, MUS[0], sigma))] as const)} color={A} width={2.2} area />
              <Curve frame={f} points={zs.map((z) => [z, Math.min(peak * 1.15, gauss(z, MUS[1], sigma))] as const)} color={B} width={2.2} area />
              <text x={f.x(-1)} y={f.y(0) + 13} fontSize={10} textAnchor="middle" fill={A}>μ₁</text>
              <text x={f.x(1)} y={f.y(0) + 13} fontSize={10} textAnchor="middle" fill={B}>μ₂</text>
            </>
          )}
        </Plot>
        <Strip row={ROW_A} x={350} y={40} label="样本 1：边缘在第 10 格" />
        <Strip row={ROW_B} x={350} y={96} label="样本 2：边缘在第 14 格" />
        <Strip row={rec} x={350} y={170} label="从样本 1 的编码采样后解码（期望）" />
        <text x={350} y={214} fontSize={10.5} fill="#30332c">混入样本 2 <tspan fontWeight={700}>{(mix * 100).toFixed(0)}%</tspan>（50% = 两张平均）　KL = {kl.toFixed(2)}</text>
      </Figure>
      <div className={`viz-narr${sigma <= 0.15 ? " is-good" : sigma >= 0.8 ? " is-warn" : ""}`}>
        {sigma <= 0.15
          ? `σ = ${sigma.toFixed(2)}：两个编码完全分开，解码出来就是样本 1 本身，混入样本 2 的比例 ${(mix * 100).toFixed(0)}%。这就是普通 AE：重建清楚，但 latent 空间里两个编码之间是空的，KL = ${kl.toFixed(2)} 很大，没法从先验里采样生成新图。`
          : sigma >= 0.8
            ? `σ = ${sigma.toFixed(2)}：KL 项把编码往 N(0, 1) 拉（σ = 1 时 KL 最小之一），两个高斯大面积重叠。解码器看到一个 z，分不清来自哪张图，MSE 下最安全的答案是两张图的平均：第 10 到 14 格被抹成灰色的中间台阶，重建已经有 ${(mix * 100).toFixed(0)}% 往样本 2 漂（50% 就是两张图的平均）。图像融合要的恰恰是边缘和纹理，所以 DAE-Fuse 用的是确定性的 AE，再用判别器补「像真图」的那部分约束。`
            : mix < 0.02
              ? `σ = ${sigma.toFixed(2)}：两个高斯只在尾巴上碰到一点，解码几乎还是样本 1（混入 ${(mix * 100).toFixed(1)}%），但 KL = ${kl.toFixed(2)} 仍然不小。继续往右拖，看 KL 降下来的同时重建怎么变。`
              : `σ = ${sigma.toFixed(2)}：两个编码开始重叠，第 10 到 14 格开始发灰，混入样本 2 的比例 ${(mix * 100).toFixed(0)}%，KL = ${kl.toFixed(2)}。VAE 的损失在这两者之间折中：KL 越小越方便采样，重建就越糊。`}
      </div>
    </VisualizationFrame>
  );
}
