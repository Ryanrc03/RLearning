"use client";

import { useState, type KeyboardEvent } from "react";
import { Arrow, Box, FlowChain, Legend, Markers, MsdFrame, P, type Tone } from "./kit";

// Figures of the ML System Design overview: the six-step framework (the module's
// navigation figure), the generic ML pipeline, and the modeling ladder.

type Step = {
  n: string;
  title: string;
  /** The title broken for the narrow boxes of the horizontal layout. */
  lines: string[];
  tone: Tone;
  anchor: string;
  question: string;
  output: string;
  chapters: string;
};

const STEPS: Step[] = [
  { n: "01", title: "Problem Framing", lines: ["Problem", "Framing"], tone: "dec", anchor: "step-1-problem-framing", question: "到底要优化什么，哪些条件不能破", output: "Business Objective、ML Objective、约束与规模", chapters: "Business Objective & ML Objective；Requirements & Constraints" },
  { n: "02", title: "High Level Design", lines: ["High Level", "Design"], tone: "enc", anchor: "step-2-high-level-design", question: "数据从哪来，预测怎样变成动作", output: "一张从事件到决策再到反馈的框图", chapters: "End-to-End ML Pipeline；Cascading Architecture" },
  { n: "03", title: "Data and Features", lines: ["Data and", "Features"], tone: "dyn", anchor: "step-3-data-and-features", question: "标签从哪来，推理时手里有什么信息", output: "训练数据来源、标签定义、特征清单", chapters: "Training Data & Label Engineering；Feature Engineering" },
  { n: "04", title: "Modeling", lines: ["Modeling"], tone: "enc", anchor: "step-4-modeling", question: "从最简单的 baseline 怎样一步步加复杂度", output: "模型结构的演进路线、loss 与样本权重", chapters: "Model Architecture；Loss & Multi-task Learning" },
  { n: "05", title: "Inference and Evaluation", lines: ["Inference and", "Evaluation"], tone: "par", anchor: "step-5-inference-and-evaluation", question: "怎样在延迟和成本内跑起来，怎样知道它真的有用", output: "推理方式、离线指标、线上实验、校准", chapters: "Model Serving & Inference；Offline & Online Evaluation；Probability Calibration" },
  { n: "06", title: "Deep Dives", lines: ["Deep", "Dives"], tone: "att", anchor: "step-6-deep-dives", question: "这个案例最难、最值得展开的一两点是什么", output: "针对本案例的专题：漂移、偏差、冷启动等", chapters: "Sampling & Selection Bias；Feedback Loop & Data Drift" },
];

const FILL: Record<string, string> = { dec: P.decFill, enc: P.encFill, dyn: P.dynFill, par: P.parFill, att: P.attFill };
const STROKE: Record<string, string> = { dec: P.dec, enc: P.enc, dyn: P.dyn, par: P.par, att: P.att };

