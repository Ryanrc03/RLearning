"use client";

import { useState } from "react";
import { LAYER_DIMS, LAYER_WEIGHTS, layerShapes, shapeText, type LayerMode, type Shape } from "@/lib/ml/attentionLayer";
import { BahFrame, Legend, P, toneFill, toneStroke, type Tone } from "../bahdanau/shared";

const W = 700;
const H = 252;
const ID = "shx";
/** Pixels per token (rows of Q, A, C; columns of Kᵀ, A); features are drawn at 1.25 px each (64 → 80 px, 32 → 40 px). */
const U = 18;
const F = 1.25;
const AX = 282;
const Y0 = 64;

const MODES: { key: LayerMode; label: string }[] = [
  { key: "cross", label: "Cross-Attention：X′ ≠ X" },
  { key: "self", label: "Self-Attention：X′ = X" },
];

function Block({ x, w, h, tone, name, shape, rows, cols }: { x: number; w: number; h: number; tone: Tone; name: string; shape: Shape; rows?: number; cols?: number }) {
  return (
    <g>
      <rect className="bah-size" x={x} y={Y0} width={w} height={h} rx={3} fill={toneFill(tone)} stroke={toneStroke(tone)} strokeWidth={1.4} />
      {rows && Array.from({ length: rows - 1 }, (_, r) => <line key={`r${r}`} x1={x} x2={x + w} y1={Y0 + (r + 1) * (h / rows)} y2={Y0 + (r + 1) * (h / rows)} stroke={toneStroke(tone)} strokeWidth={0.6} />)}
      {cols && Array.from({ length: cols - 1 }, (_, c) => <line key={`c${c}`} y1={Y0} y2={Y0 + h} x1={x + (c + 1) * (w / cols)} x2={x + (c + 1) * (w / cols)} stroke={toneStroke(tone)} strokeWidth={0.6} />)}
      <text x={x + w / 2} y={Y0 - 22} fontSize={11} fontWeight={700} textAnchor="middle" fill={P.ink}>{name}</text>
      <text x={x + w / 2} y={Y0 - 8} fontSize={9.5} textAnchor="middle" fill={P.sub} className="mono">{shapeText(shape)}</text>
    </g>
  );
}

