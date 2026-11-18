"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Bars from "@/components/visualization/ml/primitives/Bars";
import Slider from "@/components/visualization/ml/primitives/Slider";
import {
  buildToyIndexes, cosine, INTERACTIONS, ITEMS, itemVector, popularityWeight,
  retrieveToy, scorePaths, USERS, type CfMode,
} from "@/lib/ml/collaborativeFiltering";

const fmt = (value: number) => value.toFixed(3);
const MODES = { item: "ItemCF", user: "UserCF" };
const INDEXES = buildToyIndexes();

function ModeControl({ mode, setMode }: { mode: CfMode; setMode: (mode: CfMode) => void }) {
  return <div className="viz-chips" role="group" aria-label="召回方式">
    {(["item", "user"] as const).map((value) => (
      <button key={value} type="button" className="viz-chip" aria-pressed={mode === value}
        onClick={() => setMode(value)}>{MODES[value]}</button>
    ))}
  </div>;
}

export function InteractionMatrix() {
  const [matrix, setMatrix] = useState(INTERACTIONS);
  const [mode, setMode] = useState<CfMode>("item");
  const [pair, setPair] = useState([0, 2]);
  const names = mode === "item" ? ITEMS : USERS;
  const vectors = pair.map((index) => mode === "item" ? itemVector(matrix, index) : matrix[index]);
  const result = cosine(vectors[0], vectors[1]);
  const shared = (mode === "item" ? USERS : ITEMS).filter((_, index) => result.shared[index]);

  return <VisualizationFrame title="交互矩阵里的行与列" description="点单元格切换 0 / 1。选择两列或两行，观察哪些共同交互进入分子。">
    <div className="viz-controls">
      <ModeControl mode={mode} setMode={(next) => { setMode(next); setPair(next === "item" ? [0, 2] : [0, 1]); }} />
      {pair.map((value, side) => <label key={side}>
        {side === 0 ? "向量 1" : "向量 2"}
        <select value={value} onChange={(event) => setPair((current) => current.map((index, i) => i === side ? Number(event.target.value) : index))}>
          {names.map((name, index) => <option key={name} value={index} disabled={pair[1 - side] === index}>{name}</option>)}
        </select>
      </label>)}
      <button type="button" className="viz-btn" onClick={() => { setMatrix(INTERACTIONS); setMode("item"); setPair([0, 2]); }}>重置</button>
    </div>
    <div className="viz-scroll"><table className="viz-table cf-matrix">
      <thead><tr><th scope="col">User</th>{ITEMS.map((item, col) => <th key={item} scope="col" className={mode === "item" && pair.includes(col) ? "cf-selected" : ""}>{item}</th>)}</tr></thead>
      <tbody>{matrix.map((row, r) => <tr key={USERS[r]}>
        <th scope="row" className={mode === "user" && pair.includes(r) ? "cf-selected" : ""}>{USERS[r]}</th>
        {row.map((value, c) => {
          const selected = pair.includes(mode === "item" ? c : r);
          const overlap = selected && result.shared[mode === "item" ? r : c];
          return <td key={ITEMS[c]} className={overlap ? "cf-overlap" : selected ? "cf-selected" : ""}>
            <button type="button" className="viz-btn" aria-label={USERS[r] + " · " + ITEMS[c]} aria-pressed={Boolean(value)}
              onClick={() => setMatrix((current) => current.map((line, i) => i === r ? line.map((cell, j) => j === c ? 1 - cell : cell) : line))}>{value}</button>
          </td>;
        })}
      </tr>)}</tbody>
    </table></div>
    <div className="viz-narr" aria-live="polite">
      共同交互 {shared.join("、") || "无"}。sim({names[pair[0]]}, {names[pair[1]]}) = {result.numerator} /
      √({vectors[0].filter(Boolean).length} × {vectors[1].filter(Boolean).length})。
      {result.denominator ? <> 分母 {fmt(result.denominator)}，相似度 {fmt(result.value)}。</> : " 分母为 0，示例约定相似度为 0。"}
    </div>
  </VisualizationFrame>;
}

