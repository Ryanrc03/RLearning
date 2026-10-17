"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Slider from "@/components/visualization/ml/primitives/Slider";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import { averageOneHots, negativeWords, TOKENS, vocabIndex, windowPairs } from "@/lib/ml/embeddings";

// Page 16 of Representations: the sentence from the notes, "we are about to
// study the idea". Slide the centre word; the window (2 each side) picks the
// context, and the two routes read the same window the other way round:
// CBOW averages the context one-hots to predict the centre, Skip-gram sends
// the centre one-hot out to predict each context word.

type Route = "cbow" | "skipgram";

const WINDOW = 2;
const V = TOKENS.length;
const W = 720;
const H = 320;
const C_CBOW = "#2a78d6";
const C_SKIP = "#eb6834";
const INK = "#3b4234";
const MUTED = "#76796f";
const LINE = "#c9c4ad";
const FILL = "#e4dfcb";
const DEFAULT_CENTRE = 2;

const ROUTES: { key: Route; label: string }[] = [
  { key: "cbow", label: "CBOW" },
  { key: "skipgram", label: "Skip-gram" },
];

/** A word card with its one-hot drawn as seven tiny cells. */
function OneHotCard({ x, y, word, color, on }: { x: number; y: number; word: string; color: string; on: boolean }) {
  const idx = vocabIndex(word);
  const cell = 10;
  return (
    <g transform={`translate(${x} ${y})`} opacity={on ? 1 : 0.55}>
      <rect width={92} height={40} rx={6} fill="#fff" stroke={on ? color : LINE} strokeWidth={on ? 1.5 : 1} />
      <text x={8} y={16} fontSize={12} fontWeight={600} fill={INK}>{word}</text>
      {Array.from({ length: V }, (_, i) => (
        <rect key={i} x={8 + i * (cell + 1)} y={23} width={cell} height={10} rx={2} fill={i === idx ? color : "#fff"} stroke={i === idx ? color : LINE} strokeWidth={0.8} />
      ))}
    </g>
  );
}

/** A weight matrix drawn as V thin rows; the rows being looked up are filled. */
function MatrixBox({ x, y, w, h, label, sub, rows, color }: { x: number; y: number; w: number; h: number; label: string; sub?: string; rows: number[]; color: string }) {
  const rowH = (h - 12) / V;
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={w} height={h} rx={5} fill="#fff" stroke={LINE} />
      {Array.from({ length: V }, (_, i) => (
        <rect key={i} x={6} y={6 + i * rowH + 1} width={w - 12} height={rowH - 2} rx={1.5} fill={rows.includes(i) ? color : FILL} opacity={rows.includes(i) ? 0.9 : 0.6} style={{ transition: "fill .3s" }} />
      ))}
      <text x={w / 2} y={h + 14} fontSize={11.5} fontWeight={600} textAnchor="middle" fill={INK} className="mono">{label}</text>
      {sub && <text x={w / 2} y={h + 27} fontSize={10.5} textAnchor="middle" fill={MUTED}>{sub}</text>}
    </g>
  );
}

function Arrow({ x1, y1, x2, y2, color, dashed }: { x1: number; y1: number; x2: number; y2: number; color: string; dashed?: boolean }) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const hx = x2 - ux * 6;
  const hy = y2 - uy * 6;
  return (
    <g style={{ transition: "opacity .3s" }}>
      <line x1={x1} y1={y1} x2={hx} y2={hy} stroke={color} strokeWidth={1.4} strokeDasharray={dashed ? "4 3" : undefined} />
      <polygon points={`${x2},${y2} ${hx - uy * 3.5},${hy + ux * 3.5} ${hx + uy * 3.5},${hy - ux * 3.5}`} fill={color} />
    </g>
  );
}

function WordChip({ x, y, word, color, strong }: { x: number; y: number; word: string; color: string; strong: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={46} height={22} rx={11} fill={strong ? color : "#fff"} stroke={color} strokeWidth={1.2} style={{ transition: "fill .3s" }} />
      <text x={23} y={15} fontSize={11.5} fontWeight={600} textAnchor="middle" fill={strong ? "#fff" : color}>{word}</text>
    </g>
  );
}

/** Vertical positions for n stacked items centred on `mid`. */
function stack(n: number, mid: number, gap: number): number[] {
  return Array.from({ length: n }, (_, i) => mid + (i - (n - 1) / 2) * gap);
}

