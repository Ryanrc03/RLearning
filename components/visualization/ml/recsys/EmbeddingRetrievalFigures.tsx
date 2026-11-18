"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Plot from "@/components/visualization/ml/primitives/Plot";
import Slider from "@/components/visualization/ml/primitives/Slider";
import {
  ANN_ITEMS, ANN_K, dot, exactTopK, INITIAL_EMBEDDINGS, INTEREST, ITEM_NAMES, LEARNING_RATE,
  metricScore, normalize, OBSERVATIONS, observedMse, PARTITIONS, partitionSearch, sgdStep,
  type Embeddings, type Metric, type Vector,
} from "@/lib/ml/embeddingRetrieval";

const fmt = (value: number) => value.toFixed(3);
const vec = (v: Vector) => "[" + v.map(fmt).join(", ") + "]";
const label = (u: number, i: number) => "U" + (u + 1) + " · " + ITEM_NAMES[i];
const resetLabel = "重置";

function VectorSliders({ name, vector, setVector }: { name: string; vector: Vector; setVector: (v: Vector) => void }) {
  return <div className="viz-panel">
    <h5>{name}</h5>
    <Slider label={name + " · x"} value={vector[0]} min={-2} max={2} step={0.05} onChange={(x) => setVector([x, vector[1]])} />
    <Slider label={name + " · y"} value={vector[1]} min={-2} max={2} step={0.05} onChange={(y) => setVector([vector[0], y])} />
  </div>;
}

