"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Action = "none" | "ingest" | "analyst" | "train";
type Side = { boxes: { label: string; sub: string; on?: boolean }[]; result: string; note: string; bad?: boolean };

const C1 = "#2a78d6";
const C2 = "#eb6834";
const LINE = "#76796f";
const COL_W = 300;

const STATES: Record<Action, { left: Side; right: Side; narr: string; tone?: string }> = {
  none: {
    left: { boxes: [{ label: "清洗、定好表结构", sub: "写入时就要符合 schema" }, { label: "整齐的表", sub: "trips、brakes、vehicles" }, { label: "SQL 查询", sub: "分析师、报表" }], result: "", note: "写入时定结构：schema-on-write" },
    right: { boxes: [{ label: "原样丢进对象存储", sub: "日志、图片、点云、Parquet" }, { label: "按日期和车辆分目录", sub: "s3://logs/2026/10/16/car-07/" }, { label: "读的时候再解释", sub: "Spark、训练脚本" }], result: "", note: "读的时候定结构：schema-on-read" },
    narr: "左边数据仓库（Snowflake、BigQuery、ClickHouse）：数据写进去之前先清洗、定好表结构，进去的都是整齐的表，用 SQL 查。右边数据湖：原始文件原样丢进对象存储，按目录分区，谁要用谁自己解释。点按钮看三件事。",
  },
  ingest: {
    left: { boxes: [{ label: "清洗、定好表结构", sub: "点云？图片？放不进表", on: true }, { label: "整齐的表", sub: "只能存解析后的数字字段" }, { label: "SQL 查询", sub: "" }], result: "50 TB 原始日志只有一小部分能进来", note: "不规整的东西进不了仓库", bad: true },
    right: { boxes: [{ label: "原样丢进对象存储", sub: "50 TB 全部落地，几分钱一 GB", on: true }, { label: "按日期和车辆分目录", sub: "" }, { label: "读的时候再解释", sub: "" }], result: "全部留下，以后想怎么用都行", note: "便宜、什么都能放" },
    narr: "一天 50 TB 车辆日志来了：点云、图片、CAN 信号、文本日志。左边仓库要求每样东西先变成表里的一行，点云和图片根本放不进去，只能存解析后的少数字段，而且仓库的存储贵。右边湖什么都收，原样落在对象存储上，几分钱一 GB。所以原始数据先进湖。",
    tone: "is-warn",
  },
  analyst: {
    left: { boxes: [{ label: "清洗、定好表结构", sub: "" }, { label: "整齐的表", sub: "brakes 表早就建好了", on: true }, { label: "SQL 查询", sub: "SELECT city, count(*) … 几秒出结果", on: true }], result: "分析师自己就能查", note: "结构早定好了，查起来快而且不容易错" },
    right: { boxes: [{ label: "原样丢进对象存储", sub: "" }, { label: "按日期和车辆分目录", sub: "急刹在哪个文件的哪个字段？", on: true }, { label: "读的时候再解释", sub: "写个 Spark 作业扫一遍，几十分钟" }], result: "要找工程师写作业", note: "没人定结构，每次查都要重新解释", bad: true },
    narr: "分析师问“上个月各城市急刹次数”。左边 brakes 表早就建好、清洗过，一条 SQL 几秒出结果，分析师自己就能干。右边原始日志散在几百万个文件里，急刹藏在某个字段里，要工程师写 Spark 作业扫一遍，几十分钟，而且每个人解释方式可能不一样。所以常用指标要进仓库。",
    tone: "is-warn",
  },
  train: {
    left: { boxes: [{ label: "清洗、定好表结构", sub: "清洗时把图片扔了" }, { label: "整齐的表", sub: "只有“急刹发生过”这个事实", on: true }, { label: "SQL 查询", sub: "" }], result: "训练要的原始帧已经没了", note: "清洗是有损的，仓库只剩摘要", bad: true },
    right: { boxes: [{ label: "原样丢进对象存储", sub: "急刹前后 10 秒的原始帧都在", on: true }, { label: "按日期和车辆分目录", sub: "" }, { label: "读的时候再解释", sub: "训练脚本直接读 Parquet 和图片", on: true }], result: "从湖里取原始帧组成数据集", note: "训练要的是原始数据，不是摘要" },
    narr: "训练要“急刹前后 10 秒的原始摄像头帧”。左边仓库在清洗时只留了“哪辆车何时急刹”这个事实，图片早扔了。右边湖里原始帧都在，按目录就能找到，训练脚本直接读。所以现在的主流是湖仓一体（lakehouse）：原始数据在湖里，常用指标用 Iceberg、Delta 这类表格式在湖上直接建成仓库的表，不用再拷一份。",
    tone: "is-good",
  },
};

function Column({ x, title, side, color }: { x: number; title: string; side: Side; color: string }) {
  return (
    <g transform={`translate(${x} 0)`}>
      <text x={COL_W / 2} y={12} fontSize={11} fontWeight={600} textAnchor="middle" fill="#3b4234">{title}</text>
      {side.boxes.map((b, i) => (
        <g key={i} transform={`translate(0 ${22 + i * 34})`}>
          <rect x={0} y={0} width={COL_W} height={28} rx={5} fill={b.on ? "#eef5fd" : "#fff"} stroke={b.on ? color : "#e4dfcb"} strokeWidth={b.on ? 1.8 : 1} />
          <text x={8} y={12} fontSize={10} fontWeight={600} fill="#30332c">{b.label}</text>
          <text x={8} y={23} fontSize={8.5} fill={LINE}>{b.sub}</text>
          {i < side.boxes.length - 1 && <text x={COL_W / 2} y={33} fontSize={10} textAnchor="middle" fill="#c9c4ad">↓</text>}
        </g>
      ))}
      <text x={0} y={136} fontSize={9.5} fontWeight={600} fill={side.bad ? "#d03b3b" : "#0b7a4b"}>{side.result}</text>
      <text x={0} y={150} fontSize={9} fill={side.bad ? "#d03b3b" : LINE}>{side.note}</text>
    </g>
  );
}

export default function WarehouseVsLakeDiagram() {
  const [action, setAction] = useState<Action>("none");
  const s = STATES[action];
  const W = COL_W * 2 + 24;
  const H = 156;
  return (
    <VisualizationFrame
      title="数据仓库 vs 数据湖：先定结构再存，还是先存了再说"
      description="左边仓库，右边湖。三个按钮是数据平台每天都在面对的三件事。"
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${action === "ingest" ? " is-on" : ""}`} onClick={() => setAction("ingest")}>一天 50 TB 原始日志来了</button>
        <button type="button" className={`viz-btn${action === "analyst" ? " is-on" : ""}`} onClick={() => setAction("analyst")}>分析师查一个指标</button>
        <button type="button" className={`viz-btn${action === "train" ? " is-on" : ""}`} onClick={() => setAction("train")}>训练要原始帧</button>
        <button type="button" className="viz-btn" onClick={() => setAction("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={s.narr}>
          <Column x={0} title="数据仓库（warehouse）" side={s.left} color={C1} />
          <line x1={COL_W + 12} y1={4} x2={COL_W + 12} y2={H - 4} stroke="#e4dfcb" strokeDasharray="3 3" />
          <Column x={COL_W + 24} title="数据湖（lake）" side={s.right} color={C2} />
        </svg>
      </div>
      <div className={`viz-narr${s.tone ? ` ${s.tone}` : ""}`}>{s.narr}</div>
    </VisualizationFrame>
  );
}
