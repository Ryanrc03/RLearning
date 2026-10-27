"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Curve from "@/components/visualization/ml/primitives/Curve";
import Plot from "@/components/visualization/ml/primitives/Plot";

// Shared pieces for the DAE-Fuse training figures: a hook that runs a training
// job only once the figure is near the viewport (so the page loads without
// training anything), a loss-curve panel with a step cursor, and the colour
// scales the weight / activation heat maps use.

export function useLazyRun<T>(run: () => T): [React.RefObject<HTMLDivElement | null>, T | null] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || data) return;
    let timer = 0;
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      cleanup();
      timer = window.setTimeout(() => setData(run()), 30);
    };
    // Near the viewport (within 300 px) counts as visible.
    const near = () => {
      const r = el.getBoundingClientRect();
      return r.bottom > -300 && r.top < window.innerHeight + 300;
    };
    const onScroll = () => {
      if (near()) start();
    };
    const io =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && start(), { rootMargin: "300px" });
    // The scroll check backs up the observer, which some embedded browsers never fire.
    function cleanup() {
      io?.disconnect();
      window.removeEventListener("scroll", onScroll);
    }
    io?.observe(el);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      cleanup();
      window.clearTimeout(timer);
    };
  }, [run, data]);
  return [ref, data];
}

export function Training({ children }: { children?: ReactNode }) {
  return <div className="viz-panel" style={{ textAlign: "center", color: "var(--muted)", padding: "40px 12px" }}>{children ?? "滚动到这里时开始训练，约一秒…"}</div>;
}

/** Diverging blue (negative) / orange (positive) for weights. */
export function diverge(v: number, scale: number) {
  const t = Math.max(-1, Math.min(1, v / scale));
  if (t >= 0) return `rgb(${Math.round(255 - t * 20)},${Math.round(255 - t * 151)},${Math.round(255 - t * 203)})`;
  return `rgb(${Math.round(255 + t * 213)},${Math.round(255 + t * 135)},${Math.round(255 + t * 41)})`;
}

/** White → blue for non-negative activations and attention weights. */
export function seq(v: number, max: number) {
  const t = Math.max(0, Math.min(1, v / max));
  return `rgb(${Math.round(255 - t * 213)},${Math.round(255 - t * 135)},${Math.round(255 - t * 41)})`;
}

export type Series = { label: string; color: string; points: [number, number][]; dashed?: boolean };

/** A small line chart of training curves with a vertical cursor at the current step. */
export function CurvePanel({ box, series, xMax, yDomain, yTicks, cursor, title, format, xLabel = "训练步数", legend = "top" }: { box: { x: number; y: number; w: number; h: number }; series: Series[]; xMax: number; yDomain: [number, number]; yTicks?: number[]; cursor?: number; title: string; format?: (v: number) => string; xLabel?: string; legend?: "top" | "bottom" }) {
  return (
    <Plot box={box} xDomain={[0, xMax]} yDomain={yDomain} xTicks={[0, Math.round(xMax / 2), xMax]} yTicks={yTicks} xLabel={xLabel} title={title} format={format} xFormat={(v) => String(Math.round(v))}>
      {(f) => (
        <>
          {series.map((s) => (
            <Curve key={s.label} frame={f} points={s.points.map(([x, y]) => [x, Math.max(yDomain[0], Math.min(yDomain[1], y))] as const)} color={s.color} width={2} dashed={s.dashed} />
          ))}
          {cursor !== undefined && <line x1={f.x(cursor)} y1={f.y1} x2={f.x(cursor)} y2={f.y0} stroke="#3b4234" strokeWidth={1} strokeDasharray="3 3" />}
          {series.map((s, i) => (
            <text key={s.label} x={f.x1 - 4} y={legend === "top" ? f.y1 + 12 + i * 13 : f.y0 - 8 - (series.length - 1 - i) * 13} fontSize={10.5} textAnchor="end" fill={s.color} fontWeight={600}>{s.label}</text>
          ))}
        </>
      )}
    </Plot>
  );
}

/** A grid of cells drawn from a flat row-major array. */
export function Cells({ vals, cols, x, y, cell, color, title, stroke }: { vals: number[]; cols: number; x: number; y: number; cell: number; color: (v: number, i: number) => string; title?: string; stroke?: (i: number) => string | undefined }) {
  const rows = Math.ceil(vals.length / cols);
  return (
    <g>
      {title && <text x={x} y={y - 6} fontSize={10.5} fontWeight={600} fill="#30332c">{title}</text>}
      {vals.map((v, i) => (
        <rect key={i} x={x + (i % cols) * cell} y={y + Math.floor(i / cols) * cell} width={cell + 0.3} height={cell + 0.3} fill={color(v, i)} stroke={stroke?.(i)} strokeWidth={stroke?.(i) ? 2 : 0} />
      ))}
      <rect x={x} y={y} width={cols * cell} height={rows * cell} fill="none" stroke="#9a9c8d" />
    </g>
  );
}
