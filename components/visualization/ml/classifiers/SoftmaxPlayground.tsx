"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Bars from "@/components/visualization/ml/primitives/Bars";
import Slider from "@/components/visualization/ml/primitives/Slider";
import { sigmoid, softmax } from "@/lib/ml/linear";

const NAMES = ["Cat", "Dog", "Bird"];
const COLORS = ["var(--v1)", "var(--v3)", "var(--v4)"];
const INITIAL = [2, 1, 0];
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const rows = (values: number[]) => values.map((value, index) => ({
  label: NAMES[index], value, color: COLORS[index], text: value.toFixed(3),
}));

export default function SoftmaxPlayground({ competition = false }: { competition?: boolean }) {
  const [logits, setLogits] = useState(competition ? [2, 0, 0] : INITIAL);
  const probabilities = softmax(logits);
  const independent = logits.map(sigmoid);
  const exponentials = logits.map(Math.exp);
  function update(index: number, value: number) {
    if (!Number.isFinite(value)) return;
    setLogits((current) => current.map((previous, i) => i === index ? Math.max(-5, Math.min(5, value)) : previous));
  }

  return (
    <VisualizationFrame
      title={competition ? "只改 Dog，观察 Cat 的概率" : "从三个分数到三个概率"}
      description={competition ? "Cat 的 logit 固定为 2，Bird 固定为 0。两边使用相同的 logits。" : "拖动任意一类的 logit，查看指数、分母和概率怎样变化。"}
    >
      <div className="viz-controls">
        {(competition ? [1] : [0, 1, 2]).map((index) => (
          <Slider key={index} label={NAMES[index] + " logit"} value={logits[index]} min={-5} max={5} step={0.1}
            onChange={(value) => update(index, value)} display={logits[index].toFixed(1)} />
        ))}
        <button type="button" className="viz-btn" onClick={() => setLogits(competition ? [2, 0, 0] : INITIAL)}>重置</button>
      </div>
      {competition ? (
        <div className="viz-grid2">
          <div className="viz-panel">
            <h5>Softmax · 互斥类别</h5>
            <Bars rows={rows(probabilities)} />
            <p className="viz-k">概率总和 = {sum(probabilities).toFixed(3)}</p>
          </div>
          <div className="viz-panel">
            <h5>独立 Sigmoid · 可共存标签</h5>
            <Bars rows={rows(independent)} />
            <p className="viz-k">各标签概率之和 = {sum(independent).toFixed(3)}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="viz-scroll">
            <table className="viz-table">
              <thead><tr><th scope="col">类别</th><th scope="col">logit z</th><th scope="col">exp(z)</th><th scope="col">exp(z) / 总和</th></tr></thead>
              <tbody>{NAMES.map((name, i) => (
                <tr key={name}><th scope="row">{name}</th><td>{logits[i].toFixed(1)}</td><td>{exponentials[i].toFixed(3)}</td><td>{probabilities[i].toFixed(3)}</td></tr>
              ))}</tbody>
            </table>
          </div>
          <p className="viz-k">指数总和 = {sum(exponentials).toFixed(3)} · 概率总和 = {sum(probabilities).toFixed(3)}</p>
          <Bars rows={rows(probabilities)} />
        </>
      )}
      <div className="viz-narr" aria-live="polite">
        {competition
          ? "logits = [" + logits.join(", ") + "]。Softmax 的 Cat 概率是 " + probabilities[0].toFixed(3) + "，会随 Dog 改变；独立 Sigmoid 的 Cat 概率始终是 σ(2) = " + independent[0].toFixed(3) + "。"
          : "最大的分数来自 " + NAMES[logits.indexOf(Math.max(...logits))] + "，得到的概率为 " + Math.max(...probabilities).toFixed(3) + "。显示值经过四舍五入，未舍入的概率之和为 1。"}
      </div>
    </VisualizationFrame>
  );
}

export function SoftmaxStabilityFigure() {
  const [offset, setOffset] = useState(1000);
  const logits = INITIAL.map((value) => value + offset);
  const naiveWeights = logits.map(Math.exp);
  const denominator = sum(naiveWeights);
  const stable = softmax(logits);
  const format = (value: number) => Number.isNaN(value) ? "未定义（∞ / ∞）" : value.toFixed(3);

  return (
    <VisualizationFrame title="整体加 1000，概率应该相同" description="改变公共偏移，比较直接取指数和先减最大值的计算。">
      <div className="viz-controls">
        <Slider label="公共偏移 c" value={offset} min={0} max={1000} step={10} display={String(offset)}
          onChange={(value) => { if (Number.isFinite(value)) setOffset(Math.max(0, Math.min(1000, value))); }} />
        <button type="button" className="viz-btn" onClick={() => setOffset(1000)}>重置</button>
      </div>
      <div className="viz-scroll">
        <table className="viz-table">
          <thead><tr><th scope="col">类别</th><th scope="col">logit</th><th scope="col">朴素 Softmax</th><th scope="col">稳定 Softmax</th></tr></thead>
          <tbody>{NAMES.map((name, i) => <tr key={name}><th scope="row">{name}</th><td>{logits[i]}</td><td>{format(naiveWeights[i] / denominator)}</td><td>{stable[i].toFixed(3)}</td></tr>)}</tbody>
        </table>
      </div>
      <div className={"viz-narr" + (Number.isFinite(denominator) ? "" : " is-warn")} aria-live="polite">
        减去最大值后始终是 [{INITIAL.map((value) => value - Math.max(...INITIAL)).join(", ")}]。
        {Number.isFinite(denominator) ? "当前直接取指数也能计算。" : "当前直接取指数已经溢出。"}
        稳定结果之和为 {sum(stable).toFixed(3)}。
      </div>
    </VisualizationFrame>
  );
}
