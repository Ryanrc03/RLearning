"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Action = "none" | "field" | "join" | "scale";
type Side = { lines: string[]; note: string; bad?: boolean };

const C1 = "#2a78d6";
const C2 = "#eb6834";
const LINE = "#76796f";
const COL_W = 300;

const STATES: Record<Action, { left: Side; right: Side; narr: string; tone?: string }> = {
  none: {
    left: { lines: ["vehicles(id, model, plant_id)", "  1 | Model-S | 7", "  2 | Model-X | 7", "plants(id, city)", "  7 | 上海"], note: "表有固定的列，表之间靠 id 关联" },
    right: { lines: ['{ "id": 1, "model": "Model-S",', '  "plant": { "city": "上海" } }', '{ "id": 2, "model": "Model-X",', '  "plant": { "city": "上海" } }'], note: "每条记录是一个自包含的文档，想放什么放什么" },
    narr: "左边关系型数据库（PostgreSQL、MySQL）：数据拆成几张表，每张表有固定的列，表之间靠 id 关联。右边文档型 NoSQL（MongoDB 这一类）：每条记录是一个自包含的 JSON，相关的东西直接嵌在里面。点按钮。",
  },
  field: {
    left: { lines: ["ALTER TABLE vehicles", "  ADD COLUMN lidar_model text;", "", "锁表、改所有行、历史行填 NULL", "改完才能写新字段"], note: "改结构是一件正式的事，要迁移", bad: true },
    right: { lines: ['{ "id": 3, "model": "Model-Y",', '  "lidar_model": "HDL-64" }', "", "直接写，老记录没有这个字段也没关系"], note: "没有固定结构，随手加" },
    narr: "新车型多了一个激光雷达字段。左边要改表结构：ALTER TABLE，大表上可能锁几分钟，老记录全部填空值，应用代码要和迁移一起上线。右边直接在新记录里多写一个字段，老记录没有就没有。NoSQL 换来的是灵活，代价是“哪些记录有这个字段”现在没人保证，读的代码得自己处理缺失。",
    tone: "is-warn",
  },
  join: {
    left: { lines: ["SELECT v.model, p.city", "FROM vehicles v", "JOIN plants p ON v.plant_id = p.id", "WHERE p.city = '上海';", "", "数据库自己算，一条 SQL"], note: "跨表查询是关系型的强项" },
    right: { lines: ["没有 join。要么：", "  把 plant 嵌进每辆车（已嵌）", "  改工厂名要改所有车的记录", "要么：", "  查两次，在应用里自己拼"], note: "跨记录的关联要自己维护", bad: true },
    narr: "问“上海工厂产的车有哪些型号”。左边一条 SQL，数据库做 join，不管几张表。右边没有 join：要么提前把工厂信息嵌进每辆车的文档里（查得快，但工厂改名要改几十万条记录），要么查两次自己拼。关系型把数据只存一份靠关联查，NoSQL 常常为了查得快而重复存。",
    tone: "is-warn",
  },
  scale: {
    left: { lines: ["单机写入到顶了", "分片：按 id 切到 10 台机器", "  跨分片的 join 和事务变得很难", "  很多团队这时候才上 NoSQL"], note: "横向扩展不是关系型的默认能力", bad: true },
    right: { lines: ["按 id 自动分到 10 台机器", "每个文档自包含，不需要跨机器 join", "写入线性扩展"], note: "文档自包含，天生好分片" },
    narr: "数据量涨 100 倍，单机写不动了。右边文档自包含，按 id 切到 10 台机器，每台各管一段，写入线性扩展。左边也能分片，但 join 和事务一旦跨机器就非常难，所以关系型通常先纵向加机器配置、加只读副本，实在不行才分片。NoSQL 流行起来的原因就是这一条：互联网规模的写入。",
    tone: "is-good",
  },
};

function Column({ x, title, side, color }: { x: number; title: string; side: Side; color: string }) {
  return (
    <g transform={`translate(${x} 0)`}>
      <text x={COL_W / 2} y={12} fontSize={11} fontWeight={600} textAnchor="middle" fill="#3b4234">{title}</text>
      <rect x={0} y={20} width={COL_W} height={90} rx={6} fill="#fff" stroke={color} strokeWidth={1.4} />
      {side.lines.map((l, i) => <text key={i} x={10} y={36 + i * 14} fontSize={9.5} className="mono" fill="#30332c">{l}</text>)}
      <text x={0} y={126} fontSize={9} fill={side.bad ? "#d03b3b" : LINE}>{side.note}</text>
    </g>
  );
}

export default function SqlVsNosqlDiagram() {
  const [action, setAction] = useState<Action>("none");
  const s = STATES[action];
  const W = COL_W * 2 + 24;
  const H = 132;
  return (
    <VisualizationFrame
      title="SQL vs NoSQL：几张表靠 id 关联，还是一个文档装下全部"
      description="同样是“车辆和它的工厂”。左边关系型数据库，右边文档型 NoSQL。三个按钮是三件常见的事。"
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${action === "field" ? " is-on" : ""}`} onClick={() => setAction("field")}>新车型多一个字段</button>
        <button type="button" className={`viz-btn${action === "join" ? " is-on" : ""}`} onClick={() => setAction("join")}>查上海工厂产的车</button>
        <button type="button" className={`viz-btn${action === "scale" ? " is-on" : ""}`} onClick={() => setAction("scale")}>数据量涨 100 倍</button>
        <button type="button" className="viz-btn" onClick={() => setAction("none")}>重置</button>
      </div>
      <div className="viz-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={s.narr}>
          <Column x={0} title="SQL：关系型，几张表" side={s.left} color={C1} />
          <line x1={COL_W + 12} y1={4} x2={COL_W + 12} y2={H - 4} stroke="#e4dfcb" strokeDasharray="3 3" />
          <Column x={COL_W + 24} title="NoSQL：文档型，一条装全" side={s.right} color={C2} />
        </svg>
      </div>
      <div className={`viz-narr${s.tone ? ` ${s.tone}` : ""}`}>{s.narr}</div>
    </VisualizationFrame>
  );
}
