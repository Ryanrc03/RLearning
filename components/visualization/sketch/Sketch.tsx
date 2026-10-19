// Hand-drawn SVG primitives (Excalidraw look) built on roughjs.
// Every shape takes a seed so server and client draw the same wobble and hydration matches.

import rough from "roughjs";
import type { Options } from "roughjs/bin/core";
import type { ReactNode } from "react";

const gen = rough.generator();

// Excalidraw's palette: a stroke color and the pale fill that goes with it.
export const SK = {
  ink: "#1e1e1e",
  muted: "#868e96",
  orange: { stroke: "#e8590c", fill: "#fff4e6" },
  blue: { stroke: "#1971c2", fill: "#e7f5ff" },
  green: { stroke: "#2f9e44", fill: "#ebfbee" },
  teal: { stroke: "#0c8599", fill: "#c3fae8" },
  violet: { stroke: "#6741d9", fill: "#f3f0ff" },
  red: { stroke: "#e03131", fill: "#fff5f5" },
  grey: { stroke: "#495057", fill: "#f8f9fa" },
} as const;

export type Tone = Exclude<keyof typeof SK, "ink" | "muted">;

export const SKETCH_FONT = "var(--font-sketch), 'Patrick Hand', 'Comic Sans MS', 'PingFang SC', cursive";

export function seedOf(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i += 1) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return (Math.abs(h) % 2147483646) + 1;
}

function Drawn({ drawable, className }: { drawable: ReturnType<typeof gen.path>; className?: string }) {
  return (
    <g className={className}>
      {gen.toPaths(drawable).map((p, i) => (
        <path key={i} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} fill={p.fill ?? "none"} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </g>
  );
}

function roundedRect(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  return `M${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h - rr} Q${x + w},${y + h} ${x + w - rr},${y + h} L${x + rr},${y + h} Q${x},${y + h} ${x},${y + h - rr} L${x},${y + rr} Q${x},${y} ${x + rr},${y} Z`;
}

type BoxProps = {
  x: number; y: number; w: number; h: number;
  seed: string;
  tone?: Tone;
  stroke?: string;
  fill?: string;
  dashed?: boolean;
  radius?: number;
  strokeWidth?: number;
  roughness?: number;
  /** "solid" fill or roughjs hachure styles. */
  fillStyle?: Options["fillStyle"];
};

export function SkBox({ x, y, w, h, seed, tone, stroke, fill, dashed, radius = 14, strokeWidth = 1.6, roughness = 1.1, fillStyle = "solid" }: BoxProps) {
  const st = stroke ?? (tone ? SK[tone].stroke : SK.ink);
  const fl = fill ?? (tone ? SK[tone].fill : undefined);
  const d = gen.path(roundedRect(x, y, w, h, radius), {
    seed: seedOf(seed), stroke: st, strokeWidth, roughness, bowing: 1,
    fill: fl, fillStyle, fillWeight: 1, hachureGap: 5,
    strokeLineDash: dashed ? [7, 6] : undefined,
    disableMultiStroke: dashed,
  });
  return <Drawn drawable={d} />;
}

export function SkEllipse({ cx, cy, w, h, seed, stroke = SK.ink, fill, fillStyle = "solid", strokeWidth = 1.4 }: { cx: number; cy: number; w: number; h: number; seed: string; stroke?: string; fill?: string; fillStyle?: Options["fillStyle"]; strokeWidth?: number }) {
  const d = gen.ellipse(cx, cy, w, h, { seed: seedOf(seed), stroke, strokeWidth, fill, fillStyle, hachureGap: 4.5, fillWeight: 1.1, roughness: 1 });
  return <Drawn drawable={d} />;
}

/** Numbered badge with the cross-hatched teal fill from the Hello Interview diagrams. */
export function SkBadge({ cx, cy, n, seed, r = 17, active = true }: { cx: number; cy: number; n: number | string; seed: string; r?: number; active?: boolean }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r - 1} fill="#fff" />
      <SkEllipse cx={cx} cy={cy} w={r * 2} h={r * 2} seed={seed} stroke={active ? SK.teal.stroke : SK.muted} fill={active ? "#38d9a9" : "#dee2e6"} fillStyle="cross-hatch" />
      <text x={cx} y={cy + 6} textAnchor="middle" fontSize={r * 1.05} fontFamily={SKETCH_FONT} fill={SK.ink}>{n}</text>
    </g>
  );
}

type ArrowProps = {
  /** Points along the shaft; with `curve` they become a smooth curve through them. */
  points: [number, number][];
  seed: string;
  stroke?: string;
  strokeWidth?: number;
  dashed?: boolean;
  curve?: boolean;
  head?: "end" | "both" | "none";
};

