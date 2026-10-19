"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Curve from "@/components/visualization/ml/primitives/Curve";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Marker from "@/components/visualization/ml/primitives/Marker";
import Plot from "@/components/visualization/ml/primitives/Plot";
import Slider from "@/components/visualization/ml/primitives/Slider";
import { HARNESS_PRESETS, type HarnessPreset, PAGE_MIX, RULE_GATE, VLM_GATE, yieldCurve } from "@/lib/ml/harness";

// Page 5 of LLM Engineering: a generated web page goes through cheap rule checks,
// then a VLM quality gate, and is regenerated on failure. Drag the retry budget
// and watch good-page yield climb from 60% towards the gate's precision while the
// cost per good page creeps up. Every number comes from lib/ml/harness.ts.

const W = 720;
const H = 290;
const MAX_K = 5;
const PRESETS: { key: HarnessPreset; label: string; color: string }[] = [
  { key: "layered", label: "规则 → VLM 质量门", color: "#2a78d6" },
  { key: "vlmOnly", label: "只有 VLM 质量门", color: "#eb6834" },
  { key: "none", label: "没有门控", color: "#76796f" },
];
const WHEEL = ["线上日志", "自动标注 + 抽检", "SFT", "Eval Harness", "上线"];

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

export default function EvalHarnessFigure() {
  const [k, setK] = useState(2);
  const [preset, setPreset] = useState<HarnessPreset>("layered");
  const curves = useMemo(
    () => Object.fromEntries(PRESETS.map((p) => [p.key, yieldCurve(PAGE_MIX, HARNESS_PRESETS[p.key], MAX_K)])) as Record<HarnessPreset, ReturnType<typeof yieldCurve>>,
    [],
  );
  const r = curves[preset][k];
  const r0 = curves[preset][0];
  const gates = HARNESS_PRESETS[preset];
  const hasRule = gates.includes(RULE_GATE);
  const hasVlm = gates.includes(VLM_GATE);
  const ruleStage = r.stages.find((s) => s.name === RULE_GATE.name);
  const vlmStage = r.stages.find((s) => s.name === VLM_GATE.name);
  const color = PRESETS.find((p) => p.key === preset)!.color;
  const maxCost = Math.max(...PRESETS.flatMap((p) => curves[p.key].map((x) => x.costPerGood)));
  const costTop = Math.ceil(maxCost * 2) / 2;

  const reset = () => {
    setK(2);
    setPreset("layered");
  };

  const nextGain = k < MAX_K ? curves[preset][k + 1].goodYield - r.goodYield : 0;
  let tone: "good" | "bad" | "warn" | "mid" = "mid";
  let narr: string;
  if (preset === "none") {
    tone = "bad";
    narr = `没有门控就没有「不合格」这个信号，重试次数拖到多少都没用：交付出去的页面里永远只有 ${pct(r.goodYield)} 是好的，剩下 25% 文字溢出、15% 排版难看，全靠用户发现。每张好页面的成本 ${r.costPerGood.toFixed(2)} 看起来最便宜，那是因为坏页面的代价被转嫁给了用户。`;
  } else if (k === 0) {
    tone = "warn";
    narr = `只判不重试：门控把坏页面挑出来了（一次通过率 ${pct(r.accept)}），但挑出来之后没有第二次机会，只能照样交付，优质率还是 ${pct(r.goodYield)}。门控的价值要靠「不合格就重生成」兑现，往右拖一格看看。这时每张好页面成本 ${r.costPerGood.toFixed(2)}，比不设门控还贵：只判不重来，门控就是纯成本。`;
  } else if (preset === "vlmOnly") {
    tone = "warn";
    narr = `只用 VLM：每次生成都要付一次 VLM 的钱（每次尝试 ${r.cost.toFixed(2)}），而 VLM 对文字溢出这种像素级问题只抓到 60%，放过去的坏页面直接混进了「通过」里。最多重试 ${k} 次，优质率 ${pct(r.goodYield)}，封顶也只有 ${pct(r.precision)}；同样的预算，规则在前的版本是 ${pct(curves.layered[k].goodYield)}。`;
  } else {
    tone = k >= 2 ? "good" : "mid";
    narr = `最多重试 ${k} 次：一次通过率 ${pct(r.accept)}，${k + 1} 次以内通过的概率 ${pct(r.passedWithin)}，交付的优质率从 ${pct(r0.goodYield)} 涨到 ${pct(r.goodYield)}；平均生成 ${r.expectedAttempts.toFixed(2)} 次，每张好页面成本 ${r.costPerGood.toFixed(2)}（以一次生成为 1）。${k < MAX_K ? `再加一次重试只多 ${(nextGain * 100).toFixed(1)} 个百分点，` : ""}上限是门控的 precision ${pct(r.precision)}：门控放过的坏页面，重试多少次也救不回来。`;
  }

  return (
    <VisualizationFrame
      title="生成后的分层门控：便宜的规则在前，模型判断在后，不合格就重来"
      description="每次生成一张网页：60% 是好的，25% 有规则能查出的硬伤（文字溢出、字段缺失），15% 有只能靠看的毛病（排版难看、内容跑题）。规则检查几乎不要钱、查得准；VLM 每次 0.3 次生成的成本，会误杀 5% 的好页面。拖动重试上限，切换门控的组合。"
    >
      <Slider label="最多重试次数" value={k} min={0} max={MAX_K} step={1} onChange={setK} display={`${k} 次`} id="harness-k" />
      <div className="viz-row">
        <div className="viz-chips" role="group" aria-label="门控组合">
          {PRESETS.map((p) => (
            <button key={p.key} type="button" className={`viz-chip${preset === p.key ? " is-on" : ""}`} onClick={() => setPreset(p.key)} aria-pressed={preset === p.key}>
              {p.label}
            </button>
          ))}
        </div>
        <button type="button" className="viz-btn" onClick={reset}>重置</button>
      </div>

      <div className="harness-flow">
        <div className="harness-step">
          <h6>① 生成</h6>
          <b>{pct(PAGE_MIX.good)}</b>
          <small>原始输出里好的比例</small>
        </div>
        <span className="harness-arrow" aria-hidden="true">→</span>
        <div className={`harness-step${hasRule ? "" : " is-off"}`}>
          <h6>② 规则检查</h6>
          <b>{ruleStage ? `通过 ${pct(ruleStage.passRate)}` : "未启用"}</b>
          <small>溢出、JSON、必填字段；成本 {RULE_GATE.cost}</small>
        </div>
        <span className="harness-arrow" aria-hidden="true">→</span>
        <div className={`harness-step${hasVlm ? "" : " is-off"}`}>
          <h6>③ VLM 质量门</h6>
          <b>{vlmStage ? `通过 ${pct(vlmStage.passRate)}` : "未启用"}</b>
          <small>{vlmStage ? `只看到 ${pct(vlmStage.reached)} 的页面；成本 ${VLM_GATE.cost}` : "规则判不了的交给它"}</small>
        </div>
        <span className="harness-arrow" aria-hidden="true">→</span>
        <div className={`harness-step${preset !== "none" && k > 0 ? " is-loop" : " is-off"}`}>
          <h6>④ 不合格重生成</h6>
          <b>≤ {k} 次</b>
          <small>平均生成 {r.expectedAttempts.toFixed(2)} 次</small>
        </div>
      </div>

      <Figure width={W} height={H} label={`最多重试 ${k} 次，优质率 ${pct(r.goodYield)}，每张好页面成本 ${r.costPerGood.toFixed(2)}`}>
        <Plot box={{ x: 0, y: 0, w: W / 2, h: H }} xDomain={[0, MAX_K]} yDomain={[50, 100]} xTicks={[0, 1, 2, 3, 4, 5]} yTicks={[50, 60, 70, 80, 90, 100]} xLabel="最多重试次数" yLabel="交付的优质率 %" title="优质率" format={(v) => String(v)}>
          {(f) => (
            <>
              <line x1={f.x0} x2={f.x1} y1={f.y(r.precision * 100)} y2={f.y(r.precision * 100)} stroke={color} strokeDasharray="3 4" opacity={preset === "none" ? 0 : 0.6} />
              {PRESETS.map((p) => (
                <Curve key={p.key} frame={f} points={curves[p.key].map((x, i) => [i, x.goodYield * 100] as const)} color={p.color} width={p.key === preset ? 2.5 : 1.5} opacity={p.key === preset ? 1 : 0.35} dashed={p.key !== preset} />
              ))}
              <Marker frame={f} x={k} y={r.goodYield * 100} color={color} label={pct(r.goodYield)} side={k >= 4 ? "left" : "below"} guides />
            </>
          )}
        </Plot>
        <Plot box={{ x: W / 2, y: 0, w: W / 2, h: H }} xDomain={[0, MAX_K]} yDomain={[0, costTop]} xTicks={[0, 1, 2, 3, 4, 5]} yTicks={Array.from({ length: costTop * 2 + 1 }, (_, i) => i / 2)} xLabel="最多重试次数" yLabel="每张好页面的成本" title="成本（一次生成 = 1）" format={(v) => (Number.isInteger(v) ? String(v) : v.toFixed(1))}>
          {(f) => (
            <>
              {PRESETS.map((p) => (
                <Curve key={p.key} frame={f} points={curves[p.key].map((x, i) => [i, x.costPerGood] as const)} color={p.color} width={p.key === preset ? 2.5 : 1.5} opacity={p.key === preset ? 1 : 0.35} dashed={p.key !== preset} />
              ))}
              <Marker frame={f} x={k} y={r.costPerGood} color={color} label={r.costPerGood.toFixed(2)} side={k >= 4 ? "left" : "above"} guides />
            </>
          )}
        </Plot>
      </Figure>
      <div className="viz-legend">
        {PRESETS.map((p) => (
          <span key={p.key}><i style={{ background: p.color }} />{p.label}</span>
        ))}
        <span className="viz-k">虚线横线是门控的 precision：优质率的天花板</span>
      </div>

      <div className="viz-stat" style={{ marginTop: 12 }}>
        <div><small>一次通过率</small><b>{pct(r.accept)}</b></div>
        <div><small>通过里真好的（precision）</small><b>{pct(r.precision)}</b></div>
        <div><small>交付的优质率</small><b style={{ color: "#087a08" }}>{pct(r.goodYield)}</b><span className="delta">不重试 {pct(r0.goodYield)}</span></div>
        <div><small>每张好页面成本</small><b>{r.costPerGood.toFixed(2)}</b><span className="delta">每次尝试 {r.cost.toFixed(2)}</span></div>
      </div>

      <div className="harness-wheel" aria-label="数据飞轮">
        <b style={{ fontWeight: 600 }}>数据飞轮：</b>
        {WHEEL.map((w) => (
          <span key={w} className={w === "Eval Harness" ? "is-here" : undefined}>{w}</span>
        )).flatMap((el, i) => (i === 0 ? [el] : [<i key={`a${i}`}>→</i>, el]))}
        <i>↺ 回到线上日志</i>
      </div>

      <div className={`viz-narr${tone === "good" ? " is-good" : tone === "bad" ? " is-bad" : tone === "warn" ? " is-warn" : ""}`}>{narr}</div>
    </VisualizationFrame>
  );
}
