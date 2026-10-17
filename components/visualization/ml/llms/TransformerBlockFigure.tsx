"use client";

import { useMemo, useState, type ReactNode } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Curve from "@/components/visualization/ml/primitives/Curve";
import Figure from "@/components/visualization/ml/primitives/Figure";
import Plot from "@/components/visualization/ml/primitives/Plot";
import StepPlayer from "@/components/visualization/ml/primitives/StepPlayer";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import { applyBlockDemo, blockShapes, DEMO_D_FF, DEMO_D_MODEL, DEMO_POS, learnedPositionsInit, shapeText, sinusoidalPositions } from "@/lib/ml/transformer";

// Page 5 of LLMs: one decoder layer drawn bottom-up like the paper. The step
// player sends one token (「吃」, the last of 「我 想 吃」) through embedding +
// position, masked attention, add & LayerNorm, MLP, add & LayerNorm; the
// panel prints the 4-dimensional vector before and after each block. The tabs
// swap the positional table (sinusoidal / learned) that step 1 adds.

type PeMode = "sin" | "learned";
type Hot = "embed" | "attn" | "ln1" | "mlp" | "ln2" | "out";

const PE_MODES: { key: PeMode; label: string }[] = [
  { key: "sin", label: "sinusoidal" },
  { key: "learned", label: "learned" },
];

const W = 460;
const H = 380;
const PW = 720;
const PH = 180;
const T_PLOT = 16;
const BX = 68;
const BW = 184;
const CX = BX + BW / 2;
const RAIL = 40;
const LABEL_X = CX + 10;
const SIDE_X = BX + BW + 12;
const V1 = "#2a78d6";
const V2 = "#eb6834";
const V3 = "#1baf7a";
const V4 = "#eda100";
const INK = "#3b4234";
const MUTED = "#76796f";
const LINE = "#c9c4ad";
const HOT_FILL = "#eaf3fd";
const DIM_COLORS = [V1, V2, V3, V4];

const BOXES: { key: Hot; y: number; h: number; label: string; sub?: string }[] = [
  { key: "embed", y: 322, h: 30, label: "Embedding + Position" },
  { key: "attn", y: 258, h: 42, label: "Masked Multi-Head Attention", sub: "h 个 head，各有自己的 Q K V" },
  { key: "ln1", y: 196, h: 28, label: "Add & LayerNorm" },
  { key: "mlp", y: 134, h: 34, label: "MLP（每个位置各自过）" },
  { key: "ln2", y: 72, h: 28, label: "Add & LayerNorm" },
];

const num = (v: number, digits = 2) => v.toFixed(digits).replace("-", "−");
const vec = (xs: number[], digits = 2) => `(${xs.map((x) => num(x, digits)).join(", ")})`;

const P = ({ children }: { children: ReactNode }) => <p style={{ margin: "4px 0 0", fontSize: 12.5, lineHeight: 1.7 }}>{children}</p>;
const M = ({ children }: { children: ReactNode }) => <span className="viz-mono" style={{ fontSize: 12.5 }}>{children}</span>;

type Step = { hot: Hot; title: string; body: ReactNode; shapes: string[]; narr: string; tone?: "warn" | "good" };

