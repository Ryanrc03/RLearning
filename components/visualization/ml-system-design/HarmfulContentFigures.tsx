"use client";

import { useMemo, useState } from "react";
import Slider from "@/components/visualization/ml/primitives/Slider";
import { confusionAtThreshold, makeScoredDataset, precision, recall } from "@/lib/ml/metrics";
import { makeCascadePosts, operatingPoints, recallAtPrecision, runCascade } from "@/lib/ml/calibration";
import { Arrow, Axes, Box, CRIT, Legend, linePath, Markers, MsdFrame, P, pct, plotFrame, type Tone } from "./kit";

// System-level figures of the Harmful Content Detection case study: decision
// policy, features, leakage timeline, two-stage inference, the Recall@Precision
// operating point, and the creator graph.

// ---------- 2. high level design: score → calibration → policy ----------

const T_DEMOTE = 0.7;
const T_DELETE = 0.95;
const ACTIONS = [
  { key: "allow", title: "Allow", sub: "正常分发", tone: "par" as Tone, cx: 121, range: "p < 70%" },
  { key: "demote", title: "Demote", sub: "降低分发，排队人工审核", tone: "dyn" as Tone, cx: 350, range: "70% ≤ p < 95%" },
  { key: "delete", title: "Delete", sub: "自动删除", tone: "dec" as Tone, cx: 579, range: "p ≥ 95%" },
];

export function DecisionPolicyFigure() {
  const [percent, setPercent] = useState(82);
  const p = percent / 100;
  const active = p >= T_DELETE ? 2 : p >= T_DEMOTE ? 1 : 0;
  const act = ACTIONS[active];
  const ID = "hld";
  const text = [
    `校准后的概率是 ${percent}%，低于 70%，帖子正常分发。绝大多数帖子都走这一档，系统对它们什么也不做。`,
    `校准后的概率是 ${percent}%，落在 70% 到 95% 之间。系统不够确定，不能自动删除，但风险已经不低：先降低它的分发量来减少可能的有害曝光，同时排进人工审核队列。`,
    `校准后的概率是 ${percent}%，达到 95%，自动删除。这一档直接对应业务约束「自动删除的 Precision ≥ 95%」，所以这里的 95% 必须是校准过的概率，而不是模型的原始分数。`,
  ][active];

  return (
    <MsdFrame
      title="图 1 · High Level Design：分类模型、校准、决策策略"
      description="拖动校准后的概率，看帖子落进哪一档。模型只负责给分，动作由策略决定。"
      footnote={<>70% 和 95% 是教学示例阈值，实际阈值要用验证数据和线上业务约束来定。</>}
    >
      <Slider id="hld-p" label="校准后的概率 p" value={percent} min={0} max={100} step={1} onChange={setPercent} display={`${percent}% → ${act.title}`} />
      <div className="viz-scroll">
        <svg viewBox="0 0 700 226" role="img" aria-label={`Post Created 和 Post Viewed 触发 Classification Model，Raw Score 经过 Calibration 得到概率 ${percent}%，Decision Policy 选择 ${act.title}`} style={{ minWidth: 620 }}>
          <Markers id={ID} />
          <Box x={16} y={18} w={112} h={36} tone="neu" title="Post Created" />
          <Box x={16} y={68} w={112} h={36} tone="neu" title="Post Viewed" />
          <Arrow id={ID} tone="neu" d="M130 36 C148 36 148 54 163 54" />
          <Arrow id={ID} tone="neu" d="M130 86 C148 86 148 68 163 68" />
          <Box x={166} y={36} w={142} h={50} tone="enc" title="Classification Model" sub="识别内容风险" />
          <Arrow id={ID} tone="enc" d="M310 61 H333" />
          <Box x={336} y={36} w={92} h={50} tone="dyn" title="Raw Score" sub="未校准" />
          <Arrow id={ID} tone="dyn" d="M430 61 H455" />
          <Box x={458} y={36} w={120} h={50} tone="att" title="Calibration" sub="score → 概率" />
          <text x={16} y={132} fontSize={9.5} fontWeight={600} fill={P.sub}>DECISION POLICY</text>
          <text x={526} y={106} fontSize={11} fontWeight={600} fill={P.ink} className="mono">p = {percent}%</text>

          <path d="M121 118 H579" fill="none" stroke={P.sub} strokeWidth={1.2} opacity={0.3} />
          <path d={`M518 88 V118 H${act.cx}`} fill="none" stroke={P.att} strokeWidth={2.2} strokeLinejoin="round" />
          {ACTIONS.map((a, i) => (
            <g key={a.key}>
              <Arrow id={ID} tone={i === active ? "att" : "neu"} d={`M${a.cx} 118 V155`} bold={i === active} dim={i !== active} />
              <text x={a.cx + 7} y={142} fontSize={9.5} fill={P.sub} opacity={i === active ? 1 : 0.5}>{a.range}</text>
              <Box x={a.cx - 75} y={158} w={150} h={52} tone={a.tone} title={a.title} sub={a.sub} bold={i === active} dim={i !== active} size={11.5} />
            </g>
          ))}
        </svg>
      </div>
      <Legend items={[{ tone: "neu", label: "触发推理的事件" }, { tone: "enc", label: "模型" }, { tone: "att", label: "Calibration" }, { tone: "par", label: "Allow" }, { tone: "dyn", label: "Demote" }, { tone: "dec", label: "Delete" }]} />
      <div className={`viz-narr${active === 2 ? " is-bad" : active === 1 ? " is-warn" : " is-good"}`} aria-live="polite">{text}</div>
    </MsdFrame>
  );
}

