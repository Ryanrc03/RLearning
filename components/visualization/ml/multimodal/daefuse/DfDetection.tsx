"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Bars from "@/components/visualization/ml/primitives/Bars";
import { DF_DET, DF_DET_CLASSES } from "@/lib/ml/daefuse";

// Section 4.4, Table III: YOLOv8n trained on each method's fused M3FD images.
// Pick a class (or mAP); single-modality rows are drawn in grey-green so the
// "fusion beats either source" gap is visible.

const KEYS = ["mAP", ...DF_DET_CLASSES] as const;
type Key = (typeof KEYS)[number];
const CN: Record<Key, string> = { mAP: "mAP@50", People: "行人", Car: "汽车", Lamp: "路灯", Bus: "公交", Motor: "摩托", Truck: "卡车" };

export default function DfDetection() {
  const [key, setKey] = useState<Key>("mAP");
  const val = (r: (typeof DF_DET)[number]) => (key === "mAP" ? r.map : r.ap[DF_DET_CLASSES.indexOf(key as (typeof DF_DET_CLASSES)[number])]);
  const rows = [...DF_DET].sort((a, b) => val(b) - val(a));
  const best = rows[0];
  const ours = DF_DET.find((r) => r.name === "DAE-Fuse")!;
  const ir = DF_DET[0];
  const vis = DF_DET[1];
  const min = Math.min(...DF_DET.map(val));

  return (
    <VisualizationFrame
      title="表 III：融合图喂给 YOLOv8n，AP@50 是多少"
      description="M3FD 上每种方法生成的 4,200 张融合图，按 8 : 1 : 1 切成训练、验证、测试，各训一个 YOLOv8n。绿色的两条是只用单一模态（Infrared、Visible）训练的结果。"
      footnote="数字抄自论文表 III（AP@50，0–1）。条形从最低值附近起画，放大差距。"
    >
      <div className="viz-chips" role="group" aria-label="类别">
        {KEYS.map((k) => (
          <button key={k} type="button" className={`viz-chip${key === k ? " is-on" : ""}`} aria-pressed={key === k} onClick={() => setKey(k)}>{CN[k]}</button>
        ))}
      </div>
      <div className="viz-panel" style={{ marginTop: 12 }}>
        <h5>{CN[key]}（按分数排序）</h5>
        <Bars
          rows={rows.map((r) => ({
            label: r.name,
            value: val(r) - (min - 0.03),
            max: val(best) - (min - 0.03),
            color: r.name === "DAE-Fuse" ? "#2a78d6" : r.name === "Infrared" || r.name === "Visible" ? "#1baf7a" : "#cfcab4",
            text: val(r).toFixed(3),
          }))}
        />
      </div>
      <div className={`viz-narr${best.name === "DAE-Fuse" ? " is-good" : " is-warn"}`}>
        {key === "People"
          ? `行人：红外 ${ir.ap[0].toFixed(3)}，可见光只有 ${vis.ap[0].toFixed(3)}——夜里行人在可见光里会被车灯、路灯的反光淹没，在红外里却是最亮的热源。DAE-Fuse ${ours.ap[0].toFixed(3)}，比红外还高：热源告诉检测器「哪里有人」，可见光的纹理帮它把框画准。`
          : key === "Lamp"
            ? `路灯：红外只有 ${ir.ap[2].toFixed(3)}（灯杆不发热），可见光 ${vis.ap[2].toFixed(3)}。和行人正好相反，这一类靠的是可见光。融合之后 ${ours.ap[2].toFixed(3)}，两边都拿到了。`
            : key === "mAP"
              ? `mAP@50：红外 ${ir.map.toFixed(3)}、可见光 ${vis.map.toFixed(3)}，所有融合方法都高于两者；DAE-Fuse ${ours.map.toFixed(3)} 最高，比第二名 CDDFuse 高 ${(ours.map - 0.878).toFixed(3)}，比单用红外高 ${(ours.map - ir.map).toFixed(3)}。`
              : best.name === "DAE-Fuse"
                ? `${CN[key]}：DAE-Fuse ${val(ours).toFixed(3)} 第一。`
                : `${CN[key]}：第一是 ${best.name}（${val(best).toFixed(3)}），DAE-Fuse ${val(ours).toFixed(3)}。六个类别里 DAE-Fuse 拿了四个第一，汽车输给 TarDAL（它的损失本身就是为检测设计的），卡车以 0.001 输给 CDDFuse。`}
      </div>
    </VisualizationFrame>
  );
}
