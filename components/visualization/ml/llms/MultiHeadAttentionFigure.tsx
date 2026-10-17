"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Bars from "@/components/visualization/ml/primitives/Bars";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Slider from "@/components/visualization/ml/primitives/Slider";
import { DEMO_E, DEMO_HEADS, DEMO_TOKENS, DEMO_WO, multiHeadAttention, multiHeadParams, splitHeads } from "@/lib/ml/attention";

// Page 4 of LLMs: d_model is cut into h slices, every head runs its own
// attention in d_k = d_model / h dimensions, the outputs are concatenated and
// mixed by W^O. The slider moves h; the table shows that the parameter total
// stays 4 d_model². A second panel runs two toy heads on the attention page's
// sentence and shows that they look at different tokens.

type Preset = "toy" | "gpt3";
const PRESETS: Record<Preset, { label: string; dModel: number; heads: number[]; defaultIdx: number }> = {
  toy: { label: "d_model = 128", dModel: 128, heads: [1, 2, 4, 8, 16], defaultIdx: 3 },
  gpt3: { label: "GPT-3：d_model = 12,288", dModel: 12288, heads: [1, 12, 24, 48, 96], defaultIdx: 4 },
};
const PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"];
const INK = "#3b4234";
const MUTED = "#76796f";
const LINE = "#c9c4ad";

const MH = multiHeadAttention(DEMO_E, DEMO_HEADS, DEMO_WO);
const FOCUS = 3; // Ryan
const SUB = ["₁", "₂", "₃", "₄"];

const fmt = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const num = (v: number, digits = 2) => v.toFixed(digits).replace("-", "−");
const vec = (v: number[], digits = 2) => `(${v.map((x) => num(x, digits)).join(", ")})`;
const argmax = (xs: number[]) => xs.indexOf(Math.max(...xs));

const W = 720;
const H = 170;
const BAR_X0 = 70;
const BAR_X1 = 520;
const BAR_H = 22;
const Y_IN = 30;
const Y_HEAD = 82;
const Y_CAT = 134;

