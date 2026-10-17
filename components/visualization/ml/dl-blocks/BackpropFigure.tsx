"use client";

import { useMemo, useState, type ReactNode } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
import StepPlayer from "@/components/visualization/ml/primitives/StepPlayer";
import { backward, DEMO_PARAMS, DEMO_X, DEMO_Y, forward, numericGradient } from "@/lib/ml/backprop";

// Page 1 of Deep Learning Blocks: a 2 → 2 → 1 sigmoid network with the numbers
// from the notes. Step forward (a, z, s, p, L appear on the nodes) and then
// backward (each local derivative lands on the edge or node it belongs to);
// the panel keeps the running chain-rule product with the numbers substituted.

const W = 720;
const H = 330;
const R = 23;
const FWD = "#2a78d6";
const BWD = "#eb6834";
const INK = "#3b4234";
const LINE = "#c9c4ad";
const X_IN = 78;
const X_HID = 290;
const X_OUT = 502;
const X_LOSS = 656;
const Y_TOP = 108;
const Y_BOT = 232;
const Y_MID = 170;

const num = (v: number, digits = 3) => v.toFixed(digits).replace("-", "−");
const sym = (v: number, digits = 3) => (v < 0 ? `(${num(v, digits)})` : num(v, digits));

type Phase = "start" | "forward" | "backward" | "check";
type Hot = "w1" | "hidden" | "w0" | "out" | "loss" | "none";
type Step = { phase: Phase; title: string; hot: Hot; chain: ReactNode; numbers: ReactNode; narr: string };

const P = ({ children }: { children: ReactNode }) => <p style={{ margin: "4px 0 0", fontSize: 12.5, lineHeight: 1.7 }}>{children}</p>;

// Edge label with a white halo so it stays readable where edges cross.
const Label = ({ x, y, text, color = INK, anchor = "middle", bold }: { x: number; y: number; text: string; color?: string; anchor?: "middle" | "start" | "end"; bold?: boolean }) => (
  <text x={x} y={y} fontSize={11.5} textAnchor={anchor} fill={color} fontWeight={bold ? 600 : 500} stroke="#fff" strokeWidth={3.5} paintOrder="stroke" className="mono">
    {text}
  </text>
);

