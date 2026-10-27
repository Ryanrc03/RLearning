"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Slider from "@/components/visualization/ml/primitives/Slider";
import DfPixels from "./DfPixels";
import { fuse, lossInt, lossText, sobel, toyInfrared, toyVisible, zipImg, type FusionRule } from "@/lib/ml/daefuse";

// Section 3.4, Phase 2 (Eqs. 13–14). Try hand-made fusion rules on the toy
// scene and see what the two content losses say. Bottom row: the per-pixel
// targets the losses compare against, max(α, β) and max(|∇α|, |∇β|).

const RULES: { key: FusionRule; label: string }[] = [
  { key: "ir", label: "只用红外" },
  { key: "vis", label: "只用可见光" },
  { key: "weighted", label: "加权平均" },
  { key: "max", label: "逐像素取大" },
];

const heat = (v: number) => {
  const t = Math.min(1, v);
  return `rgb(${Math.round(255 - t * 20)},${Math.round(255 - t * 130)},${Math.round(255 - t * 200)})`;
};

export default function DfFusionLoss() {
  const { ir, vis, gradT, intT } = useMemo(() => {
    const ir = toyInfrared();
    const vis = toyVisible();
    return { ir, vis, intT: zipImg(ir, vis, Math.max), gradT: zipImg(sobel(ir), sobel(vis), Math.max) };
  }, []);
  const [rule, setRule] = useState<FusionRule>("weighted");
  const [w, setW] = useState(0.5);
  const f = fuse(ir, vis, rule, w);
  const li = lossInt(f, ir, vis);
  const lt = lossText(f, ir, vis);
  const gradF = sobel(f);
  const errText = zipImg(gradF, gradT, (a, b) => Math.abs(a - b));
  const C = 6.4;

  return (
    <VisualizationFrame
      title="Phase 2 的内容损失：亮度看两者较大，梯度看两者较大"
      description="选一种手工融合规则，看融合图 F 的 L_int（式 14）和 L_text（式 13）。第二行是两个损失的目标：每个像素取两张源图里更亮的那个，每个像素取两张源图里更陡的那个梯度。"
      footnote="∇ 用 Sobel 算子（论文引用的 SeAFusion 用的就是 Sobel）。融合规则是手写的，用来理解损失在奖励什么；DAE-Fuse 的融合图由解码器生成，不是这几种规则之一。"
    >
      <div className="viz-row">
        <div className="viz-chips" role="group" aria-label="融合规则">
          {RULES.map((r) => (
            <button key={r.key} type="button" className={`viz-chip${rule === r.key ? " is-on" : ""}`} aria-pressed={rule === r.key} onClick={() => setRule(r.key)}>{r.label}</button>
          ))}
        </div>
      </div>
      {rule === "weighted" && <Slider label="红外权重 w" value={w} min={0} max={1} step={0.05} onChange={setW} display={`F = ${w.toFixed(2)}·α + ${(1 - w).toFixed(2)}·β`} />}
      <div className="viz-scroll">
        <svg viewBox="0 0 640 260" role="img" aria-label={`L_int ${li.toFixed(4)}，L_text ${lt.toFixed(4)}`} style={{ minWidth: 560 }}>
          <DfPixels img={ir} x={8} y={22} cell={C} title="α 红外" />
          <DfPixels img={vis} x={168} y={22} cell={C} title="β 可见光" />
          <DfPixels img={f} x={328} y={22} cell={C} title="F 融合图" />
          <g>
            <text x={492} y={44} fontSize={11} fill="#30332c">L_int</text>
            <text x={492} y={64} fontSize={18} fontWeight={700} fill="#2a78d6" className="mono">{li.toFixed(4)}</text>
            <text x={492} y={94} fontSize={11} fill="#30332c">L_text</text>
            <text x={492} y={114} fontSize={18} fontWeight={700} fill="#eb6834" className="mono">{lt.toFixed(4)}</text>
          </g>
          <DfPixels img={intT} x={8} y={152} cell={C} title="L_int 的目标 max(α, β)" />
          <DfPixels img={gradT.map((r) => r.map((v) => Math.min(1, v / 2)))} x={168} y={152} cell={C} title="L_text 的目标 max|∇|" />
          <DfPixels img={errText} x={328} y={152} cell={C} title="|∇F − max|∇||（越红差越多）" color={(v) => heat(v / 1.2)} />
        </svg>
      </div>
      <div className={`viz-narr${rule === "max" ? " is-good" : rule === "weighted" && Math.abs(w - 0.5) < 0.11 ? " is-warn" : ""}`}>
        {rule === "ir"
          ? `只用红外：人很亮，但车、砖墙都比可见光暗，L_int = ${li.toFixed(4)}；砖墙纹理和车窗的边全丢了，L_text = ${lt.toFixed(4)}，是四种里最大的。`
          : rule === "vis"
            ? `只用可见光：大部分像素本来就是可见光更亮，L_int 只有 ${li.toFixed(4)}；可人在可见光里几乎看不见，他的轮廓梯度全丢，L_text = ${lt.toFixed(4)}（右下角人那一列是红的）。`
            : rule === "weighted"
              ? `加权平均 w = ${w.toFixed(2)}：L_int = ${li.toFixed(4)}，L_text = ${lt.toFixed(4)}。平均会把两边的对比度都压低：人只剩 ${((w * 0.95 + (1 - w) * 0.36)).toFixed(2)} 的亮度，砖缝的反差缩成原来的 ${(1 - w).toFixed(2)} 倍。这就是早期「把特征直接相加」方法看起来发灰、发糊的原因。`
              : `逐像素取大：按定义 L_int = 0；梯度也大多保住了，L_text = ${lt.toFixed(4)}，是四种里最小的。剩下的误差在人和车的边缘：两张图在这里谁亮谁暗换了位置，取大之后造出了新的边。所以 L_int 和 L_text 要一起用，再加判别器，解码器才会学到「比取大更自然」的融合。`}
      </div>
    </VisualizationFrame>
  );
}
