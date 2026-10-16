"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Bars from "@/components/visualization/ml/primitives/Bars";
import Figure from "@/components/visualization/ml/primitives/Figure";
import StepPlayer from "@/components/visualization/ml/primitives/StepPlayer";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import { createRng } from "@/lib/ml/random";
import {
  BAGGING_SAMPLES,
  bootstrapSample,
  classStumpPredict,
  featureSubset,
  fitClassStump,
  majorityVote,
  residualChain,
  weightedCombine,
  type ClassStump,
  type Label,
} from "@/lib/ml/trees";

// Page 2 of Tree Models: three ways to combine trees. Switch the strategy,
// then step through its data flow: bagging draws bootstrap subsets and votes,
// boosting replays the notes' 180 → 20 → 10 → 0 residual chain, stacking
// feeds three base outputs into one meta model.

type Strategy = "bagging" | "boosting" | "stacking";
const TABS: { key: Strategy; label: string }[] = [
  { key: "bagging", label: "Bagging" },
  { key: "boosting", label: "Boosting" },
  { key: "stacking", label: "Stacking" },
];
const TOTAL: Record<Strategy, number> = { bagging: 5, boosting: 4, stacking: 3 };

const C0 = "#2a78d6";
const C1 = "#eb6834";
const C3 = "#1baf7a";
const C4 = "#eda100";
const CRIT = "#d03b3b";
const INK = "#3b4234";
const MUTED = "#76796f";
const FAINT = "#c9c4ad";
const LINE = "#e4dfcb";
const labelName = (l: Label) => (l === 0 ? "蓝" : "橙");
const labelColor = (l: Label) => (l === 0 ? C0 : C1);

// --- Bagging ---------------------------------------------------------------

const QUERY_X = 6.5;
const N = BAGGING_SAMPLES.length;
const FEATURES = ["年龄", "收入", "城市", "设备"];
const TREE_SEEDS = [1600, 1601, 1602];

type BaggedTree = { k: number; idx: number[]; times: number[]; stump: ClassStump; vote: Label; feats: number[] };

function buildBagging() {
  const trees: BaggedTree[] = TREE_SEEDS.map((seed, k) => {
    const idx = bootstrapSample(createRng(seed), N);
    const times = new Array<number>(N).fill(0);
    idx.forEach((i) => (times[i] += 1));
    const stump = fitClassStump(idx.map((i) => BAGGING_SAMPLES[i]));
    return { k, idx, times, stump, vote: classStumpPredict(stump, QUERY_X), feats: featureSubset(createRng(seed + 100), 2, FEATURES.length) };
  });
  const full = fitClassStump(BAGGING_SAMPLES);
  const vote = majorityVote(trees.map((t) => t.vote));
  return { trees, full, vote };
}