export function SixStepFigure() {
  const [sel, setSel] = useState(0);
  const step = STEPS[sel];

  const pick = (i: number) => ({
    role: "button" as const,
    tabIndex: 0,
    "aria-pressed": sel === i,
    "aria-label": `Step ${i + 1}：${STEPS[i].title}`,
    style: { cursor: "pointer" },
    onClick: () => setSel(i),
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setSel(i);
      }
    },
  });

  const wx = (i: number) => 12 + i * 116;
  const ny = (i: number) => 8 + i * 54;

  return (
    <MsdFrame
      title="图 1 · 六步框架：一次 ML System Design 的顺序"
      description="点一个阶段，看它要回答的问题和产出。前一步的结论是后一步的输入。"
      footnote={<>窄屏上这张图改为纵向排列，内容相同。</>}
    >
      <div className="viz-scroll msd-wide">
        <svg viewBox="0 0 700 96" role="group" aria-label="六步框架，横向排列" style={{ minWidth: 600 }}>
          <Markers id="six-w" />
          {STEPS.map((s, i) => (
            <g key={s.n}>
              <g {...pick(i)} opacity={sel === i ? 1 : 0.62} className="bah-fade">
                <rect x={wx(i)} y={16} width={98} height={64} rx={7} fill={FILL[s.tone]} stroke={STROKE[s.tone]} strokeWidth={sel === i ? 2.4 : 1.3} />
                <text x={wx(i) + 9} y={31} fontSize={9} fontWeight={600} fill={P.sub} className="mono">{s.n}</text>
                {s.lines.map((line, k) => (
                  <text key={line} x={wx(i) + 49} y={(s.lines.length === 1 ? 56 : 49) + k * 14} fontSize={10.5} fontWeight={600} textAnchor="middle" fill={P.ink}>{line}</text>
                ))}
              </g>
              {i < STEPS.length - 1 && <Arrow id="six-w" tone="neu" d={`M${wx(i) + 100} 48 H${wx(i + 1) - 3}`} />}
            </g>
          ))}
        </svg>
      </div>
      <div className="msd-narrow">
        <svg viewBox="0 0 300 326" role="group" aria-label="六步框架，纵向排列">
          <Markers id="six-n" />
          {STEPS.map((s, i) => (
            <g key={s.n}>
              <g {...pick(i)} opacity={sel === i ? 1 : 0.62} className="bah-fade">
                <rect x={20} y={ny(i)} width={260} height={40} rx={7} fill={FILL[s.tone]} stroke={STROKE[s.tone]} strokeWidth={sel === i ? 2.4 : 1.3} />
                <text x={34} y={ny(i) + 25} fontSize={11} fontWeight={600} fill={P.sub} className="mono">{s.n}</text>
                <text x={150} y={ny(i) + 25} fontSize={13} fontWeight={600} textAnchor="middle" fill={P.ink}>{s.title}</text>
              </g>
              {i < STEPS.length - 1 && <Arrow id="six-n" tone="neu" d={`M150 ${ny(i) + 42} V${ny(i + 1) - 3}`} />}
            </g>
          ))}
        </svg>
      </div>
      <div className="viz-narr" aria-live="polite">
        <b>Step {sel + 1} · {step.title}</b>：{step.question}。产出：{step.output}。规划中的章节：{step.chapters}。<a href={`#${step.anchor}`}>跳到本页这一步 ↓</a>
      </div>
    </MsdFrame>
  );
}

type Focus = "online" | "offline" | "feedback" | null;

const FOCUS_TEXT: Record<"none" | "online" | "offline" | "feedback", string> = {
  none: "上面一行是线上链路：每个事件或请求都要在延迟预算内走完。下面一行是离线链路：周期性地用日志和标签重训。两行靠三条竖线连起来：特征落盘、模型和 calibrator 上线、监控结果回流。",
  online: "线上链路里 Model Serving 只负责给出 raw score。分数先经过 Calibration 变成可以当概率读的数，再由 Decision Policy 按阈值决定动作。换阈值、换动作都不需要重训模型，所以 Model Prediction 和 Business Decision 是两个模块。",
  offline: "离线链路把落盘的特征和标签按时间对齐，训练模型，再在留出的数据上拟合 calibrator，两样东西一起发布。Offline Features 必须是事件发生当时的快照（point-in-time），否则训练时看到了线上看不到的信息。",
  feedback: "系统自己的决策会改变之后收集到的数据：被删除的帖子不再有曝光和举报，被降权的帖子行为变少。Monitoring 发现的漂移和人工审核的结果回流成新的标签，这条闭环既是系统变好的来源，也是 selection bias 的来源。",
};

