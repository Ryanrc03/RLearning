"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

// Sentence A (20 WordPiece tokens) and two candidates for sentence B (8 tokens each).
const A = ["the", "cat", "sat", "on", "the", "mat", "because", "it", "was", "tired", "after", "chasing", "the", "neighbor", "'", "s", "dog", "all", "morning", "."];
const B_NEXT = ["it", "is", "still", "asleep", "on", "the", "sofa", "."];
const B_RANDOM = ["the", "stock", "market", "closed", "higher", "on", "friday", "."];
const VOCAB = ["apple", "quickly", "window", "seven", "blue", "##ing", "river", "sang", "under", "paper", "loud", "bridge", "##ed", "green", "table", "walked"];
const MASK_RATE = 0.15;
const REST_W = [0.4, 0.25, 0.18, 0.1, 0.07]; // how the probability left over from the target is spread across 5 distractors

type Kind = "mask" | "random" | "keep";
type Pick = { pos: number; kind: Kind; shown: string; target: string; p: number; distractors: string[] };
type Tally = Record<Kind, number>;

const KIND_LABEL: Record<Kind, string> = { mask: "换成 [MASK]", random: "换成随机词", keep: "保留原词" };

// mulberry32: a seeded generator so the first render is identical on server and client.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sequence(b: string[]) {
  return ["[CLS]", ...A, "[SEP]", ...b, "[SEP]"];
}

function isSpecial(t: string) {
  return t === "[CLS]" || t === "[SEP]";
}

function sample(seed: number, b: string[]): Pick[] {
  const r = rng(seed);
  const tokens = sequence(b);
  const idx = tokens.map((t, i) => (isSpecial(t) ? -1 : i)).filter((i) => i >= 0);
  const n = Math.max(1, Math.round(idx.length * MASK_RATE));
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, n).sort((x, y) => x - y).map((pos) => {
    const roll = r();
    const kind: Kind = roll < 0.8 ? "mask" : roll < 0.9 ? "random" : "keep";
    const target = tokens[pos];
    const pool = VOCAB.filter((v) => v !== target);
    const distractors: string[] = [];
    while (distractors.length < 5) {
      const v = pool[Math.floor(r() * pool.length)];
      if (!distractors.includes(v)) distractors.push(v);
    }
    const shown = kind === "mask" ? "[MASK]" : kind === "random" ? distractors[0] : target;
    const p = 0.05 + 0.85 * r();
    return { pos, kind, shown, target, p, distractors };
  });
}

function countKinds(picks: Pick[], into: Tally): Tally {
  const t = { ...into };
  for (const p of picks) t[p.kind] += 1;
  return t;
}

const INITIAL_SEED = 5;
const INITIAL_PICKS = sample(INITIAL_SEED, B_NEXT);