// ---------- 3.2 feature columns ----------

const FEATURE_COLUMNS = [
  { title: "Content Features", color: "var(--bah-c1)", fresh: "发帖时就能算，之后不变，可以缓存", items: ["Concatenated Text：标题、正文、图片里 OCR 出的文字拼在一起", "Post Images", "Text Embeddings", "Image Embeddings"] },
  { title: "Behavioral Features", color: "var(--bah-c5)", fresh: "发帖后才逐渐出现，需要实时计数", items: ["Negative Reactions / Views", "Shares / Views", "Reports / Views", "Real-time Tallies：最近几分钟内的累计计数"] },
  { title: "Creator Features", color: "var(--bah-c3)", fresh: "变化慢，离线批量更新即可", items: ["User Embedding", "Age of Account", "Historical Violations", "Last N Posts：最近几条帖子的内容和处理结果"] },
];

export function FeatureColumnsFigure() {
  return (
    <MsdFrame title="图 2 · 三类特征" description="按信息来源分成三栏，每一栏的更新频率不同，这决定了它们在线上怎样计算和存放。">
      <div className="msd-cols">
        {FEATURE_COLUMNS.map((c) => (
          <div key={c.title} className="msd-col" style={{ ["--c" as string]: c.color }}>
            <h5>{c.title}</h5>
            <small>{c.fresh}</small>
            <ul>{c.items.map((it) => <li key={it}>{it}</li>)}</ul>
          </div>
        ))}
      </div>
      <div className="viz-narr">行为特征都写成比例（除以 Views）而不是原始计数：一条 100 万曝光的帖子有 50 次举报，和一条 100 曝光的帖子有 50 次举报，是完全不同的信号。</div>
    </MsdFrame>
  );
}

// ---------- 3.3 leakage timeline ----------

const EVENTS = [
  { t: 0, x: 80, title: "Post Created", tone: "neu" as Tone, views: 0, reports: 0 },
  { t: 5, x: 250, title: "100 Views", tone: "dyn" as Tone, views: 100, reports: 0 },
  { t: 10, x: 420, title: "Model Inference", tone: "enc" as Tone, views: 0, reports: 0 },
  { t: 60, x: 610, title: "20 User Reports", tone: "att" as Tone, views: 0, reports: 20 },
];
const INFER_T = 10;

function featuresAsOf(cutoff: number) {
  const seen = EVENTS.filter((e) => e.t <= cutoff);
  const views = seen.reduce((s, e) => s + e.views, 0);
  const reports = seen.reduce((s, e) => s + e.reports, 0);
  return { views, reports, rate: views === 0 ? 0 : reports / views };
}

