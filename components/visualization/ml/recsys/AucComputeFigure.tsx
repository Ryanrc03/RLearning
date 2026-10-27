"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import StepPlayer from "@/components/visualization/ml/primitives/StepPlayer";
import { byRequest, EXAMPLE_ROWS, gaucFrom, groupWeight, pairCountAuc, perGroupAuc, rankAuc, type Row, type Weighting } from "@/lib/ml/aucCompute";

// Recommender Systems: AUC and GAUC computed by hand on 15 exposures of three
// users. Steps: sort one user, count pairs, get the same number from ranks,
// cut the rows by user, one AUC per user (skip one-class users), weight and
// average, then cut the same rows by request instead.

const STEPS = [
  "排序",
  "数对",
  "排名公式",
  "按用户切开",
  "每人一个 AUC",
  "加权平均 = GAUC",
  "换成按请求切",
];

const f3 = (x: number) => (Number.isNaN(x) ? "—" : x.toFixed(3));
const userA = EXAMPLE_ROWS.filter((r) => r.group === "A");
const WEIGHTINGS: { key: Weighting; label: string }[] = [
  { key: "sample", label: "按曝光数 n" },
  { key: "positive", label: "按正例数 n⁺" },
  { key: "none", label: "不加权" },
];

function RowList({ rows, ranks, highlight, showRank }: { rows: readonly Row[]; ranks?: number[]; highlight?: (r: Row) => string | undefined; showRank?: boolean }) {
  return (
    <table className="viz-table">
      <thead>
        <tr><th>曝光</th><th>分数</th><th className="num">label</th>{showRank && <th className="num">排名（升序）</th>}</tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.id} style={highlight?.(r) ? { background: highlight(r) } : undefined}>
            <td className="viz-mono">{r.id}</td>
            <td>
              <div className="viz-bar-track" style={{ height: 10, width: 120, display: "inline-block", verticalAlign: "middle" }}>
                <span style={{ width: `${r.score * 100}%`, background: r.label ? "var(--v1)" : "#b9b8a8" }} />
              </div>
              <span className="viz-mono" style={{ marginLeft: 6 }}>{r.score.toFixed(2)}</span>
            </td>
            <td className="num">{r.label ? <b style={{ color: "var(--v1)" }}>1</b> : "0"}</td>
            {showRank && ranks && <td className="num">{ranks[i]}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function AucComputeFigure({ initialStep = 0 }: { initialStep?: number }) {
  const [step, setStep] = useState(initialStep);
  const sortedA = [...userA].sort((a, b) => b.score - a.score);
  const pairs = pairCountAuc(userA);
  const ranked = rankAuc(sortedA);
  const users = perGroupAuc(EXAMPLE_ROWS);
  const requests = perGroupAuc(byRequest(EXAMPLE_ROWS));
  const gSample = gaucFrom(users, "sample");
  const global = rankAuc(EXAMPLE_ROWS).auc;

  let body = null;
  let narr = "";
  let tone = "";

  if (step === 0) {
    body = <RowList rows={sortedA} />;
    narr = "先只看用户 A：8 次曝光，3 次点了（label = 1）。按模型分数从高到低排好。AUC 问的是：随便抽一个点了的和一个没点的，模型把点了的排在前面的概率。";
  } else if (step === 1) {
    const counts = sortedA.filter((r) => r.label === 1).map((p) => {
      const negs = userA.filter((q) => q.label === 0);
      return { id: p.id, beat: negs.filter((q) => p.score > q.score).length, tie: negs.filter((q) => p.score === q.score).length, of: negs.length };
    });
    body = (
      <div className="viz-grid2 wide-left">
        <RowList rows={sortedA} highlight={(r) => (r.id === "A4" || r.id === "A5" ? "#fdf3cd" : undefined)} />
        <div className="viz-panel">
          <h5>每个正例赢了几个负例</h5>
          <table className="viz-table"><tbody>
            {counts.map((c) => <tr key={c.id}><td className="viz-mono">{c.id}</td><td className="num">{c.beat}{c.tie ? ` + ${c.tie} 个平` : ""} / {c.of}</td></tr>)}
            <tr><td><b>合计</b></td><td className="num"><b>{pairs.good} + ½ × {pairs.ties} = {pairs.good + pairs.ties / 2}</b></td></tr>
          </tbody></table>
          <p className="viz-k" style={{ marginTop: 8 }}>AUC = {pairs.good + pairs.ties / 2} / ({ranked.nPos} × {ranked.nNeg}) = <b>{f3(pairs.auc)}</b></p>
        </div>
      </div>
    );
    narr = `3 个正例 × 5 个负例 = ${pairs.pairs} 对。排对的记 1，分数相同（黄色那两行，都是 0.52）记 ½。这就是定义，但要两两比较：n⁺ × n⁻ 次，一个用户有上千条曝光时太慢。`;
  } else if (step === 2) {
    const asc = [...userA].sort((a, b) => a.score - b.score);
    const r = rankAuc(asc);
    body = (
      <div className="viz-grid2 wide-left">
        <RowList rows={asc} ranks={r.ranks} showRank highlight={(x) => (x.label === 1 ? "#eef5fd" : undefined)} />
        <div className="viz-panel">
          <h5>一次排序就够</h5>
          <table className="viz-table"><tbody>
            <tr><td>正例的排名和 R⁺</td><td className="num">{asc.map((x, i) => (x.label === 1 ? r.ranks[i] : null)).filter((x) => x !== null).join(" + ")} = <b>{r.rPos}</b></td></tr>
            <tr><td>正例全垫底时的 R⁺</td><td className="num">n⁺(n⁺+1)/2 = {r.floor}</td></tr>
            <tr><td>AUC</td><td className="num">({r.rPos} − {r.floor}) / ({r.nPos} × {r.nNeg}) = <b>{f3(r.auc)}</b></td></tr>
          </tbody></table>
        </div>
      </div>
    );
    tone = "is-good";
    narr = "按分数从低到高编排名 1…n，并列的取平均（两个 0.52 都记 4.5，这就是「平局算半对」）。正例的排名和，减去「正例全排在最底下」时的最小可能值，剩下的正好是赢下的负例个数。和数对的结果一样，只要一次 O(n log n) 的排序。kurec/metrics.py 用 scipy 的 rankdata 做的就是这个。";
  } else if (step === 3) {
    body = (
      <div className="viz-cards">
        {users.map((u) => (
          <div key={u.group} className="viz-card">
            <h6>用户 {u.group} · {u.n} 次曝光 · {u.nPos} 次点击</h6>
            <RowList rows={EXAMPLE_ROWS.filter((r) => r.group === u.group).sort((a, b) => b.score - a.score)} />
          </div>
        ))}
      </div>
    );
    narr = `现在有 3 个用户共 15 次曝光。全局 AUC 把所有正例和所有负例混在一起比——A 的正例也拿去和 B、C 的负例比。这 15 行的全局 AUC 是 ${f3(global)}。GAUC 先按 user_id 把行切成段：代码里是按 user 排序后找出段的边界。`;
  } else if (step === 4) {
    body = (
      <table className="viz-table">
        <thead><tr><th>用户</th><th className="num">n</th><th className="num">n⁺</th><th className="num">AUC</th><th /></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.group} style={u.skipped ? { opacity: 0.55 } : undefined}>
              <td>用户 {u.group}</td><td className="num">{u.n}</td><td className="num">{u.nPos}</td><td className="num"><b>{f3(u.auc)}</b></td>
              <td>{u.skipped ? "只有负例，算不出 AUC，跳过" : u.group === "B" ? "唯一的高分是个没点的" : "排得不错"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
    tone = "is-warn";
    narr = `每段内部用上一步的排名公式算 AUC。用户 C 一次都没点，没有正负对可比，直接跳过——这 3 行不进 GAUC（覆盖率 ${(gSample.coverage * 100).toFixed(0)}%）。真实数据里这很常见：test 里 988 个用户都能算 click，点赞只剩 864 个，关注只剩 572 个。`;
  } else if (step === 5) {
    body = (
      <div className="viz-grid2">
        <div className="viz-panel">
          <h5>GAUC = Σ wᵤ · AUCᵤ / Σ wᵤ</h5>
          <table className="viz-table">
            <thead><tr><th>权重</th><th>计算</th><th className="num">GAUC</th></tr></thead>
            <tbody>
              {WEIGHTINGS.map((w) => {
                const used = users.filter((u) => !u.skipped);
                return (
                  <tr key={w.key}>
                    <td>{w.label}</td>
                    <td className="viz-mono">({used.map((u) => `${groupWeight(u, w.key)}×${u.auc.toFixed(3)}`).join(" + ")}) / {used.reduce((s, u) => s + groupWeight(u, w.key), 0)}</td>
                    <td className="num"><b>{f3(gaucFrom(users, w.key).gauc)}</b></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="viz-panel">
          <h5>同一批 15 次曝光</h5>
          <table className="viz-table"><tbody>
            <tr><td>全局 AUC（混算）</td><td className="num">{f3(global)}</td></tr>
            <tr><td>GAUC（按曝光数加权，kurec 默认）</td><td className="num"><b>{f3(gSample.gauc)}</b></td></tr>
          </tbody></table>
        </div>
      </div>
    );
    narr = "每个用户的 AUC 按他的曝光数加权平均，曝光多的用户说话分量重。按正例数加权、或不加权，同样的分数会给出不同的 GAUC：和别人的数对比之前，先对齐加权方式。";
  } else {
    const gReq = gaucFrom(requests, "sample");
    body = (
      <table className="viz-table">
        <thead><tr><th>请求</th><th>里面的曝光</th><th className="num">n</th><th className="num">AUC</th></tr></thead>
        <tbody>
          {requests.map((q) => (
            <tr key={q.group} style={q.skipped ? { opacity: 0.55 } : undefined}>
              <td className="viz-mono">{q.group}</td>
              <td className="viz-mono">{byRequest(EXAMPLE_ROWS).filter((r) => r.group === q.group).map((r) => `${r.id}(${r.score.toFixed(2)}${r.label ? "✓" : ""})`).join(" ")}</td>
              <td className="num">{q.n}</td>
              <td className="num"><b>{q.skipped ? "跳过" : f3(q.auc)}</b></td>
            </tr>
          ))}
          <tr><td colSpan={3}><b>按请求的 GAUC（按曝光数加权）</b></td><td className="num"><b>{f3(gReq.gauc)}</b></td></tr>
        </tbody>
      </table>
    );
    tone = "is-bad";
    narr = `同样的分数，只是分组从「用户」换成「一次请求返回的那几条」：GAUC 从 ${f3(gSample.gauc)} 变成 ${f3(gReq.gauc)}。用户 A 的 0.52 平局被拆进了两个请求，不再相遇；B 的两次请求都排反了。线上精排只在一次请求的候选之间排序，所以 kuairank 两种分组都报。`;
  }

  return (
    <VisualizationFrame
      title="AUC 与 GAUC：在 15 次曝光上手算一遍"
      description="3 个用户、15 次曝光、一个平局。一步一步：数对 → 排名公式 → 按用户切开 → 每人一个 AUC → 加权平均 → 换成按请求切。"
      footnote="与 kurec/metrics.py 同一套算法：auc 用平均排名，per_group_auc 跳过只有一类的组，gauc 默认按样本数加权，request 分组是 (user, 请求时间)。"
    >
      <StepPlayer step={step} total={STEPS.length} onStep={setStep} caption={`第 ${step + 1} 步：${STEPS[step]}`} intervalMs={3000} />
      <div style={{ marginTop: 12 }}>{body}</div>
      <div className={`viz-narr ${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}
