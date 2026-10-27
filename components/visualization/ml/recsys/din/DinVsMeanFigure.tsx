"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Curve from "@/components/visualization/ml/primitives/Curve";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Marker from "@/components/visualization/ml/primitives/Marker";
import Plot from "@/components/visualization/ml/primitives/Plot";
import Slider from "@/components/visualization/ml/primitives/Slider";
import { LONG_HISTORY_LEN, longHistory, RECENT_BURST, separationAt } from "@/lib/ml/din";

// DIN note, "DIN vs mean pooling": the same 200-event history, read through the
// last N events. The user binged 萌宠 in the last 12 events; older events are
// mixed. The y-axis is how far apart the pooled score puts a 萌宠 candidate and
// a 游戏 candidate. Mean pooling dilutes the recent burst as N grows; the
// un-normalised DIN sum keeps it.

const BLUE = "#2a78d6";
const ORANGE = "#eb6834";
const W = 720;
const H = 300;

export default function DinVsMeanFigure() {
  const [n, setN] = useState(50);
  const h = useMemo(() => longHistory(), []);
  const curves = useMemo(() => {
    const ns = Array.from({ length: LONG_HISTORY_LEN }, (_, i) => i + 1);
    return {
      mean: ns.map((k) => [k, separationAt(h, k, "mean")] as const),
      din: ns.map((k) => [k, separationAt(h, k, "din")] as const),
    };
  }, [h]);
  const mean = separationAt(h, n, "mean");
  const din = separationAt(h, n, "din");
  const peakMean = Math.max(...curves.mean.map((p) => p[1]));
  const maxDin = Math.max(...curves.din.map((p) => p[1]));

  // two y scales: mean on the left (0–2), DIN on the right (0–maxDin), both from 0
  const meanTop = 2;
  const dinTop = Math.ceil(maxDin / 5) * 5;
  const dinScale = meanTop / dinTop;

  const tone = n <= RECENT_BURST ? "is-good" : n <= 30 ? "is-warn" : "is-bad";
  const narr =
    n <= RECENT_BURST
      ? `N = ${n}：窗口还在最近这段「刷萌宠」里，两种池化都把萌宠候选排在游戏前面（均值的分差 ${mean.toFixed(2)}，DIN ${din.toFixed(2)}）。`
      : `N = ${n}：均值池化把最近 ${RECENT_BURST} 条的兴趣和更早的 ${n - RECENT_BURST} 条平均，分差从最高的 ${peakMean.toFixed(2)} 掉到 ${mean.toFixed(2)}；DIN 的权重只落在相关的历史上，不除以 N，分差 ${din.toFixed(2)}，还在随相关历史变多而变大。代价是它的尺度随 N 变，后面的网络要能消化。`;

  return (
    <VisualizationFrame
      title="同一段历史，N 越长，均值越被稀释"
      description={`一个用户最近 ${LONG_HISTORY_LEN} 条曝光：最后 ${RECENT_BURST} 条是一阵「刷萌宠」，更早的混着美食、搞笑、游戏、汽车，萌宠很少。纵轴是池化后的分数把「萌宠」候选和「游戏」候选拉开了多少；两条线各用自己的刻度。`}
      footnote="示意值：历史由固定种子生成，tag 向量、反馈系数和权重函数与上面的 loss 例子相同。它演示的是 DIN_SEQ 方案里实验 (b) 的预期（N 越长，din 与 mean 的差距越大）；kuairank 的实际结果相反（DIN 与均值打平，N = 10 最好），见正文。"
    >
      <div className="viz-controls">
        <Slider label="N：取最近多少条" value={n} min={1} max={LONG_HISTORY_LEN} step={1} onChange={setN} id="din-vs-n" />
        <button type="button" className="viz-btn" onClick={() => setN(50)}>重置</button>
      </div>
      <Figure width={W} height={H} label={`N = ${n}：均值池化分差 ${mean.toFixed(2)}，DIN 分差 ${din.toFixed(2)}`}>
        <Plot box={{ x: 0, y: 0, w: W - 40, h: H }} xDomain={[0, LONG_HISTORY_LEN]} yDomain={[0, meanTop]} xTicks={[0, 50, 100, 150, 200]} yTicks={[0, 0.5, 1, 1.5, 2]} xLabel="N（最近多少条曝光）" yLabel="均值池化的分差">
          {(f) => (
            <>
              <rect x={f.x0} y={f.y1} width={f.x(RECENT_BURST) - f.x0} height={f.y0 - f.y1} fill={BLUE} opacity={0.06} />
              <text x={f.x(RECENT_BURST) + 4} y={f.y1 + 12} fontSize={10.5} fill="#76796f">最近 {RECENT_BURST} 条：刷萌宠</text>
              <Curve frame={f} points={curves.mean} color={ORANGE} width={2.2} />
              <Curve frame={f} points={curves.din.map(([k, v]) => [k, v * dinScale] as const)} color={BLUE} width={2.2} />
              <line x1={f.x(n)} y1={f.y1} x2={f.x(n)} y2={f.y0} stroke="#3b4234" strokeDasharray="4 3" />
              <Marker frame={f} x={n} y={mean} color={ORANGE} label={mean.toFixed(2)} side="right" />
              <Marker frame={f} x={n} y={din * dinScale} color={BLUE} label={din.toFixed(2)} side="left" />
              {[0, dinTop / 2, dinTop].map((t) => (
                <text key={t} x={f.x1 + 6} y={f.y(t * dinScale) + 4} fontSize={11} fill={BLUE}>{t}</text>
              ))}
              <text x={f.x1 + 6} y={f.y1 - 8} fontSize={10.5} fill={BLUE}>DIN</text>
            </>
          )}
        </Plot>
      </Figure>
      <div className="viz-legend">
        <span><i style={{ background: ORANGE }} />均值池化（左轴）</span>
        <span><i style={{ background: BLUE }} />DIN，不归一化（右轴）</span>
      </div>
      <div className={`viz-narr ${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}
