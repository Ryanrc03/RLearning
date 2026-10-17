"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Plot from "@/components/visualization/ml/primitives/Plot";
import Slider from "@/components/visualization/ml/primitives/Slider";
import { createRng } from "@/lib/ml/random";
import { acceptableMass, DEMO_LOGITS, sampleTokens, softmaxTemperature, wrongCount } from "@/lib/ml/sampling";

// Page 3 of LLM Engineering: the next-token distribution after "珠穆朗玛峰的海拔是".
// Drag the temperature and watch the probability mass leak from 8848 onto
// numbers that merely look like an altitude; draw 20 seeded samples to see
// how often the model would actually write one of them.

const W = 720;
const H = 320;
const N_SAMPLES = 20;
const SEED_BASE = 13;
const C_OK = "#0ca30c";
const C_BAD = "#d03b3b";
const TOKENS = DEMO_LOGITS.tokens;
const LOGITS = TOKENS.map((t) => t.logit);
const MASK = TOKENS.map((t) => t.acceptable);

const pct = (p: number) => (p < 0.0005 ? "<0.1%" : `${(p * 100).toFixed(1)}%`);

export default function HallucinationFigure() {
  const [T, setT] = useState(1);
  const [draw, setDraw] = useState(0);
  const probs = useMemo(() => softmaxTemperature(LOGITS, T), [T]);
  const counts = useMemo(() => (draw === 0 ? null : sampleTokens(createRng(SEED_BASE + draw * 17), probs, N_SAMPLES)), [draw, probs]);
  const pTop = probs[0];
  const pOk = acceptableMass(probs, MASK);
  const pBad = 1 - pOk;
  const wrong = counts ? wrongCount(counts, MASK) : null;
  const wrongList = counts ? TOKENS.map((t, i) => (!t.acceptable && counts[i] > 0 ? `${t.text} × ${counts[i]}` : null)).filter(Boolean).join("、") : "";

  const changeT = (v: number) => {
    setT(v);
    setDraw(0);
  };
  const reset = () => {
    setT(1);
    setDraw(0);
  };

  const tone = T <= 0.3 ? "good" : T >= 1.2 ? "bad" : "mid";
  const base =
    tone === "good"
      ? `T = ${T.toFixed(1)}：logit 的差距被放大，分布几乎全压在 8848 上（${pct(pTop)}），错误 token 合计 ${pct(pBad)}。每次都答 8848，稳；但它也只会答 8848，让它写诗就会很单调。`
      : tone === "bad"
        ? `T = ${T.toFixed(1)}：差距被压平，8848 只剩 ${pct(pTop)}，错误 token 合计 ${pct(pBad)}，连 3000 都有 ${pct(probs[9])} 的机会。${Math.round(1 / Math.max(pBad, 1e-9))} 次里大约 1 次在编，而且编出来的句子一样通顺。`
        : `T = ${T.toFixed(1)}${T === 1 ? "，模型原本的分布" : ""}：8848 占 ${pct(pTop)}，8849 占 ${pct(probs[1])}，错的加起来 ${pct(pBad)}，大多落在 8800、8000 这些看起来像那么回事的数上。${Math.round(1 / Math.max(pBad, 1e-9))} 次里大约 1 次会写出一个错的海拔。`;
  const narr = counts ? `${base} 这次抽 ${N_SAMPLES} 个：错了 ${wrong} 个${wrong ? `（${wrongList}）` : ""}，和分布说的大致对得上；再抽一次会不一样，那正是随机。` : base;

  return (
    <VisualizationFrame
      title="下一个 token 的分布：温度决定错的多容易被抽到"
      description="十个候选 token 的 logit 是固定的，8848 最高。温度 T 把 logit 除一下再过 softmax；绿色是可接受的答案，红色是错的。右边的按钮按当前分布真的抽 20 次。"
    >
      <div className="viz-endcap user" style={{ marginBottom: 12 }}>{DEMO_LOGITS.prompt} <b className="viz-mono">▁</b> {DEMO_LOGITS.unit}</div>
      <div className="viz-row">
        <Slider label="temperature T" value={T} min={0.1} max={2} step={0.1} onChange={changeT} display={T.toFixed(1)} id="hall-T" />
        <button type="button" className="viz-btn primary" onClick={() => setDraw((d) => d + 1)}>抽 {N_SAMPLES} 个 token</button>
        <button type="button" className="viz-btn" onClick={reset}>重置</button>
      </div>

      <Figure width={W} height={H} label={`T = ${T.toFixed(1)}，8848 的概率 ${pct(pTop)}，错误 token 合计 ${pct(pBad)}${counts ? `，20 次抽样错了 ${wrong} 次` : ""}`}>
        <Plot box={{ x: 0, y: 0, w: W, h: H }} xDomain={[0, TOKENS.length]} yDomain={[0, 1]} xTicks={[]} yTicks={[0, 0.25, 0.5, 0.75, 1]} yLabel="概率" title={`softmax(z / T)，T = ${T.toFixed(1)}`} format={(v) => `${Math.round(v * 100)}%`}>
          {(f) => (
            <>
              {TOKENS.map((t, i) => {
                const x0 = f.x(i + 0.18);
                const x1 = f.x(i + 0.82);
                const cx = (x0 + x1) / 2;
                const top = f.y(probs[i]);
                const color = t.acceptable ? C_OK : C_BAD;
                const c = counts ? counts[i] : 0;
                return (
                  <g key={t.text}>
                    <rect x={x0} y={top} width={x1 - x0} height={Math.max(0, f.y0 - top)} fill={color} opacity={0.85} rx={3} style={{ transition: "y .3s, height .3s" }} />
                    <text x={cx} y={top - (counts && c > 0 ? 18 : 5)} fontSize={11} textAnchor="middle" fill="#3b4234" className="mono" style={{ transition: "y .3s" }}>{pct(probs[i])}</text>
                    {counts && c > 0 && (
                      <text x={cx} y={top - 5} fontSize={11.5} fontWeight={700} textAnchor="middle" fill={color} style={{ transition: "y .3s" }}>{t.acceptable ? "✓" : "✗"} {c}</text>
                    )}
                    <text x={cx} y={f.y0 + 16} fontSize={12.5} fontWeight={600} textAnchor="middle" fill={color}>{t.text}</text>
                    <text x={cx} y={f.y0 + 29} fontSize={11} textAnchor="middle" fill="#76796f" className="mono">z = {t.logit.toFixed(1)}</text>
                  </g>
                );
              })}
            </>
          )}
        </Plot>
      </Figure>
      <div className="viz-legend">
        <span><i style={{ background: C_OK }} />可接受（8848、8849）</span>
        <span><i style={{ background: C_BAD }} />错的，但看起来像海拔</span>
        <span className="viz-k">z 是固定的 logit，温度只改 z / T</span>
      </div>

      <div className="viz-stat" style={{ marginTop: 12 }}>
        <div><small>p(8848)</small><b>{pct(pTop)}</b></div>
        <div><small>可接受的合计</small><b style={{ color: "#087a08" }}>{pct(pOk)}</b></div>
        <div><small>错误 token 的合计</small><b style={{ color: C_BAD }}>{pct(pBad)}</b></div>
        <div><small>{N_SAMPLES} 次抽样里错了</small><b>{counts ? `${wrong} 次` : "—"}<span className="delta">{counts ? `第 ${draw} 批` : "还没抽"}</span></b></div>
      </div>

      <div className="viz-cards" style={{ marginTop: 12 }}>
        <div className="viz-card">
          <h6>什么算编 · what</h6>
          <p>句子前后矛盾：上一句说 8848，下一句说 9000。或者事实本身错了：引用一篇不存在的论文、调用一个不存在的 API，语气和真的一样。</p>
        </div>
        <div className="viz-card">
          <h6>为什么会编 · why</h6>
          <p><b>数据质量</b>：语料里本来就有错的、过时的、互相矛盾的说法。<b>生成方式</b>：每个 token 都是抽出来的，错的概率不是零，温度一高就被抽到。<b>输入 prompt</b>：问题含糊、缺少事实依据，模型只能拿语料里的印象补。</p>
        </div>
        <div className="viz-card">
          <h6>怎么少编 · how</h6>
          <p><b>清晰的 prompt</b>：把问题、范围、已知事实写明。<b>降温</b>：把分布压回最可能的 token 上，也就是把滑杆往左拖。<b>few-shot</b>：给几个「不确定就说不确定」的例子，把回答的形状定下来。</p>
        </div>
      </div>

      <div className={`viz-narr${tone === "good" ? " is-good" : tone === "bad" ? " is-bad" : ""}`}>{narr}</div>
    </VisualizationFrame>
  );
}
