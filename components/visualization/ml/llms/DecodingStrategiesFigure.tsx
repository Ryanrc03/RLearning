"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Plot from "@/components/visualization/ml/primitives/Plot";
import Slider from "@/components/visualization/ml/primitives/Slider";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import { createRng } from "@/lib/ml/random";
import { softmaxTemperature } from "@/lib/ml/sampling";
import { beamSearch, DEFAULT_TOP_K, DEFAULT_TOP_P, DEMO_BEAM_TABLE, DEMO_NEXT_LOGITS, greedy, greedyPath, keptMass, renormalize, sampleFrom, temperedTable, topK, topP } from "@/lib/ml/decoding";

// Page 7 of LLMs: one next-token distribution after 「今天 很 想 吃」 and the
// five rules for picking from it. The tabs switch the rule, the slider the
// temperature. Blue bars are the eligible set, the number under each is its
// renormalised probability, the orange marker is this round's seeded draw.
// Beam search gets its own two-step tree with the log-prob sums.

type Strategy = "greedy" | "sampling" | "topk" | "topp" | "beam";

const STRATEGIES: { key: Strategy; label: string }[] = [
  { key: "greedy", label: "greedy" },
  { key: "sampling", label: "sampling" },
  { key: "topk", label: `top-k (k = ${DEFAULT_TOP_K})` },
  { key: "topp", label: `top-p (p = ${DEFAULT_TOP_P})` },
  { key: "beam", label: "beam (width 2)" },
];

const W = 720;
const H = 330;
const V1 = "#2a78d6";
const V2 = "#eb6834";
const V3 = "#1baf7a";
const INK = "#3b4234";
const MUTED = "#76796f";
const LINE = "#c9c4ad";
const FADE = "#e4dfcb";
const SEED_BASE = 1009;
const TOKENS = DEMO_NEXT_LOGITS.tokens;
const LOGITS = DEMO_NEXT_LOGITS.logits;
const BEAM_WIDTH = 2;

const pct = (p: number) => (p < 0.0005 ? "<0.1%" : `${(p * 100).toFixed(1)}%`);
const num = (v: number, digits = 2) => v.toFixed(digits).replace("-", "−");

// Park–Miller's first outputs are almost linear in a small seed, so warm the generator up before one draw.
function warmRng(seed: number) {
  const rng = createRng(seed);
  for (let i = 0; i < 8; i++) rng();
  return rng;
}

