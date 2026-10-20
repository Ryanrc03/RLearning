"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Curve from "@/components/visualization/ml/primitives/Curve";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Plot from "@/components/visualization/ml/primitives/Plot";
import Slider from "@/components/visualization/ml/primitives/Slider";
import { conv1d, corrLoss, movingAverage, splitScore, toyInfrared, toySignal, toyVisible } from "@/lib/ml/daefuse";

// Section 2.3: why a ViT branch and a CNN branch side by side. One scan line is
// split into a smooth part (what wide averaging keeps: the DLE / ViT branch)
// and a residual (what a small kernel responds to: the DHE / ResNet branch).
// Below, the correlation decomposition loss (Eq. 10) that keeps the two
// branches doing different jobs.

const LOW = "#2a78d6";
const HIGH = "#eb6834";
const SIG = "#3b4234";

export default function DfFrequencySplit() {
  const sig = useMemo(() => toySignal(), []);
  const [k, setK] = useState(9);
  const [ccH, setCcH] = useState(0.1);
  const [ccL, setCcL] = useState(0.8);
  const low = movingAverage(sig, k);
  const high = sig.map((v, i) => v - low[i]);
  const edge = conv1d(sig, [-1, 2, -1]);
  const energy = (v: number[]) => v.reduce((s, x) => s + x * x, 0);
  const lowMean = low.reduce((a, b) => a + b, 0) / low.length;
  const highShare = energy(high) / (energy(high) + energy(low.map((v) => v - lowMean)));
  const toy = useMemo(() => splitScore(toyInfrared(), toyVisible(), 2), []);
  const loss = corrLoss(ccH, ccL);
  const pts = (v: number[]) => v.map((y, i) => [i, y] as const);

  return (
    <VisualizationFrame
      title="一条扫描线拆成低频 + 高频：两个分支各管一半"
      description="上：一条 64 个像素的扫描线 = 缓慢变化的光照 + 一辆车的台阶 + 左边砖墙的细纹理。中：窗口为 k 的滑动平均（宽范围加权平均，ViT 擅长的那种）留下低频；原信号减掉它就是高频。下：3 × 3 卷积核 [−1, 2, −1] 的响应，只在边缘和纹理处不为 0。"
      footnote={<>Park &amp; Kim（2022）的分析：multi-head self-attention 的行为像低通滤波器，卷积像高通滤波器。DAE-Fuse 据此用 ViT 做 DLE、用 ResNet18 做 DHE。下面的相关系数是在示意图上用「模糊 2 次」手工切分得到的，不是训练过的编码器输出。</>}
    >
      <Slider label="平均窗口 k" value={k} min={3} max={21} step={2} onChange={setK} display={`${k} 像素`} />
      <Figure width={640} height={330} label={`窗口 ${k}：高频部分占去均值后能量的 ${(highShare * 100).toFixed(0)}%`} minWidth={520}>
        <Plot box={{ x: 0, y: 0, w: 640, h: 130 }} xDomain={[0, 63]} yDomain={[0, 0.9]} xTicks={[0, 16, 32, 48, 63]} yTicks={[0, 0.45, 0.9]} title="原信号与低频（DLE / ViT 分支）">
          {(f) => (
            <>
              <Curve frame={f} points={pts(sig)} color={SIG} width={1.6} />
              <Curve frame={f} points={pts(low)} color={LOW} width={2.6} />
              <text x={f.x(4)} y={f.y(0.82)} fontSize={10.5} fill="#76796f">砖墙纹理</text>
              <text x={f.x(39)} y={f.y(0.88)} fontSize={10.5} fill="#76796f">车</text>
            </>
          )}
        </Plot>
        <Plot box={{ x: 0, y: 120, w: 640, h: 110 }} xDomain={[0, 63]} yDomain={[-0.25, 0.25]} xTicks={[0, 16, 32, 48, 63]} yTicks={[-0.25, 0, 0.25]} title="高频 = 原信号 − 低频（DHE / CNN 分支）">
          {(f) => <Curve frame={f} points={pts(high)} color={HIGH} width={2.2} />}
        </Plot>
        <Plot box={{ x: 0, y: 220, w: 640, h: 110 }} xDomain={[0, 63]} yDomain={[-0.4, 0.4]} xTicks={[0, 16, 32, 48, 63]} yTicks={[-0.4, 0, 0.4]} title="3 × 3 卷积核 [−1, 2, −1] 的响应" xLabel="像素位置">
          {(f) => <Curve frame={f} points={pts(edge)} color={HIGH} width={1.6} dashed={false} />}
        </Plot>
      </Figure>
      <div className="viz-legend">
        <span><i style={{ background: SIG }} />原信号</span>
        <span><i style={{ background: LOW }} />低频：交给 ViT（DLE）</span>
        <span><i style={{ background: HIGH }} />高频：交给 ResNet18（DHE）</span>
      </div>
      <div className="viz-narr">
        {k <= 5
          ? `窗口只有 ${k}：低频曲线几乎贴着原信号，砖墙纹理也被当成了「低频」，高频部分只剩很小一点（去均值后能量占 ${(highShare * 100).toFixed(0)}%）。窗口太小，两个分支分不开工。`
          : `窗口 ${k}：蓝线只剩光照和车的大致轮廓，砖墙纹理和车的两条边全部落进橙线（高频，占去均值后能量的 ${(highShare * 100).toFixed(0)}%）。最下面的卷积响应也只在同样的位置不为 0：小卷积核天生就在找这些地方。`}
      </div>

      <div className="viz-panel" style={{ marginTop: 14 }}>
        <h5>相关性分解损失（式 10）：让两个分支真的分工</h5>
        <div className="viz-grid2">
          <div>
            <Slider label="CC(高频α, 高频β)" value={ccH} min={-1} max={1} step={0.05} onChange={setCcH} display={ccH.toFixed(2)} />
            <Slider label="CC(低频α, 低频β)" value={ccL} min={-1} max={1} step={0.05} onChange={setCcL} display={ccL.toFixed(2)} />
          </div>
          <div className="viz-mono" style={{ fontSize: 12.5, lineHeight: 1.9 }}>
            L = CC_H² / (CC_L + 1.01)
            <br />= {ccH.toFixed(2)}² / ({ccL.toFixed(2)} + 1.01)
            <br />= {(ccH * ccH).toFixed(4)} / {(ccL + 1.01).toFixed(2)} = <b>{loss.toFixed(4)}</b>
          </div>
        </div>
        <p className="viz-k" style={{ marginTop: 8 }}>
          示意图上手工切分：CC_L = {toy.ccLow.toFixed(2)}（红外里人是亮的、可见光里人是暗的，所以低频反而负相关），CC_H = {toy.ccHigh.toFixed(2)}，L = {toy.loss.toFixed(4)}。
        </p>
      </div>
      <div className={`viz-narr${loss < 0.05 ? " is-good" : " is-warn"}`}>
        {loss < 0.05
          ? `损失 ${loss.toFixed(4)}，很小：两种模态的高频几乎不相关（各自独有的细节），低频高度相关（共享的场景结构）。这正是这个损失想要的状态。`
          : `损失 ${loss.toFixed(4)}。分子在罚高频相关：如果两种模态的高频特征很像，说明 DHE 抽到的其实是共享信息，没在抽各自独有的细节；分母在奖励低频相关：CC_L 越接近 1，分母越大，损失越小。ε = 1.01 保证 CC_L = −1 时分母仍是正的。`}
      </div>
    </VisualizationFrame>
  );
}