export default function Word2VecFigure() {
  const [centre, setCentre] = useState(DEFAULT_CENTRE);
  const [route, setRoute] = useState<Route>("cbow");

  const pairs = windowPairs(TOKENS, centre, WINDOW);
  const context = pairs.cbow.context;
  const contextIdx = context.map((w) => vocabIndex(w));
  const centreWord = TOKENS[centre];
  const negatives = negativeWords(TOKENS, centre, WINDOW);
  const avg = averageOneHots(contextIdx, V);
  const atEdge = context.length < 2 * WINDOW;
  const cbowOn = route === "cbow";

  const reset = () => {
    setCentre(DEFAULT_CENTRE);
    setRoute("cbow");
  };

  const MID = 160;
  const leftYs = stack(context.length, MID, 46);
  const rightYs = stack(context.length, MID, 46);
  const fmtCtx = context.join(", ");

  const narr = cbowOn
    ? `CBOW：中心词是第 ${centre + 1} 个词「${centreWord}」，窗口 2 取到 ${context.length} 个上下文（${fmtCtx}）。${context.length} 个 one-hot 各在 W_in 里查出一行，平均成一个向量 h，再过 softmax，训练目标是把「${centreWord}」在 ${V} 个词里排到第一。${atEdge ? "这里在句子边上，窗口只剩一边，上下文比平时少。" : ""}`
    : `Skip-gram：中心词「${centreWord}」的 one-hot 查出一行 W_in 得到 h，再乘 W_out 过 softmax，得到 P(w_context | ${centreWord})。这一步产生 ${pairs.skipgram.length} 个训练对：${pairs.skipgram.map(([, w]) => `${centreWord} → ${w}`).join("，")}，标签都是 1；窗口外的 ${negatives.join("、")} 作为负样本，标签 0。${atEdge ? "句子边上窗口只剩一边，训练对也少了。" : ""}`;

  return (
    <VisualizationFrame
      title="Word2Vec：同一个窗口，两种读法"
      description="滑杆移动中心词，窗口左右各取 2 个词。左边 CBOW 用上下文预测中心词，右边 Skip-gram 用中心词预测每个上下文词；当前选中的那条路线被点亮，另一条变淡。"
    >
      <div className="viz-row">
        <Tabs options={ROUTES} value={route} onChange={setRoute} ariaLabel="训练路线" />
        <button type="button" className="viz-btn" onClick={reset}>重置</button>
      </div>
      <Slider label="中心词位置" value={centre} min={0} max={V - 1} step={1} onChange={setCentre} display={`${centre + 1} · ${centreWord}`} id="w2v-centre" />

      <div className="tok-strip" style={{ marginBottom: 12 }} aria-label="句子，点任一词把它设为中心词">
        {TOKENS.map((t, i) => {
          const isCentre = i === centre;
          const inCtx = contextIdx.includes(i);
          return (
            <button key={t} type="button" className={`tok${isCentre ? " is-done" : inCtx ? " is-active" : " is-wait"}`} onClick={() => setCentre(i)} aria-pressed={isCentre}>
              {t}
              <small>{isCentre ? "中心" : inCtx ? "上下文" : "窗口外"}</small>
            </button>
          );
        })}
      </div>

      <Figure width={W} height={H} label={`中心词 ${centreWord}，上下文 ${fmtCtx}；当前路线 ${cbowOn ? "CBOW" : "Skip-gram"}`} minWidth={640}>
        {/* ---------- CBOW, left ---------- */}
        <g opacity={cbowOn ? 1 : 0.38} style={{ transition: "opacity .3s" }}>
          <rect x={6} y={6} width={348} height={H - 12} rx={8} fill={cbowOn ? "#f5f9fe" : "#fff"} stroke={cbowOn ? C_CBOW : LINE} strokeWidth={cbowOn ? 1.5 : 1} />
          <text x={18} y={26} fontSize={12.5} fontWeight={600} fill={C_CBOW}>CBOW：上下文 → 中心词</text>
          <text x={18} y={41} fontSize={10.5} fill={MUTED}>{context.length} 个 one-hot 共用一张 W_in，取平均</text>
          {context.map((w, k) => (
            <g key={w}>
              <OneHotCard x={18} y={leftYs[k] - 20} word={w} color={C_CBOW} on />
              <Arrow x1={112} y1={leftYs[k]} x2={134} y2={MID + (leftYs[k] - MID) * 0.5} color={C_CBOW} />
            </g>
          ))}
          <MatrixBox x={136} y={MID - 55} w={44} h={110} label="W_in" sub={`V × d`} rows={contextIdx} color={C_CBOW} />
          <Arrow x1={182} y1={MID} x2={206} y2={MID} color={C_CBOW} />
          <circle cx={226} cy={MID} r={19} fill="#fff" stroke={C_CBOW} strokeWidth={1.5} />
          <text x={226} y={MID + 4} fontSize={11.5} fontWeight={600} textAnchor="middle" fill={C_CBOW}>平均</text>
          <text x={226} y={MID + 34} fontSize={10.5} textAnchor="middle" fill={MUTED} className="mono">h = Σv / {context.length}</text>
          <Arrow x1={247} y1={MID} x2={260} y2={MID} color={C_CBOW} />
          <MatrixBox x={262} y={MID - 40} w={34} h={80} label="softmax" sub={`V = ${V}`} rows={[centre]} color={C_CBOW} />
          <Arrow x1={298} y1={MID} x2={305} y2={MID} color={C_CBOW} />
          <WordChip x={306} y={MID - 11} word={centreWord} color={C_CBOW} strong />
          <text x={329} y={MID + 26} fontSize={10.5} textAnchor="middle" fill={MUTED}>目标</text>
        </g>

        {/* ---------- Skip-gram, right ---------- */}
        <g opacity={cbowOn ? 0.38 : 1} style={{ transition: "opacity .3s" }}>
          <rect x={366} y={6} width={348} height={H - 12} rx={8} fill={cbowOn ? "#fff" : "#fef6f2"} stroke={cbowOn ? LINE : C_SKIP} strokeWidth={cbowOn ? 1 : 1.5} />
          <text x={378} y={26} fontSize={12.5} fontWeight={600} fill={C_SKIP}>Skip-gram：中心词 → 上下文</text>
          <text x={378} y={41} fontSize={10.5} fill={MUTED}>一个 one-hot，对每个上下文词各算一次 softmax</text>
          <OneHotCard x={378} y={MID - 20} word={centreWord} color={C_SKIP} on />
          <text x={424} y={MID + 34} fontSize={10.5} textAnchor="middle" fill={MUTED}>中心词</text>
          <Arrow x1={472} y1={MID} x2={492} y2={MID} color={C_SKIP} />
          <MatrixBox x={494} y={MID - 55} w={40} h={110} label="W_in" sub="V × d" rows={[centre]} color={C_SKIP} />
          <Arrow x1={536} y1={MID} x2={556} y2={MID} color={C_SKIP} />
          <circle cx={572} cy={MID} r={15} fill="#fff" stroke={C_SKIP} strokeWidth={1.5} />
          <text x={572} y={MID + 4} fontSize={11.5} fontWeight={600} textAnchor="middle" fill={C_SKIP} className="mono">h</text>
          <Arrow x1={589} y1={MID} x2={608} y2={MID} color={C_SKIP} />
          <MatrixBox x={610} y={MID - 55} w={40} h={110} label="W_out" sub="softmax" rows={contextIdx} color={C_SKIP} />
          {context.map((w, k) => (
            <g key={w}>
              <Arrow x1={652} y1={MID + (rightYs[k] - MID) * 0.5} x2={662} y2={rightYs[k]} color={C_SKIP} />
              <WordChip x={664} y={rightYs[k] - 11} word={w} color={C_SKIP} strong={false} />
            </g>
          ))}
          <text x={708} y={rightYs[rightYs.length - 1] + 28} fontSize={10.5} textAnchor="end" fill={MUTED}>各是 1 个训练对</text>
        </g>
      </Figure>

      <div className="viz-grid2" style={{ marginTop: 12 }}>
        <div className="viz-panel" style={{ opacity: cbowOn ? 1 : 0.55, borderColor: cbowOn ? C_CBOW : undefined, transition: "opacity .3s" }}>
          <h5>CBOW 这一步的训练样本</h5>
          <p className="viz-k" style={{ marginBottom: 6 }}>输入：{context.length} 个 one-hot 的平均（每个 1/{context.length}），目标：{centreWord}</p>
          <div className="tok-strip" aria-label="平均后的输入向量">
            {TOKENS.map((t, i) => (
              <span key={t} className={`tok${avg[i] > 0 ? " is-active" : " is-wait"}`} style={{ minWidth: 44 }}>
                <small>{t}</small>
                <span className="viz-mono">{avg[i] === 0 ? "0" : avg[i].toFixed(2)}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="viz-panel" style={{ opacity: cbowOn ? 0.55 : 1, borderColor: cbowOn ? undefined : C_SKIP, transition: "opacity .3s" }}>
          <h5>Skip-gram 这一步的训练对</h5>
          <table className="viz-table" style={{ margin: 0 }}>
            <thead>
              <tr><th>中心词</th><th>候选词</th><th className="num">标签</th></tr>
            </thead>
            <tbody>
              {pairs.skipgram.map(([c, w]) => (
                <tr key={w}><td>{c}</td><td>{w}</td><td className="num" style={{ color: "#0ca30c", fontWeight: 600 }}>1</td></tr>
              ))}
              {negatives.map((w) => (
                <tr key={w} style={{ color: MUTED }}><td>{centreWord}</td><td>{w} <small>负采样</small></td><td className="num">0</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={`viz-narr${atEdge ? " is-warn" : ""}`}>{narr}</div>
    </VisualizationFrame>
  );
}
