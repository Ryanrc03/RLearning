"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Curve from "@/components/visualization/ml/primitives/Curve";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Marker from "@/components/visualization/ml/primitives/Marker";
import Plot from "@/components/visualization/ml/primitives/Plot";
import Slider from "@/components/visualization/ml/primitives/Slider";
import { powerTwoProportions, requiredSampleSize, simulateAB, zTestTwoProportions } from "@/lib/ml/abtest";
import { createRng } from "@/lib/ml/random";

// Page 5 of Evaluation: control converts at 10%; treatment converts at 10%,
// 11% or 13%. Drag the per-group sample size and watch the two sampling
// distributions pull apart, the p-value drop, and the four steps light up.

const SIZES = [100, 200, 500, 1000, 2000, 5000, 10000, 20000];
const P_A = 0.1;
const EFFECTS: { key: string; label: string; pB: number }[] = [
  { key: "none", label: "其实没区别", pB: 0.1 },
  { key: "one", label: "真的高 1 个点", pB: 0.11 },
  { key: "three", label: "真的高 3 个点", pB: 0.13 },
];
const C_A = "#76796f";
const C_B = "#2a78d6";
const X_DOMAIN: [number, number] = [0.04, 0.18];

function normalPdf(x: number, mean: number, sd: number) {
  const z = (x - mean) / sd;
  return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI));
}

function curve(mean: number, sd: number): (readonly [number, number])[] {
  const pts: (readonly [number, number])[] = [];
  for (let i = 0; i <= 140; i++) {
    const x = X_DOMAIN[0] + ((X_DOMAIN[1] - X_DOMAIN[0]) * i) / 140;
    pts.push([x, normalPdf(x, mean, sd)]);
  }
  return pts;
}

