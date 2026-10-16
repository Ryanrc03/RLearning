"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import {
  classifierLogit,
  clsPool,
  contentMask,
  DEMO_CLASSIFIER,
  DEMO_HIDDEN,
  isSpecialToken,
  meanPool,
  poolingWeights,
  SENTENCE_TOKENS,
  sigmoid,
} from "@/lib/ml/embeddings";

// Page 17 of Representations: BERT has turned "[CLS] I really like Adobe [SEP]"
// into six hidden vectors (toy 6-dim values from lib/ml/embeddings.ts). Switch
// between taking the [CLS] vector and averaging all tokens; click a token to see
// how much of the output it accounts for.

type Mode = "cls" | "mean";

const MODES: { key: Mode; label: string }[] = [
  { key: "cls", label: "取 [CLS]" },
  { key: "mean", label: "Mean pooling" },
];
const D = DEMO_HIDDEN[0].length;
const N = SENTENCE_TOKENS.length;
const C_OUT = "#2a78d6";
const C_PART = "#eb6834";
const INK = "#3b4234";
const MUTED = "#76796f";
const LINE = "#c9c4ad";
const DEFAULT_SELECTED = 3; // "like"

const fmt = (x: number) => (Object.is(x, -0) ? "0.00" : x.toFixed(2));
const fmtW = (w: number) => (w === 0 ? "0" : w === 1 ? "1" : `1/${Math.round(1 / w)}`);

/** A token's 6-dim hidden vector as six small bars around a midline. */
function Glyph({ v, color }: { v: readonly number[]; color: string }) {
  const w = 56;
  const h = 34;
  const mid = h / 2;
  const k = 15; // px per unit
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden style={{ display: "block", margin: "3px 0 1px" }}>
      <line x1={0} y1={mid} x2={w} y2={mid} stroke={LINE} strokeWidth={0.8} />
      {v.map((x, i) => (
        <rect key={i} x={2 + i * 9} y={x >= 0 ? mid - x * k : mid} width={7} height={Math.abs(x) * k} fill={color} rx={1} style={{ transition: "y .3s, height .3s" }} />
      ))}
    </svg>
  );
}