export default function TransformerBlockFigure() {
  const [step, setStep] = useState(0);
  const [pe, setPe] = useState<PeMode>("sin");
  const table = useMemo(() => (pe === "sin" ? sinusoidalPositions(T_PLOT, DEMO_D_MODEL) : learnedPositionsInit(T_PLOT, DEMO_D_MODEL)), [pe]);
  const d = useMemo(() => applyBlockDemo(table), [table]);
  const shapes = useMemo(() => blockShapes(2, 8, 512, 8, 2048), []);
  const edge = (k: string) => shapes.edges.find((e) => e.key === k)!;
  const line = (k: string) => `${edge(k).label}：${edge(k).symbolic} = ${shapeText(edge(k).shape)}`;
  const ctx = ["我", "想", "吃"];

  const steps: Step[] = [
    {
      hot: "embed",
      title: "① token id → embedding",
      body: (
        <>
          句子「我 想 吃」有 T = 3 个位置，跟着第 {DEMO_POS + 1} 个 token「吃」走。查 embedding 表得到 d_model = {DEMO_D_MODEL} 维的向量（真实模型是 512 维或更大，这里用 4 维好把数全写出来）。
          <br />
          <M>e = {vec(d.e)}</M>
        </>
      ),
      shapes: [line("tokens"), line("embed")],
      narr: "一个 token id 先查 embedding 表，变成 d_model 维的向量。到这里它还不知道自己在句子里的第几个位置。",
    },
    {
      hot: "embed",
      title: "② 加上 position",
      body: (
        <>
          {pe === "sin" ? "sinusoidal 表第 2 行（位置从 0 数）：偶数维是 sin(pos / 10000^(2i/d))，奇数维是 cos。" : "可学习的位置表第 2 行：它是一个 (T_max, d_model) 的参数矩阵，训练前只是随机初始化。"}
          <br />
          <M>pe₂ = {vec(d.pe)}</M>
          <br />
          <M>x₀ = e + pe₂ = {vec(d.x0)}</M>
        </>
      ),
      shapes: [line("embed")],
      narr:
        pe === "sin"
          ? "加上第 2 个位置的 sin / cos 向量：同一个词放在不同位置会得到不同的 x₀，attention 才分得清先后。这张表不用学，任意长度都能算。"
          : "换成可学习的位置表：训练前它只是随机数，训练后每一行才有意义，而且只有 T_max 行，比训练时更长的句子没有位置向量可查。",
    },
    {
      hot: "attn",
      title: "③ masked multi-head attention",
      body: (
        <>
          演示里 W_Q = W_K = W_V 取单位阵，所以 Q = K = V = x。「吃」的 q 对三个位置的 k 打分 s = q·k / √{DEMO_D_MODEL}，未来位置在 softmax 前被 mask 成 −∞（「吃」是最后一个，没有未来）。
          <br />
          <M>s = ({d.scores.map((s) => (Number.isFinite(s) ? num(s) : "−∞")).join(", ")})</M>
          <br />
          <M>a = softmax(s) = {vec(d.attn)}</M>　对 {ctx.join("、")}
          <br />
          <M>Δ = Σ aⱼ vⱼ = {vec(d.delta)}</M>
        </>
      ),
      shapes: [line("qkv"), line("weights"), line("attn")],
      narr: `attention 把别的位置带过来：「吃」给自己 a = ${num(d.attn[2])}，给「我」${num(d.attn[0])}，给「想」${num(d.attn[1])}；Δ 就是三个 v 按这个比例的加权和。多个 head 各算一份再拼回 d_model 维。`,
    },
    {
      hot: "ln1",
      title: "④ add & LayerNorm",
      body: (
        <>
          residual 先把 Δ 加回 x₀，再对这 4 个数做 LayerNorm：μ 和 σ 只从这一个 token 自己的 4 维算（γ = 1、β = 0、ε = 10⁻⁵）。
          <br />
          <M>x₁ = x₀ + Δ = {vec(d.x1)}</M>
          <br />
          <M>μ = {num(d.ln1.mu, 3)}，σ = {num(d.ln1.sigma, 3)}</M>
          <br />
          <M>LN(x₁) = (x₁ − μ) / σ = {vec(d.ln1.out)}</M>
        </>
      ),
      shapes: [line("ln1")],
      narr: `LayerNorm 的 μ = ${num(d.ln1.mu, 2)}、σ = ${num(d.ln1.sigma, 2)} 只从「吃」自己的 4 个数算，和 batch 里别的句子、别的位置无关；句子长短不一、推理时一次只来一个 token 都不影响。BatchNorm 要沿 batch 轴统计，不同句子的同一个位置本来就没关系。`,
      tone: "warn",
    },
    {
      hot: "mlp",
      title: "⑤ MLP（feed-forward）",
      body: (
        <>
          每个位置单独过一个两层网络：{DEMO_D_MODEL} → {DEMO_D_FF} → {DEMO_D_MODEL}，中间 ReLU（真实模型 d_ff = 4 × d_model）。
          <br />
          <M>h = ReLU(W₁ · LN(x₁)) = {vec(d.hidden)}</M>
          <br />
          <M>m = W₂ h = {vec(d.mlp)}</M>
        </>
      ),
      shapes: [line("hidden"), line("mlp")],
      narr: `MLP 不看别的 token，只把这一个位置的向量升到 d_ff = ${DEMO_D_FF} 维再降回来；ReLU 把 ${d.hidden.filter((h) => h === 0).length} 个隐层单元关成 0。看别的 token 是 attention 的事，MLP 负责在每个位置上把信息加工一下。`,
    },
    {
      hot: "ln2",
      title: "⑥ add & LayerNorm",
      body: (
        <>
          再加一次 residual，再做一次 LayerNorm。
          <br />
          <M>x₂ = LN(x₁) + m = {vec(d.x2)}</M>
          <br />
          <M>μ = {num(d.ln2.mu, 3)}，σ = {num(d.ln2.sigma, 3)}</M>
          <br />
          <M>LN(x₂) = {vec(d.ln2.out)}</M>
        </>
      ),
      shapes: [line("ln2")],
      narr: `第二条 residual 把 MLP 的输出加回来，LayerNorm 再把向量拉回均值 0、方差 1。进来是 4 维，出去还是 4 维：${vec(d.ln2.out)}。`,
    },
    {
      hot: "out",
      title: "⑦ 送往下一层",
      body: (
        <>
          输出形状和输入一样，所以同样的一层可以原样叠 N 次（原论文 6 层，GPT-3 96 层）。最后一层之后接一个线性层 + softmax，给出下一个 token 的分布。
          <br />
          <M>输出 = {vec(d.ln2.out)}</M>
        </>
      ),
      shapes: shapes.edges.map((e) => `${e.label}：${e.symbolic} = ${shapeText(e.shape)}`),
      narr: "进来 (B, T, d_model)，出去 (B, T, d_model)：形状不变是整层设计的关键，层和层才能直接叠起来。右边的表是这一层里每条边的形状，用的是原论文的 d_model = 512、h = 8、d_ff = 2048。",
      tone: "good",
    },
  ];

  const cur = steps[step];
  const total = steps.length;
  const order: Hot[] = ["embed", "embed", "attn", "ln1", "mlp", "ln2", "out"];
  const visited = (k: Hot) => order.indexOf(k) < step;
  const boxStyle = (k: Hot) => ({
    fill: cur.hot === k ? HOT_FILL : "#fff",
    stroke: cur.hot === k ? V1 : visited(k) ? INK : LINE,
    strokeWidth: cur.hot === k ? 2.2 : 1.2,
    transition: "fill .25s, stroke .25s",
  });
  const edgeColor = (k: Hot) => (cur.hot === k ? V1 : visited(k) ? INK : LINE);
  const box = (k: Hot) => BOXES.find((b) => b.key === k)!;
  const top = (k: Hot) => box(k).y - box(k).h / 2;
  const bottom = (k: Hot) => box(k).y + box(k).h / 2;

  const reset = () => {
    setStep(0);
    setPe("sin");
  };
  const caption = `第 ${step + 1} 步 / 共 ${total} 步 · ${cur.title}`;
  const legend = pe === "sin" ? ["dim 0 = sin(pos)", "dim 1 = cos(pos)", "dim 2 = sin(pos / 100)", "dim 3 = cos(pos / 100)"] : ["dim 0", "dim 1", "dim 2", "dim 3"].map((s) => `${s}（随机初始化的参数）`);

  return (
    <VisualizationFrame
      title="Transformer Block：一个 token 穿过一层"
      description="从下往上读：embedding 加 position，masked multi-head attention，add & LayerNorm，MLP，再一次 add & LayerNorm。左边高亮的是这一步在哪个块，边上是张量形状；右边把一个 d_model = 4 的 token 向量在每个块前后的数全部写出来。"
    >
      <StepPlayer step={step} total={total} onStep={setStep} onReset={reset} intervalMs={1800} caption={caption} />

      <div className="viz-grid2 wide-left">
        <Figure width={W} height={H} label={`一层 decoder 的方块图，当前 ${cur.title}`} minWidth={400}>
          <defs>
            <marker id="tb-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0 0 L8 4 L0 8 z" fill={INK} />
            </marker>
          </defs>

          {/* token ids in, output out */}
          <text x={CX} y={368} fontSize={11.5} textAnchor="middle" fill={INK} className="mono">token id {edge("tokens").symbolic}</text>
          <line x1={CX} y1={356} x2={CX} y2={bottom("embed") + 1} stroke={edgeColor("embed")} strokeWidth={1.4} markerEnd="url(#tb-arrow)" />
          <line x1={CX} y1={top("ln2")} x2={CX} y2={38} stroke={edgeColor("out")} strokeWidth={cur.hot === "out" ? 2.2 : 1.4} markerEnd="url(#tb-arrow)" />
          <text x={CX} y={26} fontSize={12} fontWeight={600} textAnchor="middle" fill={cur.hot === "out" ? V1 : INK}>→ 下一层（同样的一层叠 N 次）</text>
          <text x={LABEL_X} y={50} fontSize={11} fill={cur.hot === "out" ? V1 : MUTED} className="mono">{edge("out").symbolic}</text>

          {/* vertical edges between boxes with their shapes */}
          {(
            [
              ["embed", "attn", edge("embed").symbolic],
              ["attn", "ln1", edge("attn").symbolic],
              ["ln1", "mlp", edge("ln1").symbolic],
              ["mlp", "ln2", edge("mlp").symbolic],
            ] as [Hot, Hot, string][]
          ).map(([from, to, label]) => {
            const y1 = top(from);
            const y2 = bottom(to) + 1;
            const hot = cur.hot === to || cur.hot === from;
            return (
              <g key={`${from}-${to}`}>
                <line x1={CX} y1={y1} x2={CX} y2={y2} stroke={hot ? V1 : visited(to) ? INK : LINE} strokeWidth={hot ? 2 : 1.4} markerEnd="url(#tb-arrow)" style={{ transition: "stroke .25s" }} />
                <text x={LABEL_X} y={(y1 + y2) / 2 + 4} fontSize={11} fill={hot ? V1 : MUTED} className="mono">{label}</text>
              </g>
            );
          })}

          {/* residual rails: around attention into LN1, around the MLP into LN2 */}
          {(
            [
              ["attn", "ln1", (top("embed") + bottom("attn")) / 2],
              ["mlp", "ln2", (top("ln1") + bottom("mlp")) / 2],
            ] as [Hot, Hot, number][]
          ).map(([around, into, yFrom]) => {
            const hot = cur.hot === into;
            const c = hot ? V1 : visited(into) ? INK : LINE;
            return (
              <g key={`res-${around}`}>
                <path d={`M${CX} ${yFrom} H${RAIL} V${box(into).y} H${BX - 1}`} fill="none" stroke={c} strokeWidth={hot ? 2 : 1.4} strokeDasharray="5 3" markerEnd="url(#tb-arrow)" style={{ transition: "stroke .25s" }} />
                <text x={RAIL - 4} y={(yFrom + box(into).y) / 2 + 4} fontSize={10.5} textAnchor="end" fill={hot ? V1 : MUTED} transform={`rotate(-90 ${RAIL - 4} ${(yFrom + box(into).y) / 2 + 4})`}>residual</text>
              </g>
            );
          })}

          {/* the five boxes */}
          {BOXES.map((b) => (
            <g key={b.key}>
              <rect x={BX} y={b.y - b.h / 2} width={BW} height={b.h} rx={6} style={boxStyle(b.key)} />
              <text x={CX} y={b.y + (b.sub ? -1 : 4)} fontSize={12} fontWeight={600} textAnchor="middle" fill={cur.hot === b.key ? V1 : INK}>{b.label}</text>
              {b.sub && <text x={CX} y={b.y + 13} fontSize={10.5} textAnchor="middle" fill={MUTED}>{b.sub}</text>}
            </g>
          ))}

          {/* mask glyph inside the attention box: lower triangle readable, upper −∞ */}
          <g transform={`translate(${BX + BW - 30} ${box("attn").y - 13})`}>
            {[0, 1, 2, 3].map((i) =>
              [0, 1, 2, 3].map((j) => <rect key={`${i}${j}`} x={j * 6} y={i * 6} width={5} height={5} rx={1} fill={j <= i ? (cur.hot === "attn" ? V1 : INK) : "#fff"} stroke={LINE} strokeWidth={0.5} opacity={j <= i ? 0.8 : 1} />),
            )}
          </g>

          {/* side notes: tensors that live inside a block */}
          <text x={SIDE_X} y={box("attn").y - 8} fontSize={10.5} fill={cur.hot === "attn" ? V1 : MUTED} className="mono">每个 head 的 Q K V {edge("qkv").symbolic}</text>
          <text x={SIDE_X} y={box("attn").y + 6} fontSize={10.5} fill={cur.hot === "attn" ? V1 : MUTED} className="mono">权重 {edge("weights").symbolic}</text>
          <text x={SIDE_X} y={box("attn").y + 20} fontSize={10.5} fill={cur.hot === "attn" ? V1 : MUTED}>右下角：causal mask，上三角 −∞</text>
          <text x={SIDE_X} y={box("mlp").y + 4} fontSize={10.5} fill={cur.hot === "mlp" ? V1 : MUTED} className="mono">隐层 {edge("hidden").symbolic}</text>
          <text x={SIDE_X} y={box("ln1").y + 4} fontSize={10.5} fill={cur.hot === "ln1" ? V1 : MUTED}>每个 token 自己的 d_model 维算 μ、σ</text>
          <text x={SIDE_X} y={box("ln2").y + 4} fontSize={10.5} fill={cur.hot === "ln2" ? V1 : MUTED}>同上，γ、β 是另一套</text>
        </Figure>

        <div className="viz-panel">
          <h5 className="nocase">{cur.title}</h5>
          <P>{cur.body}</P>
          <table className="viz-table" style={{ marginTop: 8 }} aria-label="这一步的张量形状">
            <thead>
              <tr>
                <th>这一步的形状</th>
              </tr>
            </thead>
            <tbody>
              {cur.shapes.map((s) => (
                <tr key={s}>
                  <td className="num" style={{ textAlign: "left", fontSize: 11.5 }}>{s}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="viz-row" style={{ marginTop: 14, marginBottom: 8 }}>
        <span className="viz-k">position 用哪张表</span>
        <Tabs options={PE_MODES} value={pe} onChange={setPe} ariaLabel="位置编码" />
        <span className="viz-k">改这里，第 ② 步之后的数都会跟着变</span>
      </div>
      <Figure width={PW} height={PH} label={`${pe === "sin" ? "sinusoidal" : "learned"} 位置编码，位置 0 到 15 的 4 个维度`} minWidth={520}>
        <Plot box={{ x: 0, y: 0, w: PW, h: PH }} xDomain={[0, T_PLOT - 1]} yDomain={[-1.2, 1.2]} xTicks={[0, 5, 10, 15]} yTicks={[-1, 0, 1]} xLabel="位置 pos" title={pe === "sin" ? "PE[pos, i]：偶数维 sin、奇数维 cos，频率随 i 变低（d_model = 4）" : "可学习的位置表：训练前每一行都是随机数（d_model = 4，seed 固定）"} format={(v) => String(Math.round(v * 10) / 10)}>
          {(f) => (
            <>
              {DIM_COLORS.map((c, j) => (
                <Curve key={j} frame={f} points={table.map((row, pos) => [pos, row[j]] as [number, number])} color={c} width={j < 2 ? 2 : 1.6} dashed={j >= 2} />
              ))}
              {pe === "learned" && table.map((row, pos) => row.map((v, j) => <circle key={`${pos}-${j}`} cx={f.x(pos)} cy={f.y(v)} r={2.2} fill={DIM_COLORS[j]} />))}
              {/* the row step ② reads */}
              <line x1={f.x(DEMO_POS)} y1={f.y1} x2={f.x(DEMO_POS)} y2={f.y0} stroke={INK} strokeWidth={1} strokeDasharray="3 3" />
              <text x={f.x(DEMO_POS) + 4} y={f.y1 + 12} fontSize={11} fill={INK}>pos = {DEMO_POS}，第 ② 步读的这一行</text>
            </>
          )}
        </Plot>
      </Figure>
      <div className="viz-legend">
        {legend.map((l, j) => (
          <span key={l}><i style={{ background: DIM_COLORS[j] }} />{l}</span>
        ))}
      </div>

      <div className={`viz-narr${cur.tone === "warn" ? " is-warn" : cur.tone === "good" ? " is-good" : ""}`}>{cur.narr}</div>
    </VisualizationFrame>
  );
}