export function LeakageTimelineFigure() {
  const [cutoff, setCutoff] = useState(INFER_T);
  const leak = cutoff > INFER_T;
  const online = featuresAsOf(INFER_T);
  const train = featuresAsOf(cutoff);
  const cutX = EVENTS.find((e) => e.t === cutoff)!.x;
  const ID = "leak";

  return (
    <MsdFrame
      title="图 3 · Point-in-time Correctness：训练样本只能用推理时刻已有的特征"
      description="同一条帖子，线上在 T = 10 min 做推理。切换训练样本的特征截止时刻，看它和线上看到的是否一致。"
      footnote={<>时间轴不按比例。数字是示例。</>}
    >
      <div className="viz-controls" role="group" aria-label="训练样本的特征截止时刻">
        <button type="button" className={`viz-btn${!leak ? " is-on" : ""}`} aria-pressed={!leak} onClick={() => setCutoff(INFER_T)}>按 T = 10 min 取特征</button>
        <button type="button" className={`viz-btn${leak ? " is-on" : ""}`} aria-pressed={leak} onClick={() => setCutoff(60)}>按 T = 60 min 取特征</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox="0 0 700 170" role="img" aria-label={`时间轴：0 分钟发帖，5 分钟 100 次曝光，10 分钟模型推理，60 分钟 20 次举报。训练特征截止到 ${cutoff} 分钟${leak ? "，包含了推理时还不存在的举报" : ""}`} style={{ minWidth: 600 }}>
          <Markers id={ID} />
          <rect x={30} y={18} width={cutX - 30 + 66} height={98} rx={8} fill={leak ? CRIT : P.par} opacity={0.1} className="bah-size" />
          <text x={38} y={14} fontSize={9.5} fontWeight={600} fill={leak ? CRIT : P.par}>训练样本用到的特征范围</text>
          <Arrow id={ID} tone="neu" d="M40 100 H668" />
          {EVENTS.map((e) => {
            const leaked = leak && e.t > INFER_T;
            return (
              <g key={e.t}>
                <Box x={e.x - 62} y={34} w={124} h={38} tone={e.tone} title={e.title} dim={e.t > cutoff} bold={e.t === INFER_T} />
                {leaked && <rect x={e.x - 65} y={31} width={130} height={44} rx={8} fill="none" stroke={CRIT} strokeWidth={2} />}
                <line x1={e.x} y1={72} x2={e.x} y2={100} stroke={P.sub} strokeWidth={1} />
                <circle cx={e.x} cy={100} r={4} fill={leaked ? CRIT : P.sub} />
                <text x={e.x} y={122} fontSize={10.5} textAnchor="middle" fill={P.ink} className="mono">T = {e.t} min</text>
                {leaked && <text x={e.x} y={138} fontSize={9.5} textAnchor="middle" fill={CRIT} fontWeight={600}>推理时还不存在</text>}
                {e.t === INFER_T && <text x={e.x} y={138} fontSize={9.5} textAnchor="middle" fill={P.enc} fontWeight={600}>线上推理时刻</text>}
              </g>
            );
          })}
        </svg>
      </div>
      <table className="viz-table">
        <thead><tr><th>特征</th><th className="num">线上推理时看到的</th><th className="num">训练样本里的</th></tr></thead>
        <tbody>
          <tr><td>Views</td><td className="num">{online.views}</td><td className="num">{train.views}</td></tr>
          <tr><td>Reports</td><td className="num">{online.reports}</td><td className={`num${leak ? " is-crit" : ""}`}>{train.reports}</td></tr>
          <tr><td>Reports / Views</td><td className="num">{online.rate.toFixed(2)}</td><td className={`num${leak ? " is-crit" : ""}`}>{train.rate.toFixed(2)}</td></tr>
        </tbody>
      </table>
      <div className={`viz-narr${leak ? " is-bad" : " is-good"}`} aria-live="polite">
        {leak
          ? `训练样本里 Reports / Views = ${train.rate.toFixed(2)}，而线上在 T = 10 min 推理时这个特征是 ${online.rate.toFixed(2)}，那 20 次举报还没发生。模型会学到「举报率高就是有害」这条几乎等于看答案的规则，离线指标很漂亮；上线后它在每条新帖子上看到的举报率都是 0，这条规则完全用不上。`
          : "训练样本的特征和线上推理时一模一样：100 次曝光，0 次举报。T = 60 min 的 20 次举报不进特征；它们可以用来生成这条样本的弱标签，或者作为下一次推理（比如 T = 60 min 重新打分时）的特征。"}
      </div>
    </MsdFrame>
  );
}

// ---------- 5.1 two-stage inference ----------

const T2 = 0.6;
const DAILY_POSTS = 1e9;

