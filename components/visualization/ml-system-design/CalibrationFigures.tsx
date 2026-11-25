"use client";

import { useMemo, useState } from "react";
import Bars from "@/components/visualization/ml/primitives/Bars";
import Slider from "@/components/visualization/ml/primitives/Slider";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import { auc } from "@/lib/ml/metrics";
import {
  binPredictions,
  brier,
  brierFromBins,
  ece,
  ecpm,
  expandBlocks,
  makeCalibratedSample,
  PAVA_EXAMPLE,
  pavaSteps,
  RELIABILITY_BINS,
  temper,
} from "@/lib/ml/calibration";
import { Axes, CRIT, FlowChain, Legend, linePath, MsdFrame, P, plotFrame, type ChainStep } from "./kit";

// Figures of the Probability Calibration note. Every number shown is computed
// in lib/ml/calibration.ts from the teaching data of the note.

const TICKS = [0, 0.25, 0.5, 0.75, 1];
const num = (v: number) => String(Math.round(v * 1000) / 1000);

// ---------- 1. reliability diagram ----------

export function ReliabilityFigure() {
  const [mode, setMode] = useState<"before" | "after">("before");
  const f = plotFrame({ x: 0, y: 0, w: 440, h: 340 }, [0, 1], [0, 1]);
  const after = mode === "after";
  // After calibration each bucket predicts g(p) = its observed rate.
  const bins = after ? RELIABILITY_BINS.map((b) => ({ ...b, conf: b.acc })) : RELIABILITY_BINS;
  const pts = bins.map((b) => [b.conf, b.acc] as const);
  const gap = `${linePath(f, pts)} L${f.x(pts[pts.length - 1][0])} ${f.y(pts[pts.length - 1][0])} L${f.x(pts[0][0])} ${f.y(pts[0][0])} Z`;
  const eceBefore = ece(RELIABILITY_BINS);

  return (
    <MsdFrame
      title="图 1 · Reliability Diagram：预测的概率和实际发生的频率"
      description="每个点是一个分数桶。横轴是模型说的概率，纵轴是这个桶里真正有害的比例。"
      footnote={<>教学数据，每桶 100 条。「校准后」是把 g 用回拟合它的同一批数据，所以点恰好落在对角线上；真实效果要在另一份留出数据上看。</>}
    >
      <Tabs ariaLabel="校准前后" value={mode} onChange={setMode} options={[{ key: "before", label: "校准前：raw score" }, { key: "after", label: "校准后：g(raw score)" }]} />
      <div className="viz-grid2 wide-left">
        <div className="viz-scroll">
          <svg viewBox="0 0 440 340" role="img" aria-label={`Reliability Diagram，${after ? "校准后各点落在对角线上" : "校准前曲线整体在对角线下方，模型过度自信"}`} style={{ minWidth: 290 }}>
            <Axes f={f} xTicks={TICKS} yTicks={TICKS} xLabel="Predicted Probability" yLabel="Observed Positive Rate" />
            <line x1={f.x(0)} y1={f.y(0)} x2={f.x(1)} y2={f.y(1)} stroke={P.sub} strokeWidth={1.2} strokeDasharray="5 4" />
            <text x={f.x(0.6)} y={f.y(0.66)} fontSize={10.5} fill={P.sub} textAnchor="end">理想校准 y = x</text>
            {!after && <path d={gap} fill={CRIT} opacity={0.13} />}
            <path d={linePath(f, pts)} fill="none" stroke={after ? P.par : P.enc} strokeWidth={2.2} strokeLinejoin="round" />
            {pts.map(([px, py], i) => (
              <circle key={i} cx={f.x(px)} cy={f.y(py)} r={4.5} fill={after ? P.par : P.enc} stroke={P.surface} strokeWidth={1.5} />
            ))}
            {!after && (
              <>
                <text x={f.x(0.8)} y={f.y(0.44)} fontSize={11.5} fontWeight={600} fill={CRIT} textAnchor="middle">Overconfidence</text>
                <text x={f.x(0.8)} y={f.y(0.44) + 14} fontSize={9.5} fill={P.sub} textAnchor="middle">说 0.95，实际 0.85</text>
              </>
            )}
          </svg>
        </div>
        <div>
          <table className="viz-table">
            <thead><tr><th className="num">Raw Score</th><th className="num">样本数</th><th className="num">实际正例率</th><th className="num">差距</th></tr></thead>
            <tbody>
              {RELIABILITY_BINS.map((b) => (
                <tr key={b.conf}>
                  <td className="num">{b.conf.toFixed(2)}</td>
                  <td className="num">{b.n}</td>
                  <td className="num">{b.acc.toFixed(2)}</td>
                  <td className={`num${after ? "" : " is-crit"}`}>{after ? "0.00" : `−${(b.conf - b.acc).toFixed(2)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="viz-stat" style={{ marginTop: 12 }}>
            <div><small>ECE</small><b>{ece(bins).toFixed(3)}</b></div>
            <div><small>Brier Score</small><b>{brierFromBins(bins).toFixed(3)}</b></div>
          </div>
        </div>
      </div>
      <div className={`viz-narr${after ? " is-good" : " is-bad"}`} aria-live="polite">
        {after
          ? `校准函数 g 把每个 raw score 换成它那一桶的实际正例率：g(0.95) = 0.85，g(0.50) = 0.30。点的上下位置没变，只是横坐标被挪到了对角线上，ECE 从 ${eceBefore.toFixed(3)} 降到 ${ece(bins).toFixed(3)}。排序没有变，变的只是每个分数被读成多大的概率。`
          : `六个点全在对角线下方：模型说 0.95 的那 100 条里只有 85 条有害，说 0.50 的只有 30 条。每一桶预测都比实际高，这叫 overconfidence。按桶的样本数加权，平均差距 ECE = ${eceBefore.toFixed(3)}。`}
      </div>
    </MsdFrame>
  );
}

// ---------- 2. same ranking, different calibration ----------

const TEMPS = [0.4, 0.5, 0.7, 1, 1.5, 2, 3];

export function RankingVsCalibrationFigure() {
  const [idx, setIdx] = useState(1);
  const temperature = TEMPS[idx];
  const base = useMemo(() => {
    const items = makeCalibratedSample({ seed: 7, n: 2000 });
    return { items, bins: binPredictions(items, 10), auc: auc(items.map((x) => ({ score: x.p, label: x.label }))), brier: brier(items) };
  }, []);
  const b = useMemo(() => {
    const items = base.items.map((x) => ({ p: temper(x.p, temperature), label: x.label }));
    return { bins: binPredictions(items, 10), auc: auc(items.map((x) => ({ score: x.p, label: x.label }))), brier: brier(items) };
  }, [base, temperature]);
  const f = plotFrame({ x: 0, y: 0, w: 440, h: 330 }, [0, 1], [0, 1]);
  const eceA = ece(base.bins);
  const eceB = ece(b.bins);
  const kind = temperature < 1 ? "过度自信" : temperature > 1 ? "过度保守" : "和 A 相同";

  return (
    <MsdFrame
      title="图 2 · 排序相同，概率不同"
      description="模型 A 的概率是校准的。模型 B 把 A 的 logit 除以 T，顺序完全不变，只是概率被拉开或压扁。"
      footnote={<>2000 条模拟样本，固定随机种子。A 的标签按它自己的预测概率抽出，所以 A 天生校准；它的 ECE 不是 0 只因为样本有限。</>}
    >
      <Slider id="cal-temp" label="模型 B 的 T" value={idx} min={0} max={TEMPS.length - 1} step={1} onChange={setIdx} display={`T = ${temperature}（${kind}）`} />
      <div className="viz-grid2 wide-left">
        <div className="viz-scroll">
          <svg viewBox="0 0 440 330" role="img" aria-label={`两个模型的 Reliability 曲线：A 贴着对角线，B 在 T=${temperature} 时${kind}`} style={{ minWidth: 290 }}>
            <Axes f={f} xTicks={TICKS} yTicks={TICKS} xLabel="Predicted Probability" yLabel="Observed Positive Rate" />
            <line x1={f.x(0)} y1={f.y(0)} x2={f.x(1)} y2={f.y(1)} stroke={P.sub} strokeWidth={1.2} strokeDasharray="5 4" />
            <path d={linePath(f, base.bins.map((x) => [x.conf, x.acc] as const))} fill="none" stroke={P.par} strokeWidth={2.2} />
            <path d={linePath(f, b.bins.map((x) => [x.conf, x.acc] as const))} fill="none" stroke={P.dec} strokeWidth={2.2} style={{ transition: "d .3s" }} />
            {b.bins.map((x, i) => <circle key={i} cx={f.x(x.conf)} cy={f.y(x.acc)} r={3.5} fill={P.dec} stroke={P.surface} strokeWidth={1.2} />)}
          </svg>
        </div>
        <div>
          <table className="viz-table">
            <thead><tr><th>指标</th><th className="num">模型 A</th><th className="num">模型 B</th></tr></thead>
            <tbody>
              <tr><td>ROC-AUC（排序）</td><td className="num">{base.auc.toFixed(4)}</td><td className="num">{b.auc.toFixed(4)}</td></tr>
              <tr><td>ECE（校准）</td><td className="num">{eceA.toFixed(3)}</td><td className={`num${eceB > eceA + 0.02 ? " is-crit" : ""}`}>{eceB.toFixed(3)}</td></tr>
              <tr><td>Brier Score（两者都受影响）</td><td className="num">{base.brier.toFixed(3)}</td><td className="num">{b.brier.toFixed(3)}</td></tr>
            </tbody>
          </table>
          <Legend items={[{ tone: "par", label: "模型 A：校准" }, { tone: "dec", label: `模型 B：T = ${temperature}` }]} />
        </div>
      </div>
      <div className={`viz-narr${temperature === 1 ? " is-good" : " is-warn"}`} aria-live="polite">
        {temperature === 1
          ? "T = 1 时 B 就是 A，两条曲线重合。把滑杆往两边拖，AUC 那一行不会动。"
          : `两个模型把 2000 条样本排成同样的顺序，AUC 都是 ${base.auc.toFixed(4)}。但 B 的概率${temperature < 1 ? "被推向 0 和 1：它说 0.9 的地方实际远不到 0.9，曲线在高分段掉到对角线下面" : "被压向 0.5：它说 0.6 的地方实际比 0.6 高，曲线在高分段翘到对角线上面"}，ECE 从 ${eceA.toFixed(3)} 变成 ${eceB.toFixed(3)}。如果策略是「概率 ≥ 0.95 就删除」，A 和 B 会删掉数量完全不同的帖子。`}
      </div>
    </MsdFrame>
  );
}

// ---------- 3. PAVA ----------

const PAVA_CASES = {
  note: { label: "笔记里的例子", ...PAVA_EXAMPLE },
  chain: { label: "需要连续合并、样本数不等", scores: [0.1, 0.3, 0.5, 0.7, 0.9], rates: [0.1, 0.5, 0.4, 0.2, 0.9], weights: [100, 100, 100, 200, 100] },
};
type CaseKey = keyof typeof PAVA_CASES;

export function PavaFigure() {
  const [which, setWhich] = useState<CaseKey>("note");
  const [step, setStep] = useState(0);
  const data = PAVA_CASES[which];
  const steps = useMemo(() => pavaSteps(data.rates, data.weights), [data]);
  const cur = steps[Math.min(step, steps.length - 1)];
  const fitted = expandBlocks(cur.blocks);
  const last = step >= steps.length - 1;
  const f = plotFrame({ x: 0, y: 0, w: 440, h: 330 }, [0, 1], [0, 1]);
  const stepLabel = (i: number) => (i === 0 ? "Before" : i === steps.length - 1 ? "After" : `合并 ${i} 次`);
  const blockOf = (i: number) => cur.blocks.find((b) => b.start <= i && i <= b.end)!;

  let narr: string;
  if (step === 0) {
    const bad = data.rates.map((r, i) => (i < data.rates.length - 1 && r > data.rates[i + 1] ? `${num(r)} > ${num(data.rates[i + 1])}` : null)).filter(Boolean);
    narr = `原始观测：分数升序排列后，正例率应该不降。红色线段是违反的地方：${bad.join("，")}。PAVA 从左往右找到第一处相邻的违反，把这两个区间合并。`;
  } else {
    const prev = steps[step - 1].blocks;
    const a = prev[cur.pooled!];
    const b = prev[cur.pooled! + 1];
    const merged = cur.blocks[cur.pooled!];
    narr = `合并相邻的两个区间，取加权平均：(${a.weight} × ${num(a.value)} + ${b.weight} × ${num(b.value)}) / (${a.weight} + ${b.weight}) = ${num(merged.value)}。${last ? `现在整条曲线单调不降，拟合结束：[${fitted.map(num).join(", ")}]。绿色的平台就是被合并的区间，平台上的原始分数都映射到同一个概率。` : "合并出来的值比右边的邻居还大，仍然违反单调，所以要继续合并。"}`;
  }

  return (
    <MsdFrame
      title="图 3 · PAVA：把违反单调的相邻区间合并成平台"
      description="空心点是观测到的正例率，实线是当前的拟合。在 Before 和 After 之间切换。"
      footnote={<>每个点代表一个分数桶，用桶内样本数加权。真实训练时每条样本是一个点，标签是 0 或 1，过程完全相同。</>}
    >
      <div className="viz-controls">
        <div className="viz-chips" role="group" aria-label="选择例子">
          {(Object.keys(PAVA_CASES) as CaseKey[]).map((k) => (
            <button key={k} type="button" className={`viz-chip${which === k ? " is-on" : ""}`} aria-pressed={which === k} onClick={() => { setWhich(k); setStep(0); }}>{PAVA_CASES[k].label}</button>
          ))}
        </div>
      </div>
      <Tabs ariaLabel="PAVA 的步骤" value={String(Math.min(step, steps.length - 1))} onChange={(k) => setStep(Number(k))} options={steps.map((_, i) => ({ key: String(i), label: stepLabel(i) }))} />
      <div className="viz-grid2 wide-left">
        <div className="viz-scroll">
          <svg viewBox="0 0 440 330" role="img" aria-label={`PAVA ${stepLabel(step)}：拟合值 ${fitted.map(num).join("、")}`} style={{ minWidth: 290 }}>
            <Axes f={f} xTicks={[0.1, 0.3, 0.5, 0.7, 0.9]} yTicks={TICKS} xLabel="Raw Score（升序）" yLabel="Positive Rate" />
            {data.scores.slice(0, -1).map((s, i) => {
              const down = fitted[i] > fitted[i + 1];
              const flat = blockOf(i) === blockOf(i + 1);
              return (
                <line key={i} x1={f.x(s)} y1={f.y(fitted[i])} x2={f.x(data.scores[i + 1])} y2={f.y(fitted[i + 1])} stroke={down ? CRIT : flat ? P.par : P.enc} strokeWidth={down || flat ? 3.2 : 2} strokeLinecap="round" />
              );
            })}
            {data.scores.map((s, i) => (
              <g key={i}>
                {fitted[i] !== data.rates[i] && <line x1={f.x(s)} y1={f.y(data.rates[i])} x2={f.x(s)} y2={f.y(fitted[i])} stroke={P.sub} strokeWidth={1} strokeDasharray="3 3" />}
                <circle cx={f.x(s)} cy={f.y(data.rates[i])} r={5} fill={P.surface} stroke={P.sub} strokeWidth={1.6} />
                <circle cx={f.x(s)} cy={f.y(fitted[i])} r={3.2} fill={blockOf(i).end > blockOf(i).start ? P.par : P.enc} />
                <text x={f.x(s)} y={f.y(Math.max(fitted[i], data.rates[i])) - 10} fontSize={10.5} fontWeight={600} textAnchor="middle" fill={P.ink} className="mono">{num(fitted[i])}</text>
              </g>
            ))}
          </svg>
        </div>
        <div>
          <table className="viz-table">
            <thead><tr><th className="num">Raw Score</th><th className="num">样本数</th><th className="num">观测</th><th className="num">拟合</th></tr></thead>
            <tbody>
              {data.scores.map((s, i) => (
                <tr key={s}>
                  <td className="num">{s.toFixed(1)}</td>
                  <td className="num">{data.weights[i]}</td>
                  <td className="num">{num(data.rates[i])}</td>
                  <td className="num"><b>{num(fitted[i])}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
          <Legend items={[{ tone: "enc", label: "已经单调的部分" }, { tone: "par", label: "合并出的平台" }]} />
          <div className="viz-legend"><span><i style={{ background: CRIT }} />违反单调的线段</span></div>
        </div>
      </div>
      <div className={`viz-narr${step === 0 ? " is-bad" : last ? " is-good" : " is-warn"}`} aria-live="polite">{narr}</div>
    </MsdFrame>
  );
}

// ---------- 4. training and serving pipeline ----------

const OFFLINE: ChainStep[] = [
  { title: "Training Dataset", sub: "训练集", tone: "dyn" },
  { title: "Train Classifier", sub: "训练分类模型", tone: "enc" },
  { title: "Freeze Model", sub: "之后不再更新参数", tone: "enc" },
  { title: "Predict", sub: "on Calibration Dataset", tone: "dyn" },
  { title: "Raw Scores + Labels", sub: "分数 + Ground Truth", tone: "dyn" },
  { title: "Fit Isotonic Regression", sub: "只学 score → 概率", tone: "att" },
  { title: "Evaluate", sub: "on Held-out Test Dataset", tone: "par" },
  { title: "Deploy", sub: "Model + Calibrator", tone: "dec" },
];

const ONLINE: ChainStep[] = [
  { title: "Features", tone: "dyn" },
  { title: "Classifier", sub: "冻结的模型", tone: "enc" },
  { title: "Raw Score", tone: "dyn" },
  { title: "Calibrator", sub: "Isotonic 查表", tone: "att" },
  { title: "Calibrated p", sub: "可当概率读", tone: "dyn" },
  { title: "Decision Policy", sub: "阈值 → 动作", tone: "dec" },
];

export function CalibrationPipelineFigure() {
  const [mode, setMode] = useState<"offline" | "online">("offline");
  return (
    <MsdFrame title="图 4 · Calibration 的训练流程和线上流程" description="离线拟合一次 calibrator，线上每次推理多做一次查表。">
      <Tabs ariaLabel="离线或线上" value={mode} onChange={setMode} options={[{ key: "offline", label: "离线：拟合 Calibrator" }, { key: "online", label: "线上：Serving" }]} />
      {mode === "offline"
        ? <FlowChain id="cpo" steps={OFFLINE} perRow={4} label="离线流程：训练分类模型，冻结，在 Calibration Dataset 上预测，用分数和标签拟合 Isotonic Regression，在留出的测试集上评估，再和模型一起发布" />
        : <FlowChain id="cpn" steps={ONLINE} perRow={6} label="线上流程：Features 经过分类模型得到 Raw Score，经过 Calibrator 得到校准后的概率，再交给 Decision Policy" />}
      <Legend items={[{ tone: "dyn", label: "数据与分数" }, { tone: "enc", label: "分类模型" }, { tone: "att", label: "Calibrator" }, { tone: "par", label: "评估" }, { tone: "dec", label: "发布与决策" }]} />
      <div className={`viz-narr${mode === "online" ? " is-good" : ""}`} aria-live="polite">
        {mode === "offline"
          ? "整个流程用到三份互不重叠的数据：Training Dataset 训练模型，Calibration Dataset 拟合 calibrator，Held-out Test Dataset 只用来看最终效果。模型在自己训练过的数据上分数偏极端，拿这些分数拟合 calibrator 会学到一个上线后不成立的映射。"
          : "Calibrator 是一张有序的节点表，线上对每个 raw score 做一次二分查找加一次线性插值，开销相对模型本身可以忽略。模型和 calibrator 是配套的：模型换版本，calibrator 必须重新拟合。"}
      </div>
    </MsdFrame>
  );
}

// ---------- 5. ads: eCPM before and after ----------

const ADS = [
  { name: "广告 A", bid: 2, raw: 0.1, calibrated: 0.06, color: "var(--bah-c2)" },
  { name: "广告 B", bid: 3, raw: 0.05, calibrated: 0.05, color: "var(--bah-c1)" },
];

export function AdsEcpmFigure() {
  const [mode, setMode] = useState<"before" | "after">("before");
  const rows = ADS.map((ad) => {
    const pCtr = mode === "before" ? ad.raw : ad.calibrated;
    return { ...ad, pCtr, ecpm: ecpm(pCtr, ad.bid) };
  });
  const winner = [...rows].sort((a, b) => b.ecpm - a.ecpm)[0];
  const a = rows[0];
  const real = ecpm(ADS[0].calibrated, ADS[0].bid);

  return (
    <MsdFrame
      title="图 5 · 校准前后的 eCPM 和排序"
      description="两个广告争一个位置，按 eCPM 排序。广告 A 的 pCTR 被模型高估了，广告 B 的是准的。"
      footnote={<>示意数字。eCPM = 1000 × pCTR × CPC Bid，单位是每千次展示的美元数。</>}
    >
      <Tabs ariaLabel="校准前后" value={mode} onChange={setMode} options={[{ key: "before", label: "Before Calibration" }, { key: "after", label: "After Calibration" }]} />
      <Bars rows={rows.map((r) => ({ label: `${r.name}：pCTR ${r.pCtr.toFixed(2)} × $${r.bid}`, value: r.ecpm, max: 220, color: r.color, text: `eCPM $${r.ecpm.toFixed(0)}` }))} />
      <div className="viz-stat" style={{ marginTop: 12 }}>
        <div><small>赢得展示位</small><b>{winner.name}</b></div>
        <div><small>A 的预期 eCPM</small><b>${a.ecpm.toFixed(0)}</b></div>
        <div><small>A 实际能带来的 eCPM</small><b>${real.toFixed(0)}</b></div>
      </div>
      <div className={`viz-narr${mode === "before" ? " is-bad" : " is-good"}`} aria-live="polite">
        {mode === "before"
          ? `模型说 A 的点击率是 0.10，eCPM = 1000 × 0.10 × 2 = $${a.ecpm.toFixed(0)}，高于 B 的 $${rows[1].ecpm.toFixed(0)}，A 赢得位置。但 A 的真实点击率只有 0.06，这个位置实际只换回 $${real.toFixed(0)}，比让给 B 少了 $${(rows[1].ecpm - real).toFixed(0)}。高估的不是排序里的一个小数点，而是一次错误的拍卖结果。`
          : `校准后 A 的 pCTR 变成 0.06，eCPM = 1000 × 0.06 × 2 = $${a.ecpm.toFixed(0)}，低于 B 的 $${rows[1].ecpm.toFixed(0)}，位置给了 B。模型对每个广告内部的排序能力没有变，变的是不同广告之间用概率乘出价比较时，谁该排在前面。`}
      </div>
    </MsdFrame>
  );
}
