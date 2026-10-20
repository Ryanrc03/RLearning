"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Slider from "@/components/visualization/ml/primitives/Slider";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import DfPixels from "./DfPixels";
import { blurTimes, contentLoss, ganLosses, splitScore, toyInfrared, toyVisible } from "@/lib/ml/daefuse";

// Section 3.4, Phase 1 (Eqs. 8–12). A reconstruction that lost detail is
// faked by blurring the input k times; the figure scores it with the content
// loss (MSE + 1 − SSIM), adds the correlation term and the adversarial term,
// and shows what the discriminator's own loss is at the same time.

type Src = "ir" | "vis";
const LAMBDA = 0.1; // 示意值: the paper does not report λ

export default function DfReconLoss() {
  const imgs = useMemo(() => ({ ir: toyInfrared(), vis: toyVisible() }), []);
  const corrTerm = useMemo(() => splitScore(imgs.ir, imgs.vis, 2).loss, [imgs]);
  const [src, setSrc] = useState<Src>("vis");
  const [k, setK] = useState(1);
  const [dRec, setDRec] = useState(0.2);
  const [sigma, setSigma] = useState(0.5);
  const x = imgs[src];
  const rec = blurTimes(x, k);
  const c = contentLoss(x, rec);
  const g = ganLosses(0.9, dRec);
  const adv = g.genMinimax; // Eq. 9 term for this modality
  const total = LAMBDA * adv + sigma * corrTerm + (1 - sigma) * c.total;
  const other = contentLoss(imgs[src === "ir" ? "vis" : "ir"], blurTimes(imgs[src === "ir" ? "vis" : "ir"], k));

  return (
    <VisualizationFrame
      title="Phase 1 的损失：把一张图重建回来，逐项算一遍"
      description="用「把输入模糊 k 次」假装解码器丢了细节。内容损失 = MSE + (1 − SSIM)；再加上相关性分解损失和对抗损失，按式 (8) 加权。右边同时给出判别器自己的损失（式 12）。"
      footnote={<>示意计算：SSIM 在整张图上算一个窗口（论文实现通常用 11 × 11 的滑动窗口）。λ = {LAMBDA}、σ 的取值论文未披露，这里是示意值；L_corr 用的是上一张图里手工切分得到的 {corrTerm.toFixed(4)}。判别器对真图的打分固定为 0.9。</>}
    >
      <div className="viz-row">
        <Tabs options={[{ key: "vis", label: "β 可见光" }, { key: "ir", label: "α 红外" }]} value={src} onChange={setSrc} ariaLabel="重建哪一张" />
      </div>
      <div className="viz-grid2">
        <Slider label="重建丢细节（模糊次数 k）" value={k} min={0} max={4} onChange={setK} display={`${k}`} />
        <Slider label="D(重建图)" value={dRec} min={0.02} max={0.98} step={0.02} onChange={setDRec} display={dRec.toFixed(2)} />
      </div>
      <Slider label="σ（相关性 vs 内容）" value={sigma} min={0} max={1} step={0.05} onChange={setSigma} display={sigma.toFixed(2)} />
      <div className="viz-grid2 wide-left">
        <div className="viz-scroll">
          <svg viewBox="0 0 400 140" role="img" aria-label={`模糊 ${k} 次：MSE ${c.mse.toFixed(4)}，SSIM ${c.ssim.toFixed(3)}`} style={{ minWidth: 340 }}>
            <DfPixels img={x} x={8} y={22} cell={7.6} title={src === "ir" ? "输入 α" : "输入 β"} />
            <DfPixels img={rec} x={208} y={22} cell={7.6} title={src === "ir" ? `重建 α̃（模糊 ${k} 次）` : `重建 β̃（模糊 ${k} 次）`} />
          </svg>
        </div>
        <div className="viz-panel">
          <h5>判别器这一步</h5>
          <p className="viz-mono">L_D = −log 0.9 − log(1 − {dRec.toFixed(2)}) = {g.disc.toFixed(3)}</p>
          <p className="viz-k" style={{ marginTop: 6 }}>D(重建) 越小，判别器越确定这是假的，L_D 越小；解码器想让 D(重建) 变大。</p>
        </div>
      </div>
      <div className="viz-scroll"><table className="viz-table" style={{ marginTop: 10 }}>
        <thead><tr><th>项</th><th>公式</th><th className="num">值</th><th className="num">权重</th><th className="num">贡献</th></tr></thead>
        <tbody>
          <tr><td>MSE</td><td className="viz-mono">‖x − x̃‖² / HW</td><td className="num">{c.mse.toFixed(4)}</td><td className="num" rowSpan={2}>1 − σ = {(1 - sigma).toFixed(2)}</td><td className="num" rowSpan={2}>{((1 - sigma) * c.total).toFixed(4)}</td></tr>
          <tr><td>1 − SSIM</td><td className="viz-mono">1 − SSIM(x, x̃)</td><td className="num">{(1 - c.ssim).toFixed(4)}</td></tr>
          <tr><td>L_corr</td><td className="viz-mono">CC_H² / (CC_L + 1.01)</td><td className="num">{corrTerm.toFixed(4)}</td><td className="num">σ = {sigma.toFixed(2)}</td><td className="num">{(sigma * corrTerm).toFixed(4)}</td></tr>
          <tr><td>L_adv</td><td className="viz-mono">log(1 − D(x̃))</td><td className="num">{adv.toFixed(4)}</td><td className="num">λ = {LAMBDA}</td><td className="num">{(LAMBDA * adv).toFixed(4)}</td></tr>
          <tr style={{ fontWeight: 700 }}><td>L_AE</td><td>式 (8)</td><td /><td /><td className="num">{total.toFixed(4)}</td></tr>
        </tbody>
      </table></div>
      <div className={`viz-narr${k === 0 ? " is-good" : k >= 3 ? " is-warn" : ""}`}>
        {k === 0
          ? "完美重建：MSE = 0、SSIM = 1，内容损失为 0。剩下的只有相关性项和对抗项。对抗项用的是式 (9) 的 log(1 − D)，所以它可以是负数：解码器越能骗过判别器，这一项越负。"
          : `模糊 ${k} 次：MSE 只有 ${c.mse.toFixed(4)}，但 1 − SSIM 是 ${(1 - c.ssim).toFixed(4)}，大了 ${Math.round((1 - c.ssim) / Math.max(c.mse, 1e-9))} 倍。MSE 是逐像素的平均误差，糊掉几条细边几乎不影响它；SSIM 比的是局部均值、方差和协方差，纹理一丢就掉。同样模糊 ${k} 次，${src === "vis" ? "可见光（有砖墙纹理）的内容损失是 " + c.total.toFixed(4) + "，红外只有 " + other.total.toFixed(4) : "红外（几乎没有纹理）的内容损失只有 " + c.total.toFixed(4) + "，可见光是 " + other.total.toFixed(4)}。这就是只用 MSE 训出来的 AE 会糊的原因，也是论文加 SSIM、再加判别器的理由。`}
      </div>
    </VisualizationFrame>
  );
}