export function TwoStageFigure() {
  const [t1, setT1] = useState(0.4);
  const posts = useMemo(() => makeCascadePosts({ seed: 11, n: 20000, harmfulRate: 0.01 }), []);
  const r = useMemo(() => runCascade(posts, t1, T2), [posts, t1]);
  const harmful = posts.filter((p) => p.harmful).length;
  const ID = "two";
  const tone = r.stage1Recall < 0.85 ? " is-bad" : r.passRate > 0.5 ? " is-warn" : " is-good";

  return (
    <MsdFrame
      title="图 9 · Two-stage Inference：便宜的模型先筛，贵的模型再判"
      description="拖动第一阶段的风险阈值。阈值越高，进入第二阶段的帖子越少，成本越低，但被第一阶段放走的有害帖再也追不回来。"
      footnote={<>20,000 条模拟帖子，其中 1% 有害，固定随机种子；第二阶段的阈值固定为 {T2}。每天的条数按 10 亿条帖子的假设换算。</>}
    >
      <Slider id="two-t1" label="Stage 1 风险阈值" value={t1} min={0.1} max={0.8} step={0.05} onChange={setT1} display={t1.toFixed(2)} />
      <div className="viz-scroll">
        <svg viewBox="0 0 700 168" role="img" aria-label={`两阶段推理：${pct(r.passRate, 1)} 的帖子进入第二阶段，第一阶段 Recall ${pct(r.stage1Recall)}，系统 Recall ${pct(r.systemRecall)}`} style={{ minWidth: 660 }}>
          <Markers id={ID} />
          <text x={98} y={18} fontSize={9.5} fontWeight={600} fill={P.sub}>STAGE 1 · 便宜，要高 Recall</text>
          <text x={336} y={18} fontSize={9.5} fontWeight={600} fill={P.sub}>STAGE 2 · 贵，要高 Precision</text>
          <Box x={8} y={28} w={74} h={46} tone="neu" title="Post Events" size={9.5} />
          <Arrow id={ID} tone="neu" d="M84 51 H95" />
          <Box x={98} y={28} w={104} h={46} tone="enc" title="Lightweight" sub="Classifier" />
          <Arrow id={ID} tone="enc" d="M204 51 H215" />
          <Box x={218} y={28} w={88} h={46} tone="dec" title="Risk Threshold" sub={`s₁ ≥ ${t1.toFixed(2)} ?`} size={9.5} bold />
          <Arrow id={ID} tone="dec" d="M308 51 H333" bold />
          <text x={321} y={43} fontSize={8.5} textAnchor="middle" fill={P.dec} fontWeight={600}>高</text>
          <Box x={336} y={28} w={112} h={46} tone="enc" title="Multimodal" sub="Transformer" />
          <Arrow id={ID} tone="enc" d="M450 51 H461" />
          <Box x={464} y={28} w={70} h={46} tone="dec" title="Multi-task" sub="Heads" size={9.5} />
          <Arrow id={ID} tone="dec" d="M536 51 H547" />
          <Box x={550} y={28} w={66} h={46} tone="att" title="Calibration" size={9} />
          <Arrow id={ID} tone="att" d="M618 51 H629" />
          <Box x={632} y={28} w={60} h={46} tone="dec" title="Policy" sub="三档动作" size={9.5} />

          <Arrow id={ID} tone="par" d="M262 76 V113" />
          <text x={270} y={99} fontSize={8.5} fill={P.par} fontWeight={600}>低</text>
          <Box x={202} y={116} w={120} h={42} tone="par" title="Allow" sub={`${pct(1 - r.passRate, 1)} 的帖子到此为止`} />
          <text x={392} y={104} fontSize={10.5} fill={P.ink}>进入 Stage 2：<tspan fontWeight={600} className="mono">{pct(r.passRate, 1)}</tspan></text>
          <text x={392} y={122} fontSize={10.5} fill={r.missedAtStage1 > 0 ? CRIT : P.ink}>被 Stage 1 放走的有害帖：<tspan fontWeight={600} className="mono">{r.missedAtStage1} / {harmful}</tspan></text>
        </svg>
      </div>
      <div className="viz-stat" style={{ marginTop: 10 }}>
        <div><small>每天进入 Stage 2</small><b>{((r.passRate * DAILY_POSTS) / 1e8).toFixed(1)} 亿条</b></div>
        <div><small>Stage 1 Recall</small><b>{pct(r.stage1Recall, 1)}</b></div>
        <div><small>Stage 2 Recall</small><b>{pct(r.stage2Recall, 1)}</b></div>
        <div><small>系统 Recall</small><b>{pct(r.systemRecall, 1)}</b></div>
        <div><small>系统 Precision</small><b>{pct(r.systemPrecision, 1)}</b></div>
      </div>
      <div className={`viz-narr${tone}`} aria-live="polite">
        阈值 {t1.toFixed(2)} 时，{pct(r.passRate, 1)} 的帖子进入第二阶段，贵的模型每天要处理约 {((r.passRate * DAILY_POSTS) / 1e8).toFixed(1)} 亿条而不是 10 亿条。第一阶段留住了 {pct(r.stage1Recall, 1)} 的有害帖，第二阶段在它看到的有害帖里抓住 {pct(r.stage2Recall, 1)}，两者相乘就是系统 Recall {pct(r.systemRecall, 1)}。
        {r.stage1Recall < 0.85 ? ` 第一阶段已经放走了 ${r.missedAtStage1} 条有害帖，第二阶段再准也看不到它们：系统 Recall 的上限就是第一阶段的 Recall。` : r.passRate > 0.5 ? " 第一阶段几乎不漏，但一半以上的流量都进了第二阶段，省下的成本有限。" : " 这是一个比较均衡的位置：成本降下来了，第一阶段漏掉的也不多。"}
      </div>
    </MsdFrame>
  );
}

