"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import StepPlayer from "@/components/visualization/ml/primitives/StepPlayer";
import { DIN_DIMS, dinShapes, materialisedBytes, MB, pointerBytes } from "@/lib/ml/din";

// DIN note, "A KuaiRand example": one training batch through SeqDCN with the
// shapes of the real configuration (batch 4096, N = 50, d = 16). Every width is
// computed from DIN_DIMS / dinShapes, which tests check against the code.

const { batch: B, n: N, d, baseFields, dense, tower, cross } = DIN_DIMS;
const s = dinShapes();
const fmt = (v: number) => v.toLocaleString("en-US");
const attnFloats = B * N * s.attnIn;

const STEPS: { what: string; shape: string; where: string; note: string }[] = [
  { what: "样本指针 (lo, hi)", shape: `[${B}, 2] int32`, where: "CPU → GPU", note: `一个 batch 只搬 ${fmt(B * 2 * 4)} 字节的指针。全 train 的指针文件 ${fmt(5055984)} × 16 B ≈ ${(pointerBytes(5055984) / MB).toFixed(0)} MB（四个 int32：全部曝光流和点击流各一对）。` },
  { what: "下标与 mask", shape: `[${B}, ${N}] int64 + bool`, where: "GPU", note: `idx = hi − ${N} + arange(${N})，mask = idx ≥ lo，越界的位置下标置 0。最近的一条在最右边。` },
  { what: "gather 事件数组", shape: `[${B}, ${N}, 3] + [${B}, ${N}]`, where: "GPU buffer", note: `从常驻 GPU 的事件数组里按下标取 vid / aid / tag 的词表下标和反馈码 fb（0 留给 padding，1–8 = 1 + click + 2·long_view + 4·like）。` },
  { what: "历史元素 e_i", shape: `[${B}, ${N}, ${s.elem}]`, where: "embedding", note: `三张 item 表各 ${d} 维拼成 ${s.item} 维，再拼 ${d} 维反馈 embedding。item 表和候选视频共用，所以历史里的 vid 和候选的 vid 落在同一行。` },
  { what: "候选 q", shape: `[${B}, ${s.item}] → [${B}, ${N}, ${s.item}]`, where: "embedding", note: "候选视频的 vid / aid / tag 查同一张表，再沿 N 维复制一份，好和每条历史逐个比较。" },
  { what: "activation unit", shape: `[${B}, ${N}, ${s.attnIn}] → [${B}, ${N}]`, where: "MLP 64 · 32 · 1", note: `输入是 [q, k_i, q − k_i, q ⊙ k_i, e_fb]，4 × ${s.item} + ${d} = ${s.attnIn} 维。这一步最占显存：${fmt(attnFloats)} 个 float，约 ${((attnFloats * 4) / MB).toFixed(0)} MB；N = 200 时乘 4。` },
  { what: "加权求和", shape: `[${B}, ${s.elem}]`, where: "Σ mask·w·e", note: "权重不经过 softmax，padding 位置乘 mask 归零。空历史得到 0 向量。" },
  { what: "x₀", shape: `[${B}, ${s.x0}]`, where: "concat", note: `F1 的 ${baseFields} 个类别域 × ${d} = ${baseFields * d}，稠密 ${dense} 维（含缺失标记），候选 q ${s.item}，用户兴趣 ${s.elem}：${baseFields * d} + ${dense} + ${s.item} + ${s.elem} = ${s.x0}。` },
  { what: "DCN-v2 + MLP + BCE", shape: `[${B}, ${s.x0}] → [${B}]`, where: `cross × ${cross}，MLP ${tower.join(" · ")}`, note: "和 Day 2 的 #9 完全相同的头：x_{l+1} = x₀ ⊙ (W x_l + b) + x_l 三层，再接 MLP 输出一个 logit，对 is_click 算 BCE。" },
];

export default function DinShapeStepper() {
  const [step, setStep] = useState(0);
  const cur = STEPS[step];
  const big = materialisedBytes(5e6, 200, 3);

  return (
    <VisualizationFrame
      title="一个 batch 走一遍：张量形状"
      description={`kuairank 的真实配置：batch ${fmt(B)}，N = ${N}，d = ${d}。一步一步看每个张量多大、在哪里算。`}
      footnote={`对照：若把 5M 条样本 × 200 条历史 × 3 个 int32 预先物化成矩阵，需要 ${(big / 1e9).toFixed(0)} GB；指针布局只要 ${(pointerBytes(5e6) / MB).toFixed(0)} MB，序列只在 gather 那一步、只为当前 batch 存在。`}
    >
      <StepPlayer step={step} total={STEPS.length} onStep={setStep} caption={`第 ${step + 1} 步 / 共 ${STEPS.length} 步`} />
      <div className="viz-scroll">
        <table className="viz-table" style={{ marginTop: 10, minWidth: 560 }}>
          <thead>
            <tr><th>#</th><th>步骤</th><th>形状</th><th>在哪</th></tr>
          </thead>
          <tbody>
            {STEPS.map((x, i) => (
              <tr key={x.what} style={{ opacity: i <= step ? 1 : 0.35, background: i === step ? "#fbf1cf" : undefined, transition: "opacity .25s" }}>
                <td className="num">{i + 1}</td>
                <td style={{ fontWeight: i === step ? 700 : 400 }}>{x.what}</td>
                <td className="viz-mono">{x.shape}</td>
                <td>{x.where}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={`viz-narr ${step === 5 ? "is-warn" : "is-good"}`}>{cur.note}</div>
    </VisualizationFrame>
  );
}
