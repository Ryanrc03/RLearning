"use client";

import { useId, useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Curve from "@/components/visualization/ml/primitives/Curve";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Marker from "@/components/visualization/ml/primitives/Marker";
import Plot from "@/components/visualization/ml/primitives/Plot";
import Slider from "@/components/visualization/ml/primitives/Slider";
import { errorByDegree, fitRegionOf, fitRegions, makeSineData, polyfit, polyval, trueCurve } from "@/lib/ml/polyfit";

// Page 2 of Training: twenty noisy points from a sine, fitted by a polynomial
// whose degree the slider sets. The right panel is the whole story: training
// error only ever falls, test error turns back up.

const W = 720;
const H = 330;
const TRAIN_SEED = 19;
const TEST_SEED = 119;
const N_TRAIN = 20;
const N_TEST = 40;
const NOISE = 0.3;
const MAX_DEG = 12;
const C_TRAIN = "#2a78d6";
const C_TEST = "#eb6834";
const C_FIT = "#1baf7a";
const Y_FIT: [number, number] = [-2, 2];

const f3 = (v: number) => v.toFixed(3);

export default function BiasVarianceFigure() {
  const [d, setD] = useState(3);
  const clipId = useId();

  const data = useMemo(() => {
    const train = makeSineData(TRAIN_SEED, N_TRAIN, NOISE);
    const test = makeSineData(TEST_SEED, N_TEST, NOISE);
    const errs = errorByDegree(train, test, MAX_DEG);
    const regions = fitRegions(errs);
    const fits = Array.from({ length: MAX_DEG }, (_, i) => polyfit(train.xs, train.ys, i + 1));
    const grid = Array.from({ length: 161 }, (_, i) => i / 160);
    const curves = fits.map((fit) => grid.map((x) => [x, polyval(fit, x)] as const));
    const truth = grid.map((x) => [x, trueCurve(x)] as const);
    const yMax = Math.ceil(Math.max(...errs.map((e) => Math.max(e.train, e.test))) * 10) / 10;
    return { train, test, errs, regions, curves, truth, yMax };
  }, []);

  const e = data.errs[d - 1];
  const gap = e.test - e.train;
  const region = fitRegionOf(data.regions, d);
  const { best, underEnd, overStart } = data.regions;

  const narr =
    region === "under"
      ? {
          tone: "is-warn",
          text: `d = ${d}：${d + 1} 个参数画不出一整个周期的正弦，训练误差 ${f3(e.train)} 和测试误差 ${f3(e.test)} 都高，两者差距只有 ${f3(gap)}。这是 bias：模型本身学不会，再多数据也没用。往右拖。`,
        }
      : region === "over"
        ? {
            tone: "is-bad",
            text: `d = ${d}：训练误差继续降到 ${f3(e.train)}，测试误差却升到 ${f3(e.test)}，差距 ${f3(gap)}。多出来的参数在 20 个点之间来回摆，把噪声也背了下来${d === MAX_DEG ? "，13 个参数对 20 个点，曲线在点与点之间甩出了图外" : ""}。这是 variance：换一批点，这条曲线会完全不同。`,
          }
        : {
            tone: "is-good",
            text: `d = ${d}：训练误差 ${f3(e.train)}，测试误差 ${f3(e.test)}，都接近噪声本身的方差 ${(NOISE * NOISE).toFixed(2)}（σ = ${NOISE}）。模型刚好够描出正弦，又没有多少余力去记噪声；测试误差在 d = ${best} 最低。`,
          };

  return (
    <VisualizationFrame
      title="同一批点，阶数从 1 拖到 12"
      description={`${N_TRAIN} 个训练点（实心）从 y = sin(2πx) 加 σ = ${NOISE} 的噪声里抽出，另抽 ${N_TEST} 个测试点（空心）只用来打分。左边是当前阶数的拟合，右边是训练 / 测试 MSE 随阶数的变化。`}
    >
      <Slider label="多项式阶数 d" value={d} min={1} max={MAX_DEG} step={1} onChange={setD} display={String(d)} id="bv-degree" />
      <Figure width={W} height={H} label={`阶数 ${d}：训练 MSE ${f3(e.train)}，测试 MSE ${f3(e.test)}`}>
        <Plot box={{ x: 0, y: 0, w: 360, h: H }} xDomain={[0, 1]} yDomain={Y_FIT} xTicks={[0, 0.5, 1]} yTicks={[-2, -1, 0, 1, 2]} xLabel="x" yLabel="y" title={`d = ${d} 的多项式拟合`}>
          {(f) => (
            <>
              <clipPath id={clipId}>
                <rect x={f.x0} y={f.y1} width={f.x1 - f.x0} height={f.y0 - f.y1} />
              </clipPath>
              <Curve frame={f} points={data.truth} color="#c9c4ad" width={1.5} dashed />
              {data.test.xs.map((x, i) => (
                <circle key={`t${i}`} cx={f.x(x)} cy={f.y(data.test.ys[i])} r={2.6} fill="#fff" stroke={C_TEST} strokeWidth={1.2} opacity={0.75} />
              ))}
              {data.train.xs.map((x, i) => (
                <circle key={`r${i}`} cx={f.x(x)} cy={f.y(data.train.ys[i])} r={3.6} fill={C_TRAIN} stroke="#fff" strokeWidth={1} />
              ))}
              <g clipPath={`url(#${clipId})`}>
                <Curve frame={f} points={data.curves[d - 1]} color={C_FIT} width={2.4} />
              </g>
              <text x={f.x1 - 4} y={f.y1 + 12} fontSize={10.5} textAnchor="end" fill="#8e8d78">虚线：真实的 sin(2πx)</text>
            </>
          )}
        </Plot>
        <Plot
          box={{ x: 370, y: 0, w: 350, h: H }}
          xDomain={[1, MAX_DEG]}
          yDomain={[0, data.yMax]}
          xTicks={[1, 3, 5, 7, 9, 12]}
          yTicks={[0, data.yMax / 2, data.yMax]}
          xLabel="多项式阶数 d"
          yLabel="MSE"
          title="训练误差只降，测试误差回头"
        >
          {(f) => (
            <>
              {underEnd !== null && (
                <>
                  <rect x={f.x0} y={f.y1} width={f.x(underEnd + 0.5) - f.x0} height={f.y0 - f.y1} fill="#eda100" opacity={0.08} />
                  <text x={(f.x0 + f.x(underEnd + 0.5)) / 2} y={f.y1 + 14} fontSize={11} textAnchor="middle" fill="#8a6d00" fontWeight={600}>欠拟合</text>
                </>
              )}
              {overStart !== null && (
                <>
                  <rect x={f.x(overStart - 0.5)} y={f.y1} width={f.x1 - f.x(overStart - 0.5)} height={f.y0 - f.y1} fill="#d03b3b" opacity={0.07} />
                  <text x={(f.x(overStart - 0.5) + f.x1) / 2} y={f.y1 + 14} fontSize={11} textAnchor="middle" fill="#d03b3b" fontWeight={600}>过拟合</text>
                </>
              )}
              <line x1={f.x(d)} y1={f.y1} x2={f.x(d)} y2={f.y0} stroke="#3b4234" strokeWidth={1} strokeDasharray="4 3" style={{ transition: "x1 .25s, x2 .25s" }} />
              <Curve frame={f} points={data.errs.map((r) => [r.degree, r.train] as const)} color={C_TRAIN} width={2} />
              <Curve frame={f} points={data.errs.map((r) => [r.degree, r.test] as const)} color={C_TEST} width={2} />
              <Marker frame={f} x={d} y={e.test} color={C_TEST} label={`测试 ${f3(e.test)}`} side={d > 8 ? "left" : "right"} r={4.5} />
              <Marker frame={f} x={d} y={e.train} color={C_TRAIN} label={`训练 ${f3(e.train)}`} side={d > 8 ? "left" : "right"} r={4.5} />
            </>
          )}
        </Plot>
      </Figure>

      <div className="viz-stat" style={{ marginTop: 12 }}>
        <div><small>参数个数 d + 1</small><b>{d + 1}</b></div>
        <div><small>训练 MSE</small><b style={{ color: C_TRAIN }}>{f3(e.train)}</b></div>
        <div><small>测试 MSE</small><b style={{ color: C_TEST }}>{f3(e.test)}</b></div>
        <div><small>差距（测试 − 训练）</small><b>{f3(gap)}</b></div>
      </div>

      <div className={`viz-narr ${narr.tone}`}>{narr.text}</div>
    </VisualizationFrame>
  );
}
