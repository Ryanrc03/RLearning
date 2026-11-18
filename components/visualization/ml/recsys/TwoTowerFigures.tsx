"use client";

import { useState, type ReactNode } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Bars from "@/components/visualization/ml/primitives/Bars";
import Curve from "@/components/visualization/ml/primitives/Curve";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Marker from "@/components/visualization/ml/primitives/Marker";
import Plot from "@/components/visualization/ml/primitives/Plot";
import Slider from "@/components/visualization/ml/primitives/Slider";
import {
  batchMatrix, CLICK_COUNTS, correctedLogits, cosineScore, ITEM_VECTORS, listwise, pairwise, pointwise,
  samplingDistribution, TIMELINE_LENGTH, TOPICS, trainingTimeline, USER_TOPICS, USER_VECTORS, VIDEO_NAMES,
} from "@/lib/ml/twoTower";

const fmt = (value: number) => value.toFixed(3);
const integer = (value: number) => value.toLocaleString("en-US");

function Chips({ options, value, onChange, label }: { options: string[]; value: number; onChange: (i: number) => void; label: string }) {
  return <div className="viz-chips" role="group" aria-label={label}>{options.map((option, i) =>
    <button type="button" key={option} className="viz-chip" aria-pressed={i === value} onClick={() => onChange(i)}>{option}</button>,
  )}</div>;
}

function Lab({ title, description, reset, children }: { title: string; description: string; reset: () => void; children: ReactNode }) {
  return <div className="tower-note"><VisualizationFrame title={title} description={description}>
    <div className="viz-controls"><button type="button" className="viz-btn" onClick={reset}>重置</button></div>
    {children}
  </VisualizationFrame></div>;
}

const FEATURES = [
  [["User ID", 16, "U1 → 查用户 ID Embedding"], ["Country", 8, "CN → 查国家 Embedding"], ["Device", 8, "Mobile → 查设备 Embedding"], ["Numerical", 4, "账号年龄、活跃度、观看时长等四项归一化"]],
  [["Item ID", 16, "A → 查物品 ID Embedding"], ["Category", 8, "Programming → 查类别 Embedding"], ["Brand", 8, "创作者品牌 → 查独立 Embedding"], ["Numerical", 3, "价格、热度和时长归一化"]],
] as const;

export function ArchitectureExplorer() {
  const [feature, setFeature] = useState([0, 0]);
  const [item, setItem] = useState(0);
  const [user, setUser] = useState(0);
  const a = USER_VECTORS[user], b = ITEM_VECTORS[item];
  return <Lab title="两个塔各自编码，最后才匹配" description="点击特征查看编码。特征维度示意生产模型，内积用两维样例演算。" reset={() => { setFeature([0, 0]); setItem(0); setUser(0); }}>
    <div className="viz-grid2">
      {FEATURES.map((rows, side) => <div key={side} className="viz-panel">
        <h5>{side === 0 ? "User Tower" : "Item Tower"}</h5>
        <Chips options={rows.map(([name]) => name)} value={feature[side]} label={side === 0 ? "用户特征" : "物品特征"}
          onChange={(i) => setFeature((old) => old.map((value, j) => j === side ? i : value))} />
        <p>{rows[feature[side]][2]} · {rows[feature[side]][1]} 维</p>
        <p>{rows.map(([, dim]) => dim).join(" + ")} = {rows.reduce((sum, [, dim]) => sum + dim, 0)} 维 → Concatenate → MLP → 64 维</p>
      </div>)}
    </div>
    <div className="viz-controls">
      <label>用户<select value={user} onChange={(e) => setUser(Number(e.target.value))}>{USER_TOPICS.map((name, i) =>
        <option key={name} value={i}>U{i + 1} · {name}</option>)}</select></label>
      <label>物品<select value={item} onChange={(e) => setItem(Number(e.target.value))}>{VIDEO_NAMES.slice(0, 4).map((name, i) =>
        <option key={name} value={i}>{name}</option>)}</select></label>
    </div>
    <div className="viz-narr" aria-live="polite">
      ({fmt(a[0])} × {fmt(b[0])} + {fmt(a[1])} × {fmt(b[1])}) / ({fmt(Math.hypot(...a))} × {fmt(Math.hypot(...b))}) = {fmt(cosineScore(a, b))}
    </div>
  </Lab>;
}

