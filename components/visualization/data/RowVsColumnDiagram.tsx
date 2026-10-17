"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Action = "none" | "row" | "col" | "compress";
const COLS = ["id", "speed", "brake", "lat", "lon"];
const ROWS = [["1", "62", "0", "31.2", "121.4"], ["2", "58", "1", "31.2", "121.4"], ["3", "60", "0", "31.3", "121.5"], ["4", "0", "1", "31.3", "121.5"]];
const C1 = "#2a78d6";
const C2 = "#eb6834";
const LINE = "#76796f";
const COL_W = 300;

const NARR: Record<Action, { narr: string; tone?: string; left: string; right: string; lb?: boolean; rb?: boolean }> = {
  none: { narr: "同一张表：4 条车辆记录、5 个字段。左边按行存（CSV、JSON、数据库的行），一条记录的所有字段挨在一起；右边按列存（Parquet），一个字段的所有值挨在一起。磁盘上的字节顺序就是图里高亮的顺序。", left: "一条记录连续存放", right: "一列的值连续存放" },
  row: { narr: "要读第 2 辆车的全部信息。左边一次顺序读就拿到整行，很快。右边要去 5 个地方各取一个值。按行存适合“取一条完整记录”，这是在线业务的典型读法。", tone: "is-good", left: "读一段连续字节，1 次", right: "跳 5 个地方各读一个值", rb: true },
  col: { narr: "要算全车队的平均速度。只需要 speed 这一列。左边必须把 4 行全部读出来，再从每行里挑出 speed，其余 4 个字段白读了，表有 84 列时白读 83 列。右边 speed 列连续存放，只读那一段。训练和分析几乎都是“全部行、少数列”，所以数据集用 Parquet。", tone: "is-good", left: "读全部 4 行，用到 1/5", right: "只读 speed 这一段", lb: true },
  compress: { narr: "压缩。右边同一列的值类型相同、往往相近：brake 全是 0 和 1，lat 只差小数点后一位，几乎不用什么空间就能编码，列存通常比行存小 5 到 10 倍。左边一行里速度、经纬度、布尔值混在一起，压不动。再加一个词：Arrow 是列存在内存里的样子，Spark、Pandas、PyTorch dataloader 之间传数据不用再序列化。", tone: "is-good", left: "类型混杂，压缩率低", right: "同类型相邻，压缩率高" },
};

function Grid({ x, title, byCol, action, color, note, bad }: { x: number; title: string; byCol: boolean; action: Action; color: string; note: string; bad?: boolean }) {
  const cw = 52;
  const ch = 16;
  const hl = (r: number, c: number) => {
    if (action === "row") return r === 1;
    if (action === "col") return c === 1;
    if (action === "compress") return byCol && (c === 2 || c === 3);
    return false;
  };
  return (
    <g transform={`translate(${x} 0)`}>
      <text x={COL_W / 2} y={12} fontSize={11} fontWeight={600} textAnchor="middle" fill="#3b4234">{title}</text>
      {COLS.map((c, ci) => <text key={c} x={20 + ci * cw + cw / 2} y={30} fontSize={9} textAnchor="middle" fill={LINE}>{c}</text>)}
      {ROWS.map((row, ri) => row.map((v, ci) => (
        <g key={`${ri}-${ci}`} transform={`translate(${20 + ci * cw} ${36 + ri * ch})`}>
          <rect width={cw - 2} height={ch - 2} rx={2} fill={hl(ri, ci) ? color : "#fff"} opacity={hl(ri, ci) ? 0.85 : 1} stroke="#e4dfcb" />
          <text x={cw / 2 - 1} y={ch / 2 + 3} fontSize={9} textAnchor="middle" fill={hl(ri, ci) ? "#fff" : "#30332c"} className="mono">{v}</text>
        </g>
      )))}
      <text x={20} y={112} fontSize={9} fill={LINE}>磁盘上的顺序：</text>
      {(byCol ? COLS.flatMap((_, ci) => ROWS.map((r, ri) => ({ v: r[ci], ri, ci }))) : ROWS.flatMap((r, ri) => r.map((v, ci) => ({ v, ri, ci })))).map((cell, k) => (
        <rect key={k} x={20 + k * 13} y={116} width={11} height={8} rx={1} fill={hl(cell.ri, cell.ci) ? color : "#e4dfcb"} />
      ))}
      <text x={20} y={138} fontSize={9} fill={bad ? "#d03b3b" : LINE}>{note}</text>
    </g>
  );
}

export default function RowVsColumnDiagram() {
  const [action, setAction] = useState<Action>("none");
  const s = NARR[action];
  const W = COL_W * 2 + 24;
  const H = 144;
  return (
    <VisualizationFrame
      title="行存 vs 列存：一条记录挨着放，还是一列值挨着放"
      description="同一张 4 行 5 列的表。高亮的是这次操作真正要读的格子，底下一排是它们在磁盘上的顺序。"
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${action === "row" ? " is-on" : ""}`} onClick={() => setAction("row")}>读第 2 辆车的全部字段</button>
        <button type="button" className={`viz-btn${action === "col" ? " is-on" : ""}`} onClick={() => setAction("col")}>算所有车的平均速度</button>
        <button type="button" className={`viz-btn${action === "compress" ? " is-on" : ""}`} onClick={() => setAction("compress")}>压缩</button>
        <button type="button" className="viz-btn" onClick={() => setAction("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={s.narr}>
          <Grid x={0} title="行存（CSV、JSON、数据库行）" byCol={false} action={action} color={C1} note={s.left} bad={s.lb} />
          <line x1={COL_W + 12} y1={4} x2={COL_W + 12} y2={H - 4} stroke="#e4dfcb" strokeDasharray="3 3" />
          <Grid x={COL_W + 24} title="列存（Parquet）" byCol action={action} color={C2} note={s.right} bad={s.rb} />
        </svg>
      </div>
      <div className={`viz-narr${s.tone ? ` ${s.tone}` : ""}`}>{s.narr}</div>
    </VisualizationFrame>
  );
}
