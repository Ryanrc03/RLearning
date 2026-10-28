"use client";

import { useRef, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import Bars from "@/components/visualization/ml/primitives/Bars";
import { createRng } from "@/lib/ml/random";
import { aggregateExperts, DEMO_EXPERTS, drawGateMask, invertedGateDropout, type GateMask } from "@/lib/ml/mmoe";

const rate = 0.1;
const seed = 20261027;
const colors = ["var(--v1)", "var(--v3)", "var(--v4)"];
const vector = (v: number[]) => `[${v.map((n) => n.toFixed(4)).join(", ")}]`;

export default function GateDropoutFigure() {
  const [preset, setPreset] = useState<"balanced" | "polarized">("polarized");
  const [mask, setMask] = useState<GateMask>([1, 1, 0]);
  const [draws, setDraws] = useState(0);
  const rng = useRef(createRng(seed));
  const gate = preset === "balanced" ? [0.3, 0.4, 0.3] : [0.01, 0.01, 0.98];
  const dropped = invertedGateDropout(gate, mask, rate);
  const total = dropped.reduce((s, g) => s + g, 0);
  const hidden = aggregateExperts(DEMO_EXPERTS, dropped);
  const rows = (values: number[]) => values.map((g, i) => ({ label: `Expert ${i + 1}`, value: g, max: 1 / (1 - rate), color: colors[i], text: g.toFixed(4) }));
  return <div className="ranking-viz mmoe-viz">
    <VisualizationFrame title="Gate 极化与 Dropout：屏蔽权重，不删除专家" description="固定 r = 0.1。两组柱使用同一刻度 0–1.1111，可容纳 inverted dropout 放大后的权重；不做二次归一化。">
      <div className="viz-row">
        <Tabs options={[{ key: "balanced", label: "正常 [0.3, 0.4, 0.3]" }, { key: "polarized", label: "极化 [0.01, 0.01, 0.98]" }]} value={preset} onChange={setPreset} ariaLabel="Gate 分布示例" />
      </div>
      <div className="viz-row">
        <button type="button" className="viz-btn" onClick={() => { setMask(drawGateMask(3, rate, rng.current)); setDraws((n) => n + 1); }}>生成一次随机 Mask</button>
        <button type="button" className="viz-btn" onClick={() => { setPreset("polarized"); setMask([1, 1, 0]); setDraws(0); rng.current = createRng(seed); }}>重置</button>
        <span className="viz-k">{draws === 0 ? "初始为手选示例 mask，尚未随机采样" : `固定种子 · 第 ${draws} 次随机采样`}</span>
      </div>
      <div className="ranking-equation">m = [{mask.join(", ")}] · 保留缩放 1/(1 − r) = {(1 / (1 - rate)).toFixed(4)}</div>
      <div className="viz-grid2">
        <div className="viz-panel"><h5>原始 Gate · 推理时使用</h5><Bars rows={rows(gate)} /><div className="mmoe-gap">Σg = {gate.reduce((s, p) => s + p, 0).toFixed(4)}</div></div>
        <div className="viz-panel"><h5>训练时的一次 Dropout</h5><Bars rows={rows(dropped)} /><div className="mmoe-gap">Σg̃ = {total.toFixed(4)}</div></div>
      </div>
      <div className="ranking-equation">g̃ = {vector(dropped)}<br />h̃ = Σg̃ᵢeᵢ = {vector(hidden)}</div>
      <div className="viz-narr" aria-live="polite">
        {total === 0 ? "本次 3 个权重全部被屏蔽，聚合向量是零向量；标准 dropout 不会强制重抽或留下一个专家。" : mask[2] === 0 && preset === "polarized" ? "占 98% 的 Expert 3 被屏蔽，其余两个权重仅各乘 1/0.9，没有瓜分原来的 98%；聚合向量会明显缩小。" : `本次保留 ${mask.reduce<number>((s, m) => s + m, 0)} 个权重，权重和是 ${total.toFixed(4)}，不必等于 1。`}
        {" "}每次独立采样都可能再次抽到相同 mask。只有权重的期望保持 E[g̃ᵢ] = gᵢ；非线性 Task Tower 的预测不保证期望不变。
      </div>
    </VisualizationFrame>
  </div>;
}