const DEFAULT_SCORES = [0.6, 0.5, 0.2, -0.3];
const LOSS_MODES = ["Pointwise", "Pairwise", "Listwise"];
export function LossExplorer() {
  const [mode, setMode] = useState(0);
  const [scores, setScores] = useState(DEFAULT_SCORES);
  const [margin, setMargin] = useState(0.2);
  const [scale, setScale] = useState(5);
  const [temperature, setTemperature] = useState(0.2);
  const [label, setLabel] = useState(1);
  const point = pointwise(scores[0], scale, label);
  const pair = pairwise(scores[0], scores[1], margin, scale);
  const logits = scores.map((s) => s / temperature);
  const list = listwise(logits);
  return <Lab title="同一组分数，三个训练目标" description="切换损失函数，再调整参与训练的分数和参数。" reset={() => {
    setMode(0); setScores(DEFAULT_SCORES); setMargin(0.2); setScale(5); setTemperature(0.2); setLabel(1);
  }}>
    <Chips options={LOSS_MODES} value={mode} label="训练目标" onChange={setMode} />
    <div className="viz-grid2">
      {scores.slice(0, [1, 2, 4][mode]).map((s, i) =>
        <Slider key={i} label={(i === 0 && mode > 0 ? "正例 · " : i > 0 ? "候选负例 · " : "") + VIDEO_NAMES[i]}
          value={s} min={-1} max={1} step={0.05} onChange={(value) => setScores((old) => old.map((x, j) => j === i ? value : x))} />,
      )}
      {mode < 2 && <Slider label="Logit Scale γ" value={scale} min={1} max={15} onChange={setScale} />}
      {mode === 1 && <Slider label="Margin m" value={margin} min={0} max={1} step={0.05} onChange={setMargin} />}
      {mode === 2 && <Slider label="Temperature τ" value={temperature} min={0.05} max={1} step={0.05} onChange={setTemperature} />}
    </div>
    {mode === 0 && <Chips options={["y = 0", "y = 1"]} value={label} label="样本标签" onChange={setLabel} />}
    {mode === 2 && <Bars rows={list.probabilities.map((p, i) => ({ label: VIDEO_NAMES[i], value: p,
      hint: "logit " + fmt(logits[i]), color: i === 0 ? "var(--v1)" : "var(--v3)", text: fmt(p),
    }))} />}
    <div className="viz-narr" aria-live="polite">
      {mode === 0 && <>σ({fmt(point.logit)}) = {fmt(point.probability)}。y = {label}，BCE = {fmt(point.loss)}。</>}
      {mode === 1 && <>分差 = {fmt(pair.gap)}，{pair.gap + 1e-9 >= margin ? "达到" : "未达到"} margin {fmt(margin)}。max(0, m − 分差) = {fmt(pair.hinge)}。softplus(−γ × 分差) = {fmt(pair.logistic)}。</>}
      {mode === 2 && <>正例概率 {fmt(list.probabilities[0])}，−ln p⁺ = {fmt(list.loss)}。</>}
    </div>
  </Lab>;
}

const FUNNEL = [
  ["Corpus · 10,000", "从全库随机抽，通常是 Easy Negatives。未曝光的内容也可能符合用户兴趣。"],
  ["Retrieval · 500", "通过召回，已经有某种相关性。随后被粗排淘汰的候选可用于 Hard Negative Mining。"],
  ["Coarse Ranking · 250", "粗排留下的候选更相似，精排淘汰可以提供细粒度对比，但会继承旧排名系统的偏差。"],
  ["Fine Ranking · 100", "进入精排结果但未曝光的候选，可能只是展示位不足。位置之外没有直接点击证据。"],
  ["Impression · 20", "曝光未点击常作 CTR Ranking 的负例。召回训练中，位置与注意力会影响其可靠性。"],
  ["Clicks · 2", "曝光后点击是本章正样本。训练其他目标时也可用有效观看、收藏或买单。"],
];

export function NegativeSourceExplorer() {
  const [stage, setStage] = useState(0);
  return <Lab title="从推荐漏斗取训练样本" description="这些规模是教学例子。点击阶段，查看能从这里得到的样本信号。" reset={() => setStage(0)}>
    <Chips options={FUNNEL.map(([name]) => name)} value={stage} label="漏斗阶段" onChange={setStage} />
    <div className="viz-narr" aria-live="polite">{FUNNEL[stage][1]}</div>
  </Lab>;
}