const SCORE_EXAMPLES = {
  item: { likes: [2, 1, 4, 3], similarities: [0.1, 0.4, 0.2, 0.6] },
  user: { likes: [0, 1, 3, 0], similarities: [0.9, 0.7, 0.7, 0.4] },
};

export function ScoringPlayground({ mode }: { mode: CfMode }) {
  const initial = SCORE_EXAMPLES[mode];
  const [values, setValues] = useState(initial);
  const paths = values.likes.map((like, index) => ({ like, similarity: values.similarities[index] }));
  const labels = paths.map((_, index) => (mode === "item" ? "历史物品 " : "相似用户 ") + (index + 1));
  function update(key: keyof typeof initial, index: number, value: number) {
    setValues((current) => ({ ...current, [key]: current[key].map((old, i) => i === index ? value : old) }));
  }
  return <VisualizationFrame title={MODES[mode] + " 的四条评分路径"} description="调整每条路径的 Like 与 Similarity，观察它对同一候选的贡献。">
    <div className="viz-controls"><button type="button" className="viz-btn" onClick={() => setValues(initial)}>重置</button></div>
    <div className="viz-grid2">
      {paths.map((path, index) => <div className="viz-panel" key={labels[index]}>
        <h5>当前用户 → {labels[index]} → 候选物品</h5>
        <Slider label={labels[index] + " Like"} value={path.like} min={0} max={5} step={0.1} onChange={(value) => update("likes", index, value)} />
        <Slider label={labels[index] + " Similarity"} value={path.similarity} min={0} max={1} step={0.01} onChange={(value) => update("similarities", index, value)} />
        <p>{path.like} × {path.similarity} = {fmt(path.like * path.similarity)}</p>
      </div>)}
    </div>
    <Bars rows={paths.map((path, index) => ({ label: labels[index], value: path.like * path.similarity, max: 5, color: "var(--v1)", text: fmt(path.like * path.similarity) }))} />
    <div className="viz-narr" aria-live="polite">
      {paths.map(({ like, similarity }) => mode === "item" ? like + " × " + similarity : similarity + " × " + like).join(" + ")}
      {" = "}{fmt(scorePaths(paths))}
    </div>
  </VisualizationFrame>;
}

export function PopularityPenaltyFigure() {
  const [count, setCount] = useState(3);
  const weight = popularityWeight(count);
  const denominator = cosine(INTERACTIONS[0], INTERACTIONS[3]).denominator;
  return <VisualizationFrame title="一条共同兴趣能提供多少信息" description="固定两位用户各有两次交互、仅共享一个物品，改变该物品的交互人数。">
    <div className="viz-controls">
      <Slider label="交互人数" value={count} min={2} max={100} onChange={setCount} />
      <button type="button" className="viz-btn" onClick={() => setCount(3)}>重置</button>
    </div>
    <div className="viz-narr" aria-live="polite">
      二值余弦 1 / {fmt(denominator)} = {fmt(1 / denominator)}。
      加权贡献 1 / ln(1 + {count}) = {fmt(weight)}，加权相似度 {fmt(weight)} / {fmt(denominator)} = {fmt(weight / denominator)}。
    </div>
  </VisualizationFrame>;
}

