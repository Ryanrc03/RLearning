import type { ReactNode } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import { Arrow, Box, Legend, Markers, P, type Tone } from "@/components/visualization/ml/llms/bahdanau/shared";

// Shared pieces of the ML System Design figures. Colors come from the token set
// of the Bahdanau note (`.bah-note` in styles/visualization.css), so every figure
// follows the OS dark preference; `.msd-note` adds the rules for the HTML parts.
//
// Colors by meaning, the same in all three notes:
//   enc  (blue)    models and the computation they do
//   att  (purple)  calibration
//   dec  (orange)  heads, decision policy and the actions it takes
//   dyn  (yellow)  data: features, scores, embeddings
//   par  (green)   the safe outcome, evaluation and monitoring
//   neu  (outline) raw inputs and events
//   grey (dashed)  parts that exist only offline / during training

export { Arrow, Box, Legend, Markers, P };
export type { Tone };

/** Red for violations, leaks and removed content; `--vcrit` is re-tuned in dark mode. */
export const CRIT = "var(--vcrit)";
export const GRID = "var(--vline)";

type FrameProps = { title: string; description?: string; footnote?: ReactNode; children: ReactNode };

export function MsdFrame({ title, description, footnote, children }: FrameProps) {
  return (
    <div className="bah-note msd-note">
      <VisualizationFrame title={title} description={description} footnote={footnote}>{children}</VisualizationFrame>
    </div>
  );
}

// ---------- a small cartesian panel drawn with the tokens ----------

export type PlotFrame = { x: (v: number) => number; y: (v: number) => number; x0: number; x1: number; y0: number; y1: number };

export function plotFrame(box: { x: number; y: number; w: number; h: number }, xDomain: [number, number], yDomain: [number, number]): PlotFrame {
  const x0 = box.x + 46;
  const x1 = box.x + box.w - 14;
  const y0 = box.y + box.h - 36;
  const y1 = box.y + 22;
  // Two decimals: server and browser can differ in the last float digit, which would trip hydration.
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return {
    x: (v) => r2(x0 + ((v - xDomain[0]) / (xDomain[1] - xDomain[0])) * (x1 - x0)),
    y: (v) => r2(y0 - ((v - yDomain[0]) / (yDomain[1] - yDomain[0])) * (y0 - y1)),
    x0, x1, y0, y1,
  };
}

type AxesProps = {
  f: PlotFrame;
  xTicks: number[];
  yTicks: number[];
  xLabel?: string;
  yLabel?: string;
  title?: string;
  xFormat?: (v: number) => string;
  yFormat?: (v: number) => string;
};

const plain = (v: number) => String(Math.round(v * 100) / 100);

export function Axes({ f, xTicks, yTicks, xLabel, yLabel, title, xFormat = plain, yFormat = plain }: AxesProps) {
  const midY = (f.y0 + f.y1) / 2;
  return (
    <g>
      {title && <text x={f.x0} y={f.y1 - 9} fontSize={12} fontWeight={600} fill={P.ink}>{title}</text>}
      {xTicks.map((t) => (
        <g key={`x${t}`}>
          <line x1={f.x(t)} y1={f.y1} x2={f.x(t)} y2={f.y0} stroke={GRID} strokeWidth={1} />
          <text x={f.x(t)} y={f.y0 + 15} fontSize={10.5} textAnchor="middle" fill={P.sub}>{xFormat(t)}</text>
        </g>
      ))}
      {yTicks.map((t) => (
        <g key={`y${t}`}>
          <line x1={f.x0} y1={f.y(t)} x2={f.x1} y2={f.y(t)} stroke={GRID} strokeWidth={1} />
          <text x={f.x0 - 6} y={f.y(t) + 4} fontSize={10.5} textAnchor="end" fill={P.sub}>{yFormat(t)}</text>
        </g>
      ))}
      <line x1={f.x0} y1={f.y0} x2={f.x1} y2={f.y0} stroke={P.sub} strokeWidth={1.2} />
      <line x1={f.x0} y1={f.y0} x2={f.x0} y2={f.y1} stroke={P.sub} strokeWidth={1.2} />
      {xLabel && <text x={(f.x0 + f.x1) / 2} y={f.y0 + 30} fontSize={11} textAnchor="middle" fill={P.ink}>{xLabel}</text>}
      {yLabel && <text x={f.x0 - 34} y={midY} fontSize={11} textAnchor="middle" fill={P.ink} transform={`rotate(-90 ${f.x0 - 34} ${midY})`}>{yLabel}</text>}
    </g>
  );
}

export function linePath(f: PlotFrame, points: readonly (readonly [number, number])[], step = false): string {
  return points
    .map(([px, py], i) => (i === 0 ? `M${f.x(px)} ${f.y(py)}` : `${step ? `H${f.x(px)} ` : ""}L${f.x(px)} ${f.y(py)}`))
    .join(" ");
}

// ---------- a chain of boxes, wrapped into rows ----------

export type ChainStep = { title: string; sub?: string; tone: Tone; dashed?: boolean };

type FlowChainProps = {
  /** Prefix for the SVG marker ids; several figures share one page. */
  id: string;
  steps: ChainStep[];
  perRow: number;
  label: string;
  /** Index of the step to emphasise; the others are dimmed. */
  active?: number | null;
};

const CH_W = 700;
const CH_GAP = 22;
const CH_BOX_H = 46;
const CH_ROW = 76;

/** Steps left to right, continuing on the next row; arrows carry the reading order. */
export function FlowChain({ id, steps, perRow, label, active }: FlowChainProps) {
  const w = (CH_W - 24 - (perRow - 1) * CH_GAP) / perRow;
  const rows = Math.ceil(steps.length / perRow);
  const pos = (i: number) => ({ x: 12 + (i % perRow) * (w + CH_GAP), y: 10 + Math.floor(i / perRow) * CH_ROW });
  const dim = (i: number) => active != null && active !== i;
  return (
    <div className="viz-scroll">
      <svg viewBox={`0 0 ${CH_W} ${rows * CH_ROW - 10}`} role="img" aria-label={label} style={{ minWidth: 600 }}>
        <Markers id={id} />
        {steps.map((s, i) => {
          const a = pos(i);
          const next = i < steps.length - 1 ? pos(i + 1) : null;
          return (
            <g key={s.title}>
              <Box x={a.x} y={a.y} w={w} h={CH_BOX_H} tone={s.tone} title={s.title} sub={s.sub} dashed={s.dashed} dim={dim(i)} bold={active === i} size={10} />
              {next && next.y === a.y && <Arrow id={id} tone="neu" d={`M${a.x + w + 2} ${a.y + CH_BOX_H / 2} H${next.x - 3}`} dim={active != null} />}
              {next && next.y !== a.y && (
                <Arrow id={id} tone="neu" d={`M${a.x + w / 2} ${a.y + CH_BOX_H + 2} V${a.y + CH_BOX_H + 14} H${next.x + w / 2} V${next.y - 3}`} dim={active != null} />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Percent with one decimal when it is small enough to need it. */
export function pct(v: number, digits = 0): string {
  return `${(v * 100).toFixed(digits)}%`;
}
