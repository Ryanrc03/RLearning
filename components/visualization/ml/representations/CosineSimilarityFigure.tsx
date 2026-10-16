"use client";

import { useState, type PointerEvent as ReactPointerEvent } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Plot, { type PlotFrame } from "@/components/visualization/ml/primitives/Plot";
import Slider from "@/components/visualization/ml/primitives/Slider";
import { cosineSimilarity, dot } from "@/lib/ml/clip";
import { angleBetweenDeg, fromPolar, norm, toDeg, VECTOR_A } from "@/lib/ml/embeddings";
import { clamp } from "@/lib/ml/random";

// Page 18 of Representations: vector A is fixed; drag the tip of B (or use the
// direction slider) and watch the dot product, the two lengths, cos θ and θ.
// The length slider stretches B: the dot product follows, cos θ does not.

const C_A = "#2a78d6";
const C_B = "#eb6834";
const INK = "#3b4234";
const MUTED = "#76796f";
const DEFAULT_DEG = 65;
const DEFAULT_LEN = 0.7;
const MIN_LEN = 0.1;
const FW = 400;
const FH = 404; // Plot's padding makes the panel square: (400 − 52) × (404 − 56)

const fmt = (x: number) => (Object.is(x, -0) ? "0.00" : x.toFixed(2));

function Arrow({ f, v, color, width = 2.2 }: { f: PlotFrame; v: readonly [number, number]; color: string; width?: number }) {
  const x1 = f.x(0);
  const y1 = f.y(0);
  const x2 = f.x(v[0]);
  const y2 = f.y(v[1]);
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  const hx = x2 - ux * 9;
  const hy = y2 - uy * 9;
  return (
    <g>
      <line x1={x1} y1={y1} x2={hx} y2={hy} stroke={color} strokeWidth={width} strokeLinecap="round" />
      <polygon points={`${x2},${y2} ${hx - uy * 5},${hy + ux * 5} ${hx + uy * 5},${hy - ux * 5}`} fill={color} />
    </g>
  );
}

