"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Plot from "@/components/visualization/ml/primitives/Plot";
import StepPlayer from "@/components/visualization/ml/primitives/StepPlayer";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import { aeRun, VAE_BETA } from "@/lib/ml/daefuseRuns";
import { aeDecode, aeEncode, EDGE_POS } from "@/lib/ml/daefuseTrain";
import { CurvePanel, Training, useLazyRun } from "./DfTrainKit";
import { gray } from "./DfPixels";

// 2.5 training dynamics: where the 24 training rows land in the 2-D latent
// space while the AE (or VAE) trains, and what the decoder gives back. The
// colour of a dot is the position of the step edge in that row.

const PAL = ["#08306b", "#1f5a9e", "#2a78d6", "#5b9be0", "#e6a35a", "#eb6834", "#c4452a", "#8a2b14"];
const ORANGE = "#eb6834";
const GREEN = "#1baf7a";
const SHOW = [1, 4, 6]; // rows with the edge at 3, 6 and 8

export default function DfAeTrain() {
  const [ref, run] = useLazyRun(aeRun);
  const [kind, setKind] = useState<"ae" | "vae">("ae");
  const [k, setK] = useState(0);
  const snaps = run ? run[kind] : [];
  const s = snaps[Math.min(k, snaps.length - 1)];
  const lim = useMemo(() => {
    if (!run) return 3;
    let m = 2.5;
    for (const sn of run[kind]) for (const d of run.data) for (const v of aeEncode(sn.params, d.x).mu) m = Math.max(m, Math.abs(v));
    return Math.ceil(m);
  }, [run, kind]);
  const vae = kind === "vae";

  return (
    <VisualizationFrame
      title="训练过程：每个样本在 2 维潜空间里落在哪，解码出来什么样"
      description="24 行训练数据（台阶在第 3–10 格，各 3 份带噪声的拷贝），12 → 10 → 2 → 10 → 12 的网络，Adam 训练 1500 步。点的颜色 = 台阶的位置（深蓝 = 靠左，深红 = 靠右）。"
      footnote={`真实计算：每 50 步存一次参数。VAE 的 KL 权重 β = ${VAE_BETA}（重建误差是 12 个像素的平方和，量级小，β = 1 时编码会整个塌到原点）。VAE 的点画的是 μ，周围的圈是 1 个 σ。`}
    >
      <div ref={ref}>
        {!run || !s ? (
          <Training />
        ) : (
          <>
            <div className="viz-row">
              <Tabs options={[{ key: "ae", label: "AE" }, { key: "vae", label: "VAE" }]} value={kind} onChange={(v) => setKind(v)} ariaLabel="模型" />
            </div>
            <StepPlayer step={k} total={snaps.length} onStep={setK} intervalMs={150} caption={`第 ${s.step} 步 / 共 1500 步`} />
            <Figure width={700} height={260} label={`${kind.toUpperCase()} 第 ${s.step} 步：重建误差 ${s.recon.toFixed(3)}`} minWidth={600}>
              <Plot box={{ x: 0, y: 0, w: 250, h: 256 }} xDomain={[-lim, lim]} yDomain={[-lim, lim]} xTicks={[-lim, 0, lim]} yTicks={[-lim, 0, lim]} title="潜空间（z₁, z₂）">
                {(f) => (
                  <>
                    {vae && <ellipse cx={f.x(0)} cy={f.y(0)} rx={f.x(1) - f.x(0)} ry={f.y(0) - f.y(1)} fill="#d9f1e6" stroke={GREEN} strokeDasharray="4 3" />}
                    {run.data.map((d, i) => {
                      const e = aeEncode(s.params, d.x);
                      const c = PAL[EDGE_POS.indexOf(d.pos)];
                      const sx = Math.exp(0.5 * e.lv[0]);
                      const sy = Math.exp(0.5 * e.lv[1]);
                      return (
                        <g key={i}>
                          {vae && <ellipse cx={f.x(e.mu[0])} cy={f.y(e.mu[1])} rx={Math.max(1, f.x(sx) - f.x(0))} ry={Math.max(1, f.y(0) - f.y(sy))} fill={c} fillOpacity={0.08} stroke={c} strokeOpacity={0.5} />}
                          <circle cx={f.x(e.mu[0])} cy={f.y(e.mu[1])} r={4} fill={c} />
                        </g>
                      );
                    })}
                  </>
                )}
              </Plot>
              {SHOW.map((di, r) => {
                const d = run.data[di];
                const e = aeEncode(s.params, d.x);
                const out = aeDecode(s.params, e.mu).out;
                const Y = 30 + r * 72;
                return (
                  <g key={di}>
                    <text x={262} y={Y - 5} fontSize={10} fill="#30332c">台阶在第 {d.pos + 1} 格：输入 / 重建</text>
                    {d.x.map((v, i) => <rect key={i} x={262 + i * 12} y={Y} width={12.3} height={16} fill={gray(v)} />)}
                    {out.map((v, i) => <rect key={i} x={262 + i * 12} y={Y + 20} width={12.3} height={16} fill={gray(v)} />)}
                    <rect x={262} y={Y} width={144} height={36} fill="none" stroke="#9a9c8d" />
                  </g>
                );
              })}
              <CurvePanel
                box={{ x: 418, y: 8, w: 282, h: 246 }}
                xMax={1500}
                yDomain={[0, vae ? 2.5 : 2]}
                yTicks={vae ? [0, 1, 2] : [0, 1, 2]}
                cursor={s.step}
                title="损失"
                series={[
                  { label: "重建误差", color: ORANGE, points: snaps.map((p) => [p.step, p.recon]) },
                  ...(vae ? [{ label: "KL", color: GREEN, points: snaps.map((p) => [p.step, p.kl] as [number, number]) }] : []),
                ]}
              />
            </Figure>
            <div className={`viz-narr${s.step === 0 ? "" : " is-good"}`}>
              {s.step === 0
                ? "第 0 步：随机权重下，所有样本挤在一起，解码出来是一片灰。按播放。"
                : !vae
                  ? s.step < 300
                    ? `第 ${s.step} 步：点开始按颜色排开，重建误差 ${s.recon.toFixed(3)}，解码结果开始出现台阶。`
                    : `第 ${s.step} 步：24 个点按台阶位置排成一条弯曲的线，从深蓝到深红依次排开，网络自己发现了「台阶在哪」是唯一要记的东西。重建误差 ${s.recon.toFixed(3)}，台阶很清楚。但注意坐标轴：点散布到了 ±${lim} 的范围，原点附近反而是空的。`
                  : s.step < 300
                    ? `第 ${s.step} 步：KL 项把所有点往原点拉，重建误差和 KL 在互相拉扯。`
                    : `第 ${s.step} 步：点也按颜色排成一条线，但只用了横轴这一维，范围在 ±2 以内（AE 是 ±${lim}），都在先验 N(0, I) 常出现的地方。纵向的圈几乎有先验那么高（σ ≈ 1）：第二维被 KL 关掉了，编码器干脆不用它。横向相邻的圈互相重叠，这就是解码时被「平均」的来源。重建误差 ${s.recon.toFixed(3)}（训练时带着采样噪声算），比 AE 大得多；KL = ${s.kl.toFixed(2)}。`}
            </div>
          </>
        )}
      </div>
    </VisualizationFrame>
  );
}
