"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Plot from "@/components/visualization/ml/primitives/Plot";
import Slider from "@/components/visualization/ml/primitives/Slider";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import { createRng, randomNormal } from "@/lib/ml/random";
import { covariance, makeConfounded, makeUShape, olsFit, partialCorrelation, pearson, rotateToCorrelation, sd } from "@/lib/ml/causal";

// Page 1 of Causal Inference. 线性: one seeded cloud of 40 (u, e) pairs is
// rotated to the target r, so dragging the slider turns the same points instead
// of redrawing them. U 形: y is a function of x and r is still ≈ 0. 有混杂:
// ice cream and drownings both follow temperature; the partial correlation
// given temperature is what is left of r once that is held fixed.

type Scene = "linear" | "ushape" | "confounded";
const SCENES: { key: Scene; label: string }[] = [
  { key: "linear", label: "线性" },
  { key: "ushape", label: "U 形" },
  { key: "confounded", label: "有混杂：冰淇淋与溺水" },
];
const DEFAULT_R = 0.7;
const N_LINEAR = 40;
const SCALE = { mx: 24, sx: 6, my: 300, sy: 80 };
const C_PT = "#2a78d6";
const C_LINE = "#76796f";
const C_COLD = "#2a78d6";
const C_HOT = "#eb6834";

const BASE = (() => {
  const rng = createRng(31);
  const u = Array.from({ length: N_LINEAR }, () => randomNormal(rng));
  const e = Array.from({ length: N_LINEAR }, () => randomNormal(rng));
  return { u, e };
})();
const USHAPE = makeUShape(createRng(32), 40);
const CONF = makeConfounded(createRng(33), 60);

const f2 = (x: number) => x.toFixed(2);
const f1 = (x: number) => x.toFixed(1);
const signed2 = (x: number) => `${x < 0 ? "−" : "+"}${Math.abs(x).toFixed(2)}`;

