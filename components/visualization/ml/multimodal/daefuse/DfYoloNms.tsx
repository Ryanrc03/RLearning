"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Slider from "@/components/visualization/ml/primitives/Slider";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import DfPixels from "./DfPixels";
import { fuse, iou, matchAt50, nms, toyInfrared, toyVisible, type Box, type Det } from "@/lib/ml/daefuse";

// Section 2.6: what a YOLO head outputs and how it becomes the AP@50 the paper
// reports. Raw boxes (示意值) for the same scene seen through infrared, visible
// and a fused image → drop low scores → per-class NMS → match to ground truth
// at IoU ≥ 0.5. Mirrors the paper's Fig. 3: IR finds the person, visible finds
// the car, the fused image finds both.

type Src = "ir" | "vis" | "fused";
const CELL = 14;
const OX = 16;
const OY = 26;
const GT: (Box & { cls: Det["cls"] })[] = [
  { cls: "person", x: 4, y: 6, w: 3, h: 9 },
  { cls: "car", x: 14, y: 9, w: 8, h: 5 },
];
const RAW: Record<Src, Det[]> = {
  ir: [
    { cls: "person", score: 0.91, x: 4.2, y: 6, w: 2.8, h: 9 },
    { cls: "person", score: 0.78, x: 3.6, y: 6.5, w: 3.4, h: 8.5 },
    { cls: "car", score: 0.31, x: 16, y: 11, w: 5, h: 3 },
  ],
  vis: [
    { cls: "car", score: 0.93, x: 14, y: 9, w: 8, h: 5.2 },
    { cls: "car", score: 0.71, x: 14.6, y: 9.4, w: 7.6, h: 4.6 },
    { cls: "person", score: 0.18, x: 3.5, y: 8, w: 3.5, h: 6 },
  ],
  fused: [
    { cls: "person", score: 0.89, x: 4.1, y: 6.2, w: 2.9, h: 8.8 },
    { cls: "person", score: 0.62, x: 3.5, y: 5.5, w: 3.6, h: 9.5 },
    { cls: "car", score: 0.92, x: 14.1, y: 9, w: 7.9, h: 5 },
    { cls: "car", score: 0.58, x: 13.4, y: 8.6, w: 8.4, h: 5.6 },
  ],
};
const LABEL: Record<Src, string> = { ir: "红外", vis: "可见光", fused: "融合图" };
const TP = "#1baf7a";
const FP = "#d03b3b";
const OFF = "#9a9c8d";

