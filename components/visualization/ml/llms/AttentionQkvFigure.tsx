"use client";

import { useState, type CSSProperties } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Bars from "@/components/visualization/ml/primitives/Bars";
import Figure from "@/components/visualization/ml/primitives/Figure";
import StepPlayer from "@/components/visualization/ml/primitives/StepPlayer";
import { DEMO_ATTENTION, DEMO_E, DEMO_TOKENS, selfAttention } from "@/lib/ml/attention";
import type { Matrix } from "@/lib/ml/clip";

// Page 3 of LLMs: one self-attention layer on "Hi I am Ryan" with d = 4.
// Step through E → Q, K, V → S = QKᵀ/√d → A = softmax(S) → ΔE = AV → E' = E + ΔE.
// The chips choose which token's row is followed; every number comes from
// lib/ml/attention.ts (selfAttention) on the fixed DEMO_E and DEMO_W*.

const R = selfAttention(DEMO_E, DEMO_ATTENTION);
const D = DEMO_E[0].length;
const SQRT_D = Math.sqrt(R.dK);
const C_Q = "#2a78d6";
const C_K = "#eb6834";
const C_V = "#1baf7a";
const C_D = "#eda100";
const INK = "#3b4234";
const MUTED = "#76796f";
const LINE = "#c9c4ad";

const SUB = ["₁", "₂", "₃", "₄"];
const num = (v: number, digits = 2) => v.toFixed(digits).replace("-", "−");
const vec = (v: number[], digits = 2) => `(${v.map((x) => num(x, digits)).join(", ")})`;
const DIMS = Array.from({ length: D }, (_, j) => `d${SUB[j]}`);
const TOK_LABELS = DEMO_TOKENS.map((t, i) => `${SUB[i]} ${t}`);

type StepInfo = { key: string; title: string; shape: string };
const STEPS: StepInfo[] = [
  { key: "E", title: "E：四个 token 的 embedding", shape: "(B, T, d)" },
  { key: "QKV", title: "Q = E W_Q，K = E W_K，V = E W_V", shape: "(B, T, d_k)" },
  { key: "S", title: "S = Q Kᵀ / √d_k：每对 token 的相关性", shape: "(B, T, T)" },
  { key: "A", title: "A = softmax(S)：按行归一成权重", shape: "(B, T, T)" },
  { key: "AV", title: "ΔE = A V：按权重把 V 加起来", shape: "(B, T, d)" },
  { key: "E'", title: "E' = E + ΔE：更新这个 token 自己的向量", shape: "(B, T, d)" },
];

const SVG_W = 720;
const SVG_H = 120;
const TOK_Y = 86;
const TOK_X = (i: number) => 120 + i * 160;

