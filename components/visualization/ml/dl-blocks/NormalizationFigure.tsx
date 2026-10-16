"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import {
  batchNorm,
  batchNorm2d,
  channelValues,
  DEMO_ACTIVATIONS,
  DEMO_BATCH,
  DEMO_FEATURES,
  DEMO_IMAGE_BATCH,
  DEMO_IMAGE_CHANNELS,
  DEMO_IMAGE_SEED,
  DEMO_IMAGES,
  DEMO_SEED,
  DEMO_WEIGHTS,
  layerNorm,
  weightNorm,
} from "@/lib/ml/norm";

// Page 3 of Deep Learning Blocks: a 4 × 5 activation matrix. BatchNorm takes
// μ and σ down one column (one feature across the batch), LayerNorm along one
// row (one sample across its features); WeightNorm leaves activations alone
// and splits a weight vector into length and direction. The BatchNorm tab has
// a 1D / 2D switch: 2D is the CNN case, a (2, 3, 2, 2) tensor where one
// channel's statistic is taken over both images and all four pixels.

type Mode = "batch" | "layer" | "weight";
const MODES: { key: Mode; label: string }[] = [
  { key: "batch", label: "BatchNorm" },
  { key: "layer", label: "LayerNorm" },
  { key: "weight", label: "WeightNorm" },
];
type Dim = "1d" | "2d";
const DIMS: { key: Dim; label: string }[] = [
  { key: "1d", label: "1D (batch, feature)" },
  { key: "2d", label: "2D (batch, channel, H, W)" },
];
const EPS = 1e-5;
const SEL_BG = "#eaf3fd";
const SEL_BORDER = "#9cc3ef";
const DEFAULTS = { mode: "batch" as Mode, dim: "1d" as Dim, feature: 3, sample: 1, channel: 1 };

const num = (v: number, digits = 1) => v.toFixed(digits).replace("-", "−");
const list = (vs: number[]) => vs.map((v) => num(v)).join(", ");

