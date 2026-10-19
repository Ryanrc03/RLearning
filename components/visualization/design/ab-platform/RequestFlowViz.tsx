"use client";

import { useMemo, useState, type ReactNode } from "react";
import rough from "roughjs";
import CodeBlock from "@/components/visualization/sketch/CodeBlock";
import { SK, SkArrow, SkBadge, SkBox, SketchFigure, SkLine, SkText, seedOf } from "@/components/visualization/sketch/Sketch";
import { addDays, buildSummary, DAYS, EXPERIMENTS, filterRows, generateDailyRows, groupByVariant, SUMMARY_SQL, type SummaryResponse } from "@/lib/systems/abPlatform";

const DATES = Array.from({ length: DAYS }, (_, i) => addDays(EXPERIMENTS[0].startDate, i));
const LANES = [
  { key: "react", label: "React", tone: "blue" as const, x: 130 },
  { key: "api", label: "FastAPI", tone: "orange" as const, x: 420 },
  { key: "db", label: "PostgreSQL", tone: "green" as const, x: 710 },
];
const STEP_TITLES = ["选择实验和日期", "HTTP 请求", "参数化 SQL", "聚合 + 统计检验", "JSON → 看板"];
const pct = (x: number, d = 2) => `${(x * 100).toFixed(d)}%`;
const signedPct = (x: number, d = 2) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(d)}%`;
const gen = rough.generator();

type Msg = { step: number; from: number; to: number; y: number; label: string; error?: boolean };

function messages(invalid: boolean): Msg[] {
  if (invalid) {
    return [
      { step: 1, from: 0, to: 0, y: 110, label: "setState(filters)" },
      { step: 2, from: 0, to: 1, y: 160, label: "GET /summary?start>end" },
      { step: 2, from: 1, to: 0, y: 205, label: "422 Unprocessable", error: true },
    ];
  }
  return [
    { step: 1, from: 0, to: 0, y: 110, label: "setState(filters)" },
    { step: 2, from: 0, to: 1, y: 160, label: "GET /experiments/{id}/summary" },
    { step: 3, from: 1, to: 2, y: 205, label: "SQL + params" },
    { step: 3, from: 2, to: 1, y: 245, label: "2 rows" },
    { step: 4, from: 1, to: 1, y: 290, label: "z-test, CI, SRM" },
    { step: 5, from: 1, to: 0, y: 340, label: "200 OK · JSON" },
  ];
}

function MiniChart({ daily }: { daily: SummaryResponse["daily"] }) {
  const W = 360, H = 130, l = 36, r = 8, t = 8, b = 18;
  const vals = daily.flatMap((d) => [d.control, d.treatment]);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo || 0.01) * 0.15;
  const y0 = lo - pad, y1 = hi + pad;
  const sx = (i: number) => l + (daily.length === 1 ? (W - l - r) / 2 : (i / (daily.length - 1)) * (W - l - r));
  const sy = (v: number) => t + (1 - (v - y0) / (y1 - y0)) * (H - t - b);
  const line = (k: "control" | "treatment", color: string) => {
    const pts = daily.map((d, i) => [sx(i), sy(d[k])] as [number, number]);
    const drawable = pts.length > 1 ? gen.linearPath(pts, { seed: seedOf(k + daily.length + daily[0].date), stroke: color, strokeWidth: 1.8, roughness: 0.6, disableMultiStroke: true }) : gen.circle(pts[0][0], pts[0][1], 6, { seed: 1, stroke: color, fill: color, fillStyle: "solid" });
    return gen.toPaths(drawable).map((p, i) => <path key={k + i} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} fill={p.fill ?? "none"} strokeLinecap="round" />);
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block" }} role="img" aria-label="每日转化率曲线">
      {[0.2, 0.5, 0.8].map((f) => {
        const v = y0 + (y1 - y0) * f;
        return <g key={f}><line x1={l} x2={W - r} y1={sy(v)} y2={sy(v)} stroke="#f1f3f5" /><text x={l - 4} y={sy(v) + 3} fontSize={9} textAnchor="end" fill={SK.muted}>{pct(v, 1)}</text></g>;
      })}
      {line("control", SK.muted)}
      {line("treatment", SK.blue.stroke)}
      <text x={l} y={H - 4} fontSize={9} fill={SK.muted}>{daily[0].date.slice(5)}</text>
      <text x={W - r} y={H - 4} fontSize={9} fill={SK.muted} textAnchor="end">{daily[daily.length - 1].date.slice(5)}</text>
    </svg>
  );
}

export default function RequestFlowViz() {
  const [expId, setExpId] = useState(EXPERIMENTS[0].id);
  const [start, setStart] = useState(DATES[0]);
  const [end, setEnd] = useState(DATES[6]);
  const [step, setStep] = useState(1);
  const exp = EXPERIMENTS.find((e) => e.id === expId)!;
  const rows = useMemo(() => generateDailyRows(exp), [exp]);
  const invalid = end < start;
  const q = { experimentId: exp.id, startDate: start, endDate: end };
  const filtered = invalid ? [] : filterRows(rows, q);
  const [c, t] = groupByVariant(filtered);
  const s = invalid ? null : buildSummary(exp, q, rows);
  const maxStep = invalid ? 2 : 5;
  const cur = Math.min(step, maxStep);
  const msgs = messages(invalid);
  const reset = (fn: () => void) => { fn(); setStep(1); };
  const url = `GET /api/experiments/${exp.id}/summary?start_date=${start}&end_date=${end}`;

  let detail: ReactNode = null;
  if (cur === 1) {
    detail = (
      <CodeBlock lang="json" title="DashboardPage · state" compact>{`{
  "experimentId": ${exp.id},
  "startDate": "${start}",
  "endDate": "${end}"
}`}</CodeBlock>
    );
  } else if (cur === 2) {
    detail = (
      <CodeBlock lang="http" title="request" compact note={invalid ? "参数校验在 API 边界完成，数据库一次都没被访问。" : "筛选条件在 URL 里：同一个链接发给同事，打开的是同一张看板。"}>
        {invalid ? `${url}\n\nHTTP/1.1 422 Unprocessable Entity\n{ "detail": "end_date must be on or after start_date" }` : `${url}\nAccept: application/json`}
      </CodeBlock>
    );
  } else if (cur === 3) {
    detail = (
      <div className="ab-flow-split">
        <CodeBlock lang="sql" title="summary.sql" compact note={`params = { experiment_id: ${exp.id}, start_date: '${start}', end_date: '${end}' }`}>{SUMMARY_SQL}</CodeBlock>
        <div className="ab-result">
          <div className="ab-result-head">PostgreSQL → 2 rows <span>扫描 {filtered.length} 行</span></div>
          <table>
            <thead><tr><th>variant</th><th>users</th><th>converted_users</th></tr></thead>
            <tbody>
              {[c, t].map((g) => <tr key={g.variant}><td>{g.variant}</td><td>{g.users.toLocaleString()}</td><td>{g.convertedUsers.toLocaleString()}</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    );
  } else if (cur === 4 && s) {
    detail = (
      <CodeBlock lang="python" title="stats.py · two_proportion_summary()" compact>{`p_c  = ${c.convertedUsers} / ${c.users}   # ${pct(s.variants[0].rate, 3)}
