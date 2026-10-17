"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Slider from "@/components/visualization/ml/primitives/Slider";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import { B2_RANGE, DEMO_INCEPTION, fmtShape, inceptionBlock, residualBlock, type BlockCost, type Shape3 } from "@/lib/ml/cnn";

// Page 4 of Deep Learning Blocks: one input map (192, 28, 28) goes through the
// four Inception branches; each keeps 28 × 28 and torch.cat joins them along
// the channel axis, so the output has Σ c_i channels. The ResNet tab sends the
// same input through y = x + f(x): the shape cannot change. Every number comes
// from lib/ml/cnn.ts.

const W = 720;
const H = 360;
const INK = "#3b4234";
const MUTED = "#76796f";
const LINE = "#e4dfcb";
const GREY = "#c9c4ad";
const BRANCH_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"];
const ROW_Y = [60, 140, 220, 300];
const MID_Y = 180;
const IN_X = 14;
const BOX_W = 56;
const BOX_H = 40;
const BRANCH_X = 334;
const CAT_X = 548;
const OUT_X = 600;

type Mode = "inception" | "resnet";
const MODES: { key: Mode; label: string }[] = [
  { key: "inception", label: "Inception：torch.cat" },
  { key: "resnet", label: "ResNet：x + f(x)" },
];

