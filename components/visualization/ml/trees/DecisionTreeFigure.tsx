"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Plot from "@/components/visualization/ml/primitives/Plot";
import StepPlayer from "@/components/visualization/ml/primitives/StepPlayer";
import { DT_POINTS, entropy, growTree, type Counts, type DecisionNode } from "@/lib/ml/trees";

// Page 1 of Tree Models: twelve points, two features. Step through the greedy
// algorithm: list every candidate cut with its information gain, take the
// best, and repeat inside each child until the tree is two levels deep.

const C0 = "#2a78d6";
const C1 = "#eb6834";
const INK = "#3b4234";
const MUTED = "#76796f";
const FAINT = "#c9c4ad";
const W = 420;
const H = 300;
const TREE_W = 720;
const TREE_H = 160;
const TOP_ROWS = 6;

type Region = { x0: number; x1: number; y0: number; y1: number };
type View = { node: DecisionNode; region: Region; path: string };
type Step = { kind: "root"; view: View } | { kind: "candidates"; view: View } | { kind: "cut"; view: View };

function collect(node: DecisionNode, region: Region, path: string, out: View[]) {
  out.push({ node, region, path });
  if (node.kind !== "split") return;
  const { feature, threshold } = node;
  const left = feature === "x" ? { ...region, x1: threshold } : { ...region, y1: threshold };
  const right = feature === "x" ? { ...region, x0: threshold } : { ...region, y0: threshold };
  collect(node.left, left, `${path}L`, out);
  collect(node.right, right, `${path}R`, out);
}

const fmt = (v: number, d = 3) => v.toFixed(d);
const countText = (c: Counts) => `${c[0]} 蓝 ${c[1]} 橙`;
const nodeName = (path: string) => (path === "" ? "根节点" : `${path.split("").map((p) => (p === "L" ? "左" : "右")).join("")}子节点`);

