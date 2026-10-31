"use client";

import { useMemo, useRef, useState } from "react";
import { maturity, nodeLabel, roadmapEdges, roadmapNodes, type RoadmapNode } from "@/content/roadmap";
import { categories } from "@/content/navigation";
import { useLang } from "@/components/i18n/LangProvider";
import { t } from "@/lib/i18n";
import RoadmapDrawer from "./RoadmapDrawer";

// Grid geometry in SVG units; the SVG scales down with its container.
const COL = 162;
const ROW = 96;
const NODE_W = 148;
const NODE_H = 64;
const PAD = 8;
const maxCol = Math.max(...roadmapNodes.map((node) => node.col));
const maxRow = Math.max(...roadmapNodes.map((node) => node.row));
const WIDTH = maxCol * COL + NODE_W + PAD * 2;
const HEIGHT = maxRow * ROW + NODE_H + PAD * 2;

const x = (node: RoadmapNode) => PAD + node.col * COL;
const y = (node: RoadmapNode) => PAD + node.row * ROW;
const byId = new Map(roadmapNodes.map((node) => [node.id, node]));

function edgePath(a: RoadmapNode, b: RoadmapNode) {
  const sx = x(a) + NODE_W / 2;
  const sy = y(a) + NODE_H;
  const ex = x(b) + NODE_W / 2;
  const ey = y(b);
  const bend = Math.max(20, (ey - sy) * 0.5);
  return `M${sx} ${sy} C${sx} ${sy + bend}, ${ex} ${ey - bend}, ${ex} ${ey}`;
}

// Everything upstream and downstream of a node, for hover highlighting.
function lineage(id: string) {
  const walk = (start: string, step: (id: string) => string[]) => {
    const seen = new Set<string>();
    const stack = [start];
    while (stack.length) for (const next of step(stack.pop()!)) if (!seen.has(next)) { seen.add(next); stack.push(next); }
    return seen;
  };
  const up = walk(id, (cur) => roadmapEdges.filter((edge) => edge.to === cur).map((edge) => edge.from));
  const down = walk(id, (cur) => roadmapEdges.filter((edge) => edge.from === cur).map((edge) => edge.to));
  return new Set([id, ...up, ...down]);
}

const rows = Array.from({ length: maxRow + 1 }, (_, row) => roadmapNodes.filter((node) => node.row === row).sort((a, b) => a.col - b.col));

export default function RoadmapGraph() {
  const lang = useLang();
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  // The element that opened the drawer gets focus back when it closes.
  const opener = useRef<HTMLElement | null>(null);
  const focus = hovered ?? selected;
  const lit = useMemo(() => (focus ? lineage(focus) : null), [focus]);

  const open = (id: string, from: HTMLElement) => {
    opener.current = from;
    setSelected(id);
  };
  const close = () => {
    setSelected(null);
    opener.current?.focus();
  };

  const card = (node: RoadmapNode) => {
    const { stable, growing, total } = maturity(node.id);
    return (
      <>
        <span className="rm-node-label">{nodeLabel(node, lang)}</span>
        <span className="rm-node-meta">{t(lang, "roadmapNotes", { n: total })}{stable ? ` · ${stable} stable` : ""}{growing ? ` · ${growing} growing` : ""}</span>
        <span className="rm-node-bar" aria-hidden="true">
          <span className="is-stable" style={{ width: `${(stable / total) * 100}%` }} />
          <span className="is-growing" style={{ width: `${(growing / total) * 100}%` }} />
        </span>
      </>
    );
  };

  return (
    <div className="roadmap">
      <ul className="rm-legend" aria-label={t(lang, "roadmapLegend")}>
        {categories.map((category) => <li key={category.id} className={`rm-cat-${category.id}`}><span />{category.title}</li>)}
        <li className="rm-legend-bar"><span />{t(lang, "roadmapProgress")}</li>
      </ul>

      <div className="rm-canvas">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group" aria-label={t(lang, "roadmapAria")} onMouseLeave={() => setHovered(null)}>
          <defs>
            <marker id="rm-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 8 4 0 8z" fill="context-stroke" />
            </marker>
          </defs>
          {roadmapEdges.map((edge) => {
            const on = lit ? lit.has(edge.from) && lit.has(edge.to) : false;
            return (
              <path
                key={`${edge.from}>${edge.to}`}
                className={`rm-edge ${on ? "is-on" : ""} ${lit && !on ? "is-dim" : ""}`}
                d={edgePath(byId.get(edge.from)!, byId.get(edge.to)!)}
                markerEnd="url(#rm-arrow)"
              />
            );
          })}
          {roadmapNodes.map((node) => (
            <foreignObject key={node.id} x={x(node)} y={y(node)} width={NODE_W} height={NODE_H}>
              <button
                type="button"
                className={`rm-node rm-cat-${node.categoryId} ${selected === node.id ? "is-selected" : ""} ${lit && !lit.has(node.id) ? "is-dim" : ""}`}
                aria-haspopup="dialog"
                onMouseEnter={() => setHovered(node.id)}
                onFocus={() => setHovered(node.id)}
                onBlur={() => setHovered(null)}
                onClick={(event) => open(node.id, event.currentTarget)}
              >
                {card(node)}
              </button>
            </foreignObject>
          ))}
        </svg>
      </div>

      {/* Narrow screens: the same nodes as a list, one group per layer. */}
      <ol className="rm-list">
        {rows.map((nodes, row) => (
          <li key={row}>
            <p className="rm-list-layer">{t(lang, "roadmapLayer", { n: row + 1 })}</p>
            <div className="rm-list-items">
              {nodes.map((node) => (
                <button key={node.id} type="button" className={`rm-node rm-cat-${node.categoryId}`} aria-haspopup="dialog" onClick={(event) => open(node.id, event.currentTarget)}>
                  {card(node)}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ol>

      {selected && <RoadmapDrawer nodeId={selected} onSelect={setSelected} onClose={close} />}
    </div>
  );
}
