"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Plot from "@/components/visualization/ml/primitives/Plot";
import Curve from "@/components/visualization/ml/primitives/Curve";
import StepPlayer from "@/components/visualization/ml/primitives/StepPlayer";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import { collapseOf, DEFAULT_RUN, logitsOf, simulateRun } from "@/lib/ml/finetune";

// BERT fine-tuning, figure 4: a training run played step by step. Left: the
// [CLS] vectors squeezed to 2-D (示意), coloured by true class, on top of the
// head's decision regions. Right: the warmup + linear-decay learning rate,
// train / validation loss and validation accuracy up to the current step.
// Preset: the default 2e-5 run vs five times the learning rate.

type Preset = "ok" | "big";
const PRESETS: { key: Preset; label: string }[] = [
  { key: "ok", label: "峰值学习率 2e-5" },
  { key: "big", label: "峰值学习率 1e-4（太大）" },
];

const CLASS = ["#eb6834", "#76796f", "#1baf7a"];
const REGION = ["#fbe3d8", "#ecebe4", "#d9f1e6"];
const C1 = "#2a78d6";
const C2 = "#eb6834";
const INK = "#3b4234";
const GRID_N = 26;
const XD: [number, number] = [-3.2, 3.2];
const YD: [number, number] = [-2.6, 2.8];

const f3 = (x: number) => x.toFixed(3);
// Keep outliers on the panel's edge instead of drawing them over the axes.
const cx = (x: number) => Math.min(XD[1] - 0.08, Math.max(XD[0] + 0.08, x));
const cy = (y: number) => Math.min(YD[1] - 0.08, Math.max(YD[0] + 0.08, y));