// ---------- 5.2 Recall@Precision95 ----------

const FLOOR = 0.95;
const PR_TICKS = [0, 0.25, 0.5, 0.75, 1];

export function RecallAtPrecisionFigure() {
  const [threshold, setThreshold] = useState(0.6);
  const d = useMemo(() => {
    const items = makeScoredDataset({ seed: 33, nPos: 80, nNeg: 1520, posMean: 0.7, negMean: 0.3, sd: 0.15 });
    const pts = operatingPoints(items);
    return { items, curve: [[0, pts[0]?.precision ?? 1] as const, ...pts.map((p) => [p.recall, p.precision] as const)], best: recallAtPrecision(items, FLOOR) };
  }, []);
  const c = confusionAtThreshold(d.items, threshold);
  const prec = precision(c);
  const rec = recall(c);
  const ok = prec >= FLOOR && c.tp + c.fp > 0;
  const f = plotFrame({ x: 0, y: 0, w: 440, h: 330 }, [0, 1], [0, 1]);
  const best = d.best;

  return (
    <MsdFrame
      title="图 10 · Recall@Precision95：在 Precision 不低于 95% 的阈值里，挑 Recall 最大的"
      description="拖动分类阈值，蓝点沿 PR 曲线移动。水平线以上是满足业务约束的区域，绿点是其中 Recall 最大的工作点。"
      footnote={<>1,600 条模拟样本，其中 80 条有害（5%），固定随机种子。真实场景里有害比例更低，曲线会更靠下。</>}
    >
      <Slider id="rp-t" label="分类阈值" value={threshold} min={0.3} max={0.95} step={0.01} onChange={setThreshold} display={threshold.toFixed(2)} />
      <div className="viz-grid2 wide-left">
        <div className="viz-scroll">
          <svg viewBox="0 0 440 330" role="img" aria-label={`PR 曲线。当前阈值 ${threshold.toFixed(2)}：Precision ${prec.toFixed(2)}，Recall ${rec.toFixed(2)}。${best ? `Recall@Precision95 = ${best.recall.toFixed(2)}` : ""}`} style={{ minWidth: 290 }}>
            <rect x={f.x0} y={f.y(1)} width={f.x1 - f.x0} height={f.y(FLOOR) - f.y(1)} fill={P.par} opacity={0.16} />
            <Axes f={f} xTicks={PR_TICKS} yTicks={PR_TICKS} xLabel="Recall" yLabel="Precision" />
            <line x1={f.x0} y1={f.y(FLOOR)} x2={f.x1} y2={f.y(FLOOR)} stroke={P.par} strokeWidth={1.4} strokeDasharray="5 4" />
            <text x={f.x1 - 4} y={f.y(FLOOR) + 14} fontSize={10.5} textAnchor="end" fill={P.par} fontWeight={600}>Precision = 0.95</text>
            <path d={linePath(f, d.curve, true)} fill="none" stroke={P.dec} strokeWidth={2} strokeLinejoin="round" />
            {best && (
              <>
                <line x1={f.x(best.recall)} y1={f.y(best.precision)} x2={f.x(best.recall)} y2={f.y0} stroke={P.par} strokeWidth={1} strokeDasharray="3 3" />
                <circle cx={f.x(best.recall)} cy={f.y(best.precision)} r={6} fill={P.par} stroke={P.surface} strokeWidth={1.5} />
                <text x={f.x(best.recall) - 8} y={f.y(0.5)} fontSize={10.5} fontWeight={600} textAnchor="end" fill={P.par}>Recall@P95 = {best.recall.toFixed(2)}</text>
              </>
            )}
            <circle cx={f.x(rec)} cy={f.y(prec)} r={5} fill={P.enc} stroke={P.surface} strokeWidth={1.5} style={{ transition: "cx .2s, cy .2s" }} />
          </svg>
        </div>
        <div>
          <table className="viz-table">
            <thead><tr><th>当前阈值 {threshold.toFixed(2)}</th><th className="num">值</th></tr></thead>
            <tbody>
              <tr><td>判为有害的条数</td><td className="num">{c.tp + c.fp}</td></tr>
              <tr><td>其中真的有害（TP）</td><td className="num">{c.tp}</td></tr>
              <tr><td>Precision</td><td className={`num${ok ? "" : " is-crit"}`}>{prec.toFixed(3)}</td></tr>
              <tr><td>Recall</td><td className="num">{rec.toFixed(3)}</td></tr>
              <tr><td>满足 Precision ≥ 0.95</td><td className={`num${ok ? "" : " is-crit"}`}>{ok ? "是" : "否"}</td></tr>
            </tbody>
          </table>
          {best && (
            <div className="viz-stat" style={{ marginTop: 12 }}>
              <div><small>最优阈值</small><b>{best.threshold.toFixed(2)}</b></div>
              <div><small>Recall@Precision95</small><b>{best.recall.toFixed(3)}</b></div>
            </div>
          )}
        </div>
      </div>
      <div className={`viz-narr${ok ? " is-good" : " is-warn"}`} aria-live="polite">
        {ok
          ? `阈值 ${threshold.toFixed(2)} 满足约束：判为有害的 ${c.tp + c.fp} 条里 ${c.tp} 条是对的，Precision ${prec.toFixed(3)}，但只抓到了 ${pct(rec, 1)} 的有害帖。${best ? `在所有满足约束的阈值里，${best.threshold.toFixed(2)} 的 Recall 最高（${best.recall.toFixed(3)}），这个数就是 Recall@Precision95。` : ""}`
          : `阈值 ${threshold.toFixed(2)} 抓到了 ${pct(rec, 1)} 的有害帖，但 Precision 只有 ${prec.toFixed(3)}，低于 0.95，不能用来自动删除。把阈值往上拖，直到蓝点进入绿色区域。${best ? `能做到的最高 Recall 是 ${best.recall.toFixed(3)}。` : ""}`}
      </div>
    </MsdFrame>
  );
}