export function CfComparison() {
  const [candidate, setCandidate] = useState(2);
  return <VisualizationFrame title="U6 看过 A、B 后，C 和 D 的分数从哪来" description="选择同一个候选，两边分别展开它的有效路径。">
    <div className="viz-chips" role="group" aria-label="候选物品">
      {[2, 3].map((index) => <button key={index} type="button" className="viz-chip" aria-pressed={candidate === index}
        onClick={() => setCandidate(index)}>{ITEMS[index]}</button>)}
    </div>
    <div className="viz-grid2" aria-live="polite">
      {(["item", "user"] as const).map((mode) => {
        const paths = retrieveToy(mode, 4, 5, 4, INDEXES).paths.filter((path) => path.item === candidate);
        return <div className="viz-panel" key={mode}>
          <h5>{MODES[mode]} · {mode === "item" ? "经历史物品" : "经相似用户"}</h5>
          <ul>{paths.map((path) => <li key={path.via} className="cf-overlap">
            U6 → {path.via} → {ITEMS[candidate]} · {mode === "item" ? path.like + " × " + fmt(path.similarity) : fmt(path.similarity) + " × " + path.like}
          </li>)}</ul>
          <p>累计 {fmt(scorePaths(paths))}</p>
        </div>;
      })}
    </div>
  </VisualizationFrame>;
}

export function RetrievalSimulator() {
  const [mode, setMode] = useState<CfMode>("item");
  const [n, setN] = useState(200);
  const [k, setK] = useState(10);
  const [m, setM] = useState(100);
  const [step, setStep] = useState(0);
  const result = retrieveToy(mode, n, k, m, INDEXES);
  const summary = (rows: typeof result.merged) => rows.map(({ item, score }) => ITEMS[item] + " " + fmt(score)).join("、") || "无";
  const steps = [
    ["输入用户", "U6 已交互 A、B。"],
    ["查询第一个索引", (mode === "item" ? "User → Item · " : "User → User · ") + (result.lookups.map(({ via, weight }) => via + " (" + fmt(weight) + ")").join("、") || "无")],
    ["查询第二个索引", (mode === "item" ? "Item → Item · " : "User → Item · ") + (result.lookups.map(({ via, entries }) => via + " → " + (entries.map(({ index, weight }) => ITEMS[index] + " (" + fmt(weight) + ")").join("、") || "无")).join("；") || "无")],
    ["展开候选条目", result.paths.map(({ via, item }) => via + " → " + ITEMS[item]).join("、") || "无"],
    ["按物品合并", "从 " + result.paths.length + " 条路径合并成 " + result.merged.length + " 个物品。"],
    ["累加分数", result.merged.map(({ item, score }) =>
      ITEMS[item] + " = " + result.paths.filter((path) => path.item === item)
        .map(({ similarity, like }) => fmt(similarity) + " × " + like).join(" + ") + " ≈ " + fmt(score),
    ).join("；") || "无"],
    ["过滤并返回 Top-M", "过滤历史物品 A、B。返回 " + summary(result.selected) + "。"],
  ];
  return <VisualizationFrame title="从离线索引到线上候选" description="相似度索引由固定矩阵预先生成。线上只查索引，按步查看实际查出的条目和分数。">
    <div className="viz-controls">
      <ModeControl mode={mode} setMode={(next) => { setMode(next); setStep(0); }} />
      <button type="button" className="viz-btn" onClick={() => { setMode("item"); setN(200); setK(10); setM(100); setStep(0); }}>重置</button>
    </div>
    <div className="viz-controls">
      <Slider label={mode === "item" ? "N · 历史物品" : "N · 每位近邻的物品"} value={n} min={1} max={200} onChange={setN} />
      <Slider label={mode === "item" ? "K · 每个物品的近邻" : "K · 近邻用户"} value={k} min={1} max={20} onChange={setK} />
      <Slider label="M · 返回数量" value={m} min={1} max={100} onChange={setM} />
    </div>
    <p>去重前条目上限 {mode === "item" ? "N × K" : "K × N"} = {mode === "item" ? n + " × " + k : k + " × " + n} = {n * k}。实际条目受索引内容限制，重复物品会合并。</p>
    <Slider label="线上步骤" value={step} min={0} max={steps.length - 1} display={String(step + 1)} onChange={setStep} />
    <div className="viz-narr" aria-live="polite"><strong>{steps[step][0]}</strong><p>{steps[step][1]}</p></div>
  </VisualizationFrame>;
}