export default function TrainingRunFigure() {
  const [preset, setPreset] = useState<Preset>("ok");
  const [step, setStep] = useState(0);
  const runs = useMemo(() => ({ ok: simulateRun(DEFAULT_RUN), big: simulateRun({ ...DEFAULT_RUN, peakLr: 1e-4 }) }), []);
  const run = runs[preset];
  const total = run.length;
  const s = run[step];
  const peak = preset === "ok" ? 2e-5 : 1e-4;
  const perEpoch = (total - 1) / DEFAULT_RUN.epochs;
  const warmup = Math.round((total - 1) * DEFAULT_RUN.warmupRatio);
  const bestAcc = Math.max(...run.slice(0, step + 1).map((r) => r.valAcc));

  const changePreset = (p: Preset) => {
    setPreset(p);
    setStep(0);
  };

  const cells = useMemo(() => {
    const out: { x: number; y: number; k: number }[] = [];
    for (let i = 0; i < GRID_N; i++)
      for (let j = 0; j < GRID_N; j++) {
        const x = XD[0] + ((i + 0.5) / GRID_N) * (XD[1] - XD[0]);
        const y = YD[0] + ((j + 0.5) / GRID_N) * (YD[1] - YD[0]);
        const z = logitsOf(s.head, { x, y });
        out.push({ x, y, k: z.indexOf(Math.max(...z)) });
      }
    return out;
  }, [s]);

  const narr = (() => {
    if (step === 0) return { tone: "", text: `每个点是一条评论的 [CLS] 向量（真实是 768 维，这里压成 2 维示意），颜色是真实标签；底色是分类头此刻的判决区域。刚开始头是随机的，底色乱分，三类的点也挤在一起：预训练过的 MacBERT 已经有一点区分度，但还不知道这个任务要分什么。按「播放」。` };
    if (step <= warmup) return { tone: "", text: `前 ${warmup} 步是 warmup：学习率从 0 线性涨到峰值 ${peak.toExponential(0)}。新初始化的头一开始梯度方向很乱，小步起跑能避免一上来就把预训练好的编码器推坏。` };
    if (preset === "big" && collapseOf(s.budget) > 0.05)
      return { tone: " is-bad", text: `学习率太大：前几步准确率冲得很快（最高 ${f3(bestAcc)}），但编码器被推得太远，预训练学到的特征被冲掉，三类的点重新混成一团，验证准确率掉到 ${f3(s.valAcc)}、loss 回升到 ${f3(s.valLoss)}。这就是灾难性遗忘；真实训练里常见的症状是所有样本都预测成同一类。` };
    if (step === total - 1) return { tone: " is-good", text: `${DEFAULT_RUN.epochs} 个 epoch、${total - 1} 步跑完，学习率衰减到 0。三类的点被拉开（编码器也在学），判决边界落在它们之间：验证 loss ${f3(s.valLoss)}，验证准确率 ${f3(s.valAcc)}。真实做法是每个 epoch 末在验证集上评估一次，保留最好的那个 checkpoint。` };
    return { tone: "", text: `第 ${s.epoch} 个 epoch，第 ${step} 步，学习率 ${s.lr.toExponential(2)}，正在线性衰减。注意点在移动：全参数微调时编码器也在更新，[CLS] 向量按类别被拉开，分类头只需要在它们之间划线。训练 loss ${f3(s.trainLoss)}，验证 loss ${f3(s.valLoss)}。` };
  })();

  const lrPts = run.map((r) => [r.step, r.lr / 1e-5] as const);
  const lrMax = preset === "ok" ? 2.4 : 12;
  const trainPts = run.slice(0, step + 1).map((r) => [r.step, r.trainLoss] as const);
  const valPts = run.slice(0, step + 1).map((r) => [r.step, r.valLoss] as const);
  const accPts = run.slice(0, step + 1).map((r) => [r.step, r.valAcc] as const);

  return (
    <VisualizationFrame
      title="一次训练跑下来：学习率、loss、判决边界"
      description="左边：每个点是一条评论的 [CLS] 向量（实心是训练集，空心是验证集），底色是分类头的判决区域。右边：学习率、loss 和验证准确率随步数变化。切换上面两档看学习率太大时会怎样。"
      footnote={<>示意：768 维的 [CLS] 压成 2 维；编码器的作用用「按类别把点拉开」表示，学习率超过默认预算时点会重新混在一起。分类头是真的按 softmax + 交叉熵的梯度一步步训练出来的：60 条训练、60 条验证、batch 8、4 个 epoch、warmup 10%、固定随机种子。</>}
    >
      <div className="viz-row">
        <Tabs options={PRESETS} value={preset} onChange={changePreset} ariaLabel="学习率" />
      </div>
      <StepPlayer step={step} total={total} onStep={setStep} intervalMs={380} caption={`第 ${step} 步 / ${total - 1} · epoch ${s.epoch}`} onReset={() => setStep(0)} />

      <Figure width={720} height={360} label="训练过程中的判决区域、学习率、loss 和准确率" minWidth={620}>
        <Plot box={{ x: 0, y: 0, w: 340, h: 360 }} xDomain={XD} yDomain={YD} xTicks={[]} yTicks={[]} title="[CLS] 向量（2 维示意）与判决区域">
          {(f) => {
            const cw = (f.x1 - f.x0) / GRID_N;
            const ch = (f.y0 - f.y1) / GRID_N;
            return (
              <g>
                {cells.map((c, i) => (
                  <rect key={i} x={f.x(c.x) - cw / 2} y={f.y(c.y) - ch / 2} width={cw + 0.5} height={ch + 0.5} fill={REGION[c.k]} style={{ transition: "fill .3s" }} />
                ))}
                {s.train.map((p, i) => (
                  <circle key={`t${i}`} cx={f.x(cx(p.x))} cy={f.y(cy(p.y))} r={3.6} fill={CLASS[p.label]} stroke="#fff" strokeWidth={0.8} style={{ transition: "cx .35s, cy .35s" }} />
                ))}
                {s.val.map((p, i) => (
                  <circle key={`v${i}`} cx={f.x(cx(p.x))} cy={f.y(cy(p.y))} r={3.4} fill="#fff" stroke={CLASS[p.label]} strokeWidth={1.6} style={{ transition: "cx .35s, cy .35s" }} />
                ))}
              </g>
            );
          }}
        </Plot>

        <Plot box={{ x: 350, y: 0, w: 370, h: 118 }} xDomain={[0, total - 1]} yDomain={[0, lrMax]} xTicks={[0, perEpoch, 2 * perEpoch, 3 * perEpoch, 4 * perEpoch]} yTicks={[0, lrMax / 2, lrMax]} format={(v) => (v === 0 ? "0" : String(Math.round(v * 10) / 10))} title="学习率（× 1e-5）">
          {(f) => (
            <g>
              <Curve frame={f} points={lrPts} color={C1} area />
              <circle cx={f.x(step)} cy={f.y(s.lr / 1e-5)} r={4.5} fill={C1} stroke="#fff" strokeWidth={1.5} />
              <line x1={f.x(warmup)} y1={f.y1} x2={f.x(warmup)} y2={f.y0} stroke="#c9c4ad" strokeDasharray="3 3" />
              <text x={f.x(warmup) + 4} y={f.y1 + 10} fontSize={10} fill="#76796f">warmup 结束</text>
            </g>
          )}
        </Plot>

        <Plot box={{ x: 350, y: 120, w: 370, h: 120 }} xDomain={[0, total - 1]} yDomain={[0, 1.8]} xTicks={[0, perEpoch, 2 * perEpoch, 3 * perEpoch, 4 * perEpoch]} yTicks={[0, 0.9, 1.8]} title="loss（实线训练 · 虚线验证）">
          {(f) => (
            <g>
              <line x1={f.x0} y1={f.y(Math.log(3))} x2={f.x1} y2={f.y(Math.log(3))} stroke="#c9c4ad" strokeDasharray="2 3" />
              <text x={f.x1 - 2} y={f.y(Math.log(3)) - 4} fontSize={10} textAnchor="end" fill="#76796f">ln 3：瞎猜</text>
              <Curve frame={f} points={trainPts} color={C2} />
              <Curve frame={f} points={valPts} color={C2} dashed />
            </g>
          )}
        </Plot>

        <Plot box={{ x: 350, y: 240, w: 370, h: 120 }} xDomain={[0, total - 1]} yDomain={[0, 1]} xTicks={[0, perEpoch, 2 * perEpoch, 3 * perEpoch, 4 * perEpoch]} yTicks={[0, 0.5, 1]} xLabel="训练步（竖线是 epoch 边界）" title="验证准确率">
          {(f) => (
            <g>
              <line x1={f.x0} y1={f.y(1 / 3)} x2={f.x1} y2={f.y(1 / 3)} stroke="#c9c4ad" strokeDasharray="2 3" />
              <Curve frame={f} points={accPts} color={INK} />
              <circle cx={f.x(step)} cy={f.y(s.valAcc)} r={4} fill={INK} stroke="#fff" strokeWidth={1.5} />
            </g>
          )}
        </Plot>
      </Figure>

      <div className="viz-stat">
        <div><small>学习率</small><b>{s.lr === 0 ? "0" : s.lr.toExponential(2)}</b></div>
        <div><small>训练 loss</small><b>{f3(s.trainLoss)}</b></div>
        <div><small>验证 loss</small><b>{f3(s.valLoss)}</b></div>
        <div><small>验证准确率</small><b>{f3(s.valAcc)}</b></div>
      </div>

      <div className={`viz-narr${narr.tone}`}>{narr.text}</div>
    </VisualizationFrame>
  );
}
