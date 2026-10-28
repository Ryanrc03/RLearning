"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import { DATASET, LABELS, labelCell, SET_ORDER, SETS, type LabelCell } from "@/lib/ml/kuairandOverview";

// Recommender Systems, first page: the eight 0/1 feedback labels of KuaiRand-1K
// across the four evaluation sets. One control picks what the cells show:
// positive rate, negatives per positive, or how many users have a positive at
// all (the users a GAUC can count).

type View = "rate" | "ratio" | "users";
const VIEWS = [
  { key: "rate" as View, label: "正样本率" },
  { key: "ratio" as View, label: "负 : 正" },
  { key: "users" as View, label: "有正例的用户" },
];

const fmtInt = (x: number) => x.toLocaleString("en-US");
const fmtRate = (r: number) => (r >= 0.1 ? `${(r * 100).toFixed(1)}%` : r >= 0.001 ? `${(r * 100).toFixed(2)}%` : `${(r * 100).toFixed(3)}%`);
const fmtRatio = (x: number) => (x < 10 ? `${x.toFixed(1)} : 1` : `${fmtInt(Math.round(x))} : 1`);

// Bar width on a log scale from 0.01% to 100% (rate) or 1 to 10,000 (ratio); users are linear.
function barShare(view: View, c: LabelCell): number {
  if (view === "rate") return Math.max(0, Math.min(1, (Math.log10(Math.max(c.rate, 1e-4)) + 4) / 4));
  if (view === "ratio") return Math.max(0, Math.min(1, Math.log10(Math.max(c.negPerPos, 1)) / 4));
  return c.usersShare;
}

function cellText(view: View, c: LabelCell): string {
  if (view === "rate") return fmtRate(c.rate);
  if (view === "ratio") return fmtRatio(c.negPerPos);
  return `${c.usersWithPos}`;
}

function cellTitle(view: View, c: LabelCell, users: number): string {
  if (view === "users") return `${c.usersWithPos} / ${users} 个用户至少有一个正例；这些用户每人正例数的中位数是 ${c.medianPosPerUser}`;
  return `${fmtInt(c.pos)} 个正例，正样本率 ${fmtRate(c.rate)}，每个正例对应 ${fmtRatio(c.negPerPos)} 个负例`;
}

const NARR: Record<View, { tone: string; text: string }> = {
  rate: {
    tone: "is-warn",
    text: "点开和长播放有三到四成，点赞 1–2%，其余都在千分之几。最右一列是随机曝光：同样的用户、随机换上的视频，点开从 44% 掉到 17%——推荐流里的曝光是策略挑过的。",
  },
  ratio: {
    tone: "is-bad",
    text: "click 和 long_view 的负:正只有 1–3，根本不算不平衡；like 约 50 : 1，follow 约 1,000 : 1，随机集里 follow 一共只有 8 个正例。负样本降采样是给 like、follow 这一档准备的。",
  },
  users: {
    tone: "is-warn",
    text: "GAUC 只数「既有正例又有负例」的用户。test 里 988 人都能算 click，like 只剩 864 人、每人中位 11 个正例，follow 只剩 572 人、每人中位 2 个正例——一个人的 AUC 就由这两条决定。随机集里能算 like 的只有 86 人。",
  },
};

export default function KuairandOverviewFigure() {
  const [view, setView] = useState<View>("rate");

  return (
    <VisualizationFrame
      title="八个 0/1 标签、四个集合：有多少正例，有多少人能算 AUC"
      description="每行一个用户反馈，每列一个评估集合。前四个是 kuairank 训练的目标；后四个日志里也有，暂时没用。悬停格子看原始计数。"
      footnote="数据：kuairank 的 data/processed/log.parquet（官方 CSV 去掉完全重复的行）。train / valid 是全部 tab，test 只看 tab 1，random 是随机曝光。"
    >
      <div className="viz-stat" style={{ marginBottom: 12 }}>
        <div><small>曝光</small><b>{(DATASET.rows / 1e6).toFixed(2)}M</b></div>
        <div><small>用户</small><b>{fmtInt(DATASET.users)}</b></div>
        <div><small>被曝光过的视频</small><b>{(DATASET.videos / 1e6).toFixed(2)}M</b></div>
        <div><small>随机曝光</small><b>{fmtInt(DATASET.randomRows)}</b><span className="delta">{fmtInt(DATASET.randomVideos)} 个视频</span></div>
        <div><small>日期</small><b>31 天</b><span className="delta">4/08–5/08</span></div>
      </div>

      <div className="viz-controls">
        <Tabs ariaLabel="格子里显示什么" value={view} onChange={setView} options={VIEWS} />
        <button type="button" className="viz-btn" onClick={() => setView("rate")}>重置</button>
      </div>

      <div className="viz-scroll">
        <table className="viz-table" style={{ minWidth: 640 }}>
          <thead>
            <tr>
              <th>标签</th>
              {SET_ORDER.map((s) => (
                <th key={s}>
                  {SETS[s].label}
                  <br />
                  <span style={{ fontWeight: 400 }}>{SETS[s].dates} · {(SETS[s].n / 1e6 >= 1 ? `${(SETS[s].n / 1e6).toFixed(2)}M` : fmtInt(SETS[s].n))} 行</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LABELS.map((l) => (
              <tr key={l.key} style={l.used ? undefined : { opacity: 0.72 }}>
                <td>
                  <span className="viz-mono">{l.column}</span>
                  <br />
                  <span style={{ color: "var(--muted)" }}>{l.name}{l.used ? " · 在用" : ""}</span>
                </td>
                {SET_ORDER.map((s) => {
                  const c = labelCell(s, l.key);
                  const share = barShare(view, c);
                  const color = view === "ratio" ? (c.negPerPos > 500 ? "var(--vcrit)" : c.negPerPos > 20 ? "var(--v4)" : "var(--v3)") : "var(--v1)";
                  return (
                    <td key={s} title={cellTitle(view, c, SETS[s].users)}>
                      <div className="viz-mono" style={{ fontSize: 12 }}>{cellText(view, c)}</div>
                      <div className="viz-bar-track" style={{ height: 6, marginTop: 3 }}>
                        <span style={{ width: `${share * 100}%`, background: color, transition: "width .3s" }} />
                      </div>
                      {view === "users" && <small style={{ color: "var(--muted)" }}>中位 {c.medianPosPerUser} 个正例</small>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="viz-legend">
        {view === "rate" && <span>条长：正样本率，对数刻度 0.01% → 100%</span>}
        {view === "ratio" && (
          <>
            <span><i style={{ background: "var(--v3)" }} />≤ 20 : 1</span>
            <span><i style={{ background: "var(--v4)" }} />20–500 : 1</span>
            <span><i style={{ background: "var(--vcrit)" }} />&gt; 500 : 1</span>
            <span>条长：对数刻度 1 → 10,000</span>
          </>
        )}
        {view === "users" && <span>条长：有正例的用户占该集合全部用户的比例</span>}
      </div>
      <div className={`viz-narr ${NARR[view].tone}`}>{NARR[view].text}</div>
    </VisualizationFrame>
  );
}