export default function NormalizationFigure() {
  const [mode, setMode] = useState<Mode>(DEFAULTS.mode);
  const [dim, setDim] = useState<Dim>(DEFAULTS.dim);
  const [feature, setFeature] = useState(DEFAULTS.feature);
  const [sample, setSample] = useState(DEFAULTS.sample);
  const [channel, setChannel] = useState(DEFAULTS.channel);
  const data = useMemo(() => {
    const m = DEMO_ACTIVATIONS(DEMO_SEED);
    const imgs = DEMO_IMAGES(DEMO_IMAGE_SEED);
    return { m, bn: batchNorm(m, EPS), ln: layerNorm(m, EPS), wn: weightNorm(DEMO_WEIGHTS), imgs, bn2: batchNorm2d(imgs, EPS) };
  }, []);
  const { m, bn, ln, wn, imgs, bn2 } = data;
  const is2d = mode === "batch" && dim === "2d";

  const reset = () => {
    setMode(DEFAULTS.mode);
    setDim(DEFAULTS.dim);
    setFeature(DEFAULTS.feature);
    setSample(DEFAULTS.sample);
    setChannel(DEFAULTS.channel);
  };

  const isHot = (i: number, j: number) => (mode === "batch" ? j === feature : mode === "layer" ? i === sample : false);
  const pick = (i: number, j: number) => {
    if (mode === "batch") setFeature(j);
    if (mode === "layer") setSample(i);
  };

  const stat =
    mode === "batch"
      ? dim === "1d"
        ? { mu: bn.mean[feature], sigma: bn.std[feature], raw: m.map((row) => row[feature]), hat: bn.normalized.map((row) => row[feature]), names: m.map((_, i) => `样本 ${i + 1}`) }
        : {
            mu: bn2.mean[channel],
            sigma: bn2.std[channel],
            raw: channelValues(imgs, channel),
            hat: channelValues(bn2.normalized, channel),
            names: imgs.flatMap((img, b) => img[channel].flatMap((row, r) => row.map((_, c) => `图 ${b + 1} [${r}, ${c}]`))),
          }
      : mode === "layer"
        ? { mu: ln.mean[sample], sigma: ln.std[sample], raw: m[sample], hat: ln.normalized[sample], names: m[sample].map((_, j) => `feature ${j + 1}`) }
        : null;

  const shape4 = `(${bn2.shape.join(", ")})`;
  const narr =
    mode === "batch"
      ? dim === "1d"
        ? `沿 batch 轴：输入形状 (batch, feature) = (${DEMO_BATCH}, ${DEMO_FEATURES})。feature ${feature + 1} 在 4 个样本上的值是 (${list(stat!.raw)})，μ_B = ${num(stat!.mu, 2)}、σ_B = ${num(stat!.sigma, 2)} 只从这一列算，归一化后这一列均值 0、方差 1，输出形状仍是 (${DEMO_BATCH}, ${DEMO_FEATURES})。训练时用的是当前 batch 的 μ_B、σ_B；推理时一次可能只来一个样本，没有 batch 可算，用的是训练期间累计的 running mean / variance，所以训练和推理走的是两套公式。`
        : `沿 batch × H × W：输入形状 (batch, channel, H, W) = ${shape4}，2 张图、3 个 channel、每个 channel 2 × 2 个像素。channel ${channel + 1} 在 2 张图的 4 个像素上一共 8 个数 (${list(stat!.raw)})，μ_B = ${num(stat!.mu, 2)}、σ_B = ${num(stat!.sigma, 2)} 只从这 8 个数算：每个 channel 一种统计，γ、β 也是每个 channel 一对。输出形状还是 ${shape4}，归一化只改数值，不改形状。`
      : mode === "layer"
        ? `沿 feature 轴：样本 ${sample + 1} 自己的 5 个 feature 是 (${list(stat!.raw)})，μ_L = ${num(stat!.mu, 2)}、σ_L = ${num(stat!.sigma, 2)} 只从这一行算，和 batch 里其他样本无关。batch 为 1 也能算，训练和推理一模一样；序列里每个 token 的向量就是这样一行，所以 Transformer 用它。`
        : `WeightNorm 不碰激活值。权重 v = (${list([...DEMO_WEIGHTS])}) 的长度 g = ‖v‖ = ${num(wn.g, 3)}，方向 v/‖v‖ 的范数恰好是 1；训练时 g 和 v 分开更新，改方向不会顺带改尺度，而且和 batch 完全无关。`;

  const cellStyle = (hot: boolean) => ({ background: hot ? SEL_BG : "#fff", borderColor: hot ? SEL_BORDER : undefined, opacity: hot ? 1 : 0.45, transition: "opacity .25s, background-color .25s" });

  return (
    <VisualizationFrame
      title="Normalization：μ 和 σ 是从哪一组数算出来的"
      description="4 个样本 × 5 个 feature 的激活矩阵，五个 feature 故意放在不同尺度上。切换方法，看高亮的是一列、一行，还是根本不在这张表里；BatchNorm 下再切到 2D，看 CNN 里一个 channel 的统计跨了几张图、几个像素。"
    >
      <div className="viz-row">
        <Tabs options={MODES} value={mode} onChange={setMode} ariaLabel="归一化方法" />
        {mode === "batch" && <Tabs options={DIMS} value={dim} onChange={setDim} ariaLabel="BatchNorm 的输入形状" />}
        {mode === "batch" && dim === "1d" && (
          <div className="viz-chips" role="group" aria-label="选一个 feature">
            {Array.from({ length: DEMO_FEATURES }, (_, j) => (
              <button key={j} type="button" className={`viz-chip mono${feature === j ? " is-on" : ""}`} aria-pressed={feature === j} onClick={() => setFeature(j)}>feature {j + 1}</button>
            ))}
          </div>
        )}
        {is2d && (
          <div className="viz-chips" role="group" aria-label="选一个 channel">
            {Array.from({ length: DEMO_IMAGE_CHANNELS }, (_, k) => (
              <button key={k} type="button" className={`viz-chip mono${channel === k ? " is-on" : ""}`} aria-pressed={channel === k} onClick={() => setChannel(k)}>channel {k + 1}</button>
            ))}
          </div>
        )}
        {mode === "layer" && (
          <div className="viz-chips" role="group" aria-label="选一个样本">
            {Array.from({ length: DEMO_BATCH }, (_, i) => (
              <button key={i} type="button" className={`viz-chip mono${sample === i ? " is-on" : ""}`} aria-pressed={sample === i} onClick={() => setSample(i)}>样本 {i + 1}</button>
            ))}
          </div>
        )}
        <button type="button" className="viz-btn" onClick={reset}>重置</button>
      </div>

      <div className="viz-grid2 wide-left">
        <div className="mx-wrap">
          {is2d ? (
            <table className="mx" aria-label={`${shape4} 的激活张量：2 张图，每张 3 个 channel，每个 channel 2 × 2`}>
              <thead>
                <tr>
                  <th />
                  {Array.from({ length: DEMO_IMAGE_CHANNELS }, (_, k) => (
                    <th key={k} className="col-h" style={{ color: k === channel ? "#2a78d6" : undefined, fontWeight: k === channel ? 600 : undefined, maxWidth: "none" }}>channel {k + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {imgs.map((img, b) => (
                  <tr key={b}>
                    <th className="row-h">图 {b + 1}</th>
                    {img.map((grid, k) => {
                      const hot = k === channel;
                      return (
                        <td key={k}>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, auto)", gap: 3, justifyContent: "center" }} role="group" aria-label={`图 ${b + 1} 的 channel ${k + 1}，2 × 2`}>
                            {grid.flatMap((row, r) =>
                              row.map((v, c) => (
                                <button
                                  key={`${r}${c}`}
                                  type="button"
                                  className={`mx-cell${hot ? " is-sel" : ""}`}
                                  style={{ ...cellStyle(hot), width: 46, height: 30, fontSize: 11.5 }}
                                  onClick={() => setChannel(k)}
                                  aria-label={`图 ${b + 1} channel ${k + 1} 像素 [${r}, ${c}]：${num(v)}`}
                                >
                                  {num(v)}
                                </button>
                              )),
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : mode !== "weight" ? (
            <table className="mx" aria-label="激活矩阵">
              <thead>
                <tr>
                  <th />
                  {Array.from({ length: DEMO_FEATURES }, (_, j) => (
                    <th key={j} className="col-h" style={{ color: mode === "batch" && j === feature ? "#2a78d6" : undefined, fontWeight: mode === "batch" && j === feature ? 600 : undefined }}>feature {j + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {m.map((row, i) => (
                  <tr key={i}>
                    <th className="row-h" style={{ color: mode === "layer" && i === sample ? "#2a78d6" : undefined, fontWeight: mode === "layer" && i === sample ? 600 : undefined }}>样本 {i + 1}</th>
                    {row.map((v, j) => {
                      const hot = isHot(i, j);
                      return (
                        <td key={j}>
                          <button
                            type="button"
                            className={`mx-cell${hot ? " is-sel" : ""}`}
                            style={cellStyle(hot)}
                            onClick={() => pick(i, j)}
                            aria-label={`样本 ${i + 1} 的 feature ${j + 1}：${num(v)}`}
                          >
                            {num(v)}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="mx" aria-label="权重向量拆成长度和方向">
              <thead>
                <tr>
                  <th />
                  {DEMO_WEIGHTS.map((_, j) => <th key={j} className="col-h">w{j + 1}</th>)}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th className="row-h">v</th>
                  {DEMO_WEIGHTS.map((v, j) => <td key={j}><span className="mx-cell" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "default", background: "#fff" }}>{num(v)}</span></td>)}
                </tr>
                <tr>
                  <th className="row-h" style={{ color: "#2a78d6", fontWeight: 600 }}>v / ‖v‖</th>
                  {wn.unit.map((u, j) => <td key={j}><span className="mx-cell is-sel" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "default", background: SEL_BG, borderColor: SEL_BORDER }}>{num(u, 3)}</span></td>)}
                </tr>
              </tbody>
            </table>
          )}
          {is2d && <p className="viz-k" style={{ marginTop: 8, textAlign: "center" }}>每个 2 × 2 是一张图的一个 channel；高亮的 channel 跨 {DEMO_IMAGE_BATCH} 张图、每张 4 个像素，点任意格子换 channel。</p>}
        </div>

        <div className="viz-panel">
          {stat ? (
            <>
              <h5 className="nocase">
                {mode === "batch" ? (dim === "1d" ? `feature ${feature + 1} 这一列（4 个样本）` : `channel ${channel + 1}：${DEMO_IMAGE_BATCH} 张图 × 2 × 2 像素，共 ${stat.raw.length} 个数`) : `样本 ${sample + 1} 这一行（5 个 feature）`}
              </h5>
              <div className="viz-stat">
                <div><small>{mode === "batch" ? "μ_B" : "μ_L"}</small><b>{num(stat.mu, 2)}</b></div>
                <div><small>{mode === "batch" ? "σ_B" : "σ_L"}</small><b>{num(stat.sigma, 2)}</b></div>
                {is2d && <div><small>输入和输出的形状（不变）</small><b style={{ fontSize: 13 }}>{shape4}</b></div>}
              </div>
              <table className="viz-table">
                <thead>
                  <tr><th></th><th className="num">x</th><th className="num">x̂ = (x − μ) / σ</th></tr>
                </thead>
                <tbody>
                  {stat.raw.map((v, k) => (
                    <tr key={k}><td>{stat.names[k]}</td><td className="num">{num(v)}</td><td className="num">{num(stat.hat[k], 2)}</td></tr>
                  ))}
                </tbody>
              </table>
              <p className="viz-k" style={{ marginTop: 8 }}>归一化后再乘 γ、加 β（可学的两个数），默认 γ = 1、β = 0 时输出就是右边这一列。{is2d ? " 2D 里 γ、β 每个 channel 一对，形状不变。" : ""}</p>
            </>
          ) : (
            <>
              <h5 className="nocase">w = g · v / ‖v‖</h5>
              <div className="viz-stat">
                <div><small>长度 g = ‖v‖</small><b>{num(wn.g, 3)}</b></div>
                <div><small>‖v / ‖v‖‖</small><b>{num(Math.sqrt(wn.unit.reduce((s, u) => s + u * u, 0)), 3)}</b></div>
              </div>
              <p className="viz-k" style={{ marginTop: 8 }}>g 和 v 是两组独立的参数：梯度下降更新 v 只改方向（之后会被重新除以 ‖v‖），更新 g 只改长度。乘回去 g · v/‖v‖ 就还原出 v，表里的每一列都能验算。</p>
            </>
          )}
        </div>
      </div>

      <div className={`viz-narr${mode === "batch" && dim === "1d" ? " is-warn" : ""}`}>{narr}</div>
    </VisualizationFrame>
  );
}