export default function DecisionTreeFigure() {
  const { views, steps } = useMemo(() => {
    const tree = growTree(DT_POINTS, 2);
    const views: View[] = [];
    collect(tree, { x0: 0, x1: 10, y0: 0, y1: 10 }, "", views);
    const steps: Step[] = [{ kind: "root", view: views[0] }];
    for (const v of views) {
      if (v.node.kind !== "split") continue;
      steps.push({ kind: "candidates", view: v }, { kind: "cut", view: v });
    }
    return { views, steps };
  }, []);
  const [step, setStep] = useState(0);
  const cur = steps[step];
  const focus = cur.view;

  // Cuts applied so far, and which nodes exist on screen.
  const cutPaths = useMemo(() => {
    const s = new Set<string>();
    steps.slice(0, step + 1).forEach((st) => st.kind === "cut" && s.add(st.view.path));
    return s;
  }, [steps, step]);
  const exists = (v: View) => v.path === "" || cutPaths.has(v.path.slice(0, -1));
  const isCurrentLeaf = (v: View) => exists(v) && !cutPaths.has(v.path);
  const done = step === steps.length - 1;
  const node = focus.node;
  const cands = node.kind === "split" ? node.candidates : [];
  const best = cands[0];

  const narr = (() => {
    const h = entropy(node.counts);
    if (cur.kind === "root") return `根节点装着全部 ${node.points.length} 个点，${countText(node.counts)}，熵 ${fmt(h)} bit：现在随便猜一个点的颜色，一半对一半。`;
    if (cur.kind === "candidates" && node.kind === "split") {
      const weighted = h - best.gain;
      return `${nodeName(focus.path)}试了 ${cands.length} 个候选切点（x、y 各取相邻两点的中点）。${best.feature} ≤ ${best.threshold} 把 ${countText(node.counts)} 分成 ${countText(best.left)} 和 ${countText(best.right)}，切完的加权熵 ${fmt(weighted)}，信息增益 ${fmt(best.gain)} bit，是所有候选里最大的。`;
    }
    if (node.kind === "split") {
      const l = node.left;
      const r = node.right;
      const pure = entropy(l.counts) === 0 && entropy(r.counts) === 0;
      if (done) return `深度 2 的树把 12 个点全分对了：三个 if 就是全部规则。每一刀都只看「切完熵降多少」，没有梯度，也没有连续的参数。`;
      return `沿 ${node.feature} = ${node.threshold} 切一刀。左边 ${countText(l.counts)}（熵 ${fmt(entropy(l.counts))}），右边 ${countText(r.counts)}（熵 ${fmt(entropy(r.counts))}）。${pure ? "两个叶子都纯了。" : "两边各有一个点站错了队，下一步在子节点里继续切。"}`;
    }
    return "";
  })();

  return (
    <VisualizationFrame
      title="Decision Tree：每一刀都挑信息增益最大的切点"
      description="12 个点、两个特征 x 和 y。每一步列出当前节点所有候选切分，算它们的信息增益，选最大的那一刀切下去，直到深度 2。"
    >
      <StepPlayer step={step} total={steps.length} onStep={setStep} intervalMs={1500} caption={`第 ${step} 步 / 共 ${steps.length - 1} 步`} />

      <div className="viz-grid2 wide-left">
        <Figure width={W} height={H} label={`散点图，当前${nodeName(focus.path)}，${countText(node.counts)}`} minWidth={340}>
          <Plot box={{ x: 0, y: 0, w: W, h: H }} xDomain={[0, 10]} yDomain={[0, 10]} xTicks={[0, 2.5, 5, 7.5, 10]} yTicks={[0, 2.5, 5, 7.5, 10]} xLabel="特征 x" yLabel="特征 y">
            {(f) => {
              const rect = (r: Region) => ({ x: f.x(r.x0), y: f.y(r.y1), width: f.x(r.x1) - f.x(r.x0), height: f.y(r.y0) - f.y(r.y1) });
              const lineOf = (r: Region, feature: "x" | "y", t: number) =>
                feature === "x" ? { x1: f.x(t), y1: f.y(r.y0), x2: f.x(t), y2: f.y(r.y1) } : { x1: f.x(r.x0), y1: f.y(t), x2: f.x(r.x1), y2: f.y(t) };
              return (
                <>
                  {views.filter(isCurrentLeaf).map((v) => {
                    const [a, b] = v.node.counts;
                    if (a === b) return null;
                    return <rect key={`lf${v.path}`} {...rect(v.region)} fill={a > b ? C0 : C1} opacity={0.08} style={{ transition: "opacity .3s" }} />;
                  })}
                  {cur.kind !== "root" && !done && <rect {...rect(focus.region)} fill="none" stroke="#eda100" strokeWidth={2} strokeDasharray="6 4" />}
                  {cur.kind === "candidates" && node.kind === "split" && cands.slice(1).map((c) => <line key={`${c.feature}${c.threshold}`} {...lineOf(focus.region, c.feature, c.threshold)} stroke={FAINT} strokeWidth={1} />)}
                  {cur.kind === "candidates" && best && <line {...lineOf(focus.region, best.feature, best.threshold)} stroke="#eda100" strokeWidth={2.5} strokeDasharray="7 4" />}
                  {views
                    .filter((v) => v.node.kind === "split" && cutPaths.has(v.path))
                    .map((v) => {
                      const n = v.node;
                      if (n.kind !== "split") return null;
                      const l = lineOf(v.region, n.feature, n.threshold);
                      const lx = n.feature === "x" ? l.x1 + 4 : l.x1 + 4;
                      const ly = n.feature === "x" ? l.y2 + 12 : l.y1 - 4;
                      return (
                        <g key={`cut${v.path}`}>
                          <line {...l} stroke={INK} strokeWidth={2} />
                          <text x={lx} y={ly} fontSize={11} fill={INK} fontWeight={600} className="mono">{n.feature} ≤ {n.threshold}</text>
                        </g>
                      );
                    })}
                  {DT_POINTS.map((p, i) => (
                    <circle key={i} cx={f.x(p.x)} cy={f.y(p.y)} r={7} fill={p.label === 0 ? C0 : C1} stroke="#fff" strokeWidth={1.5} />
                  ))}
                </>
              );
            }}
          </Plot>
        </Figure>

        <div className="viz-panel">
          <h5>{cur.kind === "candidates" ? `${nodeName(focus.path)}的候选切分` : `${nodeName(focus.path)}`}</h5>
          {cur.kind === "candidates" && node.kind === "split" ? (
            <>
              <table className="viz-table">
                <thead>
                  <tr><th>切点</th><th className="num">左边</th><th className="num">右边</th><th className="num">IG</th></tr>
                </thead>
                <tbody>
                  {cands.slice(0, TOP_ROWS).map((c, i) => (
                    <tr key={`${c.feature}${c.threshold}`} style={i === 0 ? { background: "#fdf3cd", fontWeight: 600 } : undefined}>
                      <td className="viz-mono">{c.feature} ≤ {c.threshold}</td>
                      <td className="num">{c.left[0]}蓝 {c.left[1]}橙</td>
                      <td className="num">{c.right[0]}蓝 {c.right[1]}橙</td>
                      <td className="num">{fmt(c.gain)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {cands.length > TOP_ROWS && (
                <p className="viz-k" style={{ marginTop: 6 }}>其余 {cands.length - TOP_ROWS} 个候选的 IG ≤ {fmt(cands[TOP_ROWS].gain)}，图里画成浅灰线。</p>
              )}
            </>
          ) : (
            <div className="viz-stat" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div><small>点数</small><b>{node.points.length}</b></div>
              <div><small>熵 H</small><b>{fmt(entropy(node.counts))}</b></div>
              <div><small>蓝</small><b style={{ color: C0 }}>{node.counts[0]}</b></div>
              <div><small>橙</small><b style={{ color: C1 }}>{node.counts[1]}</b></div>
              {cur.kind === "cut" && node.kind === "split" && (
                <>
                  <div><small>这一刀</small><b>{node.feature} ≤ {node.threshold}</b></div>
                  <div><small>信息增益</small><b>{fmt(node.gain)}</b></div>
                </>
              )}
            </div>
          )}
          {cur.kind === "root" && <p className="viz-k" style={{ marginTop: 8 }}>熵 = −Σ p log₂ p。两类各一半时最大，1 bit；全是一类时 0。</p>}
        </div>
      </div>

      <Figure width={TREE_W} height={TREE_H} label="当前长出的树" minWidth={560}>
        {views.filter(exists).map((v) => {
          const depth = v.path.length;
          const idx = v.path === "" ? 0 : parseInt(v.path.replace(/L/g, "0").replace(/R/g, "1"), 2);
          const cx = (TREE_W * (idx + 0.5)) / 2 ** depth;
          const cy = 26 + depth * 52;
          const bw = 150;
          const bh = 36;
          const isFocus = v.path === focus.path && !done;
          const n = v.node;
          const h = entropy(n.counts);
          const leafNow = !cutPaths.has(v.path);
          const [a, b] = n.counts;
          const title = leafNow ? (h === 0 ? `叶子：${a > 0 ? `蓝 ×${a}` : `橙 ×${b}`}` : `${countText(n.counts)}`) : `${n.kind === "split" ? `${n.feature} ≤ ${n.threshold}？` : ""}`;
          const sub = leafNow ? (h === 0 ? "熵 0，纯了" : `熵 ${fmt(h)}${n.kind === "split" ? "，还要切" : ""}`) : `${countText(n.counts)} · 熵 ${fmt(h)}`;
          const parentCx = depth === 0 ? cx : (TREE_W * (Math.floor(idx / 2) + 0.5)) / 2 ** (depth - 1);
          return (
            <g key={`t${v.path}`}>
              {depth > 0 && <line x1={parentCx} y1={cy - 52 + bh / 2} x2={cx} y2={cy - bh / 2} stroke={FAINT} strokeWidth={1.5} />}
              {depth > 0 && <text x={(parentCx + cx) / 2 + (v.path.endsWith("L") ? -8 : 8)} y={cy - 24} fontSize={11} fill={MUTED} textAnchor="middle">{v.path.endsWith("L") ? "是" : "否"}</text>}
              <rect x={cx - bw / 2} y={cy - bh / 2} width={bw} height={bh} rx={7} fill={leafNow && h === 0 ? (a > 0 ? "#eaf3fd" : "#fdf1eb") : "#fff"} stroke={isFocus ? "#eda100" : leafNow && h === 0 ? (a > 0 ? C0 : C1) : "#d9d3bb"} strokeWidth={isFocus ? 2 : 1.2} />
              <text x={cx} y={cy - 3} fontSize={12} fontWeight={600} fill={INK} textAnchor="middle">{title}</text>
              <text x={cx} y={cy + 11} fontSize={11} fill={MUTED} textAnchor="middle">{sub}</text>
            </g>
          );
        })}
      </Figure>

      <div className="viz-legend">
        <span><i style={{ background: C0 }} />蓝点</span>
        <span><i style={{ background: C1 }} />橙点</span>
        <span><i style={{ background: "#eda100" }} />正在处理的节点 / 选中的切点</span>
      </div>
      <div className={`viz-narr${done ? " is-good" : ""}`}>{narr}</div>
    </VisualizationFrame>
  );
}