export default function DfYoloNms() {
  const [src, setSrc] = useState<Src>("fused");
  const [conf, setConf] = useState(0.25);
  const [thr, setThr] = useState(0.7);
  const [grid, setGrid] = useState(false);
  const imgs = useMemo(() => {
    const ir = toyInfrared();
    const vis = toyVisible();
    return { ir, vis, fused: fuse(ir, vis, "max") };
  }, []);

  const raw = RAW[src];
  const passed = raw.filter((d) => d.score >= conf);
  const kept = nms(passed, thr);
  const { matches, missed } = matchAt50(kept, GT);
  const status = (d: Det) => (d.score < conf ? "分数低于阈值" : !kept.includes(d) ? "被 NMS 去掉" : matches.find((m) => m.det === d)?.tp ? "TP" : "FP");
  const tp = matches.filter((m) => m.tp).length;
  const fp = matches.length - tp;
  const box = (b: Box) => ({ x: OX + b.x * CELL, y: OY + b.y * CELL, width: b.w * CELL, height: b.h * CELL });

  return (
    <VisualizationFrame
      title="从 YOLO 的原始框到 AP@50：同一个场景，三种输入"
      description="检测器对每张图先吐出一堆带分数的框。去掉分数低于 conf 的框，再按类别做 NMS（和更高分的同类框重叠 ≥ IoU 阈值就删掉），剩下的框和标注框的 IoU ≥ 0.5 才算对（TP）。"
      footnote="框和分数是示意值。conf = 0.25、NMS IoU = 0.7 是 Ultralytics YOLOv8 推理时的默认值；算 mAP 时 conf 会放到 0.001，让整条 PR 曲线都能画出来。"
    >
      <div className="viz-row">
        <Tabs options={(["ir", "vis", "fused"] as Src[]).map((k) => ({ key: k, label: LABEL[k] }))} value={src} onChange={setSrc} ariaLabel="输入图像" />
        <label className="viz-check"><input type="checkbox" checked={grid} onChange={(e) => setGrid(e.target.checked)} />显示网格（YOLOv1 的看法）</label>
      </div>
      <div className="viz-grid2">
        <Slider label="conf 阈值" value={conf} min={0.05} max={0.95} step={0.01} onChange={setConf} display={conf.toFixed(2)} />
        <Slider label="NMS IoU 阈值" value={thr} min={0.3} max={0.9} step={0.05} onChange={setThr} display={thr.toFixed(2)} />
      </div>
      <div className="viz-grid2 wide-left">
        <div className="viz-scroll">
          <svg viewBox="0 0 370 262" role="img" aria-label={`${LABEL[src]}：TP ${tp}，FP ${fp}，漏检 ${missed.length}`} style={{ minWidth: 320 }}>
            <DfPixels img={imgs[src]} x={OX} y={OY} cell={CELL} title={`输入：${LABEL[src]}`} />
            {grid &&
              Array.from({ length: 5 }, (_, i) => <line key={`v${i}`} x1={OX + (i + 1) * 4 * CELL} y1={OY} x2={OX + (i + 1) * 4 * CELL} y2={OY + 16 * CELL} stroke="#d9b24a" strokeWidth={1} />)}
            {grid &&
              Array.from({ length: 3 }, (_, i) => <line key={`h${i}`} x1={OX} y1={OY + (i + 1) * 4 * CELL} x2={OX + 24 * CELL} y2={OY + (i + 1) * 4 * CELL} stroke="#d9b24a" strokeWidth={1} />)}
            {grid && GT.map((g) => <circle key={g.cls} cx={OX + (g.x + g.w / 2) * CELL} cy={OY + (g.y + g.h / 2) * CELL} r={4} fill="#d9b24a" />)}
            {GT.map((g) => <rect key={g.cls} {...box(g)} fill="none" stroke="#3b4234" strokeWidth={1.2} />)}
            {raw.map((d, i) => {
              const s = status(d);
              const c = s === "TP" ? TP : s === "FP" ? FP : OFF;
              const b = box(d);
              return (
                <g key={i} opacity={s === "TP" || s === "FP" ? 1 : 0.45}>
                  <rect {...b} fill="none" stroke={c} strokeWidth={s === "TP" || s === "FP" ? 2.4 : 1.2} />
                  <rect x={b.x} y={b.y - 12} width={64} height={12} fill={c} />
                  <text x={b.x + 3} y={b.y - 3} fontSize={9} fill="#fff">{d.cls} {d.score.toFixed(2)}</text>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="viz-panel">
          <h5>每个原始框的去向</h5>
          <table className="viz-table">
            <thead><tr><th>类别</th><th className="num">分数</th><th className="num">与标注 IoU</th><th>结果</th></tr></thead>
            <tbody>
              {raw.map((d, i) => {
                const g = GT.find((x) => x.cls === d.cls)!;
                const s = status(d);
                return (
                  <tr key={i}>
                    <td>{d.cls}</td>
                    <td className="num">{d.score.toFixed(2)}</td>
                    <td className="num">{iou(d, g).toFixed(2)}</td>
                    <td style={{ color: s === "TP" ? "#087a08" : s === "FP" ? FP : "#76796f", fontWeight: s === "TP" || s === "FP" ? 600 : 400 }}>{s}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p style={{ marginTop: 8 }}>TP <b>{tp}</b>　FP <b>{fp}</b>　漏检 <b>{missed.length}</b>{missed.length > 0 && <span className="viz-k">（{missed.map((m) => m.cls).join("、")}）</span>}</p>
        </div>
      </div>
      <div className={`viz-narr${missed.length === 0 && fp === 0 ? " is-good" : " is-warn"}`}>
        {src === "ir"
          ? `红外图里人是最亮的热源，框得很准（IoU ${iou(RAW.ir[0], GT[0]).toFixed(2)}）；车几乎不发热，只给了一个 ${RAW.ir[2].score} 分、偏小的框，IoU ${iou(RAW.ir[2], GT[1]).toFixed(2)} < 0.5，${RAW.ir[2].score >= conf ? "算 FP，车也就算漏检" : "连 conf 阈值都没过，车漏检"}。`
          : src === "vis"
            ? `可见光里车又亮又有轮廓，分数 0.93；人和路面几乎一样暗，只给了 0.18 分。conf = ${conf.toFixed(2)} ${RAW.vis[2].score >= conf ? "放过了它，而且 IoU 够 0.5，算 TP——但真实评估时这种低分框会排在 PR 曲线的末尾，拉低 AP" : "把它挡在门外，人漏检"}。`
            : fp > 0
              ? `NMS 阈值 ${thr.toFixed(2)} 太高：重复框和高分框的 IoU（人 ${iou(RAW.fused[0], RAW.fused[1]).toFixed(2)}、车 ${iou(RAW.fused[2], RAW.fused[3]).toFixed(2)}）没超过它，没被删掉；标注框已经被高分框配走，重复框只能算 FP，precision 下降。`
              : `融合图里人和车都清楚，各有一个高分框；它们的重复框和高分框重叠（人 ${iou(RAW.fused[0], RAW.fused[1]).toFixed(2)}、车 ${iou(RAW.fused[2], RAW.fused[3]).toFixed(2)}）超过 NMS 阈值，被删掉。这就是论文图 3 想说明的：融合之后，一个检测器同时拿到了两种模态各自擅长的目标。`}
      </div>
    </VisualizationFrame>
  );
}