export function SamplingExplorer() {
  const [alpha, setAlpha] = useState(0.75);
  const p = samplingDistribution(alpha);
  return <Lab title="Uniform、平滑热度和点击频率" description="同一组三个点击数，调节指数来控制热门物品被抽中的比例。" reset={() => setAlpha(0.75)}>
    <Chips options={["Uniform", "Smoothed", "Popularity"]} value={[0, 0.75, 1].indexOf(alpha)}
      label="采样预设" onChange={(i) => setAlpha([0, 0.75, 1][i])} />
    <Slider label="热度指数 α" value={alpha} min={0} max={1} step={0.01} onChange={setAlpha} />
    <Bars rows={p.map((value, i) => ({ label: VIDEO_NAMES[i], hint: "点击 " + CLICK_COUNTS[i], value, color: "var(--v1)", text: (value * 100).toFixed(2) + "%" }))} />
    <div className="viz-narr" aria-live="polite">qᵢ = cᵢ^α / Σ cⱼ^α，概率和 {fmt(p.reduce((sum, value) => sum + value, 0))}。</div>
  </Lab>;
}

export function BatchNegativeExplorer() {
  const [size, setSize] = useState(4);
  const [noise, setNoise] = useState(false);
  const [selected, select] = useState([0, 1]);
  const matrix = batchMatrix(size, noise);
  const [u, col] = selected;
  const cell = matrix[u][col];
  const masked = matrix.flat().filter(({ kind }) => kind === "masked").length;
  const kinds = { positive: "正例", negative: "候选负例", masked: "已知正例，屏蔽" };
  return <Lab title="一个 Batch，复用其他行的物品" description="青色是对角线正例。开启 False Negative 模式后，B 列换成重复的 A，并给 U1 加入已知正例 C。" reset={() => { setSize(4); setNoise(false); select([0, 1]); }}>
    <div className="viz-controls">
      <Slider label="Batch Size" value={size} min={3} max={6} onChange={(value) => { setSize(value); select([0, 1]); }} />
      <label><input type="checkbox" checked={noise} onChange={(e) => setNoise(e.target.checked)} /> False Negative 模式</label>
    </div>
    <div className="viz-scroll"><table className="viz-table tower-matrix">
      <thead><tr><th scope="col">用户</th>{matrix[0].map(({ item }, j) => <th key={j} scope="col">{String.fromCharCode(65 + item)}</th>)}</tr></thead>
      <tbody>{matrix.map((row, i) => <tr key={i}><th scope="row">U{i + 1}</th>{row.map(({ score, kind }, j) =>
        <td key={j} className={"tower-" + kind}><button type="button" className="viz-btn"
          aria-label={`U${i + 1}，第 ${j + 1} 列，${kinds[kind]}`} aria-pressed={i === u && j === col} onClick={() => select([i, j])}>{fmt(score)}</button></td>,
      )}</tr>)}</tbody>
    </table></div>
    <div className="viz-narr" aria-live="polite">
      U{u + 1} → {VIDEO_NAMES[cell.item]} · {kinds[cell.kind]} · Cosine {fmt(cell.score)}。
      {size} 个正例，{size} × {size - 1} = {size * (size - 1)} 个非对角配对位置，屏蔽 {masked} 个。
    </div>
  </Lab>;
}

export function LogQExplorer() {
  const [alpha, setAlpha] = useState(0);
  const q = [0.8, 0.15, 0.05].map((p, i) => (1 - alpha) * p + alpha * samplingDistribution(0)[i]);
  const logits = [1, 0.8, 0.6];
  const corrected = correctedLogits(logits, q);
  const original = listwise(logits);
  const adjusted = listwise(corrected);
  return <Lab title="LogQ 在训练 Softmax 之前生效" description="从指定的 q 向均匀分布插值。A 是目标，logits 已在 Softmax 所用的尺度上。" reset={() => setAlpha(0)}>
    <Slider label="均匀混合比例" value={alpha} min={0} max={1} step={0.05} onChange={setAlpha} />
    <div className="viz-scroll"><table className="viz-table">
      <thead><tr><th>物品</th><th>q</th><th>s</th><th>s − ln q</th><th>原 p</th><th>校正 p</th></tr></thead>
      <tbody>{logits.map((logit, i) => <tr key={i}><th scope="row">{String.fromCharCode(65 + i)}</th>
        {[q[i], logit, corrected[i], original.probabilities[i], adjusted.probabilities[i]].map((value, j) => <td key={j}>{fmt(value)}</td>)}</tr>)}</tbody>
    </table></div>
    <div className="viz-narr" aria-live="polite">A 的 Cross-Entropy {fmt(original.loss)} → {fmt(adjusted.loss)}。均匀 q 给每项加同一个常量，Softmax 分布相同。</div>
  </Lab>;
}