function head(at: [number, number], from: [number, number], size: number) {
  const ang = Math.atan2(at[1] - from[1], at[0] - from[0]);
  const a1 = ang + Math.PI - 0.45;
  const a2 = ang + Math.PI + 0.45;
  return `M${at[0] + size * Math.cos(a1)},${at[1] + size * Math.sin(a1)} L${at[0]},${at[1]} L${at[0] + size * Math.cos(a2)},${at[1] + size * Math.sin(a2)}`;
}

export function SkArrow({ points, seed, stroke = SK.ink, strokeWidth = 1.5, dashed, curve, head: hd = "end" }: ArrowProps) {
  const opts: Options = { seed: seedOf(seed), stroke, strokeWidth, roughness: 0.9, bowing: 1.2, strokeLineDash: dashed ? [6, 5] : undefined, disableMultiStroke: true };
  const shaft = curve ? gen.curve(points, opts) : gen.linearPath(points, opts);
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const heads: string[] = [];
  if (hd === "end" || hd === "both") heads.push(head(last, prev, 11));
  if (hd === "both") heads.push(head(points[0], points[1], 11));
  return (
    <g>
      <Drawn drawable={shaft} />
      {heads.map((h, i) => <Drawn key={i} drawable={gen.path(h, { ...opts, seed: seedOf(`${seed}-h${i}`), strokeLineDash: undefined })} />)}
    </g>
  );
}

export function SkLine({ points, seed, stroke = SK.ink, strokeWidth = 1.4, dashed }: { points: [number, number][]; seed: string; stroke?: string; strokeWidth?: number; dashed?: boolean }) {
  return <Drawn drawable={gen.linearPath(points, { seed: seedOf(seed), stroke, strokeWidth, roughness: 0.8, strokeLineDash: dashed ? [5, 5] : undefined, disableMultiStroke: true })} />;
}

/** Handwritten text; `lines` stack downward from y. */
export function SkText({ x, y, children, size = 17, anchor = "middle", color = SK.ink, weight }: { x: number; y: number; children: ReactNode; size?: number; anchor?: "start" | "middle" | "end"; color?: string; weight?: number }) {
  return <text x={x} y={y} textAnchor={anchor} fontSize={size} fontFamily={SKETCH_FONT} fill={color} fontWeight={weight}>{children}</text>;
}

/** Shared wrapper so every sketch figure sits on the same paper card and scrolls sideways on phones. */
export function SketchFigure({ title, caption, children, minWidth = 0 }: { title?: string; caption?: ReactNode; children: ReactNode; minWidth?: number }) {
  return (
    <figure className="sk-figure">
      {title && <figcaption className="sk-title">{title}</figcaption>}
      <div className="sk-canvas" style={minWidth ? { ["--sk-min" as string]: `${minWidth}px` } : undefined}>{children}</div>
      {caption && <div className="sk-caption">{caption}</div>}
    </figure>
  );
}

/** Database cylinder. */
export function SkCylinder({ x, y, w, h, seed, tone = "green", strokeWidth = 1.6 }: { x: number; y: number; w: number; h: number; seed: string; tone?: Tone; strokeWidth?: number }) {
  const ry = Math.min(14, h * 0.14);
  const { stroke, fill } = SK[tone];
  const body = `M${x},${y + ry} L${x},${y + h - ry} A${w / 2},${ry} 0 0 0 ${x + w},${y + h - ry} L${x + w},${y + ry} A${w / 2},${ry} 0 0 0 ${x},${y + ry} Z`;
  const opts: Options = { seed: seedOf(seed), stroke, strokeWidth, roughness: 1, fill, fillStyle: "solid" };
  return (
    <g>
      <Drawn drawable={gen.path(body, opts)} />
      <Drawn drawable={gen.ellipse(x + w / 2, y + ry, w, ry * 2, { ...opts, seed: seedOf(`${seed}-top`) })} />
    </g>
  );
}

/** Stick-figure user. */
export function SkPerson({ x, y, seed, stroke = SK.ink }: { x: number; y: number; seed: string; stroke?: string }) {
  const opts: Options = { seed: seedOf(seed), stroke, strokeWidth: 1.6, roughness: 0.9, disableMultiStroke: true };
  return (
    <g>
      <Drawn drawable={gen.ellipse(x, y, 22, 22, { ...opts, fill: "#fff", fillStyle: "solid" })} />
      <Drawn drawable={gen.linearPath([[x, y + 11], [x, y + 42]], opts)} />
      <Drawn drawable={gen.linearPath([[x - 15, y + 22], [x, y + 18], [x + 15, y + 22]], { ...opts, seed: seedOf(`${seed}-a`) })} />
      <Drawn drawable={gen.linearPath([[x - 12, y + 64], [x, y + 42], [x + 12, y + 64]], { ...opts, seed: seedOf(`${seed}-l`) })} />
    </g>
  );
}