export default function ShapeExplorerFigure() {
  const [mode, setMode] = useState<LayerMode>("cross");
  const d = LAYER_DIMS[mode];
  const s = layerShapes(d);
  const a = LAYER_WEIGHTS[mode];
  const th = d.t * U;
  const mh = d.m * U;
  const op = (x: number, text: string) => <text x={x} y={Y0 + 30} fontSize={15} textAnchor="middle" fill={P.ink}>{text}</text>;

  return (
    <BahFrame
      title="图 4 · 形状怎么对上：Q · Kᵀ → A，A · V → C"
      description="每个矩形按比例画：一行是一个 token，宽度是向量的维数。在 Cross 和 Self 之间切换，看哪些边跟着变。"
      footnote={<>每行一个 token 的写法（NumPy / PyTorch 的习惯）。A 里的数是教学构造数据，每行和为 1。尺寸取 d_k = {d.dK}、d_v = {d.dV}、输入宽度 {d.dSrc}，只是这个例子的设定。</>}
    >
      <div className="viz-controls" role="group" aria-label="选择 Attention 类型">
        {MODES.map((m) => (
          <button key={m.key} type="button" aria-pressed={mode === m.key} className={`viz-btn${mode === m.key ? " is-on" : ""}`} onClick={() => setMode(m.key)}>{m.label}</button>
        ))}
        <span className="viz-k">m = {d.m} 个 Key / Value，t = {d.t} 个 Query</span>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${ID}-title ${ID}-desc`} style={{ minWidth: 640 }}>
          <title id={`${ID}-title`}>Attention 各矩阵的形状</title>
          <desc id={`${ID}-desc`}>Q 的形状是 {shapeText(s.q)}，K 转置是 {shapeText(s.kT)}，相乘再按行做 softmax 得到 A，形状 {shapeText(s.a)}；V 是 {shapeText(s.v)}，A 乘 V 得到输出 C，形状 {shapeText(s.c)}。输出的行数等于 Query 的个数，宽度等于 d v。</desc>

          <Block x={24} w={d.dK * F} h={th} tone="dec" name="Q" shape={s.q} rows={d.t} />
          {op(120, "·")}
          <Block x={136} w={mh} h={d.dK * F} tone="par" name="Kᵀ" shape={s.kT} cols={d.m} />
          <text x={245} y={Y0 + 22} fontSize={9} textAnchor="middle" fill={P.sub}>逐行</text>
          <text x={245} y={Y0 + 34} fontSize={9} textAnchor="middle" fill={P.sub}>softmax</text>
          <text x={245} y={Y0 + 50} fontSize={14} textAnchor="middle" fill={P.ink}>→</text>

          {/* A drawn as the real heatmap, t rows × m columns */}
          <g>
            <text x={AX + mh / 2} y={Y0 - 22} fontSize={11} fontWeight={700} textAnchor="middle" fill={P.ink}>A</text>
            <text x={AX + mh / 2} y={Y0 - 8} fontSize={9.5} textAnchor="middle" fill={P.sub} className="mono">{shapeText(s.a)}</text>
            <rect x={AX} y={Y0} width={mh} height={th} fill={P.surface} />
            {a.map((row, j) => row.map((w, i) => (
              <rect key={`${j}-${i}`} x={AX + i * U} y={Y0 + j * U} width={U} height={U} fill={P.att} fillOpacity={Math.round((0.08 + 0.92 * w) * 100) / 100} stroke={P.surface} strokeWidth={0.8} />
            )))}
            <rect className="bah-size" x={AX} y={Y0} width={mh} height={th} rx={2} fill="none" stroke={P.att} strokeWidth={1.4} />
          </g>
          {op(AX + mh + 16, "·")}
          <Block x={AX + mh + 32} w={d.dV * F} h={mh} tone="enc" name="V" shape={s.v} rows={d.m} />
          {op(AX + mh + 90, "=")}
          <Block x={AX + mh + 108} w={d.dV * F} h={th} tone="dyn" name="C" shape={s.c} rows={d.t} />

          {/* what follows what */}
          <g fontSize={10} fill={P.ink}>
            <text x={524} y={Y0 + 4} fontWeight={700}>输出 C：{shapeText(s.c)}</text>
            <text x={524} y={Y0 + 24}>行数 {s.c[0]} = Query 的个数 t</text>
            <text x={524} y={Y0 + 40}>宽度 {s.c[1]} = Value 的维数 d_v</text>
            <text x={524} y={Y0 + 60} fill={P.sub}>{mode === "cross" ? `Key 有 ${d.m} 个，但输出不是 ${d.m} 行` : "X′ = X，所以 t = m，A 成了方阵"}</text>
          </g>

          <g fontSize={10.5} fill={P.ink} className="mono">
            <text x={24} y={H - 54}>Q · Kᵀ：({shapeText(s.q)})({shapeText(s.kT)}) = {shapeText(s.scores)}</text>
            <text x={24} y={H - 36}>A · V ：({shapeText(s.a)})({shapeText(s.v)}) = {shapeText(s.c)}</text>
          </g>
          <text x={24} y={H - 14} fontSize={9} fill={P.sub}>中间那一对相等的数（{d.dK} 和 {d.dK}，{d.m} 和 {d.m}）在乘法里消掉，留下两头。</text>
        </svg>
      </div>
      <Legend items={[{ tone: "dec", label: "Q：每行一个 Query" }, { tone: "par", label: "Kᵀ：每列一个 Key" }, { tone: "att", label: "A：权重" }, { tone: "enc", label: "V：每行一个 Value" }, { tone: "dyn", label: "C：输出" }]} />
      <div className={`viz-narr ${mode === "cross" ? "is-warn" : "is-good"}`} aria-live="polite">
        {mode === "cross"
          ? <>Cross-Attention：Q 来自 X′，有 {d.t} 行；K、V 来自 X，有 {d.m} 行。A 是 {shapeText(s.a)}，输出 C 是 {shapeText(s.c)}。<b>输出数量 = Query 数量；输出宽度 = d_v。</b></>
          : <>Self-Attention：Q、K、V 都来自同一个 X，都是 {d.m} 行。A 变成 {shapeText(s.a)} 的方阵，输出 C 是 {shapeText(s.c)}：行数和输入一样，宽度是 d_v = {d.dV}，不一定等于输入的 {d.dSrc}。<b>输出数量 = Query 数量；输出宽度 = d_v。</b></>}
      </div>
    </BahFrame>
  );
}