export default function MultiHeadAttentionFigure() {
  const [preset, setPreset] = useState<Preset>("toy");
  const [hIdx, setHIdx] = useState(PRESETS.toy.defaultIdx);
  const cfg = PRESETS[preset];
  const h = cfg.heads[Math.min(hIdx, cfg.heads.length - 1)];
  const p = multiHeadParams(cfg.dModel, h);
  const slices = splitHeads(cfg.dModel, h);
  const scaleX = (dim: number) => BAR_X0 + (dim / cfg.dModel) * (BAR_X1 - BAR_X0);
  const wide = (BAR_X1 - BAR_X0) / h >= 44;

  const pick = (next: Preset) => {
    setPreset(next);
    setHIdx(PRESETS[next].defaultIdx);
  };

  const head1 = MH.heads[0].A[FOCUS];
  const head2 = MH.heads[1].A[FOCUS];
  const t1 = DEMO_TOKENS[argmax(head1)];
  const t2 = DEMO_TOKENS[argmax(head2)];

  const narr =
    preset === "toy"
      ? h === 1
        ? `h = 1 就是上一页的单头：一个 head 用完整的 d_k = 128，W_Q、W_K、W_V 各 128 × 128 = ${fmt(p.perHead)}，加上 W^O 共 ${fmt(p.total)}。只有一种「看谁」的模式。`
        : `h = ${h}：d_k = 128 / ${h} = ${p.dK}，每个 head 的 Q、K、V 都是 (B, T, ${p.dK})，${h} 个 head 的输出拼回 128。W_Q 一共 ${h} × (128 × ${p.dK}) = ${fmt(p.wq)} = 128²，加 W_K、W_V、W^O 共 ${fmt(p.total)}，和 h = 1 时一模一样：多头没有多花参数，只是把同样的 128 维分给了 ${h} 种看法。`
      : h === 96
        ? `h = 96：d_k = 12,288 / 96 = 128，这就是笔记里 W_Q、W_K 12,288 × 128 的来历：每个 head 把 12,288 维的 embedding 压到 128 维去比相关性。三种投影各 96 × (12,288 × 128) = 12,288²，加 W^O 共 4 × 12,288² ≈ ${(p.total / 1e6).toFixed(0)}M 参数，这只是一层里的 attention。`
        : `h = ${h}：d_k = 12,288 / ${h} = ${fmt(p.dK)}，每个 head 的 W_Q 是 12,288 × ${fmt(p.dK)}。总量仍是 4 × 12,288² ≈ ${(p.total / 1e6).toFixed(0)}M，把滑杆推到 96 就得到笔记里的 128 维 key / query 空间。`;
  const tone = preset === "gpt3" && h === 96 ? " is-good" : h === 1 ? " is-warn" : "";

  return (
    <VisualizationFrame
      title="Multi-head：把 d_model 切成 h 份，各看各的，再拼回来"
      description="拖动 h 看 d_k = d_model / h 怎么变、每个 head 的形状怎么变，以及四个权重矩阵的参数量为什么一直是 4 d_model²。下面是两个真实算出来的 head 对同一个 token 的不同权重。"
    >
      <div className="viz-row">
        <Slider label="heads h" value={Math.min(hIdx, cfg.heads.length - 1)} min={0} max={cfg.heads.length - 1} step={1} onChange={setHIdx} display={`h = ${h}`} id="mha-heads" />
        <div className="viz-chips" role="group" aria-label="d_model 预设">
          {(Object.keys(PRESETS) as Preset[]).map((k) => (
            <button key={k} type="button" className={`viz-chip${preset === k ? " is-on" : ""}`} aria-pressed={preset === k} onClick={() => pick(k)}>
              {PRESETS[k].label}
            </button>
          ))}
        </div>
      </div>

      <Figure width={W} height={H} label={`d_model ${fmt(cfg.dModel)} 切成 ${h} 个 head，每个 d_k = ${fmt(p.dK)}，拼接后过 W^O 回到 ${fmt(cfg.dModel)}`} minWidth={600}>
        <defs>
          <marker id="mha-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0 0 L8 4 L0 8 z" fill={LINE} />
          </marker>
        </defs>
        <text x={8} y={Y_IN + 15} fontSize={11.5} fill={INK} fontWeight={600}>X</text>
        <text x={8} y={Y_HEAD + 15} fontSize={11.5} fill={INK} fontWeight={600}>head_i</text>
        <text x={8} y={Y_CAT + 15} fontSize={11.5} fill={INK} fontWeight={600}>Concat</text>

        {/* input split into h slices */}
        {slices.map((s) => (
          <g key={s.head}>
            <rect x={scaleX(s.start)} y={Y_IN} width={scaleX(s.end) - scaleX(s.start)} height={BAR_H} fill={PALETTE[s.head % 4]} opacity={0.28} stroke="#fff" strokeWidth={1} />
            <rect x={scaleX(s.start)} y={Y_HEAD} width={scaleX(s.end) - scaleX(s.start)} height={BAR_H} fill="#fff" stroke={PALETTE[s.head % 4]} strokeWidth={1.4} rx={3} />
            <rect x={scaleX(s.start)} y={Y_CAT} width={scaleX(s.end) - scaleX(s.start)} height={BAR_H} fill={PALETTE[s.head % 4]} opacity={0.55} stroke="#fff" strokeWidth={1} />
            <line x1={(scaleX(s.start) + scaleX(s.end)) / 2} y1={Y_IN + BAR_H + 2} x2={(scaleX(s.start) + scaleX(s.end)) / 2} y2={Y_HEAD - 2} stroke={LINE} strokeWidth={1} markerEnd="url(#mha-arrow)" />
            <line x1={(scaleX(s.start) + scaleX(s.end)) / 2} y1={Y_HEAD + BAR_H + 2} x2={(scaleX(s.start) + scaleX(s.end)) / 2} y2={Y_CAT - 2} stroke={LINE} strokeWidth={1} markerEnd="url(#mha-arrow)" />
            {wide && (
              <text x={(scaleX(s.start) + scaleX(s.end)) / 2} y={Y_HEAD + 15} fontSize={11} textAnchor="middle" fill={PALETTE[s.head % 4]} fontWeight={600} className="mono">
                Att{h <= 8 ? ` ${s.head + 1}` : ""}
              </text>
            )}
          </g>
        ))}
        <text x={BAR_X1 + 8} y={Y_IN + 15} fontSize={11} fill={MUTED} className="mono">(B, T, {fmt(cfg.dModel)})</text>
        <text x={BAR_X1 + 8} y={Y_HEAD + 15} fontSize={11} fill={MUTED} className="mono">{h} × (B, T, {fmt(p.dK)})</text>
        <text x={BAR_X1 + 8} y={Y_CAT + 15} fontSize={11} fill={MUTED} className="mono">(B, T, {h} × {fmt(p.dK)})</text>
        <text x={(BAR_X0 + BAR_X1) / 2} y={Y_IN - 8} fontSize={11} textAnchor="middle" fill={MUTED}>
          d_model = {fmt(cfg.dModel)}，每个 head 的 W_Q,i、W_K,i、W_V,i 都是 {fmt(cfg.dModel)} × {fmt(p.dK)}
        </text>
        <text x={(BAR_X0 + BAR_X1) / 2} y={Y_CAT + BAR_H + 14} fontSize={11} textAnchor="middle" fill={MUTED}>
          × W^O（{fmt(h * p.dK)} × {fmt(cfg.dModel)}）→ (B, T, {fmt(cfg.dModel)})
        </text>
      </Figure>

      <div className="viz-grid2" style={{ marginTop: 8 }}>
        <div className="viz-panel">
          <h5 className="nocase">参数量，d_model = {fmt(cfg.dModel)}，h = {h}</h5>
          <table className="viz-table">
            <thead>
              <tr>
                <th>矩阵</th>
                <th>每个的形状</th>
                <th className="num">个数</th>
                <th className="num">参数量</th>
              </tr>
            </thead>
            <tbody>
              {(["W_Q", "W_K", "W_V"] as const).map((name) => (
                <tr key={name}>
                  <td>{name}</td>
                  <td className="viz-mono">{fmt(cfg.dModel)} × {fmt(p.dK)}</td>
                  <td className="num">{h}</td>
                  <td className="num">{fmt(p.wq)}</td>
                </tr>
              ))}
              <tr>
                <td>W^O</td>
                <td className="viz-mono">{fmt(h * p.dK)} × {fmt(cfg.dModel)}</td>
                <td className="num">1</td>
                <td className="num">{fmt(p.wo)}</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>合计</td>
                <td className="viz-mono">4 × d_model²</td>
                <td className="num"></td>
                <td className="num" style={{ fontWeight: 600 }}>{fmt(p.total)}</td>
              </tr>
            </tbody>
          </table>
          <p style={{ fontSize: 11.5, color: MUTED, marginTop: 8 }}>
            h × (d_model × d_k) = h × (d_model × d_model / h) = d_model²，h 消掉了。拖滑杆，最后一列不动。
          </p>
        </div>
        <div className="viz-panel">
          <h5 className="nocase">两个 head，同一个 Ryan，看的不一样（d = 4，d_k = 2）</h5>
          <div className="viz-k" style={{ marginBottom: 4 }}>head 1 → 最看 {t1}</div>
          <Bars rows={DEMO_TOKENS.map((t, j) => ({ label: `a${SUB[FOCUS]}${SUB[j]} → ${t}`, value: head1[j], color: j === argmax(head1) ? PALETTE[0] : "#9cc3ef", text: num(head1[j], 3) }))} />
          <div className="viz-k" style={{ margin: "10px 0 4px" }}>head 2 → 最看 {t2}</div>
          <Bars rows={DEMO_TOKENS.map((t, j) => ({ label: `a${SUB[FOCUS]}${SUB[j]} → ${t}`, value: head2[j], color: j === argmax(head2) ? PALETTE[1] : "#f3bda4", text: num(head2[j], 3) }))} />
          <p style={{ fontSize: 11.5, color: MUTED, marginTop: 8 }}>
            两个 head 的输出各 2 维，拼成 Concat = {vec(MH.concat[FOCUS])}，乘 W^O（4 × 4）得到 {vec(MH.out[FOCUS])}，又是 4 维。
          </p>
        </div>
      </div>

      <div className={`viz-narr${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}
