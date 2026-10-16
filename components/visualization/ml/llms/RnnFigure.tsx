"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
import StepPlayer from "@/components/visualization/ml/primitives/StepPlayer";
import { DEMO_RNN, DEMO_RNN_STEPS, rnnRun, shapeTable } from "@/lib/ml/rnn";

// Page 1 of LLMs: a vanilla RNN unrolled over 10 steps. hidden 3, input 2,
// 3 output classes, fixed small weights, seeded inputs. Each press of 下一步
// reads one more x_t: h_{t−1} flows in from the left, x_t from below, and the
// three bars inside the cell are the new h_t. The panel prints every product
// for this step; the shape table carries the (32, 10, 50) → (32, 10, 100) from the notes.

const W = 720;
const H = 360;
const CELL_W = 46;
const CELL_H = 90;
const Y_OUT = 66;
const Y_HID = 170;
const Y_IN = 288;
const COL0 = 70;
const COL_GAP = 61;
const H_BAR = 40;
const X_BAR = 24;
const Y_BAR = 40;
const HID = "#2a78d6";
const REC = "#eb6834";
const OUT = "#1baf7a";
const INK = "#3b4234";
const MUTED = "#76796f";
const LINE = "#c9c4ad";
const FAINT = "#e4dfcb";

const ARROWS = { rec: REC, hid: HID, out: OUT, line: LINE, faint: FAINT } as const;
const arrow = (k: keyof typeof ARROWS) => `url(#rnn-arrow-${k})`;

const RUN = rnnRun(DEMO_RNN.params, DEMO_RNN.inputs);
const SHAPES = shapeTable(32, 10, 50, 100);
const CLASSES = ["A", "B", "C"];
const HIDDEN = DEMO_RNN.params.whh.length;

const num = (v: number, digits = 2) => v.toFixed(digits).replace("-", "−");
const vec = (v: number[], digits = 2) => `(${v.map((x) => num(x, digits)).join(", ")})`;
const cx = (k: number) => COL0 + k * COL_GAP;
const argmax = (xs: number[]) => xs.indexOf(Math.max(...xs));

