import { createEmbeddingExample, embeddingForward, embeddingGradients, embeddingUpdate, firstAdamStep, TOY_CATEGORIES, TOY_LR, TOY_BETA1, TOY_BETA2, TOY_EPS } from "@/lib/ml/embeddingTraining";

const model = createEmbeddingExample();
const forward = embeddingForward(model);
const gradients = embeddingGradients(model);
const updated = embeddingUpdate(model);
const after = embeddingForward(updated);
const fmt = (x: number) => x.toFixed(5);
const vec = (xs: readonly number[]) => `[${xs.map(fmt).join(", ")}]`;
const names = ["初始化", "输入与编号", "查表", "拼接", "前向计算", "交叉熵", "反向与 Adam", "更新后再算一次"];

export default function EmbeddingUpdateExample({ step }: { step: number }) {
  const showAfter = step === 7;
  const current = showAfter ? updated : model;
  const f = showAfter ? after : forward;
  const coordinate = firstAdamStep(model.embeddings[model.selected][0], gradients.embeddings[model.selected][0]);
  return (
    <div className="viz-panel" style={{ marginTop: 16 }}>
      <h5>算清一次更新 · {names[step]}</h5>
      <p className="viz-k">教学缩小版：4 类 × 2 维 embedding + 1 个数值 → 线性点击头 → sigmoid。下列数值实时计算，与上面的真实 KuaiRand 权重分开。</p>
      <div className="viz-grid2" style={{ marginTop: 12 }}>
        <div>
          <p><b>输入：美食（编号 {model.selected}）</b>，数值特征 = {model.dense}，点击标签 y = {model.label}。</p>
          <table className="viz-table"><caption>embedding 表 E · {showAfter ? "第 1 步 Adam 后" : "随机初始化"}</caption><thead><tr><th>编号 / 类别</th><th className="num">e₁</th><th className="num">e₂</th></tr></thead><tbody>
            {current.embeddings.map((row, i) => <tr key={i} style={i === model.selected ? { background: "var(--accent-soft)", color: "var(--v1)", fontWeight: 600 } : undefined}><td>{i} · {TOY_CATEGORIES[i]}{i === model.selected ? " ← 取这一行" : ""}</td>{row.map((v, j) => <td className="num" key={j}>{fmt(v)}</td>)}</tr>)}
          </tbody></table>
          <p className="viz-k" style={{ marginTop: 8 }}>E ~ N(0, 0.01²)，seed = 42；预测头也随机初始化，bias = 0。随机数一开始没有“美食”的语义。</p>
        </div>
        <div>
          {step <= 1 ? <div className="viz-narr">编号 2 只负责定位第 2 行，数值大小不代表“美食”比“音乐”多一份。点击标签用来算损失，不进入输入向量。</div> : <>
            <p className="viz-mono">e = E[2] = {vec(current.embeddings[current.selected])}</p>
            <p className="viz-mono">x = [e₁, e₂, {model.dense}]</p>
            <p className="viz-k" style={{ marginTop: 8 }}>取出的是参数表里那一行，反向传播会把梯度送回同一个位置。</p>
          </>}
          {step >= 3 && <>
            <p style={{ marginTop: 12 }}><b>预测头的权重 w</b></p><p className="viz-mono">{vec(current.weights)}</p>
            <p className="viz-mono">bias = {fmt(current.bias)}</p>
          </>}
          {step >= 4 && <>
            <p style={{ marginTop: 12 }}>z = x · w + bias</p>
            <p className="viz-mono">= {f.products.map(fmt).join(" + ")} + {fmt(current.bias)}</p>
            <p className="viz-mono">= {fmt(f.logit)}</p>
            <p>p = sigmoid(z) = <b>{fmt(f.probability)}</b></p>
          </>}
          {step >= 5 && <p style={{ marginTop: 8 }}>y = 1，所以 L = −log(p) = <b>{fmt(f.loss)}</b></p>}
        </div>
      </div>
      {step === 6 && <>
        <div className="viz-narr">误差信号 δ = p − y = {fmt(gradients.error)}。∂L/∂eⱼ = δ × wⱼ；∂L/∂wⱼ = δ × xⱼ；∂L/∂bias = δ。embedding 和预测头一起更新。</div>
        <div className="viz-scroll"><table className="viz-table" style={{ minWidth: 580 }}><caption>第 1 步 Adam · lr = {TOY_LR} · β₁ = {TOY_BETA1} · β₂ = {TOY_BETA2} · ε = {TOY_EPS}</caption><thead><tr><th>参数</th><th className="num">更新前</th><th className="num">梯度 g</th><th className="num">改变量 Δ</th><th className="num">更新后</th></tr></thead><tbody>
          {[
            ...model.embeddings[model.selected].map((v, j) => ({ name: `E[2, ${j}]`, ...firstAdamStep(v, gradients.embeddings[model.selected][j]) })),
            ...model.weights.map((v, j) => ({ name: `w[${j}]`, ...firstAdamStep(v, gradients.weights[j]) })),
            { name: "bias", ...firstAdamStep(model.bias, gradients.bias) },
          ].map(r => <tr key={r.name}><td className="viz-mono">{r.name}</td><td className="num">{fmt(r.before)}</td><td className="num">{fmt(r.gradient)}</td><td className="num">{fmt(r.delta)}</td><td className="num">{fmt(r.after)}</td></tr>)}
        </tbody></table></div>
        <p style={{ marginTop: 12 }}><b>放大 E[2, 0] 的 Adam 账本</b></p>
        <p className="viz-mono">m = (1 − β₁)g = {coordinate.m.toExponential(4)}；v = (1 − β₂)g² = {coordinate.v.toExponential(4)}</p>
        <p className="viz-mono">m̂ = m / (1 − β₁) = {fmt(coordinate.mHat)}；v̂ = v / (1 − β₂) = {fmt(coordinate.vHat)}</p>
        <p className="viz-mono">Δ = −lr × m̂ / (√v̂ + ε) = {fmt(coordinate.delta)}</p>
        <p className="viz-k">这是第一次更新，m₀ = v₀ = 0，且没有 weight decay；因此未查到的 3 行保持不变。后续若已有动量，dense Adam 的零梯度行也可能移动，具体取决于优化器实现。</p>
      </>}
      {step === 7 && <div className="viz-narr is-good">用更新后的 E、w、bias 重新前向：p {fmt(forward.probability)} → {fmt(after.probability)}，loss {fmt(forward.loss)} → {fmt(after.loss)}。这一小步让“点击”的预测更接近标签 1；只说明当前这条样本的损失下降。</div>}
    </div>
  );
}