// ---------- 6. creator graph ----------

type GraphMode = "id" | "graph" | "cold" | null;

const GRAPH_TEXT: Record<"none" | "id" | "graph" | "cold", string> = {
  none: "两个用户互相关注，都加入了 Group X，User B 还加入了 Group Y。图上的边来自关注、互动、共同加入的群组等关系。",
  id: "User ID Embedding 给每个用户一行可训练的向量，只靠这个用户自己的帖子和标签来学。它不使用图上的任何边：A 和 B 的关系对 A 的向量没有直接影响，新用户则根本没有这一行。",
  graph: "Graph-based Embedding 让一个节点的表示由它的邻居决定。计算 User A 的向量时，把邻居 User B 和 Group X 的表示聚合进来，再和 A 自己的特征合并。于是「经常和哪些人、哪些群组在一起」成了模型可用的信号。注意 A 与有违规记录的 B 相连，只是一个风险相关的特征，不能直接等同于 A 违规。",
  cold: "新用户 C 刚注册，没有发帖历史，ID Embedding 表里没有它。Transductive GNN 的节点向量是在一张固定的图上训练出来的，图里没有 C 就没有 C 的向量。Inductive 的方法（如 GraphSAGE）学的是「怎样从邻居聚合」这个函数，所以只要 C 关注了 B、加入了 Group Y，就能当场算出它的表示。",
};

