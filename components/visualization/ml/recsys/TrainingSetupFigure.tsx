"use client";

import { type ReactNode, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
import StepPlayer from "@/components/visualization/ml/primitives/StepPlayer";
import {
  BATCH,
  BOTTOM,
  bestCheckpoint,
  EMB_DIM,
  EPOCHS,
  EVALS_PER_EPOCH,
  EXAMPLE,
  exampleLosses,
  logitGrad,
  LR,
  N_DENSE,
  N_FIELDS,
  norm,
  paramCounts,
  stepsPerEpoch,
  TABLE_NORMS,
  TASKS,
  TOWER,
  touchedEmbedding,
  VALID_CURVE,
  x0Dim,
} from "@/lib/ml/trainingSetup";

// Recommender Systems: one real KuaiRand row walked through a training step of
// the shared-bottom multi-task model — encode, look up, concatenate, forward,
// loss, backward, update — and then the outer loop that picks the weights.

const STAGES = [
  { name: "一行日志", sub: "原始特征和 4 个标签" },
  { name: "编码", sub: "类别 → 编号，数值 → 标准化" },
  { name: "查 embedding 表", sub: "每个编号取出一行 16 维" },
  { name: "拼成 x0", sub: `${N_FIELDS}×${EMB_DIM} + ${N_DENSE} = ${x0Dim()} 维` },
  { name: "前向", sub: "共享 bottom → 4 个塔 → 4 个概率" },
  { name: "损失", sub: "4 个 BCE 相加" },
  { name: "反向 + Adam", sub: "谁拿到梯度、谁被更新" },
  { name: "外层循环", sub: "batch、epoch、挑 checkpoint" },
];

const fmt = (x: number) => x.toLocaleString("en-US");
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

function VectorBars({ values, color, max = 0.26 }: { values: readonly number[]; color: string; max?: number }) {
  const w = 16;
  const h = 46;
  return (
    <svg viewBox={`0 0 ${values.length * w} ${h * 2}`} style={{ width: "100%", maxWidth: 320, height: 64 }} role="img" aria-label="16 维向量">
      <line x1={0} y1={h} x2={values.length * w} y2={h} stroke="#c9c4ad" />
      {values.map((v, i) => {
        const len = (Math.min(Math.abs(v), max) / max) * (h - 4);
        return <rect key={i} x={i * w + 3} y={v >= 0 ? h - len : h} width={w - 6} height={Math.max(len, 0.5)} rx={1.5} fill={color} style={{ transition: "y .3s, height .3s" }} />;
      })}
    </svg>
  );
}

function CurvePlot() {
  const W = 420;
  const H = 150;
  const [x0, x1, y0, y1] = [40, W - 12, H - 26, 14];
  const [lo, hi] = [0.703, 0.7125];
  const sx = (e: number) => x0 + (e / EPOCHS) * (x1 - x0);
  const sy = (v: number) => y0 - ((v - lo) / (hi - lo)) * (y0 - y1);
  const best = bestCheckpoint();
  return (
    <Figure width={W} height={H} label={`valid GAUC 曲线，最好在 epoch ${best.epoch}`}>
      {[0.704, 0.708, 0.712].map((t) => (
        <g key={t}>
          <line x1={x0} y1={sy(t)} x2={x1} y2={sy(t)} stroke="#e4dfcb" />
          <text x={x0 - 5} y={sy(t) + 4} fontSize={10.5} textAnchor="end" fill="#76796f">{t.toFixed(3)}</text>
        </g>
      ))}
      {[1, 2, 3].map((e) => (
        <text key={e} x={sx(e)} y={H - 8} fontSize={10.5} textAnchor="middle" fill="#76796f">epoch {e}</text>
      ))}
      <polyline points={VALID_CURVE.map(([e, g]) => `${sx(e)},${sy(g)}`).join(" ")} fill="none" stroke="var(--v1)" strokeWidth={1.8} />
      {VALID_CURVE.map(([e, g]) => (
        <circle key={e} cx={sx(e)} cy={sy(g)} r={e === best.epoch ? 5 : 3} fill={e === best.epoch ? "var(--v4)" : "var(--v1)"} stroke="#fff" strokeWidth={1.2} />
      ))}
      <text x={sx(best.epoch)} y={sy(best.gauc) - 9} fontSize={11} textAnchor="middle" fill="#3b4234" fontWeight={600}>保留这一份</text>
    </Figure>
  );
}

export default function TrainingSetupFigure({ initialStep = 0 }: { initialStep?: number }) {
  const [step, setStep] = useState(initialStep);
  const losses = exampleLosses();
  const params = paramCounts();
  const touched = touchedEmbedding();
  const best = bestCheckpoint();
  const spe = stepsPerEpoch();

  let body: ReactNode = null;
  let narr = "";
  let tone = "";

  if (step === 0) {
    body = (
      <div className="viz-grid2">
        <div className="viz-panel">
          <h5>类别特征（27 个里的 6 个）</h5>
          <table className="viz-table"><tbody>
            {EXAMPLE.categorical.map((c) => <tr key={c.field}><td className="viz-mono">{c.field}</td><td className="num">{c.raw}</td></tr>)}
          </tbody></table>
        </div>
        <div className="viz-panel">
          <h5>数值特征（61 个里的 5 个）和标签</h5>
          <table className="viz-table"><tbody>
            {EXAMPLE.dense.map((d) => <tr key={d.field}><td className="viz-mono">{d.field}</td><td className="num">{d.raw < 10 ? d.raw : fmt(d.raw)}</td></tr>)}
            <tr><td>标签 点开 / 长播 / 点赞 / 关注</td><td className="num"><b>{EXAMPLE.labels.join(" / ")}</b></td></tr>
          </tbody></table>
        </div>
      </div>
    );
    narr = "train 里的一行真实曝光：用户 114，周六 17 点，tab 1。他点开了、看完了、点了赞，没关注。模型要从左边这些特征，同时预测右下角这 4 个 0/1。";
  } else if (step === 1) {
    body = (
      <div className="viz-grid2">
        <div className="viz-panel">
          <h5>类别值 → 编号（查 train 的词表）</h5>
          <table className="viz-table"><thead><tr><th>域</th><th className="num">原始值</th><th className="num">编号</th><th className="num">表有几行</th></tr></thead><tbody>
            {EXAMPLE.categorical.map((c) => <tr key={c.field}><td className="viz-mono">{c.field}</td><td className="num">{c.raw}</td><td className="num"><b>{c.index}</b></td><td className="num">{c.rows}</td></tr>)}
          </tbody></table>
        </div>
        <div className="viz-panel">
          <h5>数值 → 标准化（固定变换，不学）</h5>
          <table className="viz-table"><thead><tr><th>列</th><th className="num">原始</th><th className="num">进模型</th></tr></thead><tbody>
            {EXAMPLE.dense.map((d) => <tr key={d.field}><td className="viz-mono">{d.field}{d.log1p ? " ·log1p" : ""}</td><td className="num">{d.raw < 10 ? d.raw : fmt(d.raw)}</td><td className="num"><b>{d.z.toFixed(3)}</b></td></tr>)}
          </tbody></table>
        </div>
      </div>
    );
    narr = "编号只是身份证号：onehot_feat3 = 1153 编成 321，并不比 tab 编成的 2「大」。编号 0 留给缺失和 train 里没见过的值。数值列先取 log1p（计数类）再用 train 的均值、方差标准化，这一步的参数是算出来的，训练时不变。";
  } else if (step === 2) {
    body = (
      <div className="viz-grid2 wide-left">
        <div className="viz-panel">
          <h5>每个域一张表，按编号取一行</h5>
          <table className="viz-table"><thead><tr><th>表</th><th className="num">形状</th><th className="num">取第几行</th></tr></thead><tbody>
            {EXAMPLE.categorical.map((c) => <tr key={c.field}><td className="viz-mono">{c.field}</td><td className="num">{c.rows} × {EMB_DIM}</td><td className="num">{c.index}</td></tr>)}
            <tr><td colSpan={3} style={{ color: "var(--muted)" }}>…一共 {N_FIELDS} 张表、{fmt(params.embedding)} 个数，全部是可学的参数</td></tr>
          </tbody></table>
        </div>
        <div className="viz-panel">
          <h5>tag_first = 12 → 第 13 行（训练后）</h5>
          <VectorBars values={EXAMPLE.tagRowTrained} color="var(--v1)" />
          <p className="viz-k">16 个数，长度 {norm(EXAMPLE.tagRowTrained).toFixed(3)}。训练开始时它只是 N(0, 0.01²) 的随机小数，长度 {norm(EXAMPLE.tagRowInit).toFixed(3)}。</p>
        </div>
      </div>
    );
    narr = "查表就是 one-hot 乘矩阵，只是不真的乘：直接取出那一行。这一行一开始没有任何含义，它变成右边这样，全靠后面的反向传播一步步推出来。";
  } else if (step === 3) {
    const embShare = (N_FIELDS * EMB_DIM) / x0Dim();
    body = (
      <div className="viz-panel">
        <h5>x0：{x0Dim()} 维</h5>
        <div className="viz-bar-track" style={{ height: 28, display: "flex" }}>
          <span style={{ width: `${embShare * 100}%`, background: "var(--v1)", borderRadius: "4px 0 0 4px" }} />
          <span style={{ width: `${(1 - embShare) * 100}%`, background: "var(--v4)", borderRadius: "0 4px 4px 0" }} />
        </div>
        <div className="viz-legend">
          <span><i style={{ background: "var(--v1)" }} />{N_FIELDS} 个域 × {EMB_DIM} 维 = {N_FIELDS * EMB_DIM} 个数，学出来的</span>
          <span><i style={{ background: "var(--v4)" }} />{N_DENSE} 个数值列，预处理好的</span>
        </div>
      </div>
    );
    narr = `27 个 16 维向量首尾拼接，再接上 61 个标准化后的数值，就是模型真正看到的输入 x0。${pct(embShare)} 的维度来自 embedding。一个 batch 是 ${fmt(BATCH)} 行，所以实际是一个 ${fmt(BATCH)} × ${x0Dim()} 的矩阵。`;
  } else if (step === 4) {
    body = (
      <div className="viz-grid2">
        <div className="viz-panel">
          <h5>网络</h5>
          <table className="viz-table"><tbody>
            <tr><td>共享 bottom</td><td className="num">{x0Dim()} → {BOTTOM.join(" → ")}</td><td className="num">{fmt(params.bottom)}</td></tr>
            <tr><td>每个塔</td><td className="num">{BOTTOM[BOTTOM.length - 1]} → {TOWER.join(" → ")} → 1</td><td className="num">{fmt(params.towers / TASKS.length)}</td></tr>
            <tr><td>embedding</td><td className="num">27 张表</td><td className="num">{fmt(params.embedding)}</td></tr>
            <tr><td><b>合计</b></td><td /><td className="num"><b>{fmt(params.total)}</b></td></tr>
          </tbody></table>
        </div>
        <div className="viz-panel">
          <h5>这一行的 4 个预测</h5>
          <div className="viz-bars">
            {TASKS.map((t, k) => (
              <div key={t.key} className="viz-bar-row" style={{ gridTemplateColumns: "52px minmax(0, 1fr) auto" }}>
                <span className="viz-bar-label">{t.name}</span>
                <div className="viz-bar-track"><span style={{ width: `${EXAMPLE.predictions[k] * 100}%`, background: "var(--v1)" }} /></div>
                <span className="viz-bar-val">p = {EXAMPLE.predictions[k].toFixed(3)} · y = {EXAMPLE.labels[k]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
    narr = "x0 经过共享的两层 MLP 变成 256 维，再分给 4 个塔，每个塔输出一个 logit，过 sigmoid 就是概率。这里用的是训练好的模型：点开 0.88、点赞 0.43——点赞的平均率只有 1.5%，模型已经认出这是一条「会被点赞」的曝光。";
  } else if (step === 5) {
    body = (
      <div className="viz-panel">
        <h5>BCE = −[y·log p + (1 − y)·log(1 − p)]</h5>
        <div className="viz-bars">
          {TASKS.map((t, k) => (
            <div key={t.key} className="viz-bar-row" style={{ gridTemplateColumns: "52px minmax(0, 1fr) auto" }}>
              <span className="viz-bar-label">{t.name}</span>
              <div className="viz-bar-track"><span style={{ width: `${(losses.per[k] / 1) * 100}%`, background: k === 2 ? "var(--vcrit)" : "var(--v2)" }} /></div>
              <span className="viz-bar-val">{losses.per[k].toFixed(3)}　p − y = {logitGrad(EXAMPLE.predictions[k], EXAMPLE.labels[k]).toFixed(3)}</span>
            </div>
          ))}
        </div>
        <p className="viz-k" style={{ marginTop: 8 }}>这一行的总损失 = {losses.per.map((v) => v.toFixed(3)).join(" + ")} = <b>{losses.total.toFixed(3)}</b>；一个 batch 取 {fmt(BATCH)} 行的平均。</p>
      </div>
    );
    tone = "is-warn";
    narr = "每个塔的损失只看自己那个标签。点赞塔给了 0.43、真实是 1，罚得最重；关注塔给 0.02、真实是 0，几乎不罚。p − y 是传回 logit 的误差信号：正数往下压，负数往上推。";
  } else if (step === 6) {
    body = (
      <div className="viz-grid2 wide-left">
        <div className="viz-panel">
          <h5>loss.backward() 之后，谁拿到梯度</h5>
          <table className="viz-table"><tbody>
            <tr><td>4 个塔</td><td>各自只被自己的损失更新</td><td className="num">{fmt(params.towers)}</td></tr>
            <tr><td>共享 bottom</td><td>4 个损失的梯度加在一起</td><td className="num">{fmt(params.bottom)}</td></tr>
            <tr><td>embedding</td><td>只有被查到的那 27 行</td><td className="num">{fmt(touched.touched)} / {fmt(touched.total)}</td></tr>
          </tbody></table>
          <p className="viz-k" style={{ marginTop: 8 }}>然后 Adam（lr = {LR}）把所有参数一起挪一小步。</p>
        </div>
        <div className="viz-panel">
          <h5>tag_first 第 13 行：训练前 → 训练后</h5>
          <VectorBars values={EXAMPLE.tagRowInit} color="#9a9c8d" />
          <VectorBars values={EXAMPLE.tagRowTrained} color="var(--v1)" />
          <p className="viz-k">全部 971 行的长度中位数：{TABLE_NORMS.initMedian} → {TABLE_NORMS.trainedMedian}（p10 {TABLE_NORMS.trainedP10}，p90 {TABLE_NORMS.trainedP90}）。</p>
        </div>
      </div>
    );
    tone = "is-good";
    narr = "embedding 是训练出来的：每一步，这个 batch 里被查到的行收到梯度，和 MLP 一起被 Adam 更新。上面灰色是初始化时的那一行，下面蓝色是 2.5 个 epoch 之后——同一行，长了十几倍。很少出现的取值几乎收不到梯度，会一直停在初始化附近。";
  } else {
    body = (
      <div className="viz-grid2 wide-left">
        <div className="viz-panel">
          <h5>每 1/4 个 epoch 在 valid 上量一次 click GAUC</h5>
          <CurvePlot />
        </div>
        <div className="viz-panel">
          <h5>一次训练</h5>
          <table className="viz-table"><tbody>
            <tr><td>每个 batch</td><td className="num">{fmt(BATCH)} 行</td></tr>
            <tr><td>每个 epoch</td><td className="num">{fmt(spe)} 步</td></tr>
            <tr><td>epoch 数</td><td className="num">{EPOCHS}</td></tr>
            <tr><td>valid 评估</td><td className="num">{best.evals} 次</td></tr>
            <tr><td>保留</td><td className="num">epoch {best.epoch}</td></tr>
          </tbody></table>
        </div>
      </div>
    );
    narr = `前面 7 步是一次参数更新。一个 epoch 把 502 万行打乱后切成 ${fmt(spe)} 个 batch，各更新一次；每 1/${EVALS_PER_EPOCH} 个 epoch 停下来，在 valid 上算一次 click GAUC，记住最好的那份权重（这里是 epoch ${best.epoch}，${best.gauc}）。${EPOCHS} 个 epoch 结束后，用这份权重在 test 和随机集上各评一次，就是报告里的数。`;
  }

  return (
    <VisualizationFrame
      title="一次训练：一行曝光怎么变成一次参数更新"
      description="KuaiRand-1K 里的一行真实曝光，走一遍 shared-bottom 四目标模型的一个训练步，最后一步看外层的循环。"
      footnote="数据和模型：kuairank 学习线的 L1_shared_4t（seed 0，F1 特征，不含 user / video id）。预测值来自训练好的权重；损失、梯度、参数量、步数都是现算的。"
    >
      <StepPlayer step={step} total={STAGES.length} onStep={setStep} caption={`第 ${step + 1} 步 / 共 ${STAGES.length} 步`} intervalMs={2600} />
      <div className="viz-stages" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", margin: "12px 0" }}>
        {STAGES.map((s, i) => (
          <div key={s.name} className={`viz-stage${i < step ? " is-pass" : ""}${i === step ? " is-current" : ""}`}>
            <span className="dot" />
            <div><b>{i + 1}. {s.name}</b><small>{s.sub}</small></div>
          </div>
        ))}
      </div>
      {body}
      <div className={`viz-narr ${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}