export default function RnnFigure() {
  const [step, setStep] = useState(0);
  const cur = step > 0 ? RUN[step - 1] : null;
  const total = DEMO_RNN_STEPS + 1;

  const narr =
    step === 0
      ? `还没读任何东西：h₀ = (0, 0, 0)，三根 bar 都是零。按「下一步」读入 x₁ = ${vec(DEMO_RNN.inputs[0], 1)}，看 h₁ 怎么从 h₀ 和 x₁ 算出来。`
      : step === 1
        ? `第 1 步：h₀ 是零，W_hh h₀ 也全是零，所以 h₁ = tanh(W_xh x₁) = ${vec(cur!.h)}，只由当前输入决定。y₁ = softmax(W_hy h₁) = ${vec(cur!.y)}，最大的是类 ${CLASSES[argmax(cur!.y)]}。`
        : step < DEMO_RNN_STEPS
          ? `第 ${step} 步：橙色箭头把 h${sub(step - 1)} = ${vec(cur!.hPrev)} 乘上 W_hh，蓝色箭头把 x${sub(step)} = ${vec(cur!.x, 1)} 乘上 W_xh，两项相加过 tanh 得到 h${sub(step)} = ${vec(cur!.h)}。前面 ${step - 1} 步读过的东西都压在这三个数里，再往右只带 h${sub(step)}，不带 x₁…x${sub(step - 1)}。`
          : `读完 10 步：h₁₀ = ${vec(cur!.h)} 是整条序列的摘要，y₁₀ 最大的是类 ${CLASSES[argmax(cur!.y)]}。每一步都要等上一步的 h 算完才能开始，所以 10 步就是 10 轮顺序计算；h 的每个分量又被 tanh 压在 (−1, 1) 里，早先的输入经过几次 W_hh 后在 h 里越来越淡。`;
  const tone = step === 0 ? "" : step === DEMO_RNN_STEPS ? " is-warn" : "";

  return (
    <VisualizationFrame
      title="RNN：一个 hidden state，沿时间轴一步一步传"
      description="hidden_size 3、input_size 2、3 个输出类，固定的小权重和 10 个随机输入。按步读入 x_t：橙色是 W_hh h_{t−1}，蓝色是 W_xh x_t，格子里的三根 bar 是新的 h_t，上面是 y_t = softmax(W_hy h_t)。"
    >
      <StepPlayer step={step} total={total} onStep={setStep} intervalMs={1100} caption={`t = ${step} / ${DEMO_RNN_STEPS}`} />

      <Figure width={W} height={H} label={`RNN 展开 10 步，当前 t = ${step}${cur ? `，h_t = ${vec(cur.h)}` : "，h₀ = 0"}`} minWidth={640}>
        <defs>
          {Object.entries(ARROWS).map(([key, color]) => (
            <marker key={key} id={`rnn-arrow-${key}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0 0 L8 4 L0 8 z" fill={color} />
            </marker>
          ))}
        </defs>

        {/* row labels */}
        <text x={12} y={Y_OUT + 4} fontSize={12} fontWeight={600} fill={OUT}>y_t</text>
        <text x={12} y={Y_HID + 4} fontSize={12} fontWeight={600} fill={HID}>h_t</text>
        <text x={12} y={Y_IN + 4} fontSize={12} fontWeight={600} fill={MUTED}>x_t</text>
        <text x={W - 6} y={H - 8} fontSize={11} textAnchor="end" fill={MUTED}>
          h_t = tanh(W_hh h_{"{t−1}"} + W_xh x_t)，y_t = softmax(W_hy h_t)
        </text>

        {/* h_0 */}
        <g opacity={step === 0 ? 1 : 0.45} style={{ transition: "opacity .3s" }}>
          <rect x={cx(0) - CELL_W / 2} y={Y_HID - CELL_H / 2} width={CELL_W} height={CELL_H} rx={6} fill="#fff" stroke={step === 0 ? HID : LINE} strokeWidth={step === 0 ? 2.2 : 1.2} />
          <line x1={cx(0) - CELL_W / 2 + 4} y1={Y_HID} x2={cx(0) + CELL_W / 2 - 4} y2={Y_HID} stroke={FAINT} />
          <text x={cx(0)} y={Y_HID + CELL_H / 2 + 14} fontSize={11} textAnchor="middle" fill={MUTED} className="mono">h₀ = 0</text>
        </g>

        {RUN.map((s, i) => {
          const k = i + 1;
          const x = cx(k);
          const seen = k <= step;
          const isCur = k === step;
          const future = k > step;
          const cellOpacity = future ? 1 : isCur ? 1 : 0.45;
          const stroke = isCur ? HID : future ? FAINT : LINE;
          return (
            <g key={k} opacity={cellOpacity} style={{ transition: "opacity .3s" }}>
              {/* recurrent arrow h_{k-1} → h_k */}
              <line
                x1={cx(k - 1) + CELL_W / 2 + 1}
                y1={Y_HID}
                x2={x - CELL_W / 2 - 2}
                y2={Y_HID}
                stroke={isCur ? REC : future ? FAINT : LINE}
                strokeWidth={isCur ? 2.6 : 1.3}
                strokeDasharray={future ? "3 3" : undefined}
                markerEnd={arrow(isCur ? "rec" : future ? "faint" : "line")}
                style={{ transition: "stroke .25s" }}
              />
              {isCur && <text x={(cx(k - 1) + x) / 2} y={Y_HID - 8} fontSize={10.5} textAnchor="middle" fill={REC} fontWeight={600}>W_hh</text>}

              {/* input arrow x_k → h_k */}
              <line
                x1={x}
                y1={Y_IN - X_BAR - 8}
                x2={x}
                y2={Y_HID + CELL_H / 2 + 2}
                stroke={isCur ? HID : future ? FAINT : LINE}
                strokeWidth={isCur ? 2.4 : 1.2}
                strokeDasharray={future ? "3 3" : undefined}
                markerEnd={arrow(isCur ? "hid" : future ? "faint" : "line")}
                style={{ transition: "stroke .25s" }}
              />
              {isCur && <text x={x + 5} y={Y_IN - X_BAR - 20} fontSize={10.5} fill={HID} fontWeight={600}>W_xh</text>}

              {/* output arrow h_k → y_k */}
              <line
                x1={x}
                y1={Y_HID - CELL_H / 2 - 1}
                x2={x}
                y2={Y_OUT + Y_BAR / 2 + 6}
                stroke={isCur ? OUT : future ? FAINT : LINE}
                strokeWidth={isCur ? 2.2 : 1.2}
                strokeDasharray={future ? "3 3" : undefined}
                markerEnd={arrow(isCur ? "out" : future ? "faint" : "line")}
                style={{ transition: "stroke .25s" }}
              />
              {isCur && <text x={x + 5} y={Y_HID - CELL_H / 2 - 10} fontSize={10.5} fill={OUT} fontWeight={600}>W_hy</text>}

              {/* hidden cell */}
              <rect x={x - CELL_W / 2} y={Y_HID - CELL_H / 2} width={CELL_W} height={CELL_H} rx={6} fill="#fff" stroke={stroke} strokeWidth={isCur ? 2.4 : 1.2} strokeDasharray={future ? "4 3" : undefined} style={{ transition: "stroke .25s" }} />
              <line x1={x - CELL_W / 2 + 4} y1={Y_HID} x2={x + CELL_W / 2 - 4} y2={Y_HID} stroke={FAINT} />
              {seen &&
                s.h.map((v, u) => {
                  const bx = x - 15 + u * 12;
                  const hgt = Math.abs(v) * H_BAR;
                  return <rect key={u} x={bx} y={v >= 0 ? Y_HID - hgt : Y_HID} width={6} height={hgt} rx={1.5} fill={HID} style={{ transition: "height .3s, y .3s" }} />;
                })}
              <text x={x} y={Y_HID + CELL_H / 2 + 14} fontSize={11} textAnchor="middle" fill={isCur ? INK : MUTED} fontWeight={isCur ? 600 : 400} className="mono">h{sub(k)}</text>

              {/* input bars */}
              {s.x.map((v, u) => {
                const bx = x - 9 + u * 10;
                const hgt = Math.abs(v) * X_BAR;
                return <rect key={u} x={bx} y={v >= 0 ? Y_IN - hgt : Y_IN} width={7} height={hgt} rx={1.5} fill={future ? FAINT : MUTED} />;
              })}
              <line x1={x - 12} y1={Y_IN} x2={x + 12} y2={Y_IN} stroke={LINE} />
              <text x={x} y={Y_IN + X_BAR + 14} fontSize={11} textAnchor="middle" fill={isCur ? INK : MUTED} className="mono">t = {k}</text>

              {/* output probability bars */}
              {seen &&
                s.y.map((p, c) => {
                  const bx = x - 15 + c * 12;
                  const hgt = p * Y_BAR;
                  const top = argmax(s.y) === c;
                  return <rect key={c} x={bx} y={Y_OUT + Y_BAR / 2 - hgt} width={6} height={hgt} rx={1.5} fill={OUT} opacity={top ? 1 : 0.4} />;
                })}
              {seen && <text x={x} y={Y_OUT - Y_BAR / 2 - 4} fontSize={10.5} textAnchor="middle" fill={OUT} className="mono">{CLASSES[argmax(s.y)]} {num(Math.max(...s.y), 2)}</text>}
              <line x1={x - 18} y1={Y_OUT + Y_BAR / 2} x2={x + 18} y2={Y_OUT + Y_BAR / 2} stroke={LINE} />
            </g>
          );
        })}
      </Figure>

      <div className="viz-grid2 wide-left" style={{ marginTop: 12 }}>
        <div className="viz-panel" aria-live="polite">
          <h5 className="nocase">{cur ? `第 ${step} 步的每一项（三个 hidden 单元）` : "起点：h₀ 是零向量"}</h5>
          {cur ? (
            <table className="viz-table">
              <thead>
                <tr>
                  <th></th>
                  {Array.from({ length: HIDDEN }, (_, u) => <th key={u} className="num">单元 {u + 1}</th>)}
                </tr>
              </thead>
              <tbody>
                <Row label={`W_xh x${sub(step)}`} values={cur.xProj} color={HID} />
                <Row label={`W_hh h${sub(step - 1)}`} values={cur.hProj} color={REC} />
                <Row label="相加" values={cur.pre} />
                <Row label={`h${sub(step)} = tanh(相加)`} values={cur.h} color={HID} bold />
                <Row label={`W_hy h${sub(step)}`} values={cur.logits} />
                <Row label={`y${sub(step)} = softmax`} values={cur.y} color={OUT} bold classes={CLASSES} />
              </tbody>
            </table>
          ) : (
            <p style={{ fontSize: 12.5, lineHeight: 1.7, margin: 0 }}>
              W_xh 是 3×2、W_hh 是 3×3、W_hy 是 3×3，十步共用同一套权重。x₁ = {vec(DEMO_RNN.inputs[0], 1)}，按「下一步」把它读进来。
            </p>
          )}
        </div>
        <div className="viz-panel">
          <h5 className="nocase">笔记里的形状：batch 32、seq_len 10、input 50、hidden 100</h5>
          <table className="viz-table">
            <thead>
              <tr><th>张量</th><th className="num">形状</th><th>三个轴</th></tr>
            </thead>
            <tbody>
              {SHAPES.map((r) => (
                <tr key={r.symbol}>
                  <td>{r.name} <span className="viz-mono">{r.symbol}</span></td>
                  <td className="num">({r.shape.join(", ")})</td>
                  <td style={{ fontSize: 11.5, color: MUTED }}>{r.axes.join(" · ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 11.5, color: MUTED, marginTop: 8 }}>图里是同一件事的缩小版：batch 1、seq_len 10、input 2、hidden 3，所以 h 是 (1, 10, 3)。</p>
        </div>
      </div>

      <div className={`viz-narr${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}

function Row({ label, values, color, bold, classes }: { label: string; values: number[]; color?: string; bold?: boolean; classes?: string[] }) {
  return (
    <tr>
      <td style={{ color: color ?? INK, fontWeight: bold ? 600 : 400 }}>{label}</td>
      {values.map((v, i) => (
        <td key={i} className="num" style={{ color: color ?? INK, fontWeight: bold ? 600 : 400 }}>
          {num(v)}
          {classes && <span style={{ color: MUTED, fontWeight: 400 }}> {classes[i]}</span>}
        </td>
      ))}
    </tr>
  );
}

const SUBS = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"];
function sub(n: number): string {
  return String(n).split("").map((c) => SUBS[Number(c)]).join("");
}