const SERVING_STEPS = [
  ["Item Features", "收集可搜索物品的 ID、类别和数值特征。"],
  ["Item Tower", "独立编码全量物品。优化模式按索引版本预计算，朴素模式在每个请求重算。"],
  ["Item Vector / ANN Index", "优化模式把单位向量与物品 ID 写入索引。朴素模式直接扫描当前请求刚算出的向量。"],
  ["User Features", "组装与线上特征版本匹配的用户 ID、地区、设备和近期行为。"],
  ["User Tower", "每个请求只编码一个用户。"],
  ["Search", "按当前用户向量取 Top-K。优化模式查询 ANN，朴素模式全量计算相似度。"],
  ["Candidates", "过滤不合格物品后，把候选交给 Ranking。这里用四件物品的精确分数示意。"],
];

export function ServingExplorer() {
  const [mode, setMode] = useState(1);
  const [stage, setStage] = useState(0);
  const [millions, setMillions] = useState(10);
  const [dimension, setDimension] = useState(64);
  const [requests, setRequests] = useState(100);
  const [user, setUser] = useState(0);
  const items = millions * 1e6;
  const top = ITEM_VECTORS.slice(0, 4).map((item, i) => ({ name: VIDEO_NAMES[i], score: cosineScore(USER_VECTORS[user], item) }))
    .sort((a, b) => b.score - a.score).slice(0, 2);
  return <Lab title="离线物品路径与在线用户路径" description="切换计算方式，比较一次索引版本内的编码次数。这里只计算工作量，不估计毫秒延迟。" reset={() => {
    setMode(1); setStage(0); setMillions(10); setDimension(64); setRequests(100); setUser(0);
  }}>
    <Chips options={["Naive", "Optimized"]} value={mode} label="计算方式" onChange={setMode} />
    <div className="viz-grid2">
      {[{ title: mode ? "离线物品路径" : "每次请求的物品路径", first: 0, last: 3 }, { title: "在线用户路径", first: 3, last: 7 }].map(({ title, first, last }) =>
        <div className="viz-panel" key={first}><h5>{title}</h5>
          <Chips options={SERVING_STEPS.slice(first, last).map(([name]) => name)} value={stage - first}
            label={title} onChange={(i) => setStage(first + i)} />
        </div>,
      )}
    </div>
    <div className="viz-grid2">
      <Slider label="物品数（百万）" value={millions} min={1} max={100} onChange={setMillions} />
      <Slider label="向量维度" value={dimension} min={16} max={256} step={16} onChange={setDimension} />
      <Slider label="请求数" value={requests} min={1} max={1000} onChange={setRequests} />
    </div>
    <div className="viz-controls"><label>演示用户<select value={user} onChange={(e) => setUser(Number(e.target.value))}>
      {USER_TOPICS.map((topic, i) => <option key={topic} value={i}>U{i + 1} · {topic}</option>)}
    </select></label></div>
    <div className="viz-narr" aria-live="polite">
      <div>{SERVING_STEPS[stage][1]}</div>
      <div>用户塔在线 {integer(requests)} 次。物品塔{mode ? "离线 " + integer(items) + " 次、在线 0 次" : "在线 " + integer(items * requests) + " 次"}。</div>
      <div>{mode ? "索引需存储 " + integer(items * dimension) + " 个向量分量，实际评分次数由搜索预算决定。" :
        "全扫共进行 " + integer(items * requests * dimension) + " 次分量乘法。"}</div>
      <div>四物品 Exact Top-2 · {top.map(({ name, score }) => name + " " + fmt(score)).join("、")}。</div>
    </div>
  </Lab>;
}

