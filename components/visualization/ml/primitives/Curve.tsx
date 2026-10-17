import type { PlotFrame } from "./Plot";


type CurveProps = {
  frame: PlotFrame;
  points: readonly (readonly [number, number])[];
  color: string;
  width?: number;
  dashed?: boolean;
  /** Fill the area down to the x axis with a translucent copy of the color. */
  area?: boolean;
  /** Draw step-wise (used by the PR curve) instead of straight segments. */
  step?: boolean;
  opacity?: number;
};

export function pathFromPoints(frame: PlotFrame, points: readonly (readonly [number, number])[], step = false): string {
  if (points.length === 0) return "";
  let d = `M${frame.x(points[0][0])} ${frame.y(points[0][1])}`;
  for (let i = 1; i < points.length; i++) {
    const [px, py] = points[i];
    if (step) d += ` H${frame.x(px)}`;
    d += ` L${frame.x(px)} ${frame.y(py)}`;
  }
  return d;
}

// A polyline in data coordinates; animates between states through CSS on the path.
export default function Curve({ frame, points, color, width = 2, dashed, area, step, opacity = 1 }: CurveProps) {
  const d = pathFromPoints(frame, points, step);
  if (!d) return null;
  const last = points[points.length - 1];
  const first = points[0];
  const areaD = `${d} L${frame.x(last[0])} ${frame.y0} L${frame.x(first[0])} ${frame.y0} Z`;
  return (
    <g opacity={opacity}>
      {area && <path d={areaD} fill={color} opacity={0.12} style={{ transition: "d .35s" }} />}
      <path d={d} fill="none" stroke={color} strokeWidth={width} strokeDasharray={dashed ? "5 4" : undefined} strokeLinejoin="round" style={{ transition: "d .35s" }} />
    </g>
  );
}