export default function CosineSimilarityFigure() {
  const [deg, setDeg] = useState(DEFAULT_DEG);
  const [len, setLen] = useState(DEFAULT_LEN);
  const [dragging, setDragging] = useState(false);

  const A = VECTOR_A;
  const B = fromPolar(len, deg);
  const nA = norm(A);
  const nB = norm(B);
  const d = dot([...A], [...B]);
  const cos = cosineSimilarity([...A], [...B]);
  const theta = angleBetweenDeg(A, B);
  const proj = nB * cos; // signed length of B along A
  const foot: [number, number] = [(A[0] / nA) * proj, (A[1] / nA) * proj];
  const dotAtUnit = dot([...A], [...fromPolar(1, deg)]);
  const degA = toDeg(A);

  const reset = () => {
    setDeg(DEFAULT_DEG);
    setLen(DEFAULT_LEN);
  };

  const moveTo = (e: ReactPointerEvent<SVGRectElement>, f: PlotFrame) => {
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const x = ((p.x - f.x0) / (f.x1 - f.x0)) * 2 - 1;
    const y = ((f.y0 - p.y) / (f.y0 - f.y1)) * 2 - 1;
    const r = Math.hypot(x, y);
    if (r < 1e-6) return;
    setDeg(Math.round(toDeg([x, y])) % 360);
    setLen(clamp(Math.round(r * 100) / 100, MIN_LEN, 1));
  };

  const nearOrtho = Math.abs(theta - 90) < 2;
  const narr = nearOrtho
    ? `夹角 ${theta.toFixed(0)}°：A 和 B 正交，cos θ = ${fmt(cos)}，点积 ${fmt(d)}。不管把 B 拉多长，点积都停在 0 附近：两个向量「互不相关」。`
    : theta < 90
      ? `夹角 ${theta.toFixed(1)}°，cos θ = ${fmt(cos)} > 0：B 大体和 A 同向${theta < 15 ? "，几乎重合" : ""}。现在 ‖B‖ = ${fmt(nB)}，点积 ${fmt(d)}；把长度拉到 1.0，点积变成 ${fmt(dotAtUnit)}，cos θ 仍是 ${fmt(cos)}——它只看方向。`
      : `夹角 ${theta.toFixed(1)}°，cos θ = ${fmt(cos)} < 0：B 背着 A 走${theta > 165 ? "，几乎相反" : ""}。点积 ${fmt(d)} 也是负的；缩放 B 只改点积的大小，不改 cos θ 的符号和数值。`;
  const tone = nearOrtho ? " is-warn" : cos > 0.9 ? " is-good" : cos < 0 ? " is-bad" : "";

  return (
    <VisualizationFrame
      title="Cosine Similarity：夹角的余弦"
      description="A 固定在 20° 方向、长度 0.9。拖动 B 的箭头端点改变 B（也可以用两条滑杆）；右边实时给出点积、两个模长、cos θ 和夹角。虚线是 B 在 A 方向上的投影，点积 = ‖A‖ × 这段投影。"
    >
      <div className="viz-row">
        <Slider label="B 的方向" value={deg} min={0} max={359} step={1} onChange={(v) => setDeg(v % 360)} display={`${deg}°`} id="cos-deg" />
        <Slider label="B 的长度" value={len} min={MIN_LEN} max={1} step={0.01} onChange={setLen} display={fmt(len)} id="cos-len" />
        <button type="button" className="viz-btn" onClick={reset} style={{ marginBottom: 14 }}>重置</button>
      </div>

      <div className="viz-grid2 wide-left">
        <Figure width={FW} height={FH} label={`A 在 ${degA.toFixed(0)}°，B 在 ${deg}° 长 ${fmt(len)}；点积 ${fmt(d)}，cos ${fmt(cos)}，夹角 ${theta.toFixed(1)}°`} minWidth={340}>
          <Plot box={{ x: 0, y: 0, w: FW, h: FH }} xDomain={[-1, 1]} yDomain={[-1, 1]} xTicks={[-1, -0.5, 0, 0.5, 1]} yTicks={[-1, -0.5, 0, 0.5, 1]} format={(v) => v.toFixed(1)}>
            {(f) => {
              const ox = f.x(0);
              const oy = f.y(0);
              const R = f.x(1) - ox;
              const arcR = R * 0.28;
              const dA = (degA * Math.PI) / 180;
              const dB = (deg * Math.PI) / 180;
              // Shortest way round from A to B; sweep=0 is counter-clockwise on screen.
              let delta = deg - degA;
              if (delta > 180) delta -= 360;
              if (delta < -180) delta += 360;
              const sweep = delta >= 0 ? 0 : 1;
              const sx = ox + arcR * Math.cos(dA);
              const sy = oy - arcR * Math.sin(dA);
              const ex = ox + arcR * Math.cos(dB);
              const ey = oy - arcR * Math.sin(dB);
              const midA = dA + (delta * Math.PI) / 360;
              const lx = ox + (arcR + 14) * Math.cos(midA);
              const ly = oy - (arcR + 14) * Math.sin(midA);
              return (
                <>
                  <circle cx={ox} cy={oy} r={R} fill="none" stroke="#c9c4ad" strokeDasharray="4 4" />
                  <line x1={f.x0} y1={oy} x2={f.x1} y2={oy} stroke={MUTED} strokeWidth={1} />
                  <line x1={ox} y1={f.y0} x2={ox} y2={f.y1} stroke={MUTED} strokeWidth={1} />
                  {/* A's line extended both ways, so negative projections land on it too */}
                  <line x1={f.x(-A[0] / nA)} y1={f.y(-A[1] / nA)} x2={f.x(A[0] / nA)} y2={f.y(A[1] / nA)} stroke={C_A} strokeWidth={1} strokeDasharray="2 4" opacity={0.5} />
                  {Math.abs(delta) > 0.5 && <path d={`M${sx} ${sy} A${arcR} ${arcR} 0 0 ${sweep} ${ex} ${ey}`} fill="none" stroke={INK} strokeWidth={1.2} />}
                  {Math.abs(delta) > 6 && <text x={lx} y={ly + 4} fontSize={12} fontWeight={600} textAnchor="middle" fill={INK}>θ</text>}
                  {/* projection of B onto A */}
                  <line x1={f.x(B[0])} y1={f.y(B[1])} x2={f.x(foot[0])} y2={f.y(foot[1])} stroke={C_B} strokeWidth={1} strokeDasharray="3 3" />
                  <line x1={ox} y1={oy} x2={f.x(foot[0])} y2={f.y(foot[1])} stroke={C_B} strokeWidth={4} opacity={0.35} strokeLinecap="round" />
                  <Arrow f={f} v={A} color={C_A} />
                  <Arrow f={f} v={B} color={C_B} />
                  <text x={f.x(A[0]) + 8} y={f.y(A[1]) - 6} fontSize={13} fontWeight={700} fill={C_A}>A</text>
                  <text x={f.x(B[0]) + (B[0] >= 0 ? 12 : -12)} y={f.y(B[1]) + (B[1] >= 0 ? -10 : 18)} fontSize={13} fontWeight={700} textAnchor={B[0] >= 0 ? "start" : "end"} fill={C_B}>B</text>
                  <text x={f.x(foot[0]) + (A[1] >= 0 ? 6 : -6)} y={f.y(foot[1]) + 14} fontSize={10.5} fill={C_B} className="mono">‖B‖cosθ = {fmt(proj)}</text>
                  {/* drag surface + handle */}
                  <rect
                    x={f.x0}
                    y={f.y1}
                    width={f.x1 - f.x0}
                    height={f.y0 - f.y1}
                    fill="transparent"
                    style={{ cursor: dragging ? "grabbing" : "crosshair", touchAction: "none" }}
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      setDragging(true);
                      moveTo(e, f);
                    }}
                    onPointerMove={(e) => {
                      if (dragging) moveTo(e, f);
                    }}
                    onPointerUp={() => setDragging(false)}
                    onPointerCancel={() => setDragging(false)}
                  />
                  <circle cx={f.x(B[0])} cy={f.y(B[1])} r={9} fill="#fff" stroke={C_B} strokeWidth={2} pointerEvents="none" />
                  <circle cx={f.x(B[0])} cy={f.y(B[1])} r={3.5} fill={C_B} pointerEvents="none" />
                </>
              );
            }}
          </Plot>
        </Figure>

        <div className="viz-panel">
          <h5>实时数值</h5>
          <div className="viz-stat" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div><small>A · B</small><b>{fmt(d)}</b></div>
            <div><small>θ</small><b>{theta.toFixed(1)}°</b></div>
            <div><small>‖A‖</small><b>{fmt(nA)}</b></div>
            <div><small>‖B‖</small><b>{fmt(nB)}</b></div>
            <div style={{ gridColumn: "1 / -1", borderColor: C_B }}><small>cos θ = A · B / (‖A‖ ‖B‖)</small><b>{fmt(cos)}</b><span className="delta">= {fmt(d)} / ({fmt(nA)} × {fmt(nB)})</span></div>
          </div>
          <p className="viz-k" style={{ marginTop: 10 }}>
            A = ({fmt(A[0])}, {fmt(A[1])})，B = ({fmt(B[0])}, {fmt(B[1])})。A · B = {fmt(A[0])}×{fmt(B[0])} + {fmt(A[1])}×{fmt(B[1])}。
          </p>
          <div className="viz-legend" style={{ marginTop: 8 }}>
            <span><i style={{ background: C_A }} />A，固定</span>
            <span><i style={{ background: C_B }} />B，可拖</span>
            <span><i style={{ background: C_B, opacity: 0.35 }} />B 在 A 上的投影</span>
          </div>
        </div>
      </div>

      <div className={`viz-narr${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}