export function UpdateTimeline() {
  const [mode, setMode] = useState(0);
  const [step, setStep] = useState(0);
  const [rate, setRate] = useState(0.1);
  const shuffled = trainingTimeline(true, rate);
  const ordered = trainingTimeline(false, rate);
  const current = (mode === 0 ? shuffled : ordered)[step];
  return <Lab title="同样的样本，不同的 SGD 顺序" description="两条线用同一批 60 条样本。切换模式查看当前样本，再拖动训练步比较参数和两个固定评估分布。" reset={() => { setMode(0); setStep(0); setRate(0.1); }}>
    <Chips options={["Full · Shuffle", "Incremental · 按时间"]} value={mode} label="样本顺序" onChange={setMode} />
    <div className="viz-grid2">
      <Slider label="训练步" value={step} min={0} max={TIMELINE_LENGTH} onChange={setStep} />
      <Slider label="学习率 η" value={rate} min={0.02} max={0.3} step={0.01} onChange={setRate} />
    </div>
    <Figure width={420} height={235} label="参数 w 随训练步数变化，蓝色是随机顺序，橙色是时间顺序">
      <Plot box={{ x: 0, y: 0, w: 420, h: 235 }} xDomain={[0, TIMELINE_LENGTH]} yDomain={[-1, 1]} xLabel="SGD Step" yLabel="w">
        {(frame) => <>
          <Curve frame={frame} color="var(--v1)" points={shuffled.map(({ w }, i) => [i, w] as const)} />
          <Curve frame={frame} color="var(--v2)" points={ordered.map(({ w }, i) => [i, w] as const)} />
          <Marker frame={frame} x={step} y={current.w} color={mode === 0 ? "var(--v1)" : "var(--v2)"} />
        </>}
      </Plot>
    </Figure>
    <div className="viz-narr" aria-live="polite">
      <div>{current.sample ? current.sample.label + " · " + TOPICS[current.sample.topic] + " · y = " + current.sample.target : "初始参数"}
        。w = {fmt(current.w)}，更新式 w ← w − η × 2(w − y)。</div>
      <div>全天评估 MSE {fmt(current.full)} · 晚间评估 MSE {fmt(current.recent)}。</div>
      <div>同一步对照 · Shuffle 全天 {fmt(shuffled[step].full)} / 晚间 {fmt(shuffled[step].recent)}；
        时间顺序全天 {fmt(ordered[step].full)} / 晚间 {fmt(ordered[step].recent)}。</div>
    </div>
  </Lab>;
}

const RELEASE_STAGES = ["全量 v1", "v1 增量", "全量 v2", "构建索引 v2", "线上切换"];

export function VersionTimeline() {
  const [step, setStep] = useState(0);
  const [tower, setTower] = useState(1);
  const [index, setIndex] = useState(1);
  const details = [
    "发布已验证的 v1 bundle。",
    "从 v1 用户参数应用流式增量，物品塔和索引保持 v1。",
    "验证 v2 模型，线上继续使用 v1。",
    "生成 v2 物品向量、构建索引，并验证 v2 bundle。",
    "一致切换到 v2，保留 v1 回滚路径。",
  ];
  const verified = (tower === 1 && index === 1) || (step >= 3 && tower === 2 && index === 2);
  return <Lab title="验证完成，再切换 Serving Bundle" description="选择发布阶段和组合。这里用经验证的组合白名单判断。" reset={() => { setStep(0); setTower(1); setIndex(1); }}>
    <Chips options={RELEASE_STAGES} label="发布阶段" value={step} onChange={(value) => {
      setStep(value); setTower(value === 4 ? 2 : 1); setIndex(value === 4 ? 2 : 1);
    }} />
    <div className="viz-controls">
      <label>User Tower<select value={tower} onChange={(e) => setTower(Number(e.target.value))}><option value={1}>v1</option><option value={2}>v2</option></select></label>
      <label>ANN Index<select value={index} onChange={(e) => setIndex(Number(e.target.value))}><option value={1}>v1</option><option value={2}>v2</option></select></label>
    </div>
    <div className={"viz-narr" + (verified ? " is-good" : " is-warn")} aria-live="polite">
      {details[step]} 当前组合 {verified ? "已通过本例的兼容性验证。" : "未经验证，需要确认表示空间、特征和参数是否兼容。"}
    </div>
  </Lab>;
}