function BaggingView({ step, data }: { step: number; data: ReturnType<typeof buildBagging> }) {
  const W = 720;
  const H = 280;
  const X0 = 110;
  const X1 = 600;
  const sx = (x: number) => X0 + ((x - 1) / (N - 1)) * (X1 - X0);
  const rowY = (r: number) => 42 + r * 52;
  const showQuery = step >= 4;
  const stumpMark = (s: ClassStump, y: number, color: string) =>
    Number.isFinite(s.threshold) && (
      <g>
        <line x1={sx(s.threshold)} y1={y - 18} x2={sx(s.threshold)} y2={y + 14} stroke={color} strokeWidth={2} strokeDasharray="5 3" />
        <text x={sx(s.threshold)} y={y - 22} fontSize={11} fill={color} textAnchor="middle" className="mono">x ≤ {s.threshold}</text>
        <text x={sx(s.threshold) - 6} y={y + 26} fontSize={10.5} fill={labelColor(s.leftLabel)} textAnchor="end">← {labelName(s.leftLabel)}</text>
        <text x={sx(s.threshold) + 6} y={y + 26} fontSize={10.5} fill={labelColor(s.rightLabel)} textAnchor="start">{labelName(s.rightLabel)} →</text>
      </g>
    );
  return (
    <>
      <Figure width={W} height={H} label={`bagging：${step} 步，${step >= 4 ? `投票结果 ${labelName(data.vote.winner)}` : "还没投票"}`} minWidth={600}>
        <text x={X0 - 14} y={rowY(0) + 4} fontSize={12} fontWeight={600} fill={INK} textAnchor="end">全部数据</text>
        <line x1={X0 - 4} y1={rowY(0)} x2={X1 + 4} y2={rowY(0)} stroke={LINE} />
        {BAGGING_SAMPLES.map((p, i) => (
          <g key={i}>
            <circle cx={sx(p.x)} cy={rowY(0)} r={8} fill={labelColor(p.label)} stroke="#fff" strokeWidth={1.5} />
            <text x={sx(p.x)} y={rowY(0) - 13} fontSize={10.5} fill={MUTED} textAnchor="middle" className="mono">{p.x}</text>
          </g>
        ))}
        {step === 0 && stumpMark(data.full, rowY(0), MUTED)}
        {data.trees.map((t) => {
          const y = rowY(t.k + 1);
          const on = step >= t.k + 1;
          return (
            <g key={t.k} opacity={on ? 1 : 0.18} style={{ transition: "opacity .3s" }}>
              <text x={X0 - 14} y={y + 4} fontSize={12} fontWeight={600} fill={INK} textAnchor="end">树 {t.k + 1}</text>
              <line x1={X0 - 4} y1={y} x2={X1 + 4} y2={y} stroke={LINE} />
              {BAGGING_SAMPLES.map((p, i) => {
                const n = t.times[i];
                return (
                  <g key={i}>
                    <circle cx={sx(p.x)} cy={y} r={8} fill={n > 0 ? labelColor(p.label) : "#fff"} stroke={n > 0 ? "#fff" : FAINT} strokeWidth={1.5} strokeDasharray={n > 0 ? undefined : "2 2"} />
                    {n > 1 && <text x={sx(p.x) + 9} y={y - 7} fontSize={10} fontWeight={600} fill={INK} className="mono">×{n}</text>}
                  </g>
                );
              })}
              {on && stumpMark(t.stump, y, C4)}
              {on && showQuery && (
                <g>
                  <circle cx={X1 + 54} cy={y} r={11} fill={labelColor(t.vote)} />
                  <text x={X1 + 54} y={y + 4} fontSize={11} fontWeight={700} fill="#fff" textAnchor="middle">{labelName(t.vote)}</text>
                </g>
              )}
            </g>
          );
        })}
        {showQuery && (
          <g>
            <line x1={sx(QUERY_X)} y1={rowY(0) - 24} x2={sx(QUERY_X)} y2={rowY(3) + 24} stroke={INK} strokeWidth={1.5} />
            {[0, 1, 2, 3].map((r) => (
              <path key={r} d={`M${sx(QUERY_X)} ${rowY(r) - 9} l8 9 l-8 9 l-8 -9 z`} fill="#fff" stroke={INK} strokeWidth={2} />
            ))}
            <text x={sx(QUERY_X)} y={rowY(0) - 28} fontSize={11.5} fontWeight={600} fill={INK} textAnchor="middle">查询点 x = {QUERY_X}，它是哪一色？</text>
            <text x={X1 + 54} y={rowY(0) + 4} fontSize={11} fill={MUTED} textAnchor="middle">各自投票</text>
            <rect x={X0 - 4} y={rowY(4) - 16} width={X1 + 74 - X0} height={32} rx={8} fill="#fdf3cd" />
            <text x={X0 + 8} y={rowY(4) + 4} fontSize={12.5} fontWeight={600} fill={INK}>
              投票：{data.vote.tally.map((t) => `${labelName(t.label)} ${t.count} 票`).join("，")} → 多数说{labelName(data.vote.winner)}
            </text>
            <circle cx={X1 + 54} cy={rowY(4)} r={12} fill={labelColor(data.vote.winner)} />
            <text x={X1 + 54} y={rowY(4) + 4} fontSize={11} fontWeight={700} fill="#fff" textAnchor="middle">{labelName(data.vote.winner)}</text>
          </g>
        )}
      </Figure>
      <div className="viz-cards" style={{ marginTop: 10 }}>
        {data.trees.map((t) => {
          const distinct = t.times.filter((n) => n > 0).length;
          const on = step >= t.k + 1;
          return (
            <div className="viz-card" key={t.k} style={{ opacity: on ? 1 : 0.4 }}>
              <h6>树 {t.k + 1} 看到的</h6>
              <p>有放回抽 {N} 次，拿到 <b>{distinct}</b> 个不同样本（n ≤ N）</p>
              <p className="why">Random Forest 再每棵树只给 m ≤ M 个特征：{t.feats.map((i) => FEATURES[i]).join("、")}（4 选 2）</p>
            </div>
          );
        })}
      </div>
    </>
  );
}

