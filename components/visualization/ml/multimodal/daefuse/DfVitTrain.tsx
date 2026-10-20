"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
import StepPlayer from "@/components/visualization/ml/primitives/StepPlayer";
import { cornersRun } from "@/lib/ml/daefuseRuns";
import { vitForward, type ClsSnap, type Sample } from "@/lib/ml/daefuseTrain";
import { Cells, CurvePanel, seq, Training, useLazyRun } from "./DfTrainKit";
import { gray } from "./DfPixels";

// 2.2 training dynamics: the 130-parameter ViT learns where to look. The
// attention of the [CLS] query, averaged over the test images, starts flat
// and ends on the two corner patches that decide the label.

const BLUE = "#2a78d6";
const ORANGE = "#eb6834";

function meanAttention(s: ClsSnap, data: Sample[], y: 0 | 1) {
  const acc = new Array(16).fill(0);
  const rows = data.filter((d) => d.y === y);
  for (const d of rows) vitForward(s.params, d.x).a.forEach((v, i) => (acc[i] += v / rows.length));
  return acc;
}

export default function DfVitTrain() {
  const [ref, run] = useLazyRun(cornersRun);
  const [k, setK] = useState(0);
  const snaps = run?.vit ?? [];
  const s = snaps[Math.min(k, snaps.length - 1)];
  const maps = useMemo(() => (run && s ? { pos: meanAttention(s, run.test, 1), neg: meanAttention(s, run.test, 0) } : null), [run, s]);
  const ex = run?.test[1];
  const exA = run && s && ex ? vitForward(s.params, ex.x).a : [];
  const corner = maps ? maps.pos[0] + maps.pos[15] : 0;

  return (
    <VisualizationFrame
      title="训练过程：attention 学会「该看哪里」"
      description="最小 ViT（130 个参数）在 120 张图上训练 300 步（Adam，学习率 0.01）。任务：左上角和右下角两块都亮 → 1，否则 → 0。中间那张 4 × 4 的图是 [CLS] query 分给 16 个 patch 的 attention，在所有正样本上取平均。"
      footnote="真实计算：每 10 步存一次参数，测试集是另外 120 张图。"
    >
      <div ref={ref}>
        {!run || !s || !maps || !ex ? (
          <Training />
        ) : (
          <>
            <StepPlayer step={k} total={snaps.length} onStep={setK} intervalMs={160} caption={`第 ${s.step} 步 / 共 300 步`} />
            <Figure width={700} height={250} label={`第 ${s.step} 步：两个角落合计拿到 ${(corner * 100).toFixed(0)}% 的 attention，测试准确率 ${(s.testAcc * 100).toFixed(0)}%`} minWidth={600}>
              <Cells vals={ex.x} cols={8} x={14} y={40} cell={12} color={(v) => gray(v)} title="一张正样本" />
              {exA.map((a, i) => (
                <rect key={i} x={14 + (i % 4) * 24} y={40 + Math.floor(i / 4) * 24} width={24} height={24} fill={BLUE} fillOpacity={Math.min(0.75, a * 2.5)} stroke="#fff" strokeWidth={0.6} />
              ))}
              <text x={14} y={150} fontSize={9.5} fill="#76796f">蓝色越深 = 这张图上</text>
              <text x={14} y={163} fontSize={9.5} fill="#76796f">attention 越大</text>

              <Cells vals={maps.pos} cols={4} x={140} y={40} cell={30} color={(v) => seq(v, 0.45)} title="正样本平均 attention" stroke={(i) => (i === 0 || i === 15 ? "#3b4234" : undefined)} />
              {maps.pos.map((v, i) => <text key={i} x={140 + (i % 4) * 30 + 15} y={40 + Math.floor(i / 4) * 30 + 19} fontSize={9.5} textAnchor="middle" fill={v > 0.25 ? "#fff" : "#30332c"} className="mono">{Math.round(v * 100)}</text>)}
              <Cells vals={maps.neg} cols={4} x={280} y={40} cell={30} color={(v) => seq(v, 0.45)} title="负样本平均 attention" stroke={(i) => (i === 0 || i === 15 ? "#3b4234" : undefined)} />
              {maps.neg.map((v, i) => <text key={i} x={280 + (i % 4) * 30 + 15} y={40 + Math.floor(i / 4) * 30 + 19} fontSize={9.5} textAnchor="middle" fill={v > 0.25 ? "#fff" : "#30332c"} className="mono">{Math.round(v * 100)}</text>)}
              <text x={140} y={180} fontSize={10} fill="#30332c">黑框 = 决定标签的两个角落（数字是 %）</text>

              <CurvePanel
                box={{ x: 418, y: 8, w: 282, h: 236 }}
                xMax={300}
                yDomain={[0, 1]}
                yTicks={[0, 0.5, 1]}
                cursor={s.step}
                title="loss 与测试准确率"
                series={[
                  { label: "训练 loss", color: ORANGE, points: snaps.map((p) => [p.step, p.loss]) },
                  { label: "测试准确率", color: BLUE, points: snaps.map((p) => [p.step, p.testAcc]) },
                ]}
              />
            </Figure>
            <div className={`viz-narr${s.step === 0 ? "" : s.testAcc > 0.95 ? " is-good" : " is-warn"}`}>
              {s.step === 0
                ? "第 0 步：attention 几乎是平的，每个 patch 约 6%（= 1/16），模型在瞎猜。按播放。"
                : s.testAcc < 0.6
                  ? `第 ${s.step} 步：loss 几乎没动，准确率还在 50% 附近。attention 还没找到方向，梯度很小：这是一个「平台期」。`
                  : s.testAcc < 0.95
                    ? `第 ${s.step} 步：突然开始学会了。两个角落的 attention 一起往上涨（正样本上合计 ${(corner * 100).toFixed(0)}%），准确率跟着跳到 ${(s.testAcc * 100).toFixed(0)}%。`
                    : `第 ${s.step} 步：测试准确率 ${(s.testAcc * 100).toFixed(0)}%。正样本上，两个角落合计拿走 ${(corner * 100).toFixed(0)}% 的 attention，其余 14 块平均每块只有 ${(((1 - corner) / 14) * 100).toFixed(0)}%。负样本上 attention 更极端，几乎全压在两个角落：只要其中一个是暗的，答案就是 0。模型靠「位置向量 + 内容」学会了一步看两个相隔 6 个像素的地方，再在分类头里判断它们是不是都亮。`}
            </div>
          </>
        )}
      </div>
    </VisualizationFrame>
  );
}