export default function BackpropFigure() {
  const [step, setStep] = useState(0);
  const r = useMemo(() => {
    const f = forward(DEMO_PARAMS, DEMO_X);
    const b = backward(DEMO_PARAMS, DEMO_X, DEMO_Y);
    const n = numericGradient(DEMO_PARAMS, DEMO_X, DEMO_Y, 1e-5);
    const diffs = [...b.dLdw0.map((g, i) => Math.abs(g - n.dLdw0[i])), ...b.dLdw1.flatMap((row, i) => row.map((g, j) => Math.abs(g - n.dLdw1[i][j])))];
    return { f, b, n, maxDiff: Math.max(...diffs) };
  }, []);
  const { f, b, n } = r;
  const x = DEMO_X;
  const { w1, w0 } = DEMO_PARAMS;

  const steps: Step[] = [
      {
        phase: "start",
        title: "起点：一个样本，两层权重",
        hot: "none",
        chain: <>x = ({num(x[0], 1)}, {num(x[1], 1)})，标签 y = {DEMO_Y}。W⁽¹⁾ 是隐层的 2×2 权重，W⁽⁰⁾ 是输出层的 2 个权重，都写在边上。</>,
        numbers: <>W⁽¹⁾ = [[{num(w1[0][0], 1)}, {num(w1[0][1], 1)}], [{num(w1[1][0], 1)}, {num(w1[1][1], 1)}]]，W⁽⁰⁾ = ({num(w0[0], 1)}, {num(w0[1], 1)})</>,
        narr: "按「下一步」先正向算一遍：每一步的中间值都会留在节点上，因为反向时还要用。",
      },
      {
        phase: "forward",
        title: "正向 ①：a = W⁽¹⁾ x",
        hot: "w1",
        chain: <>每个隐层单元把两条入边的权重乘上输入再相加。</>,
        numbers: (
          <>
            a₁ = {num(w1[0][0], 1)}×{num(x[0], 1)} + {sym(w1[0][1], 1)}×{num(x[1], 1)} = {num(f.a[0], 2)}
            <br />a₂ = {num(w1[1][0], 1)}×{num(x[0], 1)} + {sym(w1[1][1], 1)}×{num(x[1], 1)} = {num(f.a[1], 2)}
          </>
        ),
        narr: `高亮的四条边是 W⁽¹⁾。a₁ = ${num(f.a[0], 2)}、a₂ = ${num(f.a[1], 2)} 是加权和，还没过激活函数。`,
      },
      {
        phase: "forward",
        title: "正向 ②：z = σ(a)",
        hot: "hidden",
        chain: <>sigmoid 把加权和压到 (0, 1)。z 要存下来：反向第 ④ 步和第 ⑥ 步都用它。</>,
        numbers: (
          <>
            z₁ = σ({num(f.a[0], 2)}) = {num(f.z[0])}
            <br />z₂ = σ({num(f.a[1], 2)}) = {num(f.z[1])}
          </>
        ),
        narr: `隐层输出 z = (${num(f.z[0])}, ${num(f.z[1])})。注意 sigmoid 的导数是 z(1−z)，所以反向时只要有 z 就够了，不必重算。`,
      },
      {
        phase: "forward",
        title: "正向 ③：s = W⁽⁰⁾ᵀ z",
        hot: "w0",
        chain: <>输出层只有一个单元，logit s 是两条入边的加权和。</>,
        numbers: <>s = {num(w0[0], 1)}×{num(f.z[0])} + {sym(w0[1], 1)}×{num(f.z[1])} = {num(f.s)}</>,
        narr: `高亮的两条边是 W⁽⁰⁾。s = ${num(f.s)} 是负的，说明模型目前更偏向 y = 0，而真实标签是 1。`,
      },
      {
        phase: "forward",
        title: "正向 ④：p = σ(s)",
        hot: "out",
        chain: <>logit 过 sigmoid 变成「y = 1 的概率」。</>,
        numbers: <>p = σ({num(f.s)}) = {num(f.p)}</>,
        narr: `p = ${num(f.p)}：模型只给了真实类 ${Math.round(f.p * 100)}% 的概率。`,
      },
      {
        phase: "forward",
        title: "正向 ⑤：L = −log p",
        hot: "loss",
        chain: <>y = 1 时 BCE 只剩 −log p 这一项。正向到此结束，五个中间值 a、z、s、p、L 都在节点上。</>,
        numbers: <>L = −log {num(f.p)} = {num(f.loss)}</>,
        narr: `loss = ${num(f.loss)}。接下来从 L 往回走：每一步乘一个局部导数，乘积一路带到权重上。`,
      },
      {
        phase: "backward",
        title: "反向 ①：∂L/∂p = −1/p",
        hot: "loss",
        chain: <>链的第一项：loss 对自己的直接输入 p 的导数。</>,
        numbers: <>∂L/∂p = −1/{num(f.p)} = {num(b.dLdp)}</>,
        narr: `∂L/∂p = ${num(b.dLdp)}：p 越小，这一项的绝对值越大，推 p 往上走的力越强。`,
      },
      {
        phase: "backward",
        title: "反向 ②：∂p/∂s = p(1 − p)",
        hot: "out",
        chain: <>sigmoid 的局部导数，用正向存下来的 p 直接算。</>,
        numbers: <>∂p/∂s = {num(f.p)} × {num(1 - f.p)} = {num(b.dpds)}</>,
        narr: `∂p/∂s = ${num(b.dpds)}。sigmoid 的导数最大只有 0.25，每经过一个 sigmoid 梯度至少缩到四分之一，记住这件事。`,
      },
      {
        phase: "backward",
        title: "反向 ③：∂L/∂s = ∂L/∂p · ∂p/∂s",
        hot: "out",
        chain: <>两项相乘，链走到 logit。它化简后就是 p − y = −(1 − p)。</>,
        numbers: (
          <>
            ∂L/∂s = {sym(b.dLdp)} × {num(b.dpds)} = {num(b.dLds)}
            <br />= −(1 − {num(f.p)}) = {num(-(1 - f.p))}
          </>
        ),
        narr: `∂L/∂s = ${num(b.dLds)}。这个数是后面每一个梯度的公共前缀，只算一次，存下来。`,
      },
      {
        phase: "backward",
        title: "反向 ④：∂L/∂W⁽⁰⁾ = ∂L/∂s · ∂s/∂W⁽⁰⁾",
        hot: "w0",
        chain: <>s = W⁽⁰⁾ᵀ z，所以 ∂s/∂W⁽⁰⁾ = z。整条链：∂L/∂p · ∂p/∂s · ∂s/∂W⁽⁰⁾ = (−1/p) · p(1−p) · z = −(1−p) · z。</>,
        numbers: (
          <>
            ∂L/∂W⁽⁰⁾ = {sym(b.dLdp)} × {num(b.dpds)} × ({num(f.z[0])}, {num(f.z[1])})
            <br />= {num(b.dLds)} × ({num(f.z[0])}, {num(f.z[1])}) = ({num(b.dLdw0[0])}, {num(b.dLdw0[1])})
          </>
        ),
        narr: `第一个权重梯度到手：∂L/∂W⁽⁰⁾ = (${num(b.dLdw0[0])}, ${num(b.dLdw0[1])})，写在两条边上。两个都是负数：沿负梯度走会把 W⁽⁰⁾ 调大，让 s 和 p 升高。`,
      },
      {
        phase: "backward",
        title: "反向 ⑤：∂L/∂z = ∂L/∂s · ∂s/∂z",
        hot: "w0",
        chain: <>同一个 s，这次对 z 求导：∂s/∂z = W⁽⁰⁾。前缀 ∂L/∂s 不重算。</>,
        numbers: <>∂L/∂z = {num(b.dLds)} × ({num(w0[0], 1)}, {num(w0[1], 1)}) = ({num(b.dLdz[0])}, {num(b.dLdz[1])})</>,
        narr: `梯度穿过 W⁽⁰⁾ 回到隐层：∂L/∂z = (${num(b.dLdz[0])}, ${num(b.dLdz[1])})。z₂ 的梯度是正的，因为 W⁽⁰⁾₂ = ${num(w0[1], 1)} 是负的，z₂ 越大 s 越小。`,
      },
      {
        phase: "backward",
        title: "反向 ⑥：∂L/∂a = ∂L/∂z ⊙ z(1 − z)",
        hot: "hidden",
        chain: <>穿过隐层的 sigmoid，逐元素乘它的局部导数 z(1−z)。</>,
        numbers: (
          <>
            z(1−z) = ({num(b.dzda[0])}, {num(b.dzda[1])})
            <br />∂L/∂a = ({sym(b.dLdz[0])} × {num(b.dzda[0])}, {num(b.dLdz[1])} × {num(b.dzda[1])}) = ({num(b.dLda[0])}, {num(b.dLda[1])})
          </>
        ),
        narr: `∂L/∂a = (${num(b.dLda[0])}, ${num(b.dLda[1])})。又缩了四倍多：链每多经过一个 sigmoid，梯度就再乘一个不到 0.25 的数。`,
      },
      {
        phase: "backward",
        title: "反向 ⑦：∂L/∂W⁽¹⁾ = ∂L/∂a · xᵀ",
        hot: "w1",
        chain: <>a = W⁽¹⁾ x，所以 ∂a/∂W⁽¹⁾ = xᵀ，外积得到 2×2 的梯度。整条链：−(1−p) · W⁽⁰⁾ ⊙ z(1−z) · xᵀ。</>,
        numbers: (
          <>
            ∂L/∂W⁽¹⁾ = ({num(b.dLda[0])}, {num(b.dLda[1])})ᵀ · ({num(x[0], 1)}, {num(x[1], 1)})
            <br />= [[{num(b.dLdw1[0][0])}, {num(b.dLdw1[0][1])}], [{num(b.dLdw1[1][0])}, {num(b.dLdw1[1][1])}]]
          </>
        ),
        narr: `四条 W⁽¹⁾ 边上都有了梯度。每一行是同一个 ∂L/∂aᵢ 乘不同的输入 xⱼ，所以第二列总是第一列的一半（x₂ = 0.5）。`,
      },
      {
        phase: "check",
        title: "验算：有限差分",
        hot: "none",
        chain: <>把一个权重挪 ±ε（ε = 10⁻⁵），看 loss 变多少，(L₊ − L₋) / 2ε 就是数值梯度。和链式法则的结果逐项对比。</>,
        numbers: (
          <>
            数值 ∂L/∂W⁽⁰⁾ = ({num(n.dLdw0[0])}, {num(n.dLdw0[1])})
            <br />数值 ∂L/∂W⁽¹⁾ = [[{num(n.dLdw1[0][0])}, {num(n.dLdw1[0][1])}], [{num(n.dLdw1[1][0])}, {num(n.dLdw1[1][1])}]]
            <br />最大差 {r.maxDiff.toExponential(1)}
          </>
        ),
        narr: `六个权重的数值梯度和反向传播的结果最大只差 ${r.maxDiff.toExponential(1)}：链没有乘错。真实网络里这叫 gradient check，自己写层的时候一定要做。`,
      },
  ];

  const cur = steps[step];
  const total = steps.length;
  const fwdDone = step >= 5;
  const hotColor = cur.phase === "forward" ? FWD : cur.phase === "backward" ? BWD : INK;
  const edgeStyle = (group: Hot) => ({ stroke: cur.hot === group ? hotColor : LINE, strokeWidth: cur.hot === group ? 3 : 1.4, transition: "stroke .25s, stroke-width .25s" });
  const nodeStroke = (group: Hot) => (cur.hot === group ? hotColor : "#8e8d78");
  const nodeWidth = (group: Hot) => (cur.hot === group ? 3 : 1.4);
  const show = (k: number) => step >= k;

  const narrTone = cur.phase === "check" ? " is-good" : cur.phase === "backward" ? " is-warn" : "";
  const caption = `第 ${step} 步 / 共 ${total - 1} 步 · ${cur.phase === "start" ? "起点" : cur.phase === "forward" ? "正向" : cur.phase === "backward" ? "反向" : "验算"}`;

  return (
    <VisualizationFrame
      title="Backprop：正向存中间值，反向把局部导数一路乘回去"
      description="两个输入、两个 sigmoid 隐层单元、一个 sigmoid 输出，标签 y = 1。蓝色是正向算出的值，橙色是反向算出的梯度；高亮的边或节点是这一步正在乘的那一项。"
    >
      <StepPlayer step={step} total={total} onStep={setStep} intervalMs={1500} caption={caption} />

      <Figure width={W} height={H} label={`两层网络，当前第 ${step} 步：${cur.title}`} minWidth={600}>
        <defs>
          <marker id="bp-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0 L8 4 L0 8 z" fill={LINE} />
          </marker>
        </defs>

        {/* column headers */}
        <text x={X_IN} y={34} fontSize={12} fontWeight={600} textAnchor="middle" fill={INK}>输入 x</text>
        <text x={X_HID} y={34} fontSize={12} fontWeight={600} textAnchor="middle" fill={INK}>隐层 a = W⁽¹⁾x，z = σ(a)</text>
        <text x={X_OUT} y={34} fontSize={12} fontWeight={600} textAnchor="middle" fill={INK}>输出 s = W⁽⁰⁾ᵀz，p = σ(s)</text>
        <text x={X_LOSS} y={34} fontSize={12} fontWeight={600} textAnchor="middle" fill={INK}>L = −log p</text>

        {/* direction hint */}
        <text x={W / 2} y={H - 8} fontSize={11} textAnchor="middle" fill={fwdDone ? BWD : FWD} fontWeight={600}>
          {fwdDone ? "← 反向：从 L 往回乘局部导数" : "正向：从 x 往右算中间值 →"}
        </text>

        {/* W1 edges */}
        <line x1={X_IN + R} y1={Y_TOP} x2={X_HID - R} y2={Y_TOP} style={edgeStyle("w1")} />
        <line x1={X_IN + R} y1={Y_BOT} x2={X_HID - R} y2={Y_TOP + 10} style={edgeStyle("w1")} />
        <line x1={X_IN + R} y1={Y_TOP} x2={X_HID - R} y2={Y_BOT - 10} style={edgeStyle("w1")} />
        <line x1={X_IN + R} y1={Y_BOT} x2={X_HID - R} y2={Y_BOT} style={edgeStyle("w1")} />
        {/* W0 edges */}
        <line x1={X_HID + R} y1={Y_TOP} x2={X_OUT - R + 2} y2={Y_MID - 8} style={edgeStyle("w0")} />
        <line x1={X_HID + R} y1={Y_BOT} x2={X_OUT - R + 2} y2={Y_MID + 8} style={edgeStyle("w0")} />
        {/* out → loss */}
        <line x1={X_OUT + R} y1={Y_MID} x2={X_LOSS - R} y2={Y_MID} style={edgeStyle("loss")} markerEnd="url(#bp-arrow)" />

        {/* W1 weight labels, each placed beside its own edge and clear of the crossing; gradients appear at step 12 */}
        <Label x={(X_IN + X_HID) / 2} y={Y_TOP - 7} text={`w₁₁ = ${num(w1[0][0], 1)}`} />
        <Label x={X_IN + 79} y={Y_BOT - 22} text={`w₁₂ = ${num(w1[0][1], 1)}`} anchor="start" />
        <Label x={X_IN + 79} y={Y_TOP + 28} text={`w₂₁ = ${num(w1[1][0], 1)}`} anchor="start" />
        <Label x={(X_IN + X_HID) / 2} y={Y_BOT + 16} text={`w₂₂ = ${num(w1[1][1], 1)}`} />
        {show(12) && (
          <>
            <Label x={(X_IN + X_HID) / 2 - 14} y={Y_TOP - 21} text={`∂L/∂w₁₁ = ${num(b.dLdw1[0][0])}`} color={BWD} bold />
            <Label x={X_IN + 79} y={Y_BOT - 8} text={`∂L/∂w₁₂ = ${num(b.dLdw1[0][1])}`} color={BWD} anchor="start" bold />
            <Label x={X_IN + 79} y={Y_TOP + 14} text={`∂L/∂w₂₁ = ${num(b.dLdw1[1][0])}`} color={BWD} anchor="start" bold />
            <Label x={(X_IN + X_HID) / 2} y={Y_BOT + 30} text={`∂L/∂w₂₂ = ${num(b.dLdw1[1][1])}`} color={BWD} bold />
          </>
        )}
        {/* W0 weight labels: above the upper edge, below the lower one; gradients appear at step 9 */}
        <Label x={(X_HID + X_OUT) / 2 - 4} y={Y_TOP + 14} text={`w⁽⁰⁾₁ = ${num(w0[0], 1)}`} />
        <Label x={(X_HID + X_OUT) / 2 - 4} y={Y_BOT - 8} text={`w⁽⁰⁾₂ = ${num(w0[1], 1)}`} />
        {show(9) && (
          <>
            <Label x={(X_HID + X_OUT) / 2 - 4} y={Y_TOP} text={`∂L/∂w⁽⁰⁾₁ = ${num(b.dLdw0[0])}`} color={BWD} bold />
            <Label x={(X_HID + X_OUT) / 2 - 4} y={Y_BOT + 6} text={`∂L/∂w⁽⁰⁾₂ = ${num(b.dLdw0[1])}`} color={BWD} bold />
          </>
        )}
        {show(6) && <Label x={(X_OUT + X_LOSS) / 2} y={Y_MID - 10} text={`∂L/∂p = ${num(b.dLdp)}`} color={BWD} bold />}

        {/* input nodes */}
        {[0, 1].map((i) => {
          const cy = i === 0 ? Y_TOP : Y_BOT;
          return (
            <g key={`x${i}`}>
              <circle cx={X_IN} cy={cy} r={R} fill="#fff" stroke="#8e8d78" strokeWidth={1.4} />
              <text x={X_IN} y={cy + 4} fontSize={12.5} textAnchor="middle" fill={INK} className="mono">x{i === 0 ? "₁" : "₂"}</text>
              <text x={X_IN} y={cy + R + 16} fontSize={11.5} textAnchor="middle" fill={FWD} className="mono">{num(x[i], 1)}</text>
            </g>
          );
        })}

        {/* hidden nodes: forward values below, backward values above (same convention as the output node) */}
        {[0, 1].map((i) => {
          const cy = i === 0 ? Y_TOP : Y_BOT;
          const sub = i === 0 ? "₁" : "₂";
          return (
            <g key={`h${i}`}>
              <circle cx={X_HID} cy={cy} r={R} fill="#fff" stroke={nodeStroke("hidden")} strokeWidth={nodeWidth("hidden")} style={{ transition: "stroke .25s" }} />
              <text x={X_HID} y={cy + 4} fontSize={12.5} textAnchor="middle" fill={INK} className="mono">h{sub}</text>
              {show(1) && <text x={X_HID} y={cy + R + 16} fontSize={11.5} textAnchor="middle" fill={FWD} className="mono">a{sub} = {num(f.a[i], 2)}</text>}
              {show(2) && <text x={X_HID} y={cy + R + 30} fontSize={11.5} textAnchor="middle" fill={FWD} className="mono">z{sub} = {num(f.z[i])}</text>}
              {show(10) && <text x={X_HID} y={cy - R - 20} fontSize={11} textAnchor="middle" fill={BWD} fontWeight={600} className="mono">∂L/∂z{sub} = {num(b.dLdz[i])}</text>}
              {show(11) && <text x={X_HID} y={cy - R - 6} fontSize={11} textAnchor="middle" fill={BWD} fontWeight={600} className="mono">∂L/∂a{sub} = {num(b.dLda[i])}</text>}
            </g>
          );
        })}

        {/* output node */}
        <circle cx={X_OUT} cy={Y_MID} r={R} fill="#fff" stroke={nodeStroke("out")} strokeWidth={nodeWidth("out")} style={{ transition: "stroke .25s" }} />
        <text x={X_OUT} y={Y_MID + 4} fontSize={12.5} textAnchor="middle" fill={INK} className="mono">o</text>
        {show(3) && <text x={X_OUT} y={Y_MID + R + 16} fontSize={11.5} textAnchor="middle" fill={FWD} className="mono">s = {num(f.s)}</text>}
        {show(4) && <text x={X_OUT} y={Y_MID + R + 30} fontSize={11.5} textAnchor="middle" fill={FWD} className="mono">p = {num(f.p)}</text>}
        {show(7) && <text x={X_OUT} y={Y_MID - R - 20} fontSize={11} textAnchor="middle" fill={BWD} fontWeight={600} className="mono">∂p/∂s = {num(b.dpds)}</text>}
        {show(8) && <text x={X_OUT} y={Y_MID - R - 6} fontSize={11} textAnchor="middle" fill={BWD} fontWeight={600} className="mono">∂L/∂s = {num(b.dLds)}</text>}

        {/* loss node */}
        <rect x={X_LOSS - 26} y={Y_MID - 18} width={52} height={36} rx={6} fill="#fff" stroke={nodeStroke("loss")} strokeWidth={nodeWidth("loss")} style={{ transition: "stroke .25s" }} />
        <text x={X_LOSS} y={Y_MID + 4} fontSize={12.5} textAnchor="middle" fill={INK} className="mono">L</text>
        {show(5) && <text x={X_LOSS} y={Y_MID + 34} fontSize={11.5} textAnchor="middle" fill={FWD} className="mono">{num(f.loss)}</text>}
      </Figure>

      <div className="viz-panel" style={{ marginTop: 12 }}>
        <h5 className="nocase">{cur.title}</h5>
        <P>{cur.chain}</P>
        <P><span className="viz-mono" style={{ fontSize: 12.5 }}>{cur.numbers}</span></P>
      </div>

      <div className={`viz-narr${narrTone}`}>{cur.narr}</div>
    </VisualizationFrame>
  );
}
