import type { ReactNode } from "react";

// One cartesian panel inside an <svg>: axes, ticks, labels, and linear scales
// handed to the children. Several Plots can share one svg (ROC next to PR).

export type Scale = (v: number) => number;
export type PlotFrame = { x: Scale; y: Scale; x0: number; y0: number; x1: number; y1: number };

export type PlotProps = {
  /** Panel box in svg user units. */
  box: { x: number; y: number; w: number; h: number };
  xDomain: [number, number];
  yDomain: [number, number];
  xTicks?: number[];
  yTicks?: number[];
  xLabel?: string;
  yLabel?: string;
  title?: string;
  format?: (v: number) => string;
  /** Formatter for the x ticks only; defaults to `format`. */
  xFormat?: (v: number) => string;
  /** Dashed y = x reference line (ROC chance line). */
  diagonal?: boolean;
  children: (frame: PlotFrame) => ReactNode;
};

const INK = "#30332c";
const MUTED = "#76796f";
const GRID = "#e4dfcb";

export const PAD = { left: 40, right: 12, top: 22, bottom: 34 };

export default function Plot({ box, xDomain, yDomain, xTicks, yTicks, xLabel, yLabel, title, format, xFormat, diagonal, children }: PlotProps) {
  const x0 = box.x + PAD.left;
  const x1 = box.x + box.w - PAD.right;
  const y0 = box.y + box.h - PAD.bottom;
  const y1 = box.y + PAD.top;
  const x: Scale = (v) => x0 + ((v - xDomain[0]) / (xDomain[1] - xDomain[0])) * (x1 - x0);
  const y: Scale = (v) => y0 - ((v - yDomain[0]) / (yDomain[1] - yDomain[0])) * (y0 - y1);
  const fmt = format ?? ((v: number) => String(Math.round(v * 100) / 100));
  const xFmt = xFormat ?? fmt;
  const xt = xTicks ?? [xDomain[0], (xDomain[0] + xDomain[1]) / 2, xDomain[1]];
  const yt = yTicks ?? [yDomain[0], (yDomain[0] + yDomain[1]) / 2, yDomain[1]];
  return (
    <g>
      {title && (
        <text x={x0} y={box.y + 12} fontSize={12.5} fontWeight={600} fill={INK}>
          {title}
        </text>
      )}
      {xt.map((t) => (
        <g key={`x${t}`}>
          <line x1={x(t)} y1={y1} x2={x(t)} y2={y0} stroke={GRID} strokeWidth={1} />
          <text x={x(t)} y={y0 + 15} fontSize={11} textAnchor="middle" fill={MUTED}>{xFmt(t)}</text>
        </g>
      ))}
      {yt.map((t) => (
        <g key={`y${t}`}>
          <line x1={x0} y1={y(t)} x2={x1} y2={y(t)} stroke={GRID} strokeWidth={1} />
          <text x={x0 - 6} y={y(t) + 4} fontSize={11} textAnchor="end" fill={MUTED}>{fmt(t)}</text>
        </g>
      ))}
      {diagonal && <line x1={x0} y1={y0} x2={x1} y2={y1} stroke="#c9c4ad" strokeWidth={1} strokeDasharray="4 4" />}
      <line x1={x0} y1={y0} x2={x1} y2={y0} stroke={MUTED} strokeWidth={1.2} />
      <line x1={x0} y1={y0} x2={x0} y2={y1} stroke={MUTED} strokeWidth={1.2} />
      {xLabel && (
        <text x={(x0 + x1) / 2} y={y0 + 29} fontSize={11.5} textAnchor="middle" fill={INK}>{xLabel}</text>
      )}
      {yLabel && (
        <text x={x0 - 30} y={(y0 + y1) / 2} fontSize={11.5} textAnchor="middle" fill={INK} transform={`rotate(-90 ${x0 - 30} ${(y0 + y1) / 2})`}>
          {yLabel}
        </text>
      )}
      {children({ x, y, x0, y0, x1, y1 })}
    </g>
  );
}