export default function DecodingStrategiesFigure() {
  const [strategy, setStrategy] = useState<Strategy>("greedy");
  const [T, setT] = useState(1);
  const [draw, setDraw] = useState(0);

  const probs = useMemo(() => softmaxTemperature(LOGITS, T), [T]);
  const mask = useMemo(() => {
    if (strategy === "greedy") return probs.map((_, i) => i === greedy(probs));
    if (strategy === "topk") return topK(probs, DEFAULT_TOP_K);
    if (strategy === "topp") return topP(probs, DEFAULT_TOP_P);
    return probs.map(() => true);
  }, [strategy, probs]);
  const q = useMemo(() => renormalize(probs, mask), [probs, mask]);
  const picked = useMemo(() => (strategy === "greedy" ? greedy(probs) : sampleFrom(warmRng(SEED_BASE + draw * 7919 + STRATEGIES.findIndex((s) => s.key === strategy) * 104729), probs, mask)), [strategy, probs, mask, draw]);
  const kept = mask.filter(Boolean).length;
  const mass = keptMass(probs, mask);

  const beamTable = useMemo(() => temperedTable(DEMO_BEAM_TABLE, T), [T]);
  const beam = useMemo(() => beamSearch(beamTable, BEAM_WIDTH), [beamTable]);
  const gp = useMemo(() => greedyPath(beamTable), [beamTable]);

  const changeStrategy = (s: Strategy) => {
    setStrategy(s);
    setDraw(0);
  };
  const changeT = (v: number) => {
    setT(v);
    setDraw(0);
  };
  const reset = () => {
    setStrategy("greedy");
    setT(1);
    setDraw(0);
  };

  const tDesc = T < 0.95 ? `T = ${T.toFixed(1)} 把分布压尖（p_max = ${pct(probs[0])}）` : T > 1.05 ? `T = ${T.toFixed(1)} 把分布压平（p_max = ${pct(probs[0])}）` : `T = 1 是模型原本的分布（p_max = ${pct(probs[0])}）`;
  const narr = (() => {
    switch (strategy) {
      case "greedy":
        return `greedy 每一步只取最高的那个：「${TOKENS[picked]}」${pct(probs[picked])}。${tDesc}，但温度改变不了谁是第一，所以对 greedy 没有作用；同一个 prompt 永远得到同一句话，而且每步最优不等于整句最优（见 beam）。`;
      case "sampling":
        return `random sampling 按概率在全部 ${kept} 个 token 里抽：这次抽到「${TOKENS[picked]}」（${pct(probs[picked])}）。${tDesc}。尾巴上的「的」「。」也有 ${pct(probs[8] + probs[9])} 的机会被抽到，抽到了句子就跑偏。`;
      case "topk":
        return `top-k 先留概率最高的 ${DEFAULT_TOP_K} 个（合计 ${pct(mass)}），把它们重新归一化后再抽：这次抽到「${TOKENS[picked]}」（归一化后 ${pct(q[picked])}）。${tDesc}，但 k 固定，留下的永远是 ${DEFAULT_TOP_K} 个，分布很尖时第 3 个可能已经很离谱，很平时又可能砍掉了合理的词。`;
      case "topp":
        return `top-p 留的是累计概率刚超过 ${DEFAULT_TOP_P} 的最小前缀：现在 ${kept} 个（合计 ${pct(mass)}），归一化后抽到「${TOKENS[picked]}」（${pct(q[picked])}）。${tDesc}，集合大小跟着变：分布尖时留得少，平时留得多，这是它比 top-k 省心的地方。`;
      case "beam":
        return `beam 不只看这一步。第一步「${gp.tokens[0]}」最高，可是「${beam.best.tokens[0]}」后面几乎必然接「${beam.best.tokens[1]}」：两步的 log p 加起来「${beam.best.tokens.join(" ")}」= ${num(beam.best.score)}，比 greedy 的「${gp.tokens.join(" ")}」= ${num(gp.score)} 大。宽度 2 就是每一步只留两条最好的路，${tDesc.split("（")[0]}只是改每一步的 p。`;
    }
  })();

  const tone = strategy === "beam" ? " is-good" : strategy === "sampling" && T > 1.05 ? " is-warn" : "";

  return (
    <VisualizationFrame
      title="Decoding：同一个分布，五种选法"
      description="prompt 是「今天 很 想 吃」，十个候选 token 的 logit 固定，火锅最高。切换策略看可选集合（蓝色）和重新归一化后的概率；温度先把 logit 除以 T 再过 softmax。抽样用固定种子，点「再抽一次」换一个种子。"
    >
      <div className="viz-endcap user" style={{ marginBottom: 12 }}>{DEMO_NEXT_LOGITS.prompt.join(" ")} <b className="viz-mono">▁</b></div>
      <div className="viz-row">
        <Tabs options={STRATEGIES} value={strategy} onChange={changeStrategy} ariaLabel="解码策略" />
      </div>
      <div className="viz-row">
        <Slider label="temperature T" value={T} min={0.5} max={2} step={0.1} onChange={changeT} display={T.toFixed(1)} id="dec-T" />
        {strategy !== "greedy" && strategy !== "beam" && (
          <button type="button" className="viz-btn primary" onClick={() => setDraw((d) => d + 1)}>再抽一次</button>
        )}
        <button type="button" className="viz-btn" onClick={reset}>重置</button>
      </div>

      {strategy !== "beam" ? (
        <Figure width={W} height={H} label={`${strategy}，T = ${T.toFixed(1)}，可选 ${kept} 个 token，抽到 ${TOKENS[picked]}`}>
          <Plot box={{ x: 0, y: 0, w: W, h: H }} xDomain={[0, TOKENS.length]} yDomain={[0, 1]} xTicks={[]} yTicks={[0, 0.25, 0.5, 0.75, 1]} yLabel="概率" title={`softmax(z / T)，T = ${T.toFixed(1)}；蓝色 = 可选集合，下方是重新归一化后的 p̃`} format={(v) => `${Math.round(v * 100)}%`}>
            {(f) => (
              <>
                {TOKENS.map((t, i) => {
                  const x0 = f.x(i + 0.18);
                  const x1 = f.x(i + 0.82);
                  const cx = (x0 + x1) / 2;
                  const top = f.y(probs[i]);
                  const on = mask[i];
                  const hit = i === picked;
                  return (
                    <g key={t}>
                      <rect x={x0} y={top} width={x1 - x0} height={Math.max(0, f.y0 - top)} fill={on ? V1 : FADE} opacity={on ? 0.85 : 1} rx={3} style={{ transition: "y .3s, height .3s, fill .3s" }} />
                      {on && q[i] !== probs[i] && (
                        <rect x={x0} y={f.y(q[i])} width={x1 - x0} height={Math.max(0, f.y0 - f.y(q[i]))} fill="none" stroke={V1} strokeWidth={1.2} strokeDasharray="3 3" rx={3} style={{ transition: "y .3s, height .3s" }} />
                      )}
                      <text x={cx} y={Math.min(top, f.y(q[i])) - 5} fontSize={11} textAnchor="middle" fill={on ? INK : MUTED} className="mono" style={{ transition: "y .3s" }}>{pct(probs[i])}</text>
                      {hit && <text x={cx} y={Math.min(top, f.y(q[i])) - 19} fontSize={12} fontWeight={700} textAnchor="middle" fill={V2}>▼ 抽到</text>}
                      <text x={cx} y={f.y0 + 16} fontSize={12.5} fontWeight={on ? 700 : 500} textAnchor="middle" fill={hit ? V2 : on ? V1 : MUTED}>{t}</text>
                      <text x={cx} y={f.y0 + 29} fontSize={11} textAnchor="middle" fill={on ? V1 : LINE} className="mono">{on ? `p̃ ${pct(q[i])}` : "—"}</text>
                    </g>
                  );
                })}
              </>
            )}
          </Plot>
        </Figure>
      ) : (
        <Figure width={W} height={H} label={`beam search 两步，宽度 2，最佳 ${beam.best.tokens.join(" ")}，log p 之和 ${num(beam.best.score)}`}>
          <BeamTree beam={beam} greedyTokens={gp.tokens} />
        </Figure>
      )}

      {strategy !== "beam" ? (
        <div className="viz-legend">
          <span><i style={{ background: V1 }} />可选集合，{kept} 个，原本合计 {pct(mass)}</span>
          <span><i style={{ background: FADE }} />被排除，概率归 0</span>
          <span><i style={{ background: "#fff", border: `1.5px dashed ${V1}` }} />虚线框 = 归一化后的 p̃</span>
          <span style={{ color: V2 }}>▼ 这一轮抽到的（第 {draw + 1} 个种子）</span>
        </div>
      ) : (
        <div className="viz-legend">
          <span><i style={{ background: V1 }} />每步留下的 {BEAM_WIDTH} 条路</span>
          <span><i style={{ background: V3 }} />log p 之和最大的那条</span>
          <span><i style={{ background: V2 }} />greedy 会走的路</span>
          <span><i style={{ background: FADE }} />被剪掉的</span>
        </div>
      )}

      <div className="viz-stat" style={{ marginTop: 12 }}>
        {strategy !== "beam" ? (
          <>
            <div><small>p_max（火锅）</small><b>{pct(probs[0])}</b></div>
            <div><small>可选 token 数</small><b>{kept}<span className="delta">/ {TOKENS.length}</span></b></div>
            <div><small>可选集合原本的合计</small><b>{pct(mass)}</b></div>
            <div><small>这一轮选到</small><b style={{ color: V2 }}>{TOKENS[picked]}<span className="delta">p̃ {pct(q[picked])}</span></b></div>
          </>
        ) : (
          <>
            <div><small>beam 最佳</small><b style={{ color: V3 }}>{beam.best.tokens.join(" ")}<span className="delta">{num(beam.best.score)}</span></b></div>
            <div><small>greedy 路径</small><b style={{ color: V2 }}>{gp.tokens.join(" ")}<span className="delta">{num(gp.score)}</span></b></div>
            <div><small>第一步留下</small><b>{beam.step1.filter((c) => c.kept).map((c) => c.tokens[0]).join("、")}</b></div>
            <div><small>第二步候选 → 留下</small><b>{beam.step2.length}<span className="delta">→ {BEAM_WIDTH}</span></b></div>
          </>
        )}
      </div>

      <div className={`viz-narr${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}

// Two-step beam tree: root → first tokens → continuations of the kept ones.
function BeamTree({ beam, greedyTokens }: { beam: ReturnType<typeof beamSearch>; greedyTokens: string[] }) {
  const X0 = 70;
  const X1 = 300;
  const X2 = 540;
  const HALF2 = 84;
  const ys1 = [90, 170, 250];
  const y2 = (i: number) => 56 + i * 68;
  const isBest = (tokens: string[]) => tokens.join("|") === beam.best.tokens.join("|");
  const isGreedy = (tokens: string[]) => tokens.every((t, i) => greedyTokens[i] === t);
  const nodeColor = (kept: boolean, tokens: string[]) => (isBest(tokens) ? V3 : kept ? V1 : LINE);
  return (
    <>
      <text x={X0} y={28} fontSize={12} fontWeight={600} textAnchor="middle" fill={INK}>prompt</text>
      <text x={X1} y={28} fontSize={12} fontWeight={600} textAnchor="middle" fill={INK}>第 1 步：log p₁</text>
      <text x={X2} y={28} fontSize={12} fontWeight={600} textAnchor="middle" fill={INK}>第 2 步：log p₁ + log p₂</text>
      <rect x={X0 - 52} y={170 - 16} width={104} height={32} rx={6} fill="#fff" stroke={INK} />
      <text x={X0} y={174} fontSize={12} textAnchor="middle" fill={INK}>今天 很 想 吃</text>

      {beam.step1.map((c, i) => {
        const y = ys1[i];
        const col = nodeColor(c.kept, c.tokens);
        const greedyEdge = isGreedy(c.tokens);
        return (
          <g key={c.tokens[0]}>
            <line x1={X0 + 52} y1={170} x2={X1 - 46} y2={y} stroke={greedyEdge ? V2 : col} strokeWidth={c.kept ? 2 : 1.2} strokeDasharray={c.kept ? undefined : "4 3"} />
            <rect x={X1 - 46} y={y - 16} width={92} height={32} rx={6} fill={c.kept ? "#fff" : "#f7f5ec"} stroke={col} strokeWidth={c.kept ? 2 : 1.2} />
            <text x={X1} y={y - 1} fontSize={12.5} fontWeight={600} textAnchor="middle" fill={c.kept ? INK : MUTED}>{c.tokens[0]}</text>
            <text x={X1} y={y + 12} fontSize={11} textAnchor="middle" fill={c.kept ? col : MUTED} className="mono">{num(c.score)}</text>
            {!c.kept && <text x={X1 + 52} y={y + 4} fontSize={11} fill={MUTED}>剪掉</text>}
          </g>
        );
      })}

      {beam.step2.map((c, i) => {
        const py = ys1[beam.step1.findIndex((k) => k.tokens[0] === c.tokens[0])];
        const y = y2(i);
        const col = nodeColor(c.kept, c.tokens);
        const best = isBest(c.tokens);
        const greedyEdge = isGreedy(c.tokens);
        return (
          <g key={c.tokens.join("|")}>
            <line x1={X1 + 46} y1={py} x2={X2 - HALF2} y2={y} stroke={greedyEdge ? V2 : col} strokeWidth={best ? 2.4 : c.kept ? 2 : 1.2} strokeDasharray={c.kept ? undefined : "4 3"} />
            <rect x={X2 - HALF2} y={y - 16} width={HALF2 * 2} height={32} rx={6} fill={best ? "#ecf8f3" : c.kept ? "#fff" : "#f7f5ec"} stroke={col} strokeWidth={best ? 2.4 : c.kept ? 2 : 1.2} />
            <text x={X2} y={y - 1} fontSize={12.5} fontWeight={600} textAnchor="middle" fill={c.kept ? INK : MUTED}>{c.tokens.join(" ")}</text>
            <text x={X2} y={y + 12} fontSize={11} textAnchor="middle" fill={c.kept ? col : MUTED} className="mono">{num(c.logps[0])} + {num(c.logps[1])} = {num(c.score)}</text>
            <text x={X2 + HALF2 + 8} y={y + 4} fontSize={11} fill={best ? V3 : greedyEdge ? V2 : MUTED}>{best ? "最佳" : greedyEdge ? "greedy" : c.kept ? "留下" : "剪掉"}</text>
          </g>
        );
      })}
    </>
  );
}