export function DotProductPlayground() {
  const [user, setUser] = useState(INITIAL_EMBEDDINGS.users[0]);
  const [items, setItems] = useState(INITIAL_EMBEDDINGS.items);
  const [selected, select] = useState(0);
  const item = items[selected];
  const ranking = items.map((b, index) => ({ score: dot(user, b), index }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  return <VisualizationFrame title="两张参数表，按 ID 取两个向量" description="拖动任一维，切换候选物品，观察乘积、预测分数和物品排序。">
    <div className="viz-controls">
      <label>物品<select value={selected} onChange={(event) => select(Number(event.target.value))}>
        {ITEM_NAMES.map((name, index) => <option key={name} value={index}>{name}</option>)}
      </select></label>
      <button type="button" className="viz-btn" onClick={() => { setUser(INITIAL_EMBEDDINGS.users[0]); setItems(INITIAL_EMBEDDINGS.items); select(0); }}>{resetLabel}</button>
    </div>
    <div className="viz-grid2">
      <VectorSliders name="用户 U1" vector={user} setVector={setUser} />
      <VectorSliders name={"物品 " + ITEM_NAMES[selected]} vector={item}
        setVector={(vector) => setItems((old) => old.map((b, index) => index === selected ? vector : b))} />
    </div>
    <div className="viz-narr" aria-live="polite">
      <div>{user[0]} × {item[0]} + {user[1]} × {item[1]} = {fmt(user[0] * item[0])} + {fmt(user[1] * item[1])} = <strong>{fmt(dot(user, item))}</strong></div>
      <div>全库按分数排序 {ranking.map(({ index, score }) => ITEM_NAMES[index] + " " + fmt(score)).join("、")}。</div>
    </div>
  </VisualizationFrame>;
}

export function MatrixTrainingPlayground() {
  const [model, setModel] = useState<Embeddings>(INITIAL_EMBEDDINGS);
  const [cell, setCell] = useState({ user: 2, item: 1 });
  const [predicted, setPredicted] = useState(false);
  const [last, setLast] = useState<ReturnType<typeof sgdStep>>();
  const { user, item } = cell;
  const target = INTEREST[user][item];
  const row = OBSERVATIONS.findIndex((entry) => entry.user === user && entry.item === item);
  const prediction = dot(model.users[user], model.items[item]);
  const suggestions = exactTopK(model, user, 2);
  function select(nextUser: number, nextItem: number) {
    setCell({ user: nextUser, item: nextItem });
    setLast(undefined);
  }
  return <VisualizationFrame title="从稀疏观测到预测矩阵" description="点击任一格查看交互。绿色表示已观察，灰色表示缺失。选择一条观测，执行真正的梯度更新，再切到预测矩阵查看整行怎样变化。">
    <div className="viz-controls">
      <div className="viz-chips" role="group" aria-label="矩阵视图">
        <button type="button" className="viz-chip" aria-pressed={!predicted} onClick={() => setPredicted(false)}>Observed Matrix</button>
        <button type="button" className="viz-chip" aria-pressed={predicted} onClick={() => setPredicted(true)}>Predicted Matrix</button>
      </div>
      <button type="button" className="viz-btn" onClick={() => { setModel(INITIAL_EMBEDDINGS); select(2, 1); setPredicted(false); }}>{resetLabel}</button>
    </div>
    <div className="viz-scroll"><table className="viz-table er-matrix">
      <thead><tr><th scope="col">User</th>{ITEM_NAMES.map((name) => <th key={name} scope="col">{name}</th>)}</tr></thead>
      <tbody>{INTEREST.map((values, u) => <tr key={u}><th scope="row">U{u + 1}</th>
        {values.map((value, i) => <td key={i} className={value === null ? "er-missing" : "er-observed"}>
          <button type="button" className="viz-btn" aria-label={label(u, i)}
            aria-pressed={u === user && i === item} onClick={() => select(u, i)}>
            {predicted ? fmt(dot(model.users[u], model.items[i])) : value ?? "?"}
          </button>
        </td>)}
      </tr>)}</tbody>
    </table></div>
    <div className="viz-controls">
      <label>训练样本<select value={row} onChange={(event) => {
        const entry = OBSERVATIONS[Number(event.target.value)];
        if (entry) select(entry.user, entry.item);
      }}>
        <option value={-1} disabled>当前为未观察位置</option>
        {OBSERVATIONS.map((entry, index) => <option key={index} value={index}>{label(entry.user, entry.item)} = {entry.label}</option>)}
      </select></label>
      <button type="button" className="viz-btn" disabled={row < 0} onClick={() => {
        const step = sgdStep(model, OBSERVATIONS[row]);
        setModel(step.model);
        setLast(step);
      }}>SGD Step</button>
    </div>
    <div className="viz-narr" aria-live="polite">
      <div>({label(user, item)} · {target ?? "Missing / Unobserved"})</div>
      <div>当前向量 {vec(model.users[user])} · {vec(model.items[item])}，内积 {fmt(prediction)}。
        {target === null ? " 该格不参与训练损失。" : " 单样本平方误差 " + fmt((target - prediction) ** 2) + "。"}</div>
      {last && target !== null && <div>本步梯度 {vec(last.gradA)}、{vec(last.gradB)}。
        预测 {fmt(last.before)} → {fmt(last.after)}，平方误差 {fmt((target - last.before) ** 2)} → {fmt((target - last.after) ** 2)}。</div>}
      <div>观测集 MSE {fmt(observedMse(model))} · 学习率 {LEARNING_RATE}</div>
      <div>当前用户 Exact Top-2（仅未观察物品）{suggestions.map(({ item: i, score }) => ITEM_NAMES[i] + " " + fmt(score)).join("、")}。</div>
    </div>
  </VisualizationFrame>;
}

const METRICS = { l2: "L2", ip: "Inner Product", cosine: "Cosine" } satisfies Record<Metric, string>;
const METRIC_FORMULAS = { l2: "√((aₓ−bₓ)²+(aᵧ−bᵧ)²)", ip: "aₓbₓ + aᵧbᵧ", cosine: "(a·b) / (‖a‖‖b‖)" };
const START_VECTORS: readonly Vector[] = [[1, 0], [2, 0], [0.8, 0.6]];
const VECTOR_NAMES = ["Query a", "b1", "b2"];
const COLORS = ["var(--v1)", "var(--v2)", "var(--v3)", "var(--v4)"];

export function VectorMetricsPlayground() {
  const [vectors, setVectors] = useState(START_VECTORS);
  const [editing, setEditing] = useState(0);
  const [metric, setMetric] = useState<Metric>("ip");
  const [unit, setUnit] = useState(false);
  const [a, b1, b2] = unit ? vectors.map(normalize) : vectors;
  const scores = [b1, b2].map((b) => metricScore(a, b, metric));
  const valid = scores.flatMap((score, i) => score === null ? [] : [{ i, score }]);
  const optimum = valid.length ? (metric === "l2" ? Math.min : Math.max)(...valid.map(({ score }) => score)) : null;
  const winners = valid.filter(({ score }) => optimum !== null && Math.abs(score - optimum) < 1e-9).map(({ i }) => i + 1);
  return <VisualizationFrame title="距离最短与内积最大可以选出不同物品" description="选择向量、调整坐标，再比较排序。开启单位化后，坐标轴和指标都使用归一化向量。">
    <div className="viz-controls">
      <label>调整向量<select value={editing} onChange={(e) => setEditing(Number(e.target.value))}>
        {VECTOR_NAMES.map((name, index) => <option key={name} value={index}>{name}</option>)}
      </select></label>
      <label>指标<select value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
        {(Object.keys(METRICS) as Metric[]).map((key) => <option key={key} value={key}>{METRICS[key]}</option>)}
      </select></label>
      <label><input type="checkbox" checked={unit} onChange={(e) => setUnit(e.target.checked)} /> Normalize Vectors</label>
      <button type="button" className="viz-btn" onClick={() => { setEditing(0); setVectors(START_VECTORS); setMetric("ip"); setUnit(false); }}>{resetLabel}</button>
    </div>
    <div className="viz-grid2">
      <Figure width={320} height={324} label="Query 与两个候选的位置，线段从原点出发">
        <Plot box={{ x: 0, y: 0, w: 320, h: 324 }} xDomain={[-2.2, 2.2]} yDomain={[-2.2, 2.2]} xTicks={[-2, 0, 2]} yTicks={[-2, 0, 2]}>
          {({ x, y }) => [a, b1, b2].map(([vx, vy], index) => <g key={index}>
            <line x1={x(0)} y1={y(0)} x2={x(vx)} y2={y(vy)} stroke={COLORS[index]} strokeWidth={winners.includes(index) ? 4 : 2} />
            <circle cx={x(vx)} cy={y(vy)} r={5} fill={COLORS[index]} stroke={winners.includes(index) ? "var(--ink)" : "none"} />
            <text x={x(vx)} y={y(vy) - 8 - 12 * index} textAnchor="middle" fill="var(--ink)" fontSize={12}>{VECTOR_NAMES[index]}</text>
          </g>)}
        </Plot>
      </Figure>
      <div>
        <VectorSliders name={VECTOR_NAMES[editing]} vector={vectors[editing]} setVector={(v) =>
          setVectors((old) => old.map((value, i) => i === editing ? v : value))} />
        <div className="viz-narr" aria-live="polite">
          <div>{METRIC_FORMULAS[metric]}</div>
          <div>a = {vec(a)}</div>
          {[b1, b2].map((b, i) => <div key={i}>b{i + 1} = {vec(b)} · {scores[i] === null ? "零向量余弦未定义" : fmt(scores[i]!)}
            {winners.includes(i + 1) ? " · 最优" : ""}</div>)}
        </div>
      </div>
    </div>
  </VisualizationFrame>;
}

const QUERIES: readonly Vector[] = [[1, 0.55], [1, 0], [-0.8, 0.45], [0, -1]];

export function AnnSearchPlayground() {
  const [query, setQuery] = useState(0);
  const [budget, setBudget] = useState(1);
  const [exact, setExact] = useState(false);
  const vector = QUERIES[query];
  const result = partitionSearch(vector, budget);
  const returned = exact ? result.exact : result.approximate;
  const visited = new Set((exact ? ANN_ITEMS : result.visited).map(({ id }) => id));
  return <VisualizationFrame title="先挑分区，再给分区里的物品打分" description="这组二维点用固定分区演示 ANN。先按分区中心与 Query 的内积选分区，再按物品内积排序。">
    <div className="viz-controls">
      <label>Query<select value={query} onChange={(event) => setQuery(Number(event.target.value))}>
        {QUERIES.map((value, index) => <option key={index} value={index}>{vec(value)}</option>)}
      </select></label>
      <label>搜索方式<select value={exact ? "exact" : "ann"} onChange={(event) => setExact(event.target.value === "exact")}>
        <option value="ann">Approximate Search</option><option value="exact">Exact Search</option>
      </select></label>
      <button type="button" className="viz-btn" onClick={() => { setQuery(0); setBudget(1); setExact(false); }}>{resetLabel}</button>
    </div>
    <Slider label="ANN 探测分区数" value={budget} min={1} max={PARTITIONS.length} onChange={setBudget} />
    <div className="viz-grid2">
      <Figure width={320} height={324} label="彩色点为已访问物品，带描边的点为当前返回结果">
        <Plot box={{ x: 0, y: 0, w: 320, h: 324 }} xDomain={[-2.2, 2.2]} yDomain={[-2.2, 2.2]} xTicks={[-2, 0, 2]} yTicks={[-2, 0, 2]}>
          {({ x, y }) => <>
            {PARTITIONS.map(([px, py], index) => <g key={index}>
              <circle cx={x(px)} cy={y(py)} r={29} fill={COLORS[index]} opacity={0.16} />
              <text x={x(px)} y={y(py) + 42} textAnchor="middle" fill="var(--ink)" fontSize={12}>分区 {index + 1}</text>
            </g>)}
            {ANN_ITEMS.map(({ id, bucket, vector: [vx, vy] }) => <circle key={id} cx={x(vx)} cy={y(vy)}
              r={returned.includes(id) ? 6 : 4} fill={visited.has(id) ? COLORS[bucket] : "var(--muted)"}
              opacity={visited.has(id) ? 1 : 0.45} stroke={returned.includes(id) ? "var(--ink)" : "none"} strokeWidth={2}>
              <title>物品 {id}</title>
            </circle>)}
            <line x1={x(0)} y1={y(0)} x2={x(vector[0])} y2={y(vector[1])} stroke="var(--ink)" strokeWidth={2} />
            <text x={x(vector[0])} y={y(vector[1]) - 8} fill="var(--ink)" fontSize={12}>Query</text>
          </>}
        </Plot>
      </Figure>
      <div className="viz-narr" aria-live="polite">
        <div>Exact Top-{ANN_K} · {result.exact.join("、")}</div>
        <div>ANN Top-{ANN_K} · {result.approximate.join("、")}</div>
        <div>ANN Recall@{ANN_K} = {result.hits}/{ANN_K} = {Math.round(result.recall * 100)}%</div>
        <div>当前访问 {visited.size}/{ANN_ITEMS.length} 个物品。{exact ? "目前高亮 Exact 返回。" : "探测分区 " + result.partitions.map((i) => i + 1).join("、") + "。"}</div>
      </div>
    </div>
  </VisualizationFrame>;
}