export function SocialGraphFigure() {
  const [mode, setMode] = useState<GraphMode>(null);
  const ID = "sg";
  const dimEdges = mode === "id";
  const nbr = mode === "graph";
  const dimFar = mode === "graph";
  const user = (cx: number, name: string, opts: { bold?: boolean; dim?: boolean; dashed?: boolean; flagged?: boolean }) => (
    <g opacity={opts.dim ? 0.28 : 1} className="bah-fade">
      <circle cx={cx} cy={56} r={27} fill={P.encFill} stroke={P.enc} strokeWidth={opts.bold ? 2.4 : 1.3} strokeDasharray={opts.dashed ? "4 3" : undefined} />
      <text x={cx} y={60} fontSize={11} fontWeight={600} textAnchor="middle" fill={P.ink}>{name}</text>
      {opts.flagged && <text x={cx} y={100} fontSize={9.5} textAnchor="middle" fill={CRIT} fontWeight={600}>有违规记录</text>}
    </g>
  );

  return (
    <MsdFrame
      title="图 11 · Social Graph：用关系给作者学表示"
      description="三个按钮对应三种给作者建模的方式，看每一种用到了图上的哪些部分。"
    >
      <div className="viz-controls" role="group" aria-label="选择建模方式">
        <button type="button" className={`viz-btn${mode === "id" ? " is-on" : ""}`} aria-pressed={mode === "id"} onClick={() => setMode("id")}>User ID Embedding</button>
        <button type="button" className={`viz-btn${mode === "graph" ? " is-on" : ""}`} aria-pressed={mode === "graph"} onClick={() => setMode("graph")}>Graph-based Embedding</button>
        <button type="button" className={`viz-btn${mode === "cold" ? " is-on" : ""}`} aria-pressed={mode === "cold"} onClick={() => setMode("cold")}>Cold Start：新用户 C</button>
        <button type="button" className="viz-btn" onClick={() => setMode(null)}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox="0 0 700 214" role="img" aria-label="社交图：User A 和 User B 互相关注，二者都连向 Group X，User B 还连向 Group Y" style={{ minWidth: 600 }}>
          <Markers id={ID} />
          <Arrow id={ID} tone={nbr ? "att" : "neu"} d="M199 50 H400" dim={dimEdges} bold={nbr} />
          <Arrow id={ID} tone={nbr ? "att" : "neu"} d="M401 62 H200" dim={dimEdges} bold={nbr} />
          <Arrow id={ID} tone={nbr ? "att" : "neu"} d="M186 79 L282 148" dim={dimEdges} bold={nbr} />
          <Arrow id={ID} tone="neu" d="M414 79 L338 148" dim={dimEdges || dimFar} />
          <Arrow id={ID} tone="neu" d="M448 77 L556 148" dim={dimEdges || dimFar} />
          {user(170, "User A", { bold: mode === "id" || nbr })}
          {user(430, "User B", { bold: mode === "id" || nbr, flagged: true })}
          <Box x={255} y={150} w={110} h={42} tone="dyn" title="Group X" dim={dimEdges} bold={nbr} />
          <Box x={520} y={150} w={110} h={42} tone="dyn" title="Group Y" dim={dimEdges || dimFar} bold={mode === "cold"} />
          {mode === "cold" && (
            <>
              {user(620, "User C", { bold: true, dashed: true })}
              <Arrow id={ID} tone="att" d="M592 56 H460" bold />
              <Arrow id={ID} tone="att" d="M612 84 L590 148" bold />
              <text x={620} y={20} fontSize={9.5} textAnchor="middle" fill={P.att} fontWeight={600}>新注册，无历史</text>
            </>
          )}
        </svg>
      </div>
      <Legend items={[{ tone: "enc", label: "用户（作者）" }, { tone: "dyn", label: "群组" }, { tone: "att", label: "当前方式用到的边" }]} />
      <div className={`viz-narr${mode === "graph" ? " is-warn" : mode === "cold" ? " is-good" : ""}`} aria-live="polite">{GRAPH_TEXT[mode ?? "none"]}</div>
    </MsdFrame>
  );
}