// --- Boosting --------------------------------------------------------------

const TARGET = 180;
const TREE_PREDS = [160, 10, 10];
const TREE_COLORS = [C0, C1, C3];

function BoostingView({ step }: { step: number }) {
  const residuals = useMemo(() => [TARGET, ...residualChain(TARGET, TREE_PREDS)], []);
  const W = 420;
  const H = 280;
  const base = H - 40;
  const top = 30;
  const sy = (v: number) => base - (v / 200) * (base - top);
  const stages = [0, 1, 2, 3];
  const bx = (s: number) => 70 + s * 92;
  const bw = 56;
  return (
    <div className="viz-grid2 wide-left">
      <Figure width={W} height={H} label={`boosting：${step} 棵树，残差 ${residuals[step]}`} minWidth={360}>
        <line x1={30} y1={sy(TARGET)} x2={W - 10} y2={sy(TARGET)} stroke={INK} strokeWidth={1.5} strokeDasharray="6 4" />
        <text x={W - 10} y={sy(TARGET) - 6} fontSize={11.5} fontWeight={600} fill={INK} textAnchor="end">真实身高 {TARGET}</text>
        <line x1={30} y1={base} x2={W - 10} y2={base} stroke={MUTED} strokeWidth={1.2} />
        {stages.map((s) => {
          const on = s <= step;
          let acc = 0;
          const pred = TREE_PREDS.slice(0, s).reduce((a, b) => a + b, 0);
          return (
            <g key={s} opacity={on ? 1 : 0.2} style={{ transition: "opacity .3s" }}>
              {TREE_PREDS.slice(0, s).map((p, k) => {
                const y0 = acc;
                acc += p;
                return <rect key={k} x={bx(s)} y={sy(acc)} width={bw} height={sy(y0) - sy(acc)} fill={TREE_COLORS[k]} stroke="#fff" strokeWidth={1} />;
              })}
              {residuals[s] > 0 && (
                <g>
                  <line x1={bx(s) + bw + 8} y1={sy(pred)} x2={bx(s) + bw + 8} y2={sy(TARGET)} stroke={CRIT} strokeWidth={2} />
                  <line x1={bx(s) + bw + 4} y1={sy(pred)} x2={bx(s) + bw + 12} y2={sy(pred)} stroke={CRIT} strokeWidth={2} />
                  <line x1={bx(s) + bw + 4} y1={sy(TARGET)} x2={bx(s) + bw + 12} y2={sy(TARGET)} stroke={CRIT} strokeWidth={2} />
                </g>
              )}
              <text x={bx(s) + bw / 2} y={sy(pred) - 5} fontSize={11.5} fontWeight={600} fill={INK} textAnchor="middle" className="mono">{pred}</text>
              <text x={bx(s) + bw / 2} y={base + 16} fontSize={11.5} fill={INK} textAnchor="middle">{s === 0 ? "还没有树" : `${s} 棵树`}</text>
              <text x={bx(s) + bw / 2} y={base + 30} fontSize={11} fill={residuals[s] === 0 ? "#0ca30c" : CRIT} textAnchor="middle" className="mono">残差 {residuals[s]}</text>
            </g>
          );
        })}
      </Figure>
      <div className="viz-panel">
        <h5>每棵树学的是上一棵剩下的残差</h5>
        <Bars
          rows={residuals.map((r, s) => ({
            label: s === 0 ? "没有树" : `树 ${s} 之后`,
            hint: s === 0 ? "" : `树 ${s} 补 ${TREE_PREDS[s - 1]}`,
            value: s <= step ? r : 0,
            max: TARGET,
            color: s === 0 ? CRIT : TREE_COLORS[s - 1],
            text: s <= step ? String(r) : "–",
          }))}
        />
        <p className="viz-k" style={{ marginTop: 8 }}>
          {step === 0 ? "树 1 的训练目标：180" : step < 3 ? `树 ${step + 1} 的训练目标：${residuals[step]}，不是 ${TARGET}` : `${TREE_PREDS.join(" + ")} = ${TREE_PREDS.reduce((a, b) => a + b, 0)}`}
        </p>
      </div>
    </div>
  );
}

