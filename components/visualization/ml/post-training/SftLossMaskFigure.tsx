"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Plot from "@/components/visualization/ml/primitives/Plot";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import { SFT_SAMPLES, sftLoss } from "@/lib/ml/sft";

// Page 1 of Post-training: one chat-templated sample as a token row. Each bar
// is −log p of that token under the current model. With the prompt masked
// (label −100) only the response bars count and the loss is their mean; turn
// the mask off and the hard-to-predict prompt tokens flood the average.

type SampleKey = keyof typeof SFT_SAMPLES;
type MaskKey = "masked" | "full";

const SAMPLE_TABS = (Object.keys(SFT_SAMPLES) as SampleKey[]).map((key) => ({ key, label: SFT_SAMPLES[key].label }));
const MASK_TABS: { key: MaskKey; label: string }[] = [
  { key: "masked", label: "mask prompt：只算回答" },
  { key: "full", label: "不 mask：每个 token 都算" },
];

const W = 720;
const H = 300;
const PLOT = { x: 0, y: 0, w: W, h: 226 };
const Y_MAX = 3.6;
const C_RESP = "#2a78d6";
const C_PROMPT = "#eb6834";
const C_OFF = "#cfcab4";
const C_MEAN = "#3b4234";

const short = (text: string) => text.replace("<|assistant|>", "‹asst›").replace("<|user|>", "‹user›").replace("<|end|>", "‹end›");
const num = (v: number, d = 3) => v.toFixed(d);

export default function SftLossMaskFigure() {
  const [sample, setSample] = useState<SampleKey>("chat");
  const [mask, setMask] = useState<MaskKey>("masked");
  const tokens = SFT_SAMPLES[sample].tokens;
  const n = tokens.length;
  const masked = mask === "masked";
  const loss = sftLoss(tokens, masked);
  const other = sftLoss(tokens, !masked);
  const firstResp = tokens.findIndex((t) => t.role === "response");
  const promptLen = firstResp;

  const reset = () => {
    setSample("chat");
    setMask("masked");
  };

  const narr = masked
    ? `prompt 的 ${promptLen} 个位置标签是 −100，不算 loss；只有回答的 ${loss.count} 个 token（含 ‹end›）交 −log p，平均 loss = ${num(loss.mean)}。这个数只反映「回答写得像不像」，梯度也只来自这里。`
    : `所有 ${n} 个位置都算：平均 loss 从 ${num(other.mean)} 涨到 ${num(loss.mean)}，其中 ${Math.round(loss.promptShare * 100)}% 来自 prompt。用户问什么本来就猜不准，这部分梯度在教模型「编问题」，还把回答的信号稀释了${sample === "extract" ? "：回答只有 2 个 token，几乎被淹没" : ""}。`;

  return (
    <VisualizationFrame
      title="SFT 的 loss：同一行 token，算哪几格"
      description="一条套了 chat template 的样本。每根柱子是当前模型给这个 token 的 −log p（p 是玩具值），越高说明越没猜到。被 mask 的位置画成灰色，不进平均；虚线是此刻真正反向传播的那个平均 loss。"
    >
      <div className="viz-row">
        <Tabs options={MASK_TABS} value={mask} onChange={setMask} ariaLabel="是否 mask prompt" />
        <Tabs options={SAMPLE_TABS} value={sample} onChange={setSample} ariaLabel="样本" />
        <button type="button" className="viz-btn" onClick={reset}>重置</button>
      </div>

      <Figure width={W} height={H} label={`${masked ? "mask prompt" : "不 mask"}，${loss.count} 个 token 计入，平均 loss ${num(loss.mean)}`}>
        <Plot box={PLOT} xDomain={[-0.5, n - 0.5]} yDomain={[0, Y_MAX]} xTicks={[]} yTicks={[0, 1, 2, 3]} yLabel="−log p">
          {(f) => {
            const colW = f.x(1) - f.x(0);
            const barW = Math.min(26, colW * 0.62);
            const xSplit = f.x(firstResp - 0.5);
            return (
              <g>
                <rect x={f.x0} y={f.y1 - 18} width={xSplit - f.x0} height={f.y0 - f.y1 + 18} fill="#f3f1e7" opacity={0.7} />
                <rect x={xSplit} y={f.y1 - 18} width={f.x1 - xSplit} height={f.y0 - f.y1 + 18} fill="#eaf3fd" opacity={0.7} />
                <text x={f.x0 + 6} y={f.y1 - 5} fontSize={11.5} fontWeight={600} fill={masked ? "#76796f" : C_PROMPT}>
                  prompt{masked ? "：label = −100" : "：也算 loss"}
                </text>
                <text x={xSplit + 6} y={f.y1 - 5} fontSize={11.5} fontWeight={600} fill={C_RESP}>response：算 loss</text>
                {tokens.map((t, i) => {
                  const v = loss.nll[i];
                  const on = loss.counted[i];
                  const color = !on ? C_OFF : t.role === "prompt" ? C_PROMPT : C_RESP;
                  const top = f.y(Math.min(v, Y_MAX));
                  const cx = f.x(i);
                  return (
                    <g key={`${sample}-${i}`}>
                      <rect
                        x={cx - barW / 2}
                        y={top}
                        width={barW}
                        height={Math.max(1, f.y0 - top)}
                        fill={color}
                        opacity={on ? 0.9 : 0.55}
                        rx={2}
                        style={{ transition: "fill .25s, opacity .25s" }}
                      />
                      <text x={cx} y={top - 4} fontSize={10.5} textAnchor="middle" fill={on ? "#30332c" : "#a19f8a"} className="mono">
                        {v.toFixed(1)}
                      </text>
                      <text
                        x={cx}
                        y={f.y0 + 12}
                        fontSize={11.5}
                        textAnchor="end"
                        fill={t.special ? "#76796f" : on ? "#30332c" : "#a19f8a"}
                        transform={`rotate(-40 ${cx} ${f.y0 + 12})`}
                      >
                        {short(t.text)}
                      </text>
                    </g>
                  );
                })}
                <line x1={f.x0} x2={f.x1} y1={f.y(loss.mean)} y2={f.y(loss.mean)} stroke={C_MEAN} strokeWidth={1.6} strokeDasharray="6 4" style={{ transition: "y1 .3s, y2 .3s" }} />
                <text x={f.x1 - 4} y={f.y(loss.mean) - 5} fontSize={12} fontWeight={600} textAnchor="end" fill={C_MEAN} style={{ transition: "y .3s" }}>
                  平均 loss = {num(loss.mean)}
                </text>
              </g>
            );
          }}
        </Plot>
      </Figure>

      <div className="viz-stat" style={{ marginTop: 6 }}>
        <div><small>计入 loss 的 token</small><b>{loss.count} / {n}</b></div>
        <div><small>Σ −log p（计入的）</small><b>{num(loss.sum, 2)}</b></div>
        <div><small>平均 loss = Σ / 个数</small><b style={{ color: masked ? C_RESP : C_PROMPT }}>{num(loss.mean)}</b></div>
        <div><small>loss 里 prompt 的占比</small><b>{Math.round(loss.promptShare * 100)}%</b></div>
      </div>

      <div className={`viz-narr${masked ? " is-good" : " is-warn"}`}>{narr}</div>
    </VisualizationFrame>
  );
}