export default function AttentionQkvFigure() {
  const [step, setStep] = useState(0);
  const [focus, setFocus] = useState(3);
  const f = focus;
  const name = DEMO_TOKENS[f];
  const top = R.A[f].indexOf(Math.max(...R.A[f]));

  const narr = [
    `起点：「${DEMO_TOKENS.join(" ")}」四个 token 各有一个 d = 4 的向量 E${SUB[0]}…E${SUB[3]}，这是 (B, T, d) 里的一个样本：T = 4 行，每行 d = 4 个数。聚焦 ${name}：E${SUB[f]} = ${vec(DEMO_E[f])}。此时它只知道自己，不知道旁边是谁。`,
    `同一个 E 乘三个不同的矩阵得到三份投影：Q${SUB[f]} = ${vec(R.Q[f])} 是 ${name} 发出的「我在找什么」，K${SUB[f]} = ${vec(R.K[f])} 是它亮出的「我是什么」，V${SUB[f]} = ${vec(R.V[f])} 是它愿意被拿走的内容。W_Q、W_K、W_V 是 d × d_k，这里 4 × 4。`,
    `${name} 的 Q${SUB[f]} 和每个 token 的 K 做点积再除以 √d_k = ${num(SQRT_D, 1)}，得到一行 4 个分数 ${vec(R.S[f])}。整张 S 是 T × T = 4 × 4：行是「谁在看」，列是「看谁」。`,
    `对 S 的每一行做 softmax：${name} 这一行变成 ${vec(R.A[f])}，和为 1。最大的一项落在「${DEMO_TOKENS[top]}」上（${num(R.A[f][top])}），说明在这组权重下 ${name} 主要在看 ${DEMO_TOKENS[top]}。换个 token 聚焦，每一行的分布都不一样。`,
    `把四个 V 按这行权重加起来：ΔE${SUB[f]} = Σ_j a${SUB[f]}ⱼ V_j = ${vec(R.out[f])}。权重大的 token 贡献多，${DEMO_TOKENS[top]} 的 V 占了 ${Math.round(R.A[f][top] * 100)}%。这一步输出又回到 (B, T, d)：每个 token 得到一个和自己同样长的向量。`,
    `最后 E${SUB[f]}' = E${SUB[f]} + ΔE${SUB[f]} = ${vec(R.updated![f])}。${name} 的向量被改了一点，改动来自它看过的其他 token，所以下一层再看到的 ${name} 已经带着上下文。残差相加让原来的 E 不会被覆盖。`,
  ][step];
  const tone = step === 5 ? " is-good" : "";

  return (
    <VisualizationFrame
      title="Attention：一个 token 怎么看别的 token"
      description="「Hi I am Ryan」，d = 4 的玩具 embedding 和固定的 W_Q、W_K、W_V。按步看一层 self-attention 把 E 变成 E' 的每一步；选一个 token，跟着它那一行走。"
    >
      <StepPlayer step={step} total={STEPS.length} onStep={setStep} intervalMs={1600} caption={`第 ${step} 步 / 共 ${STEPS.length - 1} 步`} />
      <div className="viz-row">
        <span className="viz-k">聚焦</span>
        <div className="viz-chips" role="group" aria-label="聚焦哪个 token">
          {DEMO_TOKENS.map((t, i) => (
            <button key={t} type="button" className={`viz-chip${f === i ? " is-on" : ""}`} aria-pressed={f === i} onClick={() => setFocus(i)}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="tok-strip" aria-label="每一步的形状" style={{ marginBottom: 10 }}>
        {STEPS.map((s, i) => (
          <span key={s.key} className={`tok${i < step ? " is-done" : i === step ? " is-active" : " is-wait"}`}>
            {s.key}
            <small>{s.shape}</small>
          </span>
        ))}
      </div>

      <Figure width={SVG_W} height={SVG_H} label={`${name} 对四个 token 的注意力${step >= 3 ? `：${vec(R.A[f])}` : "（还没算）"}`} minWidth={560}>
        {DEMO_TOKENS.map((t, j) => {
          const w = step >= 3 ? R.A[f][j] : 0;
          const x0 = TOK_X(f);
          const x1 = TOK_X(j);
          const show = step >= 2;
          const label = step >= 3 ? num(R.A[f][j]) : num(R.S[f][j]);
          const stroke = step >= 3 ? C_Q : LINE;
          const width = step >= 3 ? 1 + w * 9 : 1.2;
          const mid = (x0 + x1) / 2;
          const lift = j === f ? 34 : 18 + Math.abs(j - f) * 14;
          const d = j === f ? `M${x0 - 14} ${TOK_Y - 18} C ${x0 - 26} ${TOK_Y - 18 - lift * 1.3}, ${x0 + 26} ${TOK_Y - 18 - lift * 1.3}, ${x0 + 14} ${TOK_Y - 18}` : `M${x0} ${TOK_Y - 18} Q ${mid} ${TOK_Y - 18 - lift * 2.2} ${x1} ${TOK_Y - 18}`;
          const ly = j === f ? TOK_Y - 18 - lift - 8 : TOK_Y - 18 - lift - 4;
          return (
            <g key={t} opacity={show ? 1 : 0} style={{ transition: "opacity .3s" }}>
              <path d={d} fill="none" stroke={stroke} strokeWidth={width} strokeLinecap="round" opacity={step >= 3 ? 0.35 + w : 1} style={{ transition: "stroke-width .3s, stroke .3s" }} />
              <text x={j === f ? x0 : mid} y={ly} fontSize={11} textAnchor="middle" fill={step >= 3 ? C_Q : MUTED} fontWeight={step >= 3 && j === top ? 700 : 500} className="mono" stroke="#fff" strokeWidth={3} paintOrder="stroke">
                {step >= 3 ? "a" : "s"}{SUB[f]}{SUB[j]} = {label}
              </text>
            </g>
          );
        })}
        {DEMO_TOKENS.map((t, i) => {
          const on = i === f;
          return (
            <g key={t} onClick={() => setFocus(i)} style={{ cursor: "pointer" }}>
              <rect x={TOK_X(i) - 36} y={TOK_Y - 18} width={72} height={34} rx={7} fill={on ? INK : "#fff"} stroke={on ? INK : LINE} strokeWidth={1.3} style={{ transition: "fill .25s" }} />
              <text x={TOK_X(i)} y={TOK_Y + 3} fontSize={13} textAnchor="middle" fill={on ? "#fff" : INK} fontWeight={600}>{t}</text>
              <text x={TOK_X(i)} y={TOK_Y + 30} fontSize={11} textAnchor="middle" fill={MUTED} className="mono">E{SUB[i]}{step >= 5 ? " → E" + SUB[i] + "'" : ""}</text>
            </g>
          );
        })}
        <text x={8} y={14} fontSize={11} fill={MUTED}>{step < 2 ? "权重还没算出来：先要 Q 和 K" : step === 2 ? `s${SUB[f]}ⱼ = Q${SUB[f]}·Kⱼ / √d_k，还不是概率` : `a${SUB[f]}ⱼ 是 ${name} 分给每个 token 的权重，线越粗权重越大`}</text>
      </Figure>

      <div className="viz-panel" style={{ marginTop: 8 }} aria-live="polite">
        <h5 className="nocase">{STEPS[step].title} · 形状 {STEPS[step].shape}</h5>
        {step === 0 && <Mat title="E" m={DEMO_E} rows={TOK_LABELS} cols={DIMS} focusRow={f} color={INK} />}
        {step === 1 && (
          <div className="viz-row" style={{ alignItems: "flex-start", gap: "8px 20px", marginBottom: 0 }}>
            <Mat title="Q = E W_Q" m={R.Q} rows={TOK_LABELS} cols={DIMS} focusRow={f} color={C_Q} />
            <Mat title="K = E W_K" m={R.K} rows={TOK_LABELS} cols={DIMS} focusRow={f} color={C_K} />
            <Mat title="V = E W_V" m={R.V} rows={TOK_LABELS} cols={DIMS} focusRow={f} color={C_V} />
          </div>
        )}
        {step === 2 && (
          <div className="viz-grid2 wide-left">
            <Mat title="S：行 Q_i，列 K_j" m={R.S} rows={TOK_LABELS} cols={DEMO_TOKENS.map((t, j) => `K${SUB[j]} ${t}`)} focusRow={f} color={INK} onPick={setFocus} />
            <div style={{ fontSize: 12.5, lineHeight: 1.8 }}>
              <div><span className="viz-mono">Q{SUB[f]}</span> = <span className="viz-mono" style={{ color: C_Q }}>{vec(R.Q[f])}</span></div>
              <div><span className="viz-mono">K{SUB[top]}</span> = <span className="viz-mono" style={{ color: C_K }}>{vec(R.K[top])}</span></div>
              <div>
                <span className="viz-mono">s{SUB[f]}{SUB[top]}</span> = Q{SUB[f]}·K{SUB[top]} / √{R.dK} = {num(R.S[f][top] * SQRT_D)} / {num(SQRT_D, 1)} = <b className="viz-mono">{num(R.S[f][top])}</b>
              </div>
              <div style={{ color: MUTED, fontSize: 11.5 }}>除以 √d_k 是为了让 d_k 变大时分数不跟着变大，否则 softmax 会过早变成 one-hot。</div>
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="viz-grid2 wide-left">
            <Mat title="A = softmax(S)，每行和为 1" m={R.A} rows={TOK_LABELS} cols={DEMO_TOKENS.map((t, j) => `K${SUB[j]} ${t}`)} focusRow={f} color={C_Q} intensity onPick={setFocus} />
            <div>
              <div className="viz-k" style={{ marginBottom: 6 }}>{name} 这一行</div>
              <Bars rows={DEMO_TOKENS.map((t, j) => ({ label: `a${SUB[f]}${SUB[j]} → ${t}`, value: R.A[f][j], color: j === top ? C_Q : "#9cc3ef", text: num(R.A[f][j], 3) }))} />
            </div>
          </div>
        )}
        {step === 4 && (
          <table className="viz-table">
            <thead>
              <tr>
                <th>j</th>
                <th className="num">a{SUB[f]}ⱼ</th>
                <th>× V_j</th>
                <th className="num">= a{SUB[f]}ⱼ V_j</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_TOKENS.map((t, j) => (
                <tr key={t} style={{ opacity: 0.45 + R.A[f][j] }}>
                  <td>{t}</td>
                  <td className="num" style={{ color: C_Q }}>{num(R.A[f][j], 3)}</td>
                  <td className="viz-mono" style={{ color: C_V }}>{vec(R.V[j])}</td>
                  <td className="num" style={{ color: C_D }}>{vec(R.V[j].map((v) => v * R.A[f][j]))}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={3} style={{ fontWeight: 600 }}>ΔE{SUB[f]} = Σ_j a{SUB[f]}ⱼ V_j</td>
                <td className="num" style={{ color: C_D, fontWeight: 600 }}>{vec(R.out[f])}</td>
              </tr>
            </tbody>
          </table>
        )}
        {step === 5 && (
          <table className="viz-table">
            <tbody>
              <tr><td>E{SUB[f]}（原来的 {name}）</td><td className="num">{vec(DEMO_E[f])}</td></tr>
              <tr><td style={{ color: C_D }}>+ ΔE{SUB[f]}（从别的 token 拿来的）</td><td className="num" style={{ color: C_D }}>{vec(R.out[f])}</td></tr>
              <tr><td style={{ fontWeight: 600 }}>= E{SUB[f]}{"'"}（带上下文的 {name}）</td><td className="num" style={{ fontWeight: 600 }}>{vec(R.updated![f])}</td></tr>
            </tbody>
          </table>
        )}
      </div>

      <div className={`viz-narr${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}

type MatProps = {
  title: string;
  m: Matrix;
  rows: string[];
  cols: string[];
  focusRow: number;
  color: string;
  /** Shade each cell by its value (for A, values in [0, 1]). */
  intensity?: boolean;
  /** Clicking a row makes it the focused token. */
  onPick?: (row: number) => void;
};

// A small HTML matrix: the focused row is outlined, the others are dimmed.
function Mat({ title, m, rows, cols, focusRow, color, intensity, onPick }: MatProps) {
  const cell: CSSProperties = { width: 52, height: 32, fontSize: 11.5, display: "flex", alignItems: "center", justifyContent: "center", cursor: onPick ? "pointer" : "default" };
  return (
    <div className="mx-wrap">
      <div className="viz-k" style={{ marginBottom: 4, color }}>{title}</div>
      <table className="mx" style={{ margin: 0 }}>
        <thead>
          <tr>
            <th className="row-h"></th>
            {cols.map((c) => <th key={c} className="col-h" scope="col">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {m.map((row, i) => {
            const on = i === focusRow;
            return (
              <tr key={i} style={{ opacity: on ? 1 : 0.5, transition: "opacity .25s" }}>
                <th className="row-h" scope="row" style={{ color: on ? INK : undefined, fontWeight: on ? 600 : 500 }}>{rows[i]}</th>
                {row.map((v, j) => {
                  const bg = intensity ? `rgba(42, 120, 214, ${0.06 + v * 0.8})` : "#fff";
                  const dark = intensity && v > 0.5;
                  return (
                    <td key={j}>
                      {onPick ? (
                        <button type="button" className={`mx-cell${on ? " is-sel" : ""}${dark ? " is-dark" : ""}`} style={{ ...cell, background: bg, color: dark ? "#fff" : on ? color : INK }} aria-label={`${rows[i]} 行第 ${j + 1} 列：${num(v)}`} onClick={() => onPick(i)}>
                          {num(v)}
                        </button>
                      ) : (
                        <div className={`mx-cell${on ? " is-sel" : ""}`} style={{ ...cell, background: bg, color: on ? color : INK }}>{num(v)}</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