// --- Stacking --------------------------------------------------------------

const BASE_MODELS = [
  { name: "Decision Tree", out: 0.8, color: C0 },
  { name: "Logistic Regression", out: 0.55, color: C1 },
  { name: "kNN", out: 0.35, color: C3 },
];
const META_W = [0.6, 0.3, 0.1];

function StackingView({ step }: { step: number }) {
  const combined = useMemo(() => weightedCombine(BASE_MODELS.map((m) => m.out), META_W), []);
  const W = 720;
  const H = 240;
  const rowY = (i: number) => 60 + i * 60;
  const dataX = 40;
  const baseX = 250;
  const metaX = 500;
  const outX = 660;
  const box = (x: number, y: number, w: number, h: number, stroke: string, fill = "#fff") => <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={8} fill={fill} stroke={stroke} strokeWidth={1.5} />;
  return (
    <div className="viz-grid2 wide-left">
      <Figure width={W} height={H} label={`stacking：第 ${step} 步`} minWidth={600}>
        <g>
          {box(dataX + 40, rowY(1), 100, 56, "#d9d3bb")}
          <text x={dataX + 40} y={rowY(1) - 4} fontSize={12} fontWeight={600} fill={INK} textAnchor="middle">同一份数据</text>
          <text x={dataX + 40} y={rowY(1) + 12} fontSize={11} fill={MUTED} textAnchor="middle">一条样本 x</text>
        </g>
        {BASE_MODELS.map((m, i) => (
          <g key={m.name}>
            <line x1={dataX + 90} y1={rowY(1)} x2={baseX - 70} y2={rowY(i)} stroke={FAINT} strokeWidth={1.5} />
            {box(baseX, rowY(i), 140, 40, m.color)}
            <text x={baseX} y={rowY(i) + 4} fontSize={12} fontWeight={600} fill={m.color} textAnchor="middle">{m.name}</text>
            <g opacity={step >= 1 ? 1 : 0} style={{ transition: "opacity .3s" }}>
              <line x1={baseX + 70} y1={rowY(i)} x2={metaX - 60} y2={rowY(1)} stroke={m.color} strokeWidth={step >= 2 ? 1 + META_W[i] * 5 : 1.5} />
              <circle cx={baseX + 96} cy={rowY(i)} r={16} fill="#fff" stroke={m.color} strokeWidth={1.5} />
              <text x={baseX + 96} y={rowY(i) + 4} fontSize={11.5} fontWeight={600} fill={m.color} textAnchor="middle" className="mono">{m.out.toFixed(2)}</text>
              {step >= 2 && <text x={baseX + 130} y={rowY(i) - (i - 1) * 10 - 6} fontSize={11} fill={MUTED} className="mono">w = {META_W[i]}</text>}
            </g>
          </g>
        ))}
        <g opacity={step >= 1 ? 1 : 0.25} style={{ transition: "opacity .3s" }}>
          {box(metaX, rowY(1), 120, 56, C4, step >= 2 ? "#fdf3cd" : "#fff")}
          <text x={metaX} y={rowY(1) - 4} fontSize={12} fontWeight={600} fill={INK} textAnchor="middle">Meta 模型</text>
          <text x={metaX} y={rowY(1) + 12} fontSize={11} fill={MUTED} textAnchor="middle">{step >= 2 ? "线性组合 Σ wᵢ pᵢ" : "吃三个输出"}</text>
        </g>
        <g opacity={step >= 2 ? 1 : 0} style={{ transition: "opacity .3s" }}>
          <line x1={metaX + 60} y1={rowY(1)} x2={outX - 30} y2={rowY(1)} stroke={C4} strokeWidth={2} />
          <circle cx={outX} cy={rowY(1)} r={24} fill={C4} />
          <text x={outX} y={rowY(1) + 4} fontSize={12.5} fontWeight={700} fill="#fff" textAnchor="middle" className="mono">{combined.toFixed(2)}</text>
          <text x={outX} y={rowY(1) + 40} fontSize={11} fill={MUTED} textAnchor="middle">最终输出</text>
        </g>
        <text x={baseX} y={22} fontSize={11.5} fill={MUTED} textAnchor="middle">① 各自训练</text>
        <text x={baseX + 96} y={22} fontSize={11.5} fill={step >= 1 ? INK : FAINT} textAnchor="middle">② 输出当特征</text>
        <text x={metaX} y={22} fontSize={11.5} fill={step >= 2 ? INK : FAINT} textAnchor="middle">③ 再训一个模型</text>
      </Figure>
      <div className="viz-panel">
        <h5>Meta 模型怎么合</h5>
        <table className="viz-table">
          <thead><tr><th>基模型</th><th className="num">输出 p</th><th className="num">权重 w</th><th className="num">w · p</th></tr></thead>
          <tbody>
            {BASE_MODELS.map((m, i) => (
              <tr key={m.name}>
                <td style={{ color: m.color, fontWeight: 600 }}>{m.name}</td>
                <td className="num">{step >= 1 ? m.out.toFixed(2) : "–"}</td>
                <td className="num">{step >= 2 ? META_W[i].toFixed(1) : "–"}</td>
                <td className="num">{step >= 2 ? (m.out * META_W[i]).toFixed(3) : "–"}</td>
              </tr>
            ))}
            <tr style={{ fontWeight: 600 }}><td>合计</td><td /><td className="num">{step >= 2 ? META_W.reduce((a, b) => a + b, 0).toFixed(1) : ""}</td><td className="num">{step >= 2 ? combined.toFixed(2) : "–"}</td></tr>
          </tbody>
        </table>
        <p className="viz-k" style={{ marginTop: 8 }}>权重是 meta 模型在留出的数据上学出来的：哪个基模型平时更准，谁的票就更重。</p>
      </div>
    </div>
  );
}