export default function MaskedLmViz() {
  const [seed, setSeed] = useState(INITIAL_SEED);
  const [bNext, setBNext] = useState(true);
  const [focus, setFocus] = useState(0);
  const [pOverride, setPOverride] = useState<number | null>(null);
  const [tally, setTally] = useState<Tally>(countKinds(INITIAL_PICKS, { mask: 0, random: 0, keep: 0 }));
  const [samples, setSamples] = useState(1);

  const b = bNext ? B_NEXT : B_RANDOM;
  const tokens = sequence(b);
  const picks = sample(seed, b);
  const contentCount = tokens.filter((t) => !isSpecial(t)).length;
  const focused = picks[Math.min(focus, picks.length - 1)];
  const pOf = (pk: Pick) => (pk === focused && pOverride !== null ? pOverride : pk.p);
  const losses = picks.map((pk) => -Math.log(pOf(pk)));
  const lMlm = losses.reduce((s, x) => s + x, 0) / losses.length;
  const pNsp = 0.55 + 0.4 * rng(seed * 31 + 7)();
  const lNsp = -Math.log(pNsp);
  const nspLabel = bNext ? "IsNext" : "NotNext";
  const kindCount = countKinds(picks, { mask: 0, random: 0, keep: 0 });
  const tallyTotal = tally.mask + tally.random + tally.keep;
  const pct = (n: number) => `${Math.round((n / Math.max(1, tallyTotal)) * 100)}%`;

  const fp = pOf(focused);
  const bars = [
    { tok: focused.target, p: fp, isTarget: true },
    ...focused.distractors.map((d, i) => ({ tok: d, p: (1 - fp) * REST_W[i], isTarget: false })),
  ];

  function resample() {
    const next = seed + 1;
    setSeed(next);
    setFocus(0);
    setPOverride(null);
    setTally((t) => countKinds(sample(next, b), t));
    setSamples((s) => s + 1);
  }

  function chooseB(next: boolean) {
    if (next === bNext) return;
    setBNext(next);
    setFocus(0);
    setPOverride(null);
  }

  const narr = `这次采样：${contentCount} 个词里选了 ${picks.length} 个（15%），${kindCount.mask} 个换成 [MASK]、${kindCount.random} 个换成随机词、${kindCount.keep} 个保留原词。损失只在这 ${picks.length} 个位置计算，其余 ${contentCount - picks.length} 个位置的输出不进损失，但它们是这几个预测的上下文。累计采样 ${samples} 次，${tallyTotal} 个被选位置里：[MASK] ${pct(tally.mask)}、随机词 ${pct(tally.random)}、保留 ${pct(tally.keep)}。`;

  return (
    <VisualizationFrame
      title="掩码语言模型：损失算在哪几个位置"
      description="一条 A + B 序列。每点一次“再采样”，就按 BERT 的规则重新选 15% 的位置并腐蚀它们；点一个被选中的位置，看模型在那里对词表做的 softmax 和它的交叉熵。"
      footnote={<>概率 p 是示意值，真实模型的 p 来自 softmax(E·g(h_i)+b)。规律不依赖这些数字：交叉熵只看<b>正确词</b>拿到的概率；三种腐蚀方式都要预测原词；多次采样后三种方式的比例会收敛到 80 / 10 / 10。</>}
    >
      <div className="viz-controls">
        <button type="button" className="viz-btn primary" onClick={resample}>再采样一次</button>
        <span className="viz-k">句子 B：</span>
        <button type="button" className={`viz-btn${bNext ? " is-on" : ""}`} onClick={() => chooseB(true)}>真正的下一句</button>
        <button type="button" className={`viz-btn${!bNext ? " is-on" : ""}`} onClick={() => chooseB(false)}>随机抽的一句</button>
      </div>

      <div className="viz-panel">
        <h5>模型看到的输入（{tokens.length} 个 token，含 3 个特殊符）</h5>
        <div className="viz-chips">
          {tokens.map((t, i) => {
            const pk = picks.find((p) => p.pos === i);
            const segB = i > A.length + 1;
            if (!pk) {
              return (
                <span key={i} className="viz-chip mono" style={{ cursor: "default", background: isSpecial(t) ? "#efede4" : segB ? "#fdf9e9" : "#fff", color: isSpecial(t) ? "var(--muted)" : "var(--ink)" }}>{t}</span>
              );
            }
            const isFocus = pk === focused;
            const style = pk.kind === "mask"
              ? { background: "#3b4234", color: "#fff", borderColor: "#3b4234" }
              : pk.kind === "random"
                ? { background: "var(--v2)", color: "#fff", borderColor: "var(--v2)" }
                : { background: "#fff", color: "var(--ink)", borderColor: "var(--v3)", borderWidth: 2 };
            return (
              <button
                key={i}
                type="button"
                className="viz-chip mono"
                aria-pressed={isFocus}
                onClick={() => { setFocus(picks.indexOf(pk)); setPOverride(null); }}
                style={{ ...style, display: "inline-grid", textAlign: "center", lineHeight: 1.25, padding: "4px 8px", boxShadow: isFocus ? "0 0 0 2px var(--v1)" : undefined }}
              >
                <b>{pk.shown}</b>
                <small style={{ fontSize: 10, opacity: 0.85 }}>目标 {pk.target}</small>
              </button>
            );
          })}
        </div>
        <div className="viz-legend">
          <span><i style={{ background: "#3b4234" }} />换成 [MASK]（80%）</span>
          <span><i style={{ background: "var(--v2)" }} />换成随机词（10%）</span>
          <span><i style={{ background: "#fff", border: "2px solid var(--v3)" }} />保留原词（10%）</span>
          <span><i style={{ background: "#fdf9e9", border: "1px solid var(--vline)" }} />句子 B</span>
        </div>
      </div>

      <div className="viz-grid2 wide-left" style={{ marginTop: 14 }}>
        <div className="viz-panel">
          <h5>这 {picks.length} 个位置的交叉熵</h5>
          <div className="viz-mono" style={{ color: "var(--muted)", marginBottom: 6 }}>L_MLM = −(1/|M|) Σ<sub>i∈M</sub> log p(x<sub>i</sub> | x̃)</div>
          <table className="viz-table">
            <thead><tr><th>位置</th><th>输入</th><th>目标</th><th>情况</th><th className="num">p(目标)</th><th className="num">−log p</th></tr></thead>
            <tbody>
              {picks.map((pk, i) => (
                <tr key={pk.pos} style={pk === focused ? { background: "#eef5fd" } : undefined}>
                  <td className="num">{pk.pos}</td>
                  <td className="viz-mono" style={{ whiteSpace: "nowrap" }}>{pk.shown}</td>
                  <td className="viz-mono" style={{ whiteSpace: "nowrap" }}>{pk.target}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{KIND_LABEL[pk.kind]}</td>
                  <td className="num">{pOf(pk).toFixed(2)}</td>
                  <td className="num">{losses[i].toFixed(2)}</td>
                </tr>
              ))}
              <tr><td colSpan={5}><b>L_MLM</b>（{picks.length} 个位置的平均）</td><td className="num"><b>{lMlm.toFixed(2)}</b></td></tr>
            </tbody>
          </table>
        </div>
        <div className="viz-panel">
          <h5>位置 {focused.pos} 的输出：对整个词表做 softmax（只画 6 个）</h5>
          <div className="viz-bars" role="img" aria-label={`位置 ${focused.pos} 的目标词 ${focused.target} 拿到概率 ${fp.toFixed(2)}，交叉熵 ${(-Math.log(fp)).toFixed(2)}。`}>
            {bars.map((bar) => (
              <div className="viz-bar-row" key={bar.tok} style={{ gridTemplateColumns: "84px minmax(0, 1fr) auto" }}>
                <span className="viz-bar-label viz-mono" style={{ fontWeight: bar.isTarget ? 600 : 400 }}>{bar.tok}</span>
                <div className="viz-bar-track"><span style={{ width: `${Math.max(1, bar.p * 100)}%`, background: bar.isTarget ? "var(--v1)" : "var(--vfixed)" }} /></div>
                <span className="viz-bar-val">{bar.p.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="viz-controls" style={{ marginTop: 12, marginBottom: 0 }}>
            <label><span className="viz-k">p(目标)</span><input type="range" min={0.01} max={0.99} step={0.01} value={fp} onChange={(e) => setPOverride(Number(e.target.value))} /><span className="viz-mono">{fp.toFixed(2)}</span></label>
            <span className="viz-mono">−log p = {(-Math.log(fp)).toFixed(2)}</span>
          </div>
          <p className="viz-k" style={{ marginTop: 8 }}>交叉熵只取正确词那一根柱子；其余五根怎么分，不改变这个位置的损失。p 越接近 1 损失越接近 0，p 很小时损失很大。</p>
        </div>
      </div>

      <div className="viz-panel" style={{ marginTop: 14 }}>
        <h5>下一句预测（NSP）与总损失</h5>
        <div className="viz-mono">
          [CLS] 的最终向量 → 2 类 softmax → 标签 <b>{nspLabel}</b>　p({nspLabel}) = {pNsp.toFixed(2)}（示意）→ L_NSP = −log p = {lNsp.toFixed(2)}
        </div>
        <div className="viz-mono" style={{ marginTop: 6 }}>
          L = L_MLM + L_NSP = {lMlm.toFixed(2)} + {lNsp.toFixed(2)} = <b>{(lMlm + lNsp).toFixed(2)}</b>
        </div>
      </div>

      <div className="viz-narr">{narr}</div>
    </VisualizationFrame>
  );
}
