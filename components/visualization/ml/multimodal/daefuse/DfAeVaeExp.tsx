"use client";

import { useMemo } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
import { aeRun, VAE_BETA } from "@/lib/ml/daefuseRuns";
import { aeDecode, aeEncode, edgeLikeness, priorDraws } from "@/lib/ml/daefuseTrain";
import { Training, useLazyRun } from "./DfTrainKit";
import { gray } from "./DfPixels";

// 2.5 experiment: the trained AE and VAE asked to do two jobs. Reconstruct
// rows they were trained on; and decode 8 codes drawn from N(0, I), i.e.
// generate new rows. "Edge likeness" scores how close a decoded row is to a
// clean step (1 = a perfect step anywhere).

const BLUE = "#2a78d6";
const ORANGE = "#eb6834";
const ROWS = [0, 3, 5, 7];

function Strip({ row, x, y, label, score }: { row: number[]; x: number; y: number; label?: string; score?: number }) {
  return (
    <g>
      {label && <text x={x - 6} y={y + 11} fontSize={9.5} textAnchor="end" fill="#30332c">{label}</text>}
      {row.map((v, i) => <rect key={i} x={x + i * 9} y={y} width={9.3} height={14} fill={gray(v)} />)}
      <rect x={x} y={y} width={108} height={14} fill="none" stroke="#9a9c8d" />
      {score !== undefined && <text x={x + 112} y={y + 11} fontSize={9} fill={score > 0.85 ? "#087a08" : "#b5462b"} className="mono">{score.toFixed(2)}</text>}
    </g>
  );
}

export default function DfAeVaeExp() {
  const [ref, run] = useLazyRun(aeRun);
  const res = useMemo(() => {
    if (!run) return null;
    const ae = run.ae.at(-1)!;
    const vae = run.vae.at(-1)!;
    const draws = priorDraws(8, 9);
    const rec = (p: typeof ae.params, x: number[]) => aeDecode(p, aeEncode(p, x).mu).out;
    const gen = (p: typeof ae.params) => draws.map((z) => aeDecode(p, z).out);
    const g = { ae: gen(ae.params), vae: gen(vae.params) };
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    return {
      ae,
      vae,
      draws,
      g,
      recLike: { ae: mean(run.data.map((d) => edgeLikeness(rec(ae.params, d.x)))), vae: mean(run.data.map((d) => edgeLikeness(rec(vae.params, d.x)))) },
      genLike: { ae: mean(g.ae.map(edgeLikeness)), vae: mean(g.vae.map(edgeLikeness)) },
      rec,
    };
  }, [run]);

  return (
    <VisualizationFrame
      title="实验：AE vs VAE，重建得更清楚的那个，能不能凭空生成"
      description="同样的数据、同样的初始权重、同样训练 1500 步，唯一区别是 VAE 多了采样和 KL 项。任务 1：重建训练数据。任务 2：从标准正态 N(0, I) 里抽 8 个 z，交给解码器生成新的行。右边的数字是「像不像一条干净台阶」（1 = 完全是）。"
      footnote={`真实计算：两个模型的最终参数（第 1500 步）。8 个 z 对两个模型完全相同。VAE 的 β = ${VAE_BETA}。`}
    >
      <div ref={ref}>
        {!run || !res ? (
          <Training />
        ) : (
          <>
            <Figure width={700} height={250} label={`重建误差 AE ${res.ae.recon.toFixed(3)}、VAE ${res.vae.recon.toFixed(3)}；生成像台阶的程度 AE ${res.genLike.ae.toFixed(2)}、VAE ${res.genLike.vae.toFixed(2)}`} minWidth={620}>
              <text x={10} y={16} fontSize={11.5} fontWeight={700} fill="#30332c">任务 1：重建</text>
              <text x={84} y={36} fontSize={10} fill="#76796f">输入</text>
              <text x={210} y={36} fontSize={10} fill={BLUE} fontWeight={600}>AE</text>
              <text x={346} y={36} fontSize={10} fill={ORANGE} fontWeight={600}>VAE</text>
              {ROWS.map((di, r) => {
                const d = run.data[di];
                const Y = 44 + r * 22;
                return (
                  <g key={di}>
                    <Strip row={d.x} x={84} y={Y} label={`第 ${d.pos + 1} 格`} />
                    <Strip row={res.rec(res.ae.params, d.x)} x={210} y={Y} score={edgeLikeness(res.rec(res.ae.params, d.x))} />
                    <Strip row={res.rec(res.vae.params, d.x)} x={346} y={Y} score={edgeLikeness(res.rec(res.vae.params, d.x))} />
                  </g>
                );
              })}
              <text x={10} y={150} fontSize={11.5} fontWeight={700} fill="#30332c">任务 2：从 N(0, I) 采 z 生成（8 个里的前 4 个）</text>
              {res.draws.slice(0, 4).map((z, i) => {
                const Y = 160 + i * 22;
                return (
                  <g key={i}>
                    <Strip row={res.g.ae[i]} x={210} y={Y} label={`z=(${z[0].toFixed(1)}, ${z[1].toFixed(1)})`} score={edgeLikeness(res.g.ae[i])} />
                    <Strip row={res.g.vae[i]} x={346} y={Y} score={edgeLikeness(res.g.vae[i])} />
                  </g>
                );
              })}
              <rect x={490} y={30} width={204} height={200} rx={6} fill="#fff" stroke="#e4dfcb" />
              <text x={502} y={50} fontSize={11} fontWeight={700} fill="#30332c">8 个 z 的平均 / 全部 24 行的平均</text>
              {[
                ["重建误差（越小越好）", res.ae.recon.toFixed(3), res.vae.recon.toFixed(3)],
                ["重建像台阶（越大越好）", res.recLike.ae.toFixed(2), res.recLike.vae.toFixed(2)],
                ["生成像台阶（越大越好）", res.genLike.ae.toFixed(2), res.genLike.vae.toFixed(2)],
              ].map(([k, a, v], i) => (
                <g key={k}>
                  <text x={502} y={80 + i * 46} fontSize={10} fill="#30332c">{k}</text>
                  <text x={502} y={98 + i * 46} fontSize={12} fill={BLUE} fontWeight={700} className="mono">AE {a}</text>
                  <text x={600} y={98 + i * 46} fontSize={12} fill={ORANGE} fontWeight={700} className="mono">VAE {v}</text>
                </g>
              ))}
            </Figure>
            <div className="viz-narr is-good">
              重建：AE 的误差 {res.ae.recon.toFixed(3)}，VAE {res.vae.recon.toFixed(3)}，VAE 大了约 {Math.round(res.vae.recon / res.ae.recon)} 倍（这是训练时带采样噪声的误差）；用 μ 直接解码，像台阶的程度 AE {res.recLike.ae.toFixed(2)}、VAE {res.recLike.vae.toFixed(2)}，VAE 的台阶边缘略软。生成：从 N(0, I) 采的 z，AE 解码出来像台阶的程度平均只有 {res.genLike.ae.toFixed(2)}（很多是灰的、有两级的、不像任何训练样本），VAE 是 {res.genLike.vae.toFixed(2)}。原因就是上一张图里的潜空间：AE 的编码散在 ±9 的范围，原点附近是没人去过的空地；VAE 的编码被 KL 拉到了原点附近，从 N(0, I) 采到的点多半落在解码器见过的地方。这就是两者的取舍：要生成选 VAE，要清楚的重建选 AE。DAE-Fuse 要的是后者。
            </div>
          </>
        )}
      </div>
    </VisualizationFrame>
  );
}