const slabs = (c: number) => Math.max(1, Math.min(8, Math.ceil(c / 24)));
const thousands = (n: number) => n.toLocaleString("en-US");
const short = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)} M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)} k` : String(n));

// A feature map drawn as a stack of offset slabs; more channels, more slabs.
function Slab({ x, y, c, color, label, sub, w = BOX_W, h = BOX_H }: { x: number; y: number; c: number; color: string; label?: string; sub?: string; w?: number; h?: number }) {
  const n = slabs(c);
  return (
    <g style={{ transition: "transform .25s" }}>
      {Array.from({ length: n }, (_, i) => {
        const k = n - 1 - i;
        return <rect key={i} x={x + k * 3} y={y - h / 2 - k * 3} width={w} height={h} rx={3} fill={color} fillOpacity={0.18 + (0.55 * (i + 1)) / n} stroke={color} strokeWidth={1} />;
      })}
      {label && <text x={x + w / 2} y={y - h / 2 - n * 3 - 6} fontSize={12} fontWeight={600} textAnchor="middle" fill={INK}>{label}</text>}
      {sub && <text x={x + w / 2} y={y + h / 2 + 15} fontSize={11.5} textAnchor="middle" fill={MUTED} className="mono">{sub}</text>}
    </g>
  );
}

const curve = (x0: number, y0: number, x1: number, y1: number) => `M${x0} ${y0} C${(x0 + x1) / 2} ${y0}, ${(x0 + x1) / 2} ${y1}, ${x1} ${y1}`;

export default function InceptionFigure() {
  const [mode, setMode] = useState<Mode>("inception");
  const [c2, setC2] = useState<number>(DEMO_INCEPTION.cfg.b2.out);
  const input: Shape3 = DEMO_INCEPTION.input;
  const block: BlockCost = mode === "inception" ? inceptionBlock(input, { ...DEMO_INCEPTION.cfg, b2: { ...DEMO_INCEPTION.cfg.b2, out: c2 } }) : residualBlock(input, c2);
  const out = block.out;
  const channelSum = block.branches.map((b) => b.outShape.c);
  const reset = () => {
    setMode("inception");
    setC2(DEMO_INCEPTION.cfg.b2.out);
  };

  const narr =
    mode === "inception"
      ? c2 < 32
        ? `3×3 分支只剩 ${c2} 个 channel，输出降到 ${fmtShape(out)}，参数 ${thousands(block.params)}；规则没变：四条分支各自保持 ${input.h} × ${input.w}，torch.cat([y1, y2, y3, y4], 1) 把 channel 数加起来 ${channelSum.join(" + ")} = ${out.c}。`
        : `四条分支各自保持 ${input.h} × ${input.w}，channel 数分别是 ${channelSum.join("、")}；forward 里 torch.cat([y1, y2, y3, y4], 1) 沿 channel 维拼起来，输出 ${fmtShape(out)}，channel 变多、空间尺寸不变。拖滑杆只改 3×3 分支的 c₂，输出 channel 数跟着变成 64 + c₂ + 32 + 32，参数量 ${thousands(block.params)}。拼接的前提是四个 H × W 一样，所以每条分支都用 same padding。`
      : `同一个输入走 ResNet：f(x) 里两层 3×3 卷积把 channel 从 ${input.c} 变到 ${c2} 再变回 ${input.c}，forward 返回 relu(f(x) + x)。相加要求 f(x) 和 x 形状完全一样，所以输出还是 ${fmtShape(out)}：滑杆怎么拖，输出形状都不动，只有参数量在变（${thousands(block.params)}）。Inception 用拼接让 channel 变多，ResNet 用相加让形状不变，这是两种 forward 的根本区别。`;

  return (
    <VisualizationFrame
      title="Inception：四条分支各算各的，再沿 channel 维拼起来"
      description="输入是一张 (C, H, W) = (192, 28, 28) 的特征图（GoogLeNet 的 inception 3a）。每一叠方块是一个特征图，叠得越厚 channel 越多；H × W 一路不变。切到 ResNet 看同一个输入走 x + f(x) 的样子。"
    >
      <div className="viz-row">
        <Tabs options={MODES} value={mode} onChange={setMode} ariaLabel="两种 forward" />
        <button type="button" className="viz-btn" onClick={reset}>重置</button>
      </div>
      <Slider
        label={mode === "inception" ? "3×3 分支的输出 channel 数 c₂" : "f(x) 中间层的 channel 数 c"}
        value={c2}
        min={B2_RANGE.min}
        max={B2_RANGE.max}
        step={B2_RANGE.step}
        onChange={setC2}
        display={String(c2)}
        id="inception-c2"
      />

      <Figure width={W} height={H} label={mode === "inception" ? `Inception：输入 ${fmtShape(input)}，四条分支 ${channelSum.join("、")} 个 channel，拼接后 ${fmtShape(out)}` : `ResNet：输入 ${fmtShape(input)}，f(x) 中间 ${c2} 个 channel，输出 ${fmtShape(out)}`} minWidth={600}>
        {/* input */}
        <Slab x={IN_X} y={MID_Y} c={input.c} color={GREY} label="x" sub={fmtShape(input)} />

        {mode === "inception" ? (
          <g>
            {block.branches.map((b, i) => {
              const y = ROW_Y[i];
              const color = BRANCH_COLORS[i];
              return (
                <g key={b.key}>
                  <path d={curve(IN_X + BOX_W + 24, MID_Y, 150, y)} fill="none" stroke={color} strokeWidth={1.4} opacity={0.7} />
                  <text x={156} y={y - 4} fontSize={12} fontWeight={600} fill={INK}>b{i + 1}：{b.label}</text>
                  <text x={156} y={y + 12} fontSize={11} fill={MUTED} className="mono">
                    {b.stages.map((s) => (s.params === 0 ? `${s.kernel}×${s.kernel} pool` : `${s.inC}→${s.outC}`)).join("，")}
                  </text>
                  <Slab x={BRANCH_X} y={y} c={b.outShape.c} color={color} sub={fmtShape(b.outShape)} h={32} />
                  <path d={curve(BRANCH_X + BOX_W + 24, y, CAT_X - 16, MID_Y)} fill="none" stroke={color} strokeWidth={1.4} opacity={0.7} style={{ transition: "d .25s" }} />
                </g>
              );
            })}
            {/* concat node */}
            <circle cx={CAT_X} cy={MID_Y} r={15} fill="#fff" stroke={INK} strokeWidth={1.4} />
            <text x={CAT_X} y={MID_Y + 4} fontSize={11} fontWeight={700} textAnchor="middle" fill={INK} className="mono">cat</text>
            <text x={CAT_X} y={MID_Y + 30} fontSize={10.5} textAnchor="middle" fill={MUTED} className="mono">dim = 1</text>
            <line x1={CAT_X + 15} y1={MID_Y} x2={OUT_X - 2} y2={MID_Y} stroke={INK} strokeWidth={1.4} />
            {/* output: one column segmented by branch, heights ∝ channels */}
            {(() => {
              const total = out.c;
              const colH = 240;
              let y = MID_Y - colH / 2;
              return (
                <g>
                  <text x={OUT_X + 30} y={MID_Y - colH / 2 - 10} fontSize={12} fontWeight={600} textAnchor="middle" fill={INK}>y</text>
                  {block.branches.map((b, i) => {
                    const h = (b.outShape.c / total) * colH;
                    const top = y;
                    y += h;
                    return (
                      <g key={b.key}>
                        <rect x={OUT_X} y={top} width={60} height={Math.max(h - 1, 1)} rx={2} fill={BRANCH_COLORS[i]} fillOpacity={0.75} style={{ transition: "y .25s, height .25s" }} />
                        {h >= 14 && <text x={OUT_X + 66} y={top + h / 2 + 4} fontSize={11} fill={BRANCH_COLORS[i]} className="mono" style={{ transition: "y .25s" }}>{b.outShape.c}</text>}
                      </g>
                    );
                  })}
                  <text x={OUT_X + 30} y={MID_Y + colH / 2 + 16} fontSize={11.5} textAnchor="middle" fill={MUTED} className="mono">{fmtShape(out)}</text>
                </g>
              );
            })()}
          </g>
        ) : (
          <g>
            {/* f(x): two 3×3 convs */}
            <path d={curve(IN_X + BOX_W + 24, MID_Y, 150, MID_Y)} fill="none" stroke={BRANCH_COLORS[1]} strokeWidth={1.4} opacity={0.7} />
            <text x={156} y={MID_Y - BOX_H / 2 - 34} fontSize={12} fontWeight={600} fill={INK}>f(x)：3×3 conv → 3×3 conv</text>
            <text x={156} y={MID_Y - BOX_H / 2 - 18} fontSize={11} fill={MUTED} className="mono">{block.branches[0].stages.map((s) => `${s.inC}→${s.outC}`).join("，")}</text>
            <Slab x={200} y={MID_Y} c={c2} color={BRANCH_COLORS[1]} sub={fmtShape({ c: c2, h: input.h, w: input.w })} />
            <line x1={200 + BOX_W + 26} y1={MID_Y} x2={BRANCH_X - 4} y2={MID_Y} stroke={BRANCH_COLORS[1]} strokeWidth={1.4} opacity={0.7} />
            <Slab x={BRANCH_X} y={MID_Y} c={input.c} color={BRANCH_COLORS[1]} sub={fmtShape(block.branches[0].outShape)} />
            <line x1={BRANCH_X + BOX_W + 26} y1={MID_Y} x2={CAT_X - 16} y2={MID_Y} stroke={BRANCH_COLORS[1]} strokeWidth={1.4} opacity={0.7} />
            {/* skip connection over the top */}
            <path d={`M${IN_X + BOX_W / 2 + 12} ${MID_Y - BOX_H / 2 - 30} C${IN_X + BOX_W / 2 + 12} 40, ${CAT_X} 40, ${CAT_X} ${MID_Y - 16}`} fill="none" stroke={GREY} strokeWidth={1.6} strokeDasharray="5 4" />
            <text x={(IN_X + CAT_X) / 2} y={34} fontSize={11.5} textAnchor="middle" fill={MUTED}>x 原样跳过去（跳线）</text>
            {/* add node */}
            <circle cx={CAT_X} cy={MID_Y} r={15} fill="#fff" stroke={INK} strokeWidth={1.4} />
            <text x={CAT_X} y={MID_Y + 5} fontSize={15} fontWeight={700} textAnchor="middle" fill={INK}>+</text>
            <text x={CAT_X} y={MID_Y + 30} fontSize={10.5} textAnchor="middle" fill={MUTED} className="mono">relu</text>
            <line x1={CAT_X + 15} y1={MID_Y} x2={OUT_X + 14} y2={MID_Y} stroke={INK} strokeWidth={1.4} />
            <Slab x={OUT_X + 20} y={MID_Y} c={out.c} color={GREY} label="y" sub={fmtShape(out)} />
            <text x={OUT_X + 50} y={MID_Y + BOX_H / 2 + 32} fontSize={11} textAnchor="middle" fill={MUTED}>和 x 一样大</text>
          </g>
        )}
        <line x1={14} y1={H - 10} x2={W - 14} y2={H - 10} stroke={LINE} />
      </Figure>

      <div className="viz-stat" style={{ marginTop: 12 }}>
        <div><small>输出形状 (C, H, W)</small><b>{fmtShape(out)}</b></div>
        <div><small>{mode === "inception" ? "输出 channel = Σ c_i" : "输出 channel = 输入 channel"}</small><b style={{ fontSize: 13 }}>{mode === "inception" ? `${channelSum.join(" + ")} = ${out.c}` : `${out.c} = ${input.c}`}</b></div>
        <div><small>参数量</small><b>{thousands(block.params)}<span className="delta">≈ {short(block.params)}</span></b></div>
        <div><small>乘加次数（一次 forward）</small><b>{short(block.macs)}</b></div>
      </div>

      <table className="viz-table" aria-label="每条分支的形状与代价">
        <thead>
          <tr><th>{mode === "inception" ? "分支" : "路径"}</th><th>层</th><th>输出</th><th className="num">参数</th><th className="num">乘加</th></tr>
        </thead>
        <tbody>
          {block.branches.map((b, i) => (
            <tr key={b.key}>
              <td><i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: BRANCH_COLORS[mode === "inception" ? i : 1], marginRight: 6, verticalAlign: -1 }} />{mode === "inception" ? `b${i + 1}` : "f(x)"}</td>
              <td className="viz-k">{b.stages.map((s) => `${s.label} ${s.inC}→${s.outC}`).join("，")}</td>
              <td className="viz-mono">{fmtShape(b.outShape)}</td>
              <td className="num">{thousands(b.params)}</td>
              <td className="num">{short(b.macs)}</td>
            </tr>
          ))}
          {mode === "resnet" && (
            <tr>
              <td><i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: GREY, marginRight: 6, verticalAlign: -1 }} />x（跳线）</td>
              <td className="viz-k">不经过任何层</td>
              <td className="viz-mono">{fmtShape(input)}</td>
              <td className="num">0</td>
              <td className="num">0</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="viz-legend">
        <span><i style={{ background: GREY }} />灰色：输入 x，以及 ResNet 里和它同形状的输出</span>
        {mode === "inception" && block.branches.map((b, i) => <span key={b.key}><i style={{ background: BRANCH_COLORS[i] }} />b{i + 1}：{b.label}</span>)}
        <span>每叠方块的厚度 ∝ channel 数，宽高都是 {input.h} × {input.w}</span>
      </div>

      <div className={`viz-narr${mode === "resnet" ? " is-warn" : ""}`}>{narr}</div>
    </VisualizationFrame>
  );
}