export default function SentenceEmbeddingFigure() {
  const [mode, setMode] = useState<Mode>("cls");
  const [excludeSpecial, setExcludeSpecial] = useState(false);
  const [selected, setSelected] = useState(DEFAULT_SELECTED);

  const mask = mode === "mean" && excludeSpecial ? contentMask(SENTENCE_TOKENS) : undefined;
  const weights = poolingWeights(N, mode, mask);
  const output = mode === "cls" ? clsPool(DEMO_HIDDEN) : meanPool(DEMO_HIDDEN, mask);
  const kept = weights.filter((w) => w > 0).length;
  const logit = classifierLogit(output, DEMO_CLASSIFIER.w, DEMO_CLASSIFIER.b);
  const prob = sigmoid(logit);
  const selTok = SENTENCE_TOKENS[selected];
  const selW = weights[selected];
  const contribution = DEMO_HIDDEN[selected].map((x) => x * selW);
  const vec = (v: readonly number[]) => `(${v.map(fmt).join(", ")})`;

  const reset = () => {
    setMode("cls");
    setExcludeSpecial(false);
    setSelected(DEFAULT_SELECTED);
  };

  const narr =
    mode === "cls"
      ? `取 [CLS] 位置的向量当整句的表示：h_out = h_[CLS] = ${vec(output)}。接一个分类头，logit = W·h + b = ${fmt(logit)}，sigmoid 后 P(正面) = ${fmt(prob)}。[CLS] 本身没有词义，它的向量是靠 attention 从 I、really、like、Adobe 那里收集来的，微调时专门训练过这个位置。${selected !== 0 ? `点选的「${selTok}」在这条路上权重是 0：它不直接进入输出。` : ""}`
      : excludeSpecial
        ? `只平均 I、really、like、Adobe 四个词的向量，每个权重 1/4：h_mean = ${vec(output)}，logit ${fmt(logit)}，P(正面) ${fmt(prob)}。点选的「${selTok}」${selW > 0 ? `贡献 1/4 × h = ${vec(contribution)}` : "是特殊符号，已经被去掉，贡献为 0"}。`
        : `把 ${N} 个 token 的向量逐维平均，每个权重 1/${N}：h_mean = ${vec(output)}，logit ${fmt(logit)}，P(正面) ${fmt(prob)}。[CLS] 和 [SEP] 不带词义却也占了 2/${N}，会把平均拉偏；勾上开关把它们去掉再看。点选的「${selTok}」贡献 1/${N} × h = ${vec(contribution)}。`;

  const FW = 420;
  const FH = 212;
  const midY = 112;
  const unit = 84; // px per 1.0
  const slot = 58;
  const x0 = 52;

  return (
    <VisualizationFrame
      title="Sentence Embedding：六个 token 向量，怎么合成一个"
      description="每张卡片是 BERT 最后一层在那个位置输出的隐向量（教学用的 6 维数字）。上面的开关选怎么合成；点任一 token 看它在输出里占的份额。"
    >
      <div className="viz-row">
        <Tabs options={MODES} value={mode} onChange={setMode} ariaLabel="合成方式" />
        <label className="viz-check" style={{ opacity: mode === "mean" ? 1 : 0.5 }}>
          <input type="checkbox" checked={excludeSpecial} disabled={mode !== "mean"} onChange={(e) => setExcludeSpecial(e.target.checked)} />
          <span>平均时去掉 [CLS] 和 [SEP]</span>
        </label>
        <button type="button" className="viz-btn" onClick={reset}>重置</button>
      </div>

      <div className="tok-strip" style={{ marginBottom: 10 }} aria-label="六个 token 和它们的隐向量，点一个查看它的份额">
        {SENTENCE_TOKENS.map((t, i) => {
          const feeds = weights[i] > 0;
          const isSel = i === selected;
          return (
            <button
              key={t}
              type="button"
              className={`tok${feeds ? " is-active" : " is-wait"}${isSpecialToken(t) ? " is-special" : ""}`}
              style={{ minWidth: 64, outline: isSel ? `2px solid ${C_OUT}` : undefined, outlineOffset: 2 }}
              onClick={() => setSelected(i)}
              aria-pressed={isSel}
            >
              <span style={{ fontWeight: 600 }}>{t}</span>
              <Glyph v={DEMO_HIDDEN[i]} color={feeds ? C_OUT : MUTED} />
              <small>w = {fmtW(weights[i])}</small>
            </button>
          );
        })}
      </div>
      <div className="viz-arrow" style={{ textAlign: "left", marginBottom: 6 }}>
        ↓ {mode === "cls" ? "只取第 0 个位置" : `${kept} 个向量逐维相加，再除以 ${kept}`}
      </div>

      <div className="viz-grid2 wide-left">
        <Figure width={FW} height={FH} label={`输出向量 ${vec(output)}，点选 ${selTok} 的贡献 ${vec(contribution)}`} minWidth={360}>
          <text x={14} y={18} fontSize={12.5} fontWeight={600} fill={INK}>{mode === "cls" ? "h_out = h_[CLS]" : "h_out = mean(h_i)"}</text>
          <text x={14} y={33} fontSize={10.5} fill={MUTED}>粗条是输出的每一维，细条是点选 token 在这一维上的贡献 w · h_i</text>
          {[1, 0.5, -0.5].map((g) => (
            <line key={g} x1={x0 - 10} y1={midY - g * unit} x2={FW - 10} y2={midY - g * unit} stroke="#e4dfcb" strokeDasharray="3 3" />
          ))}
          <line x1={x0 - 10} y1={midY} x2={FW - 10} y2={midY} stroke={MUTED} strokeWidth={1} />
          {[1, 0.5, 0, -0.5].map((g) => (
            <text key={g} x={x0 - 14} y={midY - g * unit + 4} fontSize={10.5} textAnchor="end" fill={MUTED}>{g.toFixed(1)}</text>
          ))}
          {output.map((v, j) => {
            const cx = x0 + j * slot + slot / 2;
            const c = contribution[j];
            return (
              <g key={j}>
                <rect x={cx - 15} y={v >= 0 ? midY - v * unit : midY} width={30} height={Math.abs(v) * unit} fill={C_OUT} opacity={0.85} rx={2} style={{ transition: "y .3s, height .3s" }} />
                <rect x={cx - 5} y={c >= 0 ? midY - c * unit : midY} width={10} height={Math.abs(c) * unit} fill={C_PART} rx={1.5} style={{ transition: "y .3s, height .3s" }} />
                <text x={cx} y={v >= 0 ? midY - v * unit - 5 : midY + Math.abs(v) * unit + 12} fontSize={11} textAnchor="middle" fill={C_OUT} fontWeight={600} className="mono">{fmt(v)}</text>
                <text x={cx} y={FH - 6} fontSize={11} textAnchor="middle" fill={MUTED}>d{j + 1}</text>
              </g>
            );
          })}
        </Figure>
        <div className="viz-panel">
          <h5>「{selTok}」在输出里的份额</h5>
          <p className="viz-k" style={{ marginBottom: 6 }}>
            权重 w = {fmtW(selW)}{selW > 0 ? `（${Math.round(selW * 100)}%）` : ""}；贡献 = w × h_{selTok}
          </p>
          <table className="viz-table" style={{ margin: 0 }}>
            <thead>
              <tr><th>维</th><th className="num">h_{selTok}</th><th className="num">w · h</th><th className="num">h_out</th></tr>
            </thead>
            <tbody>
              {Array.from({ length: D }, (_, j) => (
                <tr key={j}>
                  <td>d{j + 1}</td>
                  <td className="num">{fmt(DEMO_HIDDEN[selected][j])}</td>
                  <td className="num" style={{ color: C_PART, fontWeight: 600 }}>{fmt(contribution[j])}</td>
                  <td className="num" style={{ color: C_OUT, fontWeight: 600 }}>{fmt(output[j])}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {mode === "cls" && selected !== 0 && (
            <p className="viz-k" style={{ marginTop: 8 }}>CLS 路线下它不直接进入输出，但它的信息已经通过 attention 流进了 [CLS]。</p>
          )}
          {mode === "mean" && selW === 0 && (
            <p className="viz-k" style={{ marginTop: 8 }}>特殊符号被排除在平均之外，贡献为 0。</p>
          )}
        </div>
      </div>

      <div className="viz-stat" style={{ marginTop: 12 }}>
        <div><small>合成方式</small><b style={{ fontSize: 13 }}>{mode === "cls" ? "h_[CLS]" : `mean of ${kept}`}</b></div>
        <div><small>logit = W · h + b</small><b>{fmt(logit)}</b></div>
        <div><small>P(正面) = sigmoid(logit)</small><b>{fmt(prob)}</b></div>
      </div>

      <div className={`viz-narr${mode === "mean" && excludeSpecial ? " is-good" : ""}`}>{narr}</div>
    </VisualizationFrame>
  );
}
