import type { PlotFrame } from "./Plot";

type MarkerProps = {
  frame: PlotFrame;
  x: number;
  y: number;
  color: string;
  label?: string;
  /** Where the label sits relative to the dot. */
  side?: "right" | "left" | "above" | "below";
  r?: number;
  /** Drop dashed guides to both axes. */
  guides?: boolean;
};

// A highlighted point in data coordinates with an optional label and axis guides.
export default function Marker({ frame, x, y, color, label, side = "right", r = 5, guides }: MarkerProps) {
  const cx = frame.x(x);
  const cy = frame.y(y);
  const dx = side === "right" ? 9 : side === "left" ? -9 : 0;
  const dy = side === "above" ? -9 : side === "below" ? 14 : 4;
  const anchor = side === "right" ? "start" : side === "left" ? "end" : "middle";
  return (
    <g style={{ transition: "transform .3s" }} transform={`translate(${cx} ${cy})`}>
      {guides && (
        <>
          <line x1={0} y1={0} x2={0} y2={frame.y0 - cy} stroke={color} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
          <line x1={0} y1={0} x2={frame.x0 - cx} y2={0} stroke={color} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
        </>
      )}
      <circle r={r + 3} fill="#fff" opacity={0.9} />
      <circle r={r} fill={color} stroke="#fff" strokeWidth={1.5} />
      {label && (
        <text x={dx} y={dy} fontSize={11.5} fontWeight={600} textAnchor={anchor} fill={color} className="mono">
          {label}
        </text>
      )}
    </g>
  );
}