// Blend two hex colours; t ∈ [0, 1].
function mix(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(",")})`;
}

export default function CorrelationFigure() {
  const [scene, setScene] = useState<Scene>("linear");
  const [rIdx, setRIdx] = useState(Math.round((DEFAULT_R + 1) / 0.05));
  const targetR = -1 + rIdx * 0.05;

  const linear = useMemo(() => {
    const xy = rotateToCorrelation(BASE, targetR, SCALE);
    return { ...xy, r: pearson(xy.xs, xy.ys), cov: covariance(xy.xs, xy.ys), sx: sd(xy.xs), sy: sd(xy.ys), fit: olsFit(xy.xs, xy.ys) };
  }, [targetR]);
  const ushape = useMemo(() => ({ ...USHAPE, r: pearson(USHAPE.xs, USHAPE.ys), fit: olsFit(USHAPE.xs, USHAPE.ys) }), []);
  const conf = useMemo(() => {
    const rxy = pearson(CONF.xs, CONF.ys);
    const rxz = pearson(CONF.xs, CONF.zs);
    const ryz = pearson(CONF.ys, CONF.zs);
    const partial = partialCorrelation(CONF.xs, CONF.ys, CONF.zs);
    const zMin = Math.min(...CONF.zs);
    const zMax = Math.max(...CONF.zs);
    return { ...CONF, rxy, rxz, ryz, partial, zMin, zMax, fit: olsFit(CONF.xs, CONF.ys) };
  }, []);

  const reset = () => {
    setScene("linear");
    setRIdx(Math.round((DEFAULT_R + 1) / 0.05));
  };

  const absR = Math.abs(linear.r);
  const narr =
    scene === "linear"
      ? absR > 0.95
        ? `目标 r = ${f2(targetR)}，算出来 r = ${f2(linear.r)}：点几乎全在一条直线上。注意 r 只说「贴得多紧」，不说斜率多陡，把纵轴单位换成「打」而不是「杯」，r 一点不变。`
        : absR < 0.15
          ? `目标 r = ${f2(targetR)}，算出来 r = ${f2(linear.r)}：云团是圆的，知道今天多少度对猜销量几乎没有帮助。cov = ${f1(linear.cov)}，正负项相互抵消。`
          : `目标 r = ${f2(targetR)}，算出来 r = ${f2(linear.r)}（40 个点的样本 r 和目标差一点是正常的）。cov = ${f1(linear.cov)} 除以 s_x · s_y = ${f1(linear.sx)} × ${f1(linear.sy)}，就是 r。${linear.r > 0 ? "气温高的日子销量也高" : "气温高的日子销量反而低"}，但这张图说不出是谁导致谁。`
      : scene === "ushape"
        ? `y 完全由 x 决定（y ≈ x²），但 r = ${f2(ushape.r)}：左半边 x 升 y 降，右半边 x 升 y 升，cov 里的正负项抵消了。r 只量直线关系，r ≈ 0 不等于没关系。`
        : `冰淇淋销量和溺水人数 r = ${f2(conf.rxy)}，看起来关系不小。但两者都跟着气温走：r(冰淇淋, 气温) = ${f2(conf.rxz)}，r(溺水, 气温) = ${f2(conf.ryz)}。把气温固定住再看，偏相关 r(x, y | z) = ${f2(conf.partial)}，几乎没有了。r = ${f2(conf.rxy)} 不等于冰淇淋导致溺水。`;
  const tone = scene === "linear" ? " is-good" : scene === "ushape" ? " is-warn" : " is-bad";

  const label =
    scene === "linear"
      ? `线性：目标 r ${f2(targetR)}，算出 r ${f2(linear.r)}`
      : scene === "ushape"
        ? `U 形：r ${f2(ushape.r)}`
        : `有混杂：r ${f2(conf.rxy)}，控制气温后 ${f2(conf.partial)}`;

  return (
    <VisualizationFrame
      title="Pearson r：点有多贴近一条直线"
      description="左图是散点和最小二乘直线（浅灰）。线性情景里拖 r，同一批点会绕着中心转；另外两个情景是 r 说不出的两种情况。所有数字都从图里的点算出来。"
    >
      <div className="viz-row">
        <Tabs options={SCENES} value={scene} onChange={setScene} ariaLabel="情景" />
        <button type="button" className="viz-btn" onClick={reset}>重置</button>
      </div>
      {scene === "linear" ? (
        <Slider label="目标 r" value={rIdx} min={0} max={40} step={1} onChange={setRIdx} display={f2(targetR)} id="corr-r" />
      ) : (
        <p className="viz-k" style={{ marginBottom: 12 }}>这个情景的点是固定的，r 由点算出，没有可拖的目标值。</p>
      )}

      <Figure width={720} height={320} label={label} minWidth={520}>
        {scene === "linear" && (
          <Plot box={{ x: 0, y: 0, w: 440, h: 320 }} xDomain={[6, 42]} yDomain={[50, 550]} xTicks={[10, 20, 30, 40]} yTicks={[100, 200, 300, 400, 500]} xLabel="气温 (°C)" yLabel="奶茶日销量 (杯)" format={(v) => String(Math.round(v))}>
            {(f) => (
              <>
                <line x1={f.x(6)} y1={f.y(linear.fit.intercept + linear.fit.slope * 6)} x2={f.x(42)} y2={f.y(linear.fit.intercept + linear.fit.slope * 42)} stroke={C_LINE} strokeWidth={1.2} opacity={0.5} style={{ transition: "y1 .3s, y2 .3s" }} />
                {linear.xs.map((x, i) => (
                  <circle key={i} cx={f.x(x)} cy={f.y(linear.ys[i])} r={3.6} fill={C_PT} opacity={0.75} style={{ transition: "cy .3s" }} />
                ))}
                <circle cx={f.x(SCALE.mx)} cy={f.y(SCALE.my)} r={4} fill="none" stroke="#30332c" strokeWidth={1.4} />
                <text x={f.x(SCALE.mx) + 7} y={f.y(SCALE.my) - 6} fontSize={11} fill="#30332c" className="mono">(x̄, ȳ)</text>
              </>
            )}
          </Plot>
        )}
        {scene === "ushape" && (
          <Plot box={{ x: 0, y: 0, w: 440, h: 320 }} xDomain={[-2.4, 2.4]} yDomain={[-1, 5]} xTicks={[-2, -1, 0, 1, 2]} yTicks={[0, 1, 2, 3, 4]} xLabel="x" yLabel="y ≈ x²">
            {(f) => (
              <>
                <line x1={f.x(-2.4)} y1={f.y(ushape.fit.intercept + ushape.fit.slope * -2.4)} x2={f.x(2.4)} y2={f.y(ushape.fit.intercept + ushape.fit.slope * 2.4)} stroke={C_LINE} strokeWidth={1.2} opacity={0.5} />
                {ushape.xs.map((x, i) => (
                  <circle key={i} cx={f.x(x)} cy={f.y(ushape.ys[i])} r={3.6} fill={C_PT} opacity={0.75} />
                ))}
              </>
            )}
          </Plot>
        )}
        {scene === "confounded" && (
          <Plot box={{ x: 0, y: 0, w: 440, h: 320 }} xDomain={[0, 320]} yDomain={[0, 12]} xTicks={[0, 100, 200, 300]} yTicks={[0, 3, 6, 9, 12]} xLabel="当日冰淇淋销量 (份)" yLabel="当日溺水人数" format={(v) => String(Math.round(v))}>
            {(f) => (
              <>
                <line x1={f.x(0)} y1={f.y(conf.fit.intercept)} x2={f.x(320)} y2={f.y(conf.fit.intercept + conf.fit.slope * 320)} stroke={C_LINE} strokeWidth={1.2} opacity={0.5} />
                {conf.xs.map((x, i) => {
                  const t = (conf.zs[i] - conf.zMin) / (conf.zMax - conf.zMin || 1);
                  return <circle key={i} cx={f.x(Math.max(0, x))} cy={f.y(Math.max(0, conf.ys[i]))} r={3.8} fill={mix(C_COLD, C_HOT, t)} opacity={0.85} />;
                })}
              </>
            )}
          </Plot>
        )}

        <g transform="translate(470 0)">
          <text x={0} y={22} fontSize={12.5} fontWeight={600} fill="#30332c">{scene === "linear" ? "从这 40 个点算出" : scene === "ushape" ? "从这 40 个点算出" : "从这 60 天算出"}</text>
          {(scene === "linear"
            ? [
                ["目标 r（滑块）", f2(targetR)],
                ["cov(x, y)", f1(linear.cov)],
                ["s_x（气温）", f1(linear.sx)],
                ["s_y（销量）", f1(linear.sy)],
                ["r = cov / (s_x s_y)", f2(linear.r)],
                ["r²", f2(linear.r * linear.r)],
              ]
            : scene === "ushape"
              ? [
                  ["r", f2(ushape.r)],
                  ["r²", f2(ushape.r * ushape.r)],
                  ["最小二乘斜率", signed2(ushape.fit.slope)],
                ]
              : [
                  ["r(冰淇淋, 溺水)", f2(conf.rxy)],
                  ["r(冰淇淋, 气温)", f2(conf.rxz)],
                  ["r(溺水, 气温)", f2(conf.ryz)],
                  ["偏相关 r(x, y | 气温)", f2(conf.partial)],
                ]
          ).map(([k, v], i) => (
            <g key={k} transform={`translate(0 ${44 + i * 30})`}>
              <text x={0} y={0} fontSize={11.5} fill="#76796f">{k}</text>
              <text x={240} y={0} fontSize={13} fontWeight={600} textAnchor="end" fill="#30332c" className="mono">{v}</text>
              <line x1={0} y1={8} x2={240} y2={8} stroke="#e4dfcb" />
            </g>
          ))}
          {scene === "confounded" && (
            <g transform="translate(0 190)">
              <text x={0} y={0} fontSize={11.5} fill="#76796f">点的颜色 = 当天气温</text>
              {Array.from({ length: 20 }, (_, i) => (
                <rect key={i} x={i * 10} y={8} width={10} height={10} fill={mix(C_COLD, C_HOT, i / 19)} />
              ))}
              <text x={0} y={32} fontSize={11} fill="#76796f" className="mono">{f1(conf.zMin)} °C</text>
              <text x={200} y={32} fontSize={11} fill="#76796f" textAnchor="end" className="mono">{f1(conf.zMax)} °C</text>
            </g>
          )}
        </g>
      </Figure>

      <div className={`viz-narr${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}
