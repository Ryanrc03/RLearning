"use client";

import { useEffect, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import { usePrefersReducedMotion } from "@/components/visualization/usePrefersReducedMotion";

const TOKENS = ["I", "love", "machine", "learning", "because", "it", "scales", "well"];
const LAYERS = 2;

// RNN cell (layer l, position t), both 1-based, is computable once (l, t−1) and (l−1, t) exist:
// the earliest tick is t + l − 1 (a diagonal wavefront). A Transformer layer l only needs
// layer l−1 at every position, so the whole layer is ready at tick l.
const rnnReady = (l: number, t: number) => t + l - 1;


export default function SequenceDependencyTimeline() {
  const [n, setN] = useState(4);
  const [tick, setTick] = useState(0);
  const [playing, setPlaying] = useState(false);
  const reduced = usePrefersReducedMotion();
  const rnnTotal = n + LAYERS - 1;
  const last = rnnTotal;

  useEffect(() => {
    if (!playing || tick >= last) return;
    const id = window.setTimeout(() => {
      setTick(tick + 1);
      if (tick + 1 >= last) setPlaying(false);
    }, reduced ? 900 : 600);
    return () => window.clearTimeout(id);
  }, [playing, tick, last, reduced]);

  const reset = (size = n) => {
    setN(size);
    setTick(0);
    setPlaying(false);
  };

  const tokens = TOKENS.slice(0, n);
  const cls = (ready: number) => (ready < tick ? "is-done" : ready === tick ? "is-done is-active" : "is-wait");
  const newlyRnn = tokens.flatMap((_, t) => Array.from({ length: LAYERS }, (_, l) => (rnnReady(l + 1, t + 1) === tick ? `h${t + 1}^(${l + 1})` : null))).filter(Boolean);
  const trDone = Math.min(tick, LAYERS);

  let narr: string;
  if (tick === 0) narr = "第 0 步：两边都只有输入 embedding。按“下一步”，每一步代表“这一批彼此不依赖、可以同时算的计算”。";
  else {
    const rnnPart = newlyRnn.length
      ? `RNN 这一步能算的只有 ${newlyRnn.join("、")}：它们要等左边同层的 h[t−1] 和下面一层的 h[t] 都算完。`
      : "RNN 已经全部算完。";
    const trPart =
      tick <= LAYERS
        ? `Transformer 第 ${tick} 层的 ${n} 个位置在这一步一起算出：它们只读第 ${tick - 1} 层（${tick === 1 ? "输入 embedding" : "上一层输出"}），同层位置之间没有等待。下一层仍要等这一层算完。`
        : "Transformer 两层已经算完，后面的步数它都在空闲。";
    narr = `第 ${tick} 步：${rnnPart}${trPart}`;
  }

  const row = (key: string, label: string, cells: { key: string; text: string; sub: string; c: string }[], arrows: boolean) => (
    <div className="lane" key={key}>
      <span>{label}</span>
      <div className="tok-strip">
        {cells.map((cell, i) => (
          <span key={cell.key} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            {arrows && i > 0 && <span className="viz-k" aria-hidden>→</span>}
            <span className={`tok ${cell.c}`}>{cell.text}<small>{cell.sub}</small></span>
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <VisualizationFrame
      title="RNN vs Transformer：同一个序列，要几步才能算完"
      description={`两种模型都堆 ${LAYERS} 层、处理同一个已知序列。每按一次“下一步”，把所有已经满足依赖的计算同时做掉，看两边各要几步。`}
      footnote="此图展示依赖结构（最少要几轮顺序计算），不是实际 GPU 微秒级延迟模拟。真实运行时间还取决于每步的计算量：Self-Attention 每层要算 n² 个位置对。"
    >
      <div className="viz-controls">
        <div className="viz-chips" role="group" aria-label="序列长度">
          {[4, 8].map((k) => (
            <button key={k} type="button" className={`viz-chip mono${n === k ? " is-on" : ""}`} aria-pressed={n === k} onClick={() => reset(k)}>n = {k}</button>
          ))}
        </div>
        <button type="button" className="viz-btn" onClick={() => setTick((k) => Math.max(0, k - 1))} disabled={tick === 0}>上一步</button>
        <button type="button" className="viz-btn primary" onClick={() => setTick((k) => Math.min(last, k + 1))} disabled={tick >= last}>下一步</button>
        <button type="button" className={`viz-btn${playing ? " is-on" : ""}`} onClick={() => (tick >= last ? (setTick(0), setPlaying(true)) : setPlaying((p) => !p))}>{playing ? "暂停" : "自动演示"}</button>
        <button type="button" className="viz-btn" onClick={() => reset()}>重置</button>
        <span className="viz-mono">step {tick} / {last}</span>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        <div className="viz-panel">
          <h5 className="nocase">RNN · 至少 {rnnTotal} 步</h5>
          {Array.from({ length: LAYERS }, (_, k) => LAYERS - k).map((l) =>
            row(`rnn-${l}`, `layer ${l}`, tokens.map((_, t) => ({ key: `${l}-${t}`, text: `h${t + 1}`, sub: `ready@${rnnReady(l, t + 1)}`, c: cls(rnnReady(l, t + 1)) })), true),
          )}
          {row("in", "输入", tokens.map((w, t) => ({ key: `x${t}`, text: w, sub: `x${t + 1}`, c: "is-text" })), false)}
          <p className="viz-k" style={{ marginTop: 8 }}>h[t] = f(W_x x[t] + W_h h[t−1] + b)：箭头就是要等的那个 h[t−1]。</p>
        </div>
        <div className="viz-panel">
          <h5 className="nocase">Transformer · 至少 {LAYERS} 步</h5>
          {Array.from({ length: LAYERS }, (_, k) => LAYERS - k).map((l) =>
            row(`tr-${l}`, `layer ${l}`, tokens.map((_, t) => ({ key: `${l}-${t}`, text: `y${t + 1}`, sub: `ready@${l}`, c: cls(l) })), false),
          )}
          {row("in", "输入", tokens.map((w, t) => ({ key: `x${t}`, text: w, sub: `x${t + 1}`, c: "is-text" })), false)}
          <p className="viz-k" style={{ marginTop: 8 }}>第 l 层 = Attention(第 l−1 层的所有位置)：一次矩阵乘法算完整层，层与层之间仍按顺序。</p>
        </div>
      </div>

      <div className="viz-stat" style={{ marginTop: 14 }}>
        <div><small>RNN 已完成的 hidden state</small><b>{tokens.reduce((s, _, t) => s + Array.from({ length: LAYERS }, (_, l) => (rnnReady(l + 1, t + 1) <= tick ? 1 : 0)).reduce((a: number, b) => a + b, 0), 0)} / {n * LAYERS}</b></div>
        <div><small>Transformer 已完成的层</small><b>{trDone} / {LAYERS}</b></div>
        <div><small>n 翻倍时 RNN 的步数</small><b>{n} + {LAYERS - 1} → {2 * n} + {LAYERS - 1}</b></div>
      </div>

      <div className="viz-narr" aria-live="polite">{narr}</div>
    </VisualizationFrame>
  );
}
