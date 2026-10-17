"use client";

import { useId, useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import { chapterById, chapters, edges, nodeBySlug, type TreeChapter, type TreeNode } from "@/content/ml/tree";

// The ML & LLM knowledge tree. Each row is a chapter read left to right (its
// question chain); dashed curves are the cross-chapter prerequisites from
// content/ml/tree.ts. With `chapter` it shows one chapter plus what feeds it
// and where it leads.

type Row = { key: string; label: string; sub?: string; nodes: TreeNode[]; kind: "chapter" | "prereq" | "exit"; existing?: boolean };
type Pos = { x: number; y: number; row: number };

const LABEL_W = 112;
const NODE_W = 112;
const NODE_H = 66;
const GAP = 8;
const ROW_H = 84;
const PAD_TOP = 6;
const TRUNK_X = LABEL_W - 6;
const FIRST_X = LABEL_W + 8;
const INK = "#3b4234";
const MUTED = "#76796f";
const FAINT = "#c9c4ad";
const CHAIN = "#b8b29a";
const HOT = "#eda100";

function unique(nodes: TreeNode[]): TreeNode[] {
  const seen = new Set<string>();
  return nodes.filter((n) => (seen.has(n.slug) ? false : (seen.add(n.slug), true)));
}

function buildRows(chapterId?: string): Row[] {
  if (!chapterId) {
    return chapters.map((c) => ({ key: c.id, label: c.short ?? c.title, sub: c.question, nodes: c.nodes, kind: "chapter", existing: c.existing }));
  }
  const c = chapterById(chapterId);
  if (!c) return [];
  const inside = new Set(c.nodes.map((n) => n.slug));
  const prereq = unique(edges.filter((e) => inside.has(e.to) && !inside.has(e.from)).map((e) => nodeBySlug[e.from]));
  const exits = unique(edges.filter((e) => inside.has(e.from) && !inside.has(e.to)).map((e) => nodeBySlug[e.to]));
  const rows: Row[] = [];
  if (prereq.length) rows.push({ key: "prereq", label: "先修", sub: "别的章里先懂的", nodes: prereq, kind: "prereq" });
  rows.push({ key: c.id, label: c.short ?? c.title, sub: c.question, nodes: c.nodes, kind: "chapter" });
  if (exits.length) rows.push({ key: "exit", label: "出口", sub: "这章讲完接着去", nodes: exits, kind: "exit" });
  return rows;
}

function chainNeighbors(slug: string): { prev?: TreeNode; next?: TreeNode; chapter: TreeChapter } {
  const { chapter } = nodeBySlug[slug];
  const i = chapter.nodes.findIndex((n) => n.slug === slug);
  return { prev: chapter.nodes[i - 1], next: chapter.nodes[i + 1], chapter };
}

function NodeLink({ node }: { node: TreeNode }) {
  return node.status === "ready" ? <a href={`/notes/${node.slug}/`}>{node.title}</a> : <span>{node.title}（还没写）</span>;
}

export default function KnowledgeTree({ chapter }: { chapter?: string }) {
  const rows = useMemo(() => buildRows(chapter), [chapter]);
  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const active = hover ?? selected;

  const pos = useMemo(() => {
    const m = new Map<string, Pos>();
    rows.forEach((r, ri) => r.nodes.forEach((n, ci) => m.set(n.slug, { x: FIRST_X + ci * (NODE_W + GAP), y: PAD_TOP + ri * ROW_H + (ROW_H - NODE_H) / 2, row: ri })));
    return m;
  }, [rows]);

  const maxNodes = Math.max(1, ...rows.map((r) => r.nodes.length));
  const W = FIRST_X + maxNodes * NODE_W + (maxNodes - 1) * GAP + 8;
  const H = PAD_TOP + rows.length * ROW_H + 4;
  const visibleEdges = edges.filter((e) => pos.has(e.from) && pos.has(e.to));

  const related = useMemo(() => {
    const s = new Set<string>();
    if (!active) return s;
    const { prev, next } = chainNeighbors(active);
    if (prev) s.add(prev.slug);
    if (next) s.add(next.slug);
    edges.forEach((e) => {
      if (e.from === active) s.add(e.to);
      if (e.to === active) s.add(e.from);
    });
    return s;
  }, [active]);

  const edgePath = (a: Pos, b: Pos) => {
    const down = b.row >= a.row;
    const sx = a.x + NODE_W / 2;
    const sy = down ? a.y + NODE_H : a.y;
    const ex = b.x + NODE_W / 2;
    const ey = down ? b.y : b.y + NODE_H;
    const bend = Math.max(24, Math.abs(ey - sy) * 0.5);
    return `M${sx} ${sy} C${sx} ${sy + (down ? bend : -bend)}, ${ex} ${ey - (down ? bend : -bend)}, ${ex} ${ey}`;
  };

  const activeNode = active ? nodeBySlug[active] : null;
  const chapterCfg = chapter ? chapterById(chapter) : undefined;
  const title = chapterCfg ? `${chapterCfg.title}：${chapterCfg.question}` : "ML & LLM 知识树";
  const description = chapterCfg
    ? "中间一行是这章的问题链，从左到右每页回答上一页留下的问题；上下两行是别的章里要先懂的和讲完接着去的。"
    : "每一行是一章，从左到右是这章的问题链；虚线是跨章的先修关系。点一个节点看它的一句话。";

  return (
    <VisualizationFrame title={title} description={description}>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}，共 ${rows.length} 行、${pos.size} 个节点`} style={{ minWidth: Math.min(W, 680) }}>
          <defs>
            <marker id={`${uid}a`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0 0.5 L7 4 L0 7.5 Z" fill={CHAIN} />
            </marker>
            <marker id={`${uid}h`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0 0.5 L7 4 L0 7.5 Z" fill={HOT} />
            </marker>
          </defs>

          {!chapter && rows.length > 1 && (
            <line x1={TRUNK_X} y1={PAD_TOP + ROW_H / 2} x2={TRUNK_X} y2={PAD_TOP + (rows.length - 1) * ROW_H + ROW_H / 2} stroke={FAINT} strokeWidth={2} />
          )}

          {rows.map((r, ri) => {
            const cy = PAD_TOP + ri * ROW_H + ROW_H / 2;
            return (
              <g key={r.key}>
                {!chapter && <line x1={TRUNK_X} y1={cy} x2={FIRST_X} y2={cy} stroke={FAINT} strokeWidth={2} />}
                {!chapter && <circle cx={TRUNK_X} cy={cy} r={3.5} fill="#fff" stroke={FAINT} strokeWidth={2} />}
                <text x={4} y={cy - 2} fontSize={12} fontWeight={600} fill={INK}>{r.label}</text>
                <text x={4} y={cy + 13} fontSize={10.5} fill={MUTED}>{r.existing ? `${r.sub} · 已有` : r.sub}</text>
                {r.kind === "chapter" &&
                  r.nodes.slice(0, -1).map((n, i) => {
                    const a = pos.get(n.slug)!;
                    const b = pos.get(r.nodes[i + 1].slug)!;
                    const on = active === n.slug || active === r.nodes[i + 1].slug;
                    return <line key={n.slug} x1={a.x + NODE_W} y1={cy} x2={b.x - 1} y2={cy} stroke={on ? HOT : CHAIN} strokeWidth={on ? 2 : 1.4} markerEnd={`url(#${uid}${on ? "h" : "a"})`} />;
                  })}
              </g>
            );
          })}

          {visibleEdges.map((e) => {
            const on = active === e.from || active === e.to;
            return (
              <path
                key={`${e.from}>${e.to}`}
                d={edgePath(pos.get(e.from)!, pos.get(e.to)!)}
                fill="none"
                stroke={on ? HOT : FAINT}
                strokeWidth={on ? 2 : 1.3}
                strokeDasharray={on ? undefined : "4 4"}
                opacity={active && !on ? 0.3 : 0.9}
                markerEnd={on ? `url(#${uid}h)` : undefined}
                style={{ transition: "opacity .2s, stroke .2s" }}
              />
            );
          })}

          {rows.map((r) =>
            r.nodes.map((n) => {
              const p = pos.get(n.slug)!;
              const cls = ["kt-node", n.status === "planned" ? "is-planned" : "", active === n.slug ? "is-on" : related.has(n.slug) ? "is-related" : ""].filter(Boolean).join(" ");
              return (
                <foreignObject key={n.slug} x={p.x} y={p.y} width={NODE_W} height={NODE_H}>
                  <div
                    className={cls}
                    role="button"
                    tabIndex={0}
                    aria-pressed={selected === n.slug}
                    onClick={() => setSelected((s) => (s === n.slug ? null : n.slug))}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter" || ev.key === " ") {
                        ev.preventDefault();
                        setSelected((s) => (s === n.slug ? null : n.slug));
                      }
                    }}
                    onMouseEnter={() => setHover(n.slug)}
                    onMouseLeave={() => setHover(null)}
                  >
                    <b>{n.short ?? n.title}</b>
                    <span>{n.question}</span>
                  </div>
                </foreignObject>
              );
            }),
          )}
        </svg>
      </div>

      <div className="viz-legend">
        <span><i style={{ background: CHAIN, borderRadius: 1, height: 2, verticalAlign: "middle" }} />章内问题链</span>
        <span><i style={{ background: "repeating-linear-gradient(90deg, #c9c4ad 0 4px, transparent 4px 8px)", borderRadius: 1, height: 2, verticalAlign: "middle" }} />跨章先修</span>
        {rows.some((r) => r.nodes.some((n) => n.status === "planned")) && (
          <span><i style={{ border: "1px dashed #b8b29a", background: "#fbfaf4", boxSizing: "border-box" }} />还没写的页</span>
        )}
      </div>

      {activeNode ? (
        <div className={`viz-narr${activeNode.status === "planned" ? " is-warn" : ""}`}>
          <b>{activeNode.title}</b>　{activeNode.oneLiner}
          {activeNode.status === "ready" ? <>　<a href={`/notes/${activeNode.slug}/`}>去读这页 →</a></> : <>　这页还没写。</>}
          <ActiveLinks slug={activeNode.slug} />
        </div>
      ) : (
        <div className="viz-narr">
          {chapterCfg
            ? `${chapterCfg.title} 这一章回答「${chapterCfg.question}」。点一个节点看它的一句话；箭头的方向就是阅读顺序。`
            : "点一个节点看它的一句话。横向是每章的问题链，虚线是跨章的先修关系。"}
        </div>
      )}
    </VisualizationFrame>
  );
}

function ActiveLinks({ slug }: { slug: string }) {
  const { prev, next, chapter } = chainNeighbors(slug);
  const prereqs = edges.filter((e) => e.to === slug).map((e) => nodeBySlug[e.from]);
  const after = edges.filter((e) => e.from === slug).map((e) => nodeBySlug[e.to]);
  const before = unique([...(prev ? [prev] : []), ...prereqs]);
  const then = unique([...(next ? [next] : []), ...after]);
  return (
    <div className="kt-links">
      <span>章：{chapter.title}</span>
      {before.length > 0 && (
        <span>
          先看：
          {before.map((n, i) => (
            <span key={n.slug}>{i > 0 && "、"}<NodeLink node={n} /></span>
          ))}
        </span>
      )}
      {then.length > 0 && (
        <span>
          接着：
          {then.map((n, i) => (
            <span key={n.slug}>{i > 0 && "、"}<NodeLink node={n} /></span>
          ))}
        </span>
      )}
    </div>
  );
}
