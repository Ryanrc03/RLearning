import type { ReactNode } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

// Colors by meaning, shared by the five figures of the Bahdanau note. They are
// CSS variables (styles/visualization.css, `.bah-note`) so the figures follow
// the OS dark preference.
export const P = {
  ink: "var(--bah-ink)",
  sub: "var(--bah-sub)",
  surface: "var(--bah-surface)",
  /** Encoder and its states h_i. */
  enc: "var(--bah-c1)",
  encFill: "var(--bah-t1)",
  /** Decoder, its states s_j and the words it emits. */
  dec: "var(--bah-c2)",
  decFill: "var(--bah-t2)",
  /** Trainable parameters shared across positions and steps. */
  par: "var(--bah-c3)",
  parFill: "var(--bah-t3)",
  /** Values computed on every forward pass: e, α, c. */
  dyn: "var(--bah-c4)",
  dynFill: "var(--bah-t4)",
  /** Parts that exist only during training. */
  grey: "var(--bah-grey)",
} as const;

export type Tone = "enc" | "dec" | "par" | "dyn" | "grey";

const FILL: Record<Tone, string> = { enc: P.encFill, dec: P.decFill, par: P.parFill, dyn: P.dynFill, grey: P.surface };

export function Markers({ id }: { id: string }) {
  const tones: Tone[] = ["enc", "dec", "par", "dyn", "grey"];
  return (
    <defs>
      {tones.map((t) => (
        <marker key={t} id={`${id}-${t}`} viewBox="0 0 6 6" refX={5} refY={3} markerWidth={6} markerHeight={6} orient="auto">
          <path d="M0 0 L6 3 L0 6 z" fill={P[t]} />
        </marker>
      ))}
    </defs>
  );
}

/** A symbol with a subscript inside an SVG <text>: <Sym b="s" s="j−1" />. */
export function Sym({ b, s }: { b: string; s: string }) {
  return (
    <>
      {b}
      <tspan dy={3} fontSize="0.74em">{s}</tspan>
      <tspan dy={-3}>{"​"}</tspan>
    </>
  );
}

type BoxProps = {
  x: number; y: number; w: number; h: number;
  tone: Tone;
  title: ReactNode;
  sub?: ReactNode;
  bold?: boolean;
  dim?: boolean;
  dashed?: boolean;
  size?: number;
};

export function Box({ x, y, w, h, tone, title, sub, bold, dim, dashed, size = 10.5 }: BoxProps) {
  return (
    <g transform={`translate(${x} ${y})`} opacity={dim ? 0.28 : 1} className="bah-fade">
      <rect width={w} height={h} rx={6} fill={FILL[tone]} stroke={P[tone]} strokeWidth={bold ? 2.2 : 1.3} strokeDasharray={dashed ? "4 3" : undefined} />
      <text x={w / 2} y={sub ? h / 2 - 2 : h / 2 + 4} fontSize={size} fontWeight={600} textAnchor="middle" fill={P.ink}>{title}</text>
      {sub && <text x={w / 2} y={h / 2 + 11} fontSize={8.5} textAnchor="middle" fill={P.sub}>{sub}</text>}
    </g>
  );
}

type ArrowProps = {
  /** SVG path data; the arrow head sits at its end. */
  d: string;
  id: string;
  tone: Tone;
  bold?: boolean;
  dim?: boolean;
  dashed?: boolean;
  head?: boolean;
};

export function Arrow({ d, id, tone, bold, dim, dashed, head = true }: ArrowProps) {
  return (
    <path d={d} fill="none" stroke={P[tone]} strokeWidth={bold ? 2 : 1.3} strokeDasharray={dashed ? "4 3" : undefined} markerEnd={head ? `url(#${id}-${tone})` : undefined} opacity={dim ? 0.28 : 1} className="bah-fade" />
  );
}

type FrameProps = { title: string; description?: string; footnote?: ReactNode; children: ReactNode };

/** VisualizationFrame inside the wrapper that carries the note's color tokens. */
export function BahFrame({ title, description, footnote, children }: FrameProps) {
  return (
    <div className="bah-note">
      <VisualizationFrame title={title} description={description} footnote={footnote}>{children}</VisualizationFrame>
    </div>
  );
}

export function Legend({ items }: { items: { tone: Tone; label: string }[] }) {
  return (
    <div className="viz-legend">
      {items.map((it) => (
        <span key={it.label}><i style={{ background: FILL[it.tone], border: `1px ${it.tone === "grey" ? "dashed" : "solid"} ${P[it.tone]}` }} />{it.label}</span>
      ))}
    </div>
  );
}