export function MlPipelineFigure() {
  const [focus, setFocus] = useState<Focus>(null);
  const cx = (i: number) => 27 + i * 110;
  const dim = (...groups: Exclude<Focus, null>[]) => focus !== null && !groups.includes(focus);
  const bold = (...groups: Exclude<Focus, null>[]) => focus !== null && groups.includes(focus);
  const ID = "mlp";

  return (
    <MsdFrame
      title="图 2 · 通用 ML Pipeline：线上推理、离线训练和反馈闭环"
      description="三个按钮各强调一条链路，其余变淡。"
      footnote={<>通用示意。具体系统里每个方框可能是好几个服务，也可能合并在一个服务里。</>}
    >
      <div className="viz-controls" role="group" aria-label="强调一条链路">
        <button type="button" className={`viz-btn${focus === "online" ? " is-on" : ""}`} aria-pressed={focus === "online"} onClick={() => setFocus("online")}>线上推理</button>
        <button type="button" className={`viz-btn${focus === "offline" ? " is-on" : ""}`} aria-pressed={focus === "offline"} onClick={() => setFocus("offline")}>离线训练</button>
        <button type="button" className={`viz-btn${focus === "feedback" ? " is-on" : ""}`} aria-pressed={focus === "feedback"} onClick={() => setFocus("feedback")}>反馈闭环</button>
        <button type="button" className="viz-btn" onClick={() => setFocus(null)}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox="0 0 700 236" role="img" aria-label="通用 ML Pipeline：线上一行是 Event Collection、Feature Pipeline、Model Serving、Calibration、Decision Policy、Monitoring；离线一行是 Offline Features、Training Pipeline、Label Engineering、Logs 与 Labels" style={{ minWidth: 640 }}>
          <Markers id={ID} />
          <text x={27} y={30} fontSize={9.5} fontWeight={600} fill={P.sub}>ONLINE · 每个事件实时经过</text>
          <text x={27} y={228} fontSize={9.5} fontWeight={600} fill={P.sub}>OFFLINE · 周期性重训</text>

          <Box x={cx(0)} y={42} w={96} h={46} tone="neu" title="Event Collection" sub="曝光 / 点击 / 举报" size={9.5} dim={dim("online")} bold={bold("online")} />
          <Box x={cx(1)} y={42} w={96} h={46} tone="dyn" title="Feature Pipeline" sub="实时 + 离线特征" size={9.5} dim={dim("online", "offline")} bold={bold("online")} />
          <Box x={cx(2)} y={42} w={96} h={46} tone="enc" title="Model Serving" sub="raw score" size={9.5} dim={dim("online")} bold={bold("online")} />
          <Box x={cx(3)} y={42} w={96} h={46} tone="att" title="Calibration" sub="score → 概率" size={9.5} dim={dim("online")} bold={bold("online")} />
          <Box x={cx(4)} y={42} w={96} h={46} tone="dec" title="Decision Policy" sub="阈值 → 动作" size={9.5} dim={dim("online", "feedback")} bold={bold("online")} />
          <Box x={cx(5)} y={42} w={96} h={46} tone="par" title="Monitoring" sub="& Feedback" size={9.5} dim={dim("feedback")} bold={bold("feedback")} />
          {[0, 1, 2, 3].map((i) => <Arrow key={i} id={ID} tone="neu" d={`M${cx(i) + 98} 65 H${cx(i + 1) - 3}`} dim={dim("online")} bold={bold("online")} />)}
          <Arrow id={ID} tone="par" d={`M${cx(4) + 98} 65 H${cx(5) - 3}`} dim={dim("feedback")} bold={bold("feedback")} />

          <Box x={cx(1)} y={150} w={96} h={46} tone="dyn" title="Offline Features" sub="point-in-time 快照" size={9.5} dim={dim("offline")} bold={bold("offline")} />
          <Box x={cx(2)} y={150} w={206} h={46} tone="enc" title="Training Pipeline" sub="训练模型，再拟合 calibrator" size={9.5} dim={dim("offline")} bold={bold("offline")} />
          <Box x={cx(4)} y={150} w={96} h={46} tone="dyn" title="Label Engineering" sub="人工 + 弱标签" size={9.5} dim={dim("offline", "feedback")} bold={bold("offline")} />
          <Box x={cx(5)} y={150} w={96} h={46} tone="dyn" title="Logs + Labels" sub="日志、审核结果" size={9.5} dim={dim("offline", "feedback")} bold={bold("feedback")} />

          <Arrow id={ID} tone="dyn" d={`M${cx(1) + 48} 90 V147`} dim={dim("offline")} bold={bold("offline")} />
          <Arrow id={ID} tone="dyn" d={`M${cx(1) + 98} 173 H${cx(2) - 3}`} dim={dim("offline")} bold={bold("offline")} />
          <Arrow id={ID} tone="par" d={`M${cx(5) + 48} 90 V147`} dim={dim("feedback")} bold={bold("feedback")} />
          <Arrow id={ID} tone="dyn" d={`M${cx(5) - 2} 173 H${cx(4) + 99}`} dim={dim("offline", "feedback")} bold={bold("feedback")} />
          <Arrow id={ID} tone="dyn" d={`M${cx(4) - 2} 173 H${cx(2) + 209}`} dim={dim("offline", "feedback")} bold={bold("feedback")} />
          <Arrow id={ID} tone="enc" d={`M${cx(2) + 48} 148 V91`} dim={dim("offline")} bold={bold("offline")} />
          <Arrow id={ID} tone="att" d={`M${cx(3) + 48} 148 V91`} dim={dim("offline")} bold={bold("offline")} />
          <text x={cx(2) + 54} y={123} fontSize={9} fill={P.sub}>model</text>
          <text x={cx(3) + 54} y={123} fontSize={9} fill={P.sub}>calibrator</text>
          <text x={cx(1) + 54} y={123} fontSize={9} fill={P.sub}>落盘</text>
          <text x={cx(5) + 42} y={123} fontSize={9} textAnchor="end" fill={P.sub}>回流</text>
        </svg>
      </div>
      <Legend items={[{ tone: "neu", label: "事件输入" }, { tone: "dyn", label: "数据：特征、标签、日志" }, { tone: "enc", label: "模型" }, { tone: "att", label: "Calibration" }, { tone: "dec", label: "决策" }, { tone: "par", label: "监控与反馈" }]} />
      <div className={`viz-narr${focus === "online" ? " is-warn" : focus ? " is-good" : ""}`} aria-live="polite">{FOCUS_TEXT[focus ?? "none"]}</div>
    </MsdFrame>
  );
}