const pct = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`;
const pts = (x: number) => `${Math.round(x * 100)} 个百分点`;

export default function AbTestFigure() {
  const [sizeIdx, setSizeIdx] = useState(3);
  const [effect, setEffect] = useState("one");
  const n = SIZES[sizeIdx];
  const pB = EFFECTS.find((e) => e.key === effect)!.pB;

  const r = useMemo(() => {
    const sim = simulateAB(createRng(40 + sizeIdx * 7 + pB * 1000), P_A, pB, n);
    const test = zTestTwoProportions(sim.xA, n, sim.xB, n);
    const need = pB === P_A ? Infinity : requiredSampleSize(P_A, pB);
    const power = pB === P_A ? 0.05 : powerTwoProportions(P_A, pB, n);
    const sdA = Math.sqrt((P_A * (1 - P_A)) / n);
    const sdB = Math.sqrt((pB * (1 - pB)) / n);
    return { sim, test, need, power, sdA, sdB };
  }, [n, pB, sizeIdx]);

  const yMax = Math.max(normalPdf(P_A, P_A, r.sdA), normalPdf(pB, pB, r.sdB)) * 1.08;
  const significant = r.test.p < 0.05;
  const enough = n >= r.need;

  const narr =
    pB === P_A
      ? significant
        ? `两组其实一模一样，这次抽样却得到 p = ${r.test.p.toFixed(3)} < 0.05。这就是 p-value 的含义：没区别时也有 5% 的机会看到这么大的差，这次正好撞上了。换个样本量再看。`
        : `两组其实一模一样。观测到 A ${pct(r.test.pA)}、B ${pct(r.test.pB)}，差 ${pct(r.test.diff, 2)}，p = ${r.test.p.toFixed(3)}：这么大的差纯靠运气也常出现，不能说 B 更好。`
      : enough
        ? `B 真的比 A 高 ${pts(pB - P_A)}。每组 ${n.toLocaleString()} 人超过了 power analysis 要的 ${r.need.toLocaleString()} 人，两条分布几乎分开，power ${pct(r.power, 0)}。这次观测差 ${pct(r.test.diff, 2)}，p = ${r.test.p < 0.001 ? "< 0.001" : r.test.p.toFixed(3)}${significant ? "，可以下结论" : "，这次运气不好没测出来，但再做几次大多会显著"}。`
        : `B 真的比 A 高 ${pts(pB - P_A)}，但每组只有 ${n.toLocaleString()} 人，power analysis 说至少要 ${r.need.toLocaleString()} 人。两条分布大面积重叠，power 只有 ${pct(r.power, 0)}：${significant ? "这次碰巧显著了（p = " + r.test.p.toFixed(3) + "），但换一批用户多半测不出来" : "p = " + r.test.p.toFixed(3) + "，真有效果也看不出来"}。往右拖。`;

  return (
    <VisualizationFrame
      title="A/B Test：两组转化率的抽样分布，能不能分开"
      description="Control A 的真实转化率 10%，Treatment B 由右边的开关决定。曲线是「每组抽 n 个人时，观测到的转化率会落在哪」；竖点是这次真抽到的值。"
    >
      <div className="viz-row">
        <div className="viz-tabs" role="tablist" aria-label="B 的真实效果">
          {EFFECTS.map((e) => (
            <button key={e.key} type="button" role="tab" aria-selected={effect === e.key} className={`viz-tab${effect === e.key ? " is-on" : ""}`} onClick={() => setEffect(e.key)}>{e.label}</button>
          ))}
        </div>
      </div>
      <Slider label="每组样本量 n" value={sizeIdx} min={0} max={SIZES.length - 1} step={1} onChange={setSizeIdx} display={n.toLocaleString()} id="ab-n" />

      <div className="viz-grid2 wide-left">
        <Figure width={440} height={260} label={`每组 ${n} 人，A 观测 ${pct(r.test.pA)}，B 观测 ${pct(r.test.pB)}，p ${r.test.p.toFixed(3)}`} minWidth={360}>
          <Plot box={{ x: 0, y: 0, w: 440, h: 260 }} xDomain={X_DOMAIN} yDomain={[0, yMax]} xTicks={[0.04, 0.07, 0.1, 0.13, 0.16]} yTicks={[]} xLabel="观测到的转化率" format={(v) => pct(v, 0)}>
            {(f) => (
              <>
                <Curve frame={f} points={curve(P_A, r.sdA)} color={C_A} width={2} area />
                <Curve frame={f} points={curve(pB, r.sdB)} color={C_B} width={2} area />
                <Marker frame={f} x={r.test.pA} y={0} color={C_A} label={`A ${pct(r.test.pA)}`} side={r.test.pA <= r.test.pB ? "left" : "right"} r={4} />
                <Marker frame={f} x={r.test.pB} y={0} color={C_B} label={`B ${pct(r.test.pB)}`} side={r.test.pA <= r.test.pB ? "right" : "left"} r={4} />
              </>
            )}
          </Plot>
        </Figure>
        <div className="viz-stages">
          <div className="viz-stage is-pass"><span className="dot" /><div><b>① 分组</b><small>随机分成 Control A 和 Treatment B，各 {n.toLocaleString()} 人</small></div></div>
          <div className={`viz-stage ${pB === P_A ? "is-skip" : enough ? "is-pass" : "is-ask"}`}><span className="dot" /><div><b>② Power analysis</b><small>{pB === P_A ? "没有真实效果，算不出需要多少样本" : `想以 80% 的把握测出 ${pts(pB - P_A)} 的提升，每组至少 ${r.need.toLocaleString()} 人；现在 power ${pct(r.power, 0)}`}</small></div></div>
          <div className="viz-stage is-pass"><span className="dot" /><div><b>③ 执行</b><small>A 转化 {r.sim.xA.toLocaleString()} 人（{pct(r.test.pA)}），B 转化 {r.sim.xB.toLocaleString()} 人（{pct(r.test.pB)}）</small></div></div>
          <div className={`viz-stage ${significant ? "is-pass" : "is-block"}`}><span className="dot" /><div><b>④ 假设检验</b><small>假设两组没区别，看到这么大差的概率 p = {r.test.p < 0.001 ? "< 0.001" : r.test.p.toFixed(3)}；{significant ? "小于 0.05，差异显著" : "不小于 0.05，不能下结论"}</small></div></div>
        </div>
      </div>

      <div className={`viz-narr${pB === P_A && significant ? " is-bad" : !enough && pB !== P_A ? " is-warn" : significant ? " is-good" : ""}`}>{narr}</div>
    </VisualizationFrame>
  );
}
