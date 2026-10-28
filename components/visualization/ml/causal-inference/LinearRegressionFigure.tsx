"use client";

import { useId, useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Curve from "@/components/visualization/ml/primitives/Curve";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Marker from "@/components/visualization/ml/primitives/Marker";
import Plot from "@/components/visualization/ml/primitives/Plot";
import Slider from "@/components/visualization/ml/primitives/Slider";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import { createRng } from "@/lib/ml/random";
import { interceptThroughMean, makeCorrelated, mean, olsFit, sse } from "@/lib/ml/causal";

// Page 2 of Causal Inference: 20 days of temperature vs bubble-tea sales. The
// slider sets the slope; the intercept always keeps the line through (x̄, ȳ),
// which is where every least-squares line passes. Left: the line and its
// residuals. Right: the sum of squared residuals as a function of the slope, a
// parabola whose bottom is the closed-form OLS slope. "多一个离群天" appends one
// typhoon day and shows how far it drags that bottom.

type Data = "plain" | "outlier";
const DATAS: { key: Data; label: string }[] = [
  { key: "plain", label: "20 天" },
  { key: "outlier", label: "多一个离群天" },
];
const SLOPE_MIN = -5;
const SLOPE_MAX = 25;
const SLOPE_STEP = 0.5;
const STEPS = Math.round((SLOPE_MAX - SLOPE_MIN) / SLOPE_STEP);
const DEFAULT_IDX = Math.round((0 - SLOPE_MIN) / SLOPE_STEP);
const X_DOMAIN: [number, number] = [6, 42];
const Y_DOMAIN: [number, number] = [0, 600];
const OUTLIER = { x: 36, y: 120 };
const C_PT = "#2a78d6";
const C_LINE = "#eb6834";
const C_OLS = "#76796f";
const C_RES = "#eda100";
const C_BAD = "#d03b3b";

const PLAIN = makeCorrelated(createRng(41), 20, 0.8, { mx: 24, sx: 6, my: 300, sy: 80 });
const WITH_OUTLIER = { xs: [...PLAIN.xs, OUTLIER.x], ys: [...PLAIN.ys, OUTLIER.y] };

const f1 = (x: number) => x.toFixed(1);
const f2 = (x: number) => x.toFixed(2);
const fk = (x: number) => `${(x / 1000).toFixed(1)}k`;

export default function LinearRegressionFigure() {
  const [data, setData] = useState<Data>("plain");
  const [idx, setIdx] = useState(DEFAULT_IDX);
  const clipId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const slope = SLOPE_MIN + idx * SLOPE_STEP;
  const { xs, ys } = data === "plain" ? PLAIN : WITH_OUTLIER;

  const r = useMemo(() => {
    const fit = olsFit(xs, ys);
    const intercept = interceptThroughMean(xs, ys, slope);
    const cur = sse(xs, ys, slope, intercept);
    const grid: (readonly [number, number])[] = [];
    for (let i = 0; i <= 60; i++) {
      const b = SLOPE_MIN + ((SLOPE_MAX - SLOPE_MIN) * i) / 60;
      grid.push([b, sse(xs, ys, b, interceptThroughMean(xs, ys, b))]);
    }
    const sseMax = Math.max(...grid.map((g) => g[1]));
    const resid = xs.map((x, i) => ys[i] - (intercept + slope * x));
    const flat = sse(xs, ys, 0, mean(ys));
    return { fit, intercept, cur, grid, sseMax, resid, xbar: mean(xs), ybar: mean(ys), flat, plainFit: olsFit(PLAIN.xs, PLAIN.ys) };
  }, [xs, ys, slope]);

  const big = Math.sqrt(r.fit.sse / xs.length) * 1.5;
  const atOls = Math.abs(slope - r.fit.slope) <= SLOPE_STEP / 2 + 1e-9;
  const nearOls = Math.abs(slope - r.fit.slope) <= 1.5;

  const narr =
    data === "outlier"
      ? atOls || nearOls
        ? `加了一个台风天（36 °C 只卖了 120 杯），最小二乘斜率从 ${f2(r.plainFit.slope)} 掉到 ${f2(r.fit.slope)}，r 从 ${f2(r.plainFit.r)} 掉到 ${f2(r.fit.r)}。一个点的残差平方太大，直线宁可把其他 20 天都拟合差一点，也要往它那边靠。`
        : `加了一个台风天。现在 β₁ = ${f1(slope)}，SSE = ${fk(r.cur)}；谷底在 β̂₁ = ${f2(r.fit.slope)}，比没有这一天时的 ${f2(r.plainFit.slope)} 平了不少。按「最小二乘解」跳过去看看它把线拉到哪。`
      : slope === 0
        ? `β₁ = 0 是一条水平线 ȳ = ${f1(r.ybar)}：不看气温，每天都猜平均数，残差平方和 SSE = ${fk(r.flat)}。这就是不用 x 时的误差，右图的曲线从这里往下走。`
        : atOls
          ? `SSE 到了谷底 ${fk(r.fit.sse)}，这里就是最小二乘解：每升 1 °C 平均多卖 β̂₁ = ${f2(r.fit.slope)} 杯，截距 β̂₀ = ${f1(r.fit.intercept)}。它等于 cov / var，也等于 r · s_y / s_x = ${f2(r.fit.r)} × (s_y / s_x)。R² = ${f2(r.fit.r2)}，比水平线少了这个比例的 SSE。`
          : nearOls
            ? `β₁ = ${f1(slope)}，SSE = ${fk(r.cur)}，离谷底 ${fk(r.fit.sse)} 已经很近。谷附近曲线很平，斜率差 1 的两条线 SSE 差不多，这就是「估计有误差」的几何来源。`
            : `β₁ = ${f1(slope)}，SSE = ${fk(r.cur)}，比水平线${r.cur < r.flat ? "好" : "还差"}。残差的平方是二次的，所以 SSE 对 β₁ 是一条抛物线，往谷底 β̂₁ = ${f2(r.fit.slope)} 拖。`;
  const tone = data === "outlier" ? " is-bad" : atOls ? " is-good" : slope === 0 ? "" : " is-warn";

  const lineY = (x: number) => r.intercept + slope * x;
  const olsY = (x: number) => r.fit.intercept + r.fit.slope * x;

  return (
    <VisualizationFrame
      title="最小二乘：让残差平方和最小的那条线"
      description="左图是 20 天的气温和奶茶销量（模拟数据），橙线是你拖出来的斜率，线始终过 (x̄, ȳ)；竖线是每个点的残差，灰色虚线是最小二乘解。右图是残差平方和 SSE 随斜率变化的曲线。"
    >
      <div className="viz-row">
        <Tabs options={DATAS} value={data} onChange={setData} ariaLabel="数据" />
        <button type="button" className="viz-btn primary" onClick={() => setIdx(Math.round((Math.min(SLOPE_MAX, Math.max(SLOPE_MIN, r.fit.slope)) - SLOPE_MIN) / SLOPE_STEP))}>最小二乘解</button>
        <button type="button" className="viz-btn" onClick={() => { setData("plain"); setIdx(DEFAULT_IDX); }}>重置</button>
      </div>
      <Slider label="斜率 β₁（杯 / °C）" value={idx} min={0} max={STEPS} step={1} onChange={setIdx} display={f1(slope)} id="ols-slope" />

      <Figure width={720} height={320} label={`β₁ = ${f1(slope)}，SSE = ${fk(r.cur)}，最小二乘 β̂₁ = ${f2(r.fit.slope)}`} minWidth={520}>
        <Plot box={{ x: 0, y: 0, w: 400, h: 320 }} xDomain={X_DOMAIN} yDomain={Y_DOMAIN} xTicks={[10, 20, 30, 40]} yTicks={[0, 150, 300, 450, 600]} xLabel="气温 (°C)" yLabel="奶茶日销量 (杯)" format={(v) => String(Math.round(v))}>
          {(f) => (
            <>
              <defs>
                <clipPath id={clipId}>
                  <rect x={f.x0} y={f.y1} width={f.x1 - f.x0} height={f.y0 - f.y1} />
                </clipPath>
              </defs>
              <g clipPath={`url(#${clipId})`}>
                <line x1={f.x(X_DOMAIN[0])} y1={f.y(olsY(X_DOMAIN[0]))} x2={f.x(X_DOMAIN[1])} y2={f.y(olsY(X_DOMAIN[1]))} stroke={C_OLS} strokeWidth={1.2} strokeDasharray="5 4" opacity={0.7} />
                {xs.map((x, i) => (
                  <line key={`r${i}`} x1={f.x(x)} y1={f.y(ys[i])} x2={f.x(x)} y2={f.y(lineY(x))} stroke={Math.abs(r.resid[i]) > big ? C_BAD : C_RES} strokeWidth={1.4} opacity={0.8} style={{ transition: "y2 .25s" }} />
                ))}
                <line x1={f.x(X_DOMAIN[0])} y1={f.y(lineY(X_DOMAIN[0]))} x2={f.x(X_DOMAIN[1])} y2={f.y(lineY(X_DOMAIN[1]))} stroke={C_LINE} strokeWidth={2.2} style={{ transition: "y1 .25s, y2 .25s" }} />
              </g>
              {xs.map((x, i) => (
                <circle key={`p${i}`} cx={f.x(x)} cy={f.y(ys[i])} r={data === "outlier" && i === xs.length - 1 ? 5 : 3.6} fill={data === "outlier" && i === xs.length - 1 ? C_BAD : C_PT} opacity={0.8} />
              ))}
              {data === "outlier" && <text x={f.x(OUTLIER.x) - 8} y={f.y(OUTLIER.y) + 4} fontSize={11} textAnchor="end" fill={C_BAD}>台风天</text>}
              <circle cx={f.x(r.xbar)} cy={f.y(r.ybar)} r={4.5} fill="#fff" stroke="#30332c" strokeWidth={1.4} />
              <text x={f.x(r.xbar) + 8} y={f.y(r.ybar) - 7} fontSize={11} fill="#30332c" className="mono">(x̄, ȳ)</text>
            </>
          )}
        </Plot>
        <Plot box={{ x: 410, y: 0, w: 310, h: 320 }} xDomain={[SLOPE_MIN, SLOPE_MAX]} yDomain={[0, r.sseMax * 1.05]} xTicks={[-5, 0, 5, 10, 15, 20, 25]} yTicks={[0, r.sseMax * 0.5, r.sseMax]} xLabel="斜率 β₁" yLabel="残差平方和 SSE" format={fk} xFormat={(v) => String(v)}>
          {(f) => (
            <>
              <Curve frame={f} points={r.grid} color={C_OLS} width={1.8} />
              <line x1={f.x(r.fit.slope)} y1={f.y0} x2={f.x(r.fit.slope)} y2={f.y(r.fit.sse)} stroke={C_OLS} strokeWidth={1} strokeDasharray="3 3" />
              <text x={f.x(r.fit.slope)} y={f.y(r.fit.sse) - 10} fontSize={11} textAnchor="middle" fill={C_OLS} className="mono">β̂₁ {f2(r.fit.slope)}</text>
              <Marker frame={f} x={slope} y={r.cur} color={C_LINE} label={fk(r.cur)} side={slope > 12 ? "left" : "right"} r={4.5} />
            </>
          )}
        </Plot>
      </Figure>

      <div className="viz-stat" style={{ marginTop: 12 }}>
        <div><small>当前 β₁</small><b>{f1(slope)}</b></div>
        <div><small>当前 β₀ = ȳ − β₁ x̄</small><b>{f1(r.intercept)}</b></div>
        <div><small>当前 SSE</small><b>{fk(r.cur)}</b></div>
        <div><small>最小二乘 β̂₁</small><b>{f2(r.fit.slope)}</b></div>
        <div><small>r</small><b>{f2(r.fit.r)}</b></div>
        <div><small>R² = 1 − SSE_min / SSE_水平</small><b>{f2(r.fit.r2)}</b></div>
      </div>

      <div className={`viz-narr${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}
