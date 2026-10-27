"use client";

import { useMemo } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Plot from "@/components/visualization/ml/primitives/Plot";
import { cornersRun } from "@/lib/ml/daefuseRuns";
import { cnnForward, vitForward } from "@/lib/ml/daefuseTrain";
import { Cells, CurvePanel, seq, Training, useLazyRun } from "./DfTrainKit";

// 2.2 experiment: the same "both corners lit" task for the small CNN
// (3 × 3 kernels + global average pooling) and the smallest ViT. Left: the
// CNN's two pooled features for every test image, coloured by label — the
// classes overlap: it can only count lit patches. Middle: where the trained ViT looks. Right: test accuracy.

const BLUE = "#2a78d6";
const ORANGE = "#eb6834";
const GREEN = "#1baf7a";
const GREY = "#9a9c8d";

export default function DfVitExp() {
  const [ref, run] = useLazyRun(cornersRun);
  const data = useMemo(() => {
    if (!run) return null;
    const cnnP = run.cnn.at(-1)!.params;
    const vitP = run.vit.at(-1)!.params;
    const feats = run.test.map((s) => ({ h: cnnForward(cnnP, s.x).h, y: s.y }));
    const att = new Array(16).fill(0);
    const pos = run.test.filter((s) => s.y === 1);
    for (const s of pos) vitForward(vitP, s.x).a.forEach((v, i) => (att[i] += v / pos.length));
    const hmax = Math.max(0.05, ...feats.flatMap((f) => f.h)) * 1.1;
    return { feats, att, hmax };
  }, [run]);

  return (
    <VisualizationFrame
      title="实验：要同时看两个远处的角落，CNN vs ViT"
      description="两个模型用同样的 120 张图训练 300 步，在另外 120 张图上测试。标签只取决于左上角和右下角那两块 2 × 2 是不是都亮；其余 14 块随机亮灭，是干扰。"
      footnote="真实计算：CNN 和前面同一个结构（2 个 3 × 3 卷积核 + 全局平均池化 + 全连接，26 个参数）；ViT 是上面那个 130 参数的最小版本。"
    >
      <div ref={ref}>
        {!run || !data ? (
          <Training />
        ) : (
          <>
            <Figure width={700} height={250} label={`测试准确率：ViT ${(run.vit.at(-1)!.testAcc * 100).toFixed(0)}%，CNN ${(run.cnn.at(-1)!.testAcc * 100).toFixed(0)}%`} minWidth={600}>
              <Plot box={{ x: 0, y: 0, w: 220, h: 246 }} xDomain={[0, data.hmax]} yDomain={[0, data.hmax]} xTicks={[0, data.hmax]} yTicks={[0, data.hmax]} format={(v) => v.toFixed(2)} xLabel="池化特征 1" title="CNN 看到的（每点一张测试图）">
                {(f) => data.feats.map((p, i) => <circle key={i} cx={f.x(p.h[0])} cy={f.y(p.h[1])} r={3} fill={p.y === 1 ? GREEN : GREY} fillOpacity={0.7} />)}
              </Plot>
              <Cells vals={data.att} cols={4} x={250} y={40} cell={34} color={(v) => seq(v, 0.45)} title="ViT 在正样本上的平均 attention" stroke={(i) => (i === 0 || i === 15 ? "#3b4234" : undefined)} />
              {data.att.map((v, i) => <text key={i} x={250 + (i % 4) * 34 + 17} y={40 + Math.floor(i / 4) * 34 + 21} fontSize={10} textAnchor="middle" fill={v > 0.25 ? "#fff" : "#30332c"} className="mono">{Math.round(v * 100)}</text>)}
              <CurvePanel
                box={{ x: 418, y: 8, w: 282, h: 236 }}
                xMax={300}
                yDomain={[0.4, 1.02]}
                yTicks={[0.5, 0.75, 1]}
                format={(v) => `${Math.round(v * 100)}%`}
                title="测试准确率"
                series={[
                  { label: "ViT", color: BLUE, points: run.vit.map((p) => [p.step, p.testAcc]) },
                  { label: "CNN", color: ORANGE, points: run.cnn.map((p) => [p.step, p.testAcc]) },
                ]}
              />
            </Figure>
            <div className="viz-legend">
              <span><i style={{ background: GREEN }} />正样本（两角都亮）</span>
              <span><i style={{ background: GREY }} />负样本</span>
              <span><i style={{ background: seq(0.45, 0.45) }} />attention 权重（%）</span>
            </div>
            <div className="viz-narr is-good">
              ViT 的测试准确率 {(run.vit.at(-1)!.testAcc * 100).toFixed(0)}%，CNN 停在 {(run.cnn.at(-1)!.testAcc * 100).toFixed(0)}%。左图解释了 CNN 卡在哪：3 × 3 卷积只看局部，全局平均池化又把「在哪」抹掉了，它最后拿到的两个数只能说明「图里大概有多少亮块」。正样本至少有两块亮，平均亮块多一些，所以靠「亮块多就猜 1」能蒙对一部分；但绿点和灰点大面积重叠，后面的分类头怎么调都分不开。ViT 的 attention 把 {Math.round((data.att[0] + data.att[15]) * 100)}% 的权重放在两个角落上，一步就把相隔很远的两块信息拿到了一起。
            </div>
          </>
        )}
      </div>
    </VisualizationFrame>
  );
}