const LADDER = [
  { title: "Simple Baseline", sub: "LR / GBDT，少量特征", tone: "neu" as Tone, text: "先有一个能跑通全链路的模型。它给出指标的下限，也让数据、标签和评估里的问题尽早暴露。" },
  { title: "Feature Fusion", sub: "embedding 拼接 + MLP", tone: "dyn" as Tone, text: "把更多信号接进来：文本、图像的 embedding，行为和作者特征。很多时候这一步的收益比换模型结构更大。" },
  { title: "Advanced Architecture", sub: "Transformer / GNN", tone: "enc" as Tone, text: "当瓶颈确实在表达能力上（例如图文必须一起看才能判断），再换更强的结构，并为它付出延迟和成本。" },
  { title: "Multi-task Learning", sub: "共享 backbone + 多个 head", tone: "dec" as Tone, text: "主任务标签稀缺时，用相关任务的大量弱标签一起训练共享表示，同时得到业务需要的多个输出。" },
];

export function ModelLadderFigure() {
  const [sel, setSel] = useState<number | null>(null);
  return (
    <MsdFrame title="图 3 · Modeling 的演进顺序" description="每一级都要能说出上一级的瓶颈在哪里。点一级看它解决什么。">
      <div className="viz-controls" role="group" aria-label="选择一级">
        {LADDER.map((s, i) => (
          <button key={s.title} type="button" className={`viz-btn${sel === i ? " is-on" : ""}`} aria-pressed={sel === i} onClick={() => setSel(i)}>{i + 1}. {s.title}</button>
        ))}
        <button type="button" className="viz-btn" onClick={() => setSel(null)}>重置</button>
      </div>
      <FlowChain id="lad" steps={LADDER} perRow={4} label="Simple Baseline、Feature Fusion、Advanced Architecture、Multi-task Learning 四级演进" active={sel} />
      <div className="viz-narr" aria-live="polite">
        {sel === null ? "不要一开始就默认用最复杂的 Transformer 或 LLM。从左往右走，每加一级复杂度，都对应一个在上一级观察到的具体问题。" : <><b>{LADDER[sel].title}</b>：{LADDER[sel].text}</>}
      </div>
    </MsdFrame>
  );
}