p_t  = ${t.convertedUsers} / ${t.users}   # ${pct(s.variants[1].rate, 3)}
diff = p_t - p_c               # ${signedPct(s.absolute_diff, 3)}
lift = diff / p_c              # ${signedPct(s.relative_lift)}
z    = diff / se_pooled        # ${s.z}
p    = 2 * (1 - Phi(abs(z)))   # ${s.p_value}
ci95 = diff ± 1.96 * se        # [${signedPct(s.ci95[0], 3)}, ${signedPct(s.ci95[1], 3)}]
srm_p = check_split(${c.users}, ${t.users}, 0.5)   # ${s.srm_p_value}`}</CodeBlock>
    );
  } else if (cur === 5 && s) {
    detail = (
      <div className="ab-flow-split">
        <CodeBlock lang="json" title="200 OK" compact>{JSON.stringify({ ...s, daily: [s.daily[0], `… ${s.daily.length} days`] }, null, 2)}</CodeBlock>
        <div className="ab-dash">
          <div className="ab-dash-bar"><span className="sk-hand">{exp.name}</span><span>{start.slice(5)} → {end.slice(5)}</span></div>
          <div className="ab-kpis">
            <div><small>Control</small><b style={{ color: SK.muted }}>{pct(s.variants[0].rate)}</b><em>{s.variants[0].users.toLocaleString()} users</em></div>
            <div><small>Treatment</small><b style={{ color: SK.blue.stroke }}>{pct(s.variants[1].rate)}</b><em>{s.variants[1].users.toLocaleString()} users</em></div>
            <div className={s.significant ? "is-sig" : "is-ns"}><small>Lift</small><b>{signedPct(s.relative_lift)}</b><em>p = {s.p_value}</em></div>
          </div>
          <MiniChart daily={s.daily} />
          <div className="ab-legend"><span><i style={{ background: SK.muted }} />control</span><span><i style={{ background: SK.blue.stroke }} />treatment</span><span className={s.srm_p_value < 0.001 ? "bad" : ""}>SRM p = {s.srm_p_value}</span></div>
        </div>
      </div>
    );
  }

  let narr: string;
  if (invalid && cur === 2) narr = "结束日期早于开始日期：FastAPI 在进入业务逻辑前就返回 422。校验放在 API 边界，后面的代码可以假设输入是干净的。";
  else if (cur === 1) narr = "React 只保存三个筛选状态，不持有原始数据，也不算统计量。";
  else if (cur === 2) narr = "GET 只读不写，可以安全重试，也可以被缓存。";
  else if (cur === 3) narr = `占位符 %(name)s 的值由数据库驱动单独传过去，不拼进字符串，所以不会被 SQL 注入。索引找到 ${filtered.length} 行（${filtered.length / 2} 天 × 2 组），GROUP BY 之后只把 2 行传回 Python。`;
  else if (cur === 4) narr = "这一段就是以前每个人在 Notebook 里各写一遍的逻辑；现在只有一份实现，有单元测试。";
  else narr = s!.significant
    ? `p = ${s!.p_value} < 0.05，置信区间不跨 0。显著不等于该上线：还要看效应大小、护栏指标，以及区间是不是事先定好的。`
    : `p = ${s!.p_value}，置信区间跨过 0，看不出差别。区间很短时可能只是样本不够。`;

  return (
    <SketchFigure
      title="Data Flow：一次看板请求，逐步走一遍"
      caption="数据全部虚构：四个实验各 28 天，设定的真实效果分别是 +6%、+1.5%、0、−8%。试试“价格按月展示”只看第一周，再看全部 28 天。"
      minWidth={600}
    >
      <div className="sk-row" style={{ marginBottom: 8 }}>
        <label>实验
          <select value={expId} onChange={(e) => reset(() => setExpId(Number(e.target.value)))}>
            {EXPERIMENTS.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </label>
        <label>从<select value={start} onChange={(e) => reset(() => setStart(e.target.value))}>{DATES.map((d) => <option key={d} value={d}>{d.slice(5)}</option>)}</select></label>
        <label>到<select value={end} onChange={(e) => reset(() => setEnd(e.target.value))}>{DATES.map((d) => <option key={d} value={d}>{d.slice(5)}</option>)}</select></label>
      </div>
      <svg viewBox="0 0 840 380" role="img" aria-label="请求时序图">
        {LANES.map((ln) => (
          <g key={ln.key}>
            <SkLine seed={`life-${ln.key}`} points={[[ln.x, 74], [ln.x, 368]]} stroke="#ced4da" dashed />
            <SkBox x={ln.x - 75} y={18} w={150} h={52} seed={`lane-${ln.key}`} tone={ln.tone} />
            <SkText x={ln.x} y={51} size={21}>{ln.label}</SkText>
          </g>
        ))}
        {msgs.map((m, i) => {
          const done = m.step < cur;
          const now = m.step === cur;
          const color = m.error ? SK.red.stroke : now ? SK.teal.stroke : done ? SK.ink : "#ced4da";
          const x1 = LANES[m.from].x, x2 = LANES[m.to].x;
          const self = m.from === m.to;
          const pts: [number, number][] = self ? [[x1 + 4, m.y - 12], [x1 + 48, m.y - 16], [x1 + 48, m.y + 8], [x1 + 8, m.y + 6]] : [[x1 + (x2 > x1 ? 6 : -6), m.y], [x2 + (x2 > x1 ? -6 : 6), m.y]];
          const mid = self ? x1 + 62 : (x1 + x2) / 2;
          return (
            <g key={i} style={{ cursor: "pointer" }} onClick={() => setStep(m.step)}>
              <SkArrow seed={`msg-${i}-${invalid}`} points={pts} curve={self} stroke={color} strokeWidth={now ? 2.3 : 1.5} dashed={!self && m.to < m.from && !m.error} />
              <SkText x={mid} y={self ? m.y + 2 : m.y - 8} size={16} anchor={self ? "start" : "middle"} color={now || m.error ? color : done ? SK.ink : "#adb5bd"}>{m.label}</SkText>
              {(i === 0 || msgs[i - 1].step !== m.step) && <SkBadge cx={28} cy={m.y} n={m.step} r={13} seed={`fb-${m.step}`} active={m.step <= cur} />}
            </g>
          );
        })}
      </svg>
      <div className="sk-chips" role="group" aria-label="步骤">
        <button type="button" className="sk-chip" disabled={cur <= 1} onClick={() => setStep(cur - 1)}>← 上一步</button>
        {STEP_TITLES.map((title, i) => (
          <button key={title} type="button" className={`sk-chip${cur === i + 1 ? " is-on" : ""}`} disabled={i + 1 > maxStep} onClick={() => setStep(i + 1)}>{i + 1}. {title}</button>
        ))}
        <button type="button" className="sk-chip is-primary" disabled={cur >= maxStep} onClick={() => setStep(cur + 1)}>下一步 →</button>
      </div>
      {detail}
      <div className={`ab-narr${invalid && cur === 2 ? " is-bad" : cur === 5 && s?.significant ? " is-good" : ""}`}>{narr}</div>
    </SketchFigure>
  );
}
