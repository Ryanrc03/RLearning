"use client";

import { useState } from "react";
import { headingId } from "@/lib/headings";
import { SK, SkArrow, SkBadge, SkBox, SketchFigure, SkText } from "@/components/visualization/sketch/Sketch";
import { DELIVERY_STEPS } from "./steps";

const W = 1000;
const BOX = { y: 196, w: 138, h: 104, gap: 29, x0: 22 };
const bx = (i: number) => BOX.x0 + i * (BOX.w + BOX.gap);

// The six-step delivery framework, with what this case study does at each step.
export default function DeliveryMapViz() {
  const [sel, setSel] = useState(0);
  const step = DELIVERY_STEPS[sel];
  return (
    <SketchFigure
      title="Delivery Framework：这篇案例按这六步展开，点一步看它在这里做什么"
      caption="虚线框的 Data Flow 是可选步骤：数据处理类系统值得单独讲，普通 CRUD 系统可以跳过。两条回边是检查：高层设计要满足功能需求，深挖要满足非功能需求。"
      minWidth={640}
    >
      <svg viewBox={`0 0 ${W} 318`} role="group" aria-label="Delivery framework">
        {/* Feedback arcs: HLD satisfies FRs, deep dives satisfy NFRs. */}
        <SkArrow seed="arc-nfr" curve points={[[bx(5) + 100, BOX.y - 6], [bx(4) + 40, 92], [bx(2) + 60, 52], [bx(0) + 150, 88], [bx(0) + 40, BOX.y - 10]]} stroke={SK.orange.stroke} />
        <SkText x={bx(2) + 70} y={36} size={19} color={SK.orange.stroke}>Primary goal: satisfy non-functional requirements</SkText>
        <SkArrow seed="arc-fr" curve points={[[bx(4) + 80, BOX.y - 6], [bx(3) + 30, 136], [bx(1) + 80, 128], [bx(0) + 120, BOX.y - 8]]} stroke={SK.blue.stroke} />
        <SkText x={bx(2) + 50} y={118} size={19} color={SK.blue.stroke}>Primary goal: satisfy functional requirements</SkText>

        {DELIVERY_STEPS.map((s, i) => {
          const x = bx(i);
          const on = i === sel;
          return (
            <g key={s.key} role="button" tabIndex={0} aria-pressed={on} aria-label={`${s.n}. ${s.label}`}
              onClick={() => setSel(i)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(i); } }}>
              <SkBox x={x} y={BOX.y} w={BOX.w} h={BOX.h} seed={`step-${s.key}`} dashed={s.optional}
                stroke={on ? SK.teal.stroke : SK.ink} fill={on ? SK.teal.fill : "#fff"} strokeWidth={on ? 2.2 : 1.6} />
              {s.label.split("\n").map((ln, j, arr) => (
                <SkText key={j} x={x + BOX.w / 2} y={BOX.y + BOX.h / 2 + 6 + (j - (arr.length - 1) / 2) * 24} size={21}>{ln}</SkText>
              ))}
              <SkText x={x + BOX.w / 2} y={BOX.y + BOX.h - 10} size={14} color={SK.muted}>{s.time}</SkText>
              <SkBadge cx={x + 4} cy={BOX.y + 2} n={s.n} seed={`badge-${s.key}`} r={18} />
              {i < DELIVERY_STEPS.length - 1 && (
                <SkArrow seed={`next-${s.key}`} points={[[x + BOX.w + 4, BOX.y + BOX.h / 2], [x + BOX.w + BOX.gap - 4, BOX.y + BOX.h / 2]]} />
              )}
            </g>
          );
        })}
      </svg>
      <div className="sk-panel">
        <h5>{step.n}. {step.label.replace("\n", " ")} <span style={{ fontSize: 14, color: SK.muted }}>{step.time}</span></h5>
        <div>{step.what}</div>
        <ul>{step.here.map((h) => <li key={h}>{h}</li>)}</ul>
        <div style={{ marginTop: 8 }}><a href={`#${headingId(step.heading)}`}>跳到这一节 ↓</a></div>
      </div>
    </SketchFigure>
  );
}