// --- The figure ------------------------------------------------------------

export default function EnsemblesFigure() {
  const [strategy, setStrategy] = useState<Strategy>("bagging");
  const [step, setStep] = useState(0);
  const bagging = useMemo(() => buildBagging(), []);
  const total = TOTAL[strategy];
  const switchTo = (s: Strategy) => {
    setStrategy(s);
    setStep(0);
  };

  const narr = (() => {
    if (strategy === "bagging") {
      const t = bagging.trees[step - 1];
      if (step === 0) return `10 个样本、一个特征 x。x 大的多是橙点，但 x = 5 和 x = 7 两个是噪声。一棵树在全部数据上会切在 x ≤ ${bagging.full.threshold}；换一批数据，这一刀就会挪，这就是 variance。`;
      if (step <= 3) {
        const distinct = t.times.filter((n) => n > 0).length;
        return `树 ${step} 有放回地抽 10 次（bootstrap），拿到 ${distinct} 个不同样本，有的抽到两次、有的没抽到。它只看自己那份数据，切在 x ≤ ${t.stump.threshold}。${t.stump.threshold !== bagging.full.threshold ? "和全量数据的那一刀不一样。" : ""}`;
      }
      const votes = bagging.trees.map((x) => labelName(x.vote)).join(" / ");
      return `查询点 x = ${QUERY_X}：三棵树分别说 ${votes}，投票 ${bagging.vote.tally.map((x) => x.count).join(" : ")}，结果${labelName(bagging.vote.winner)}。一棵树被噪声带偏，三棵一投票就抵消了：bagging 降的是 variance。`;
    }
    if (strategy === "boosting") {
      const res = [TARGET, ...residualChain(TARGET, TREE_PREDS)];
      if (step === 0) return `真实身高 ${TARGET}，还没有树，残差就是 ${TARGET}。boosting 不让一棵树一次猜完，而是让第一棵先猜个大概。`;
      if (step === 1) return `树 1 预测 ${TREE_PREDS[0]}，残差 ${TARGET} − ${TREE_PREDS[0]} = ${res[1]}。树 2 的训练目标不再是 ${TARGET}，而是这个 ${res[1]}。`;
      if (step === 2) return `树 2 对着残差 ${res[1]} 学，补上 ${TREE_PREDS[1]}，残差剩 ${res[2]}。它只负责打补丁，不重做树 1 的活。`;
      return `树 3 再补 ${TREE_PREDS[2]}，残差 ${res[3]}。三棵树加起来 ${TREE_PREDS.join(" + ")} = ${TARGET}：一棵接一棵地修正前面的错，boosting 降的是 bias。`;
    }
    if (step === 0) return "stacking 先把三个不一样的模型各自训好：一棵树、一个线性模型、一个 kNN，都看同一份数据。";
    if (step === 1) return `对同一条样本，三个模型分别给出 ${BASE_MODELS.map((m) => m.out.toFixed(2)).join("、")}。把这三个数拼在一起，就是一条新的 3 维特征。`;
    return `再训一个 meta 模型吃这 3 维特征。这里它是一个线性组合：${BASE_MODELS.map((m, i) => `${META_W[i]} × ${m.out.toFixed(2)}`).join(" + ")} = ${weightedCombine(BASE_MODELS.map((m) => m.out), META_W).toFixed(2)}。它学的不是数据，而是「什么时候该信谁」。`;
  })();

  const tone = step === total - 1 ? " is-good" : "";
  const caption = strategy === "bagging" ? (step === 0 ? "全部数据" : step <= 3 ? `第 ${step} 棵树` : "投票") : strategy === "boosting" ? `${step} 棵树` : `第 ${step + 1} 步 / 共 3 步`;

  return (
    <VisualizationFrame
      title="Ensemble：三种把多个模型合成一个的办法"
      description="Bagging 让每棵树各看一份有放回抽出的子集再投票；boosting 让后一棵树只学前一棵剩下的残差；stacking 把几个模型的输出再交给一个模型去综合。"
    >
      <div className="viz-row">
        <Tabs options={TABS} value={strategy} onChange={switchTo} ariaLabel="集成策略" />
      </div>
      <StepPlayer step={step} total={total} onStep={setStep} intervalMs={1400} caption={caption} />
      {strategy === "bagging" && <BaggingView step={step} data={bagging} />}
      {strategy === "boosting" && <BoostingView step={step} />}
      {strategy === "stacking" && <StackingView step={step} />}
      <div className={`viz-narr${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}
