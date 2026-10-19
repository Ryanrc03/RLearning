"use client";

import { useState, type KeyboardEvent } from "react";
import { SK, SkArrow, SkBox, SkCylinder, SketchFigure, SkPerson, SkText } from "@/components/visualization/sketch/Sketch";

type Fr = "fr1" | "fr2" | "fr3";
type NodeId = "user" | "react" | "api" | "stats" | "db" | "upstream" | "worker";

const FRS: { id: Fr | "all"; label: string }[] = [
  { id: "fr1", label: "FR1 数据自动进库" },
  { id: "fr2", label: "FR2 按实验 / 日期查看" },
  { id: "fr3", label: "FR3 给出统计结论" },
  { id: "all", label: "完整设计" },
];

const NODES: Record<NodeId, { title: string; frs: Fr[]; does: string[]; why: string }> = {
  user: { title: "Analyst / PM", frs: ["fr2"], does: ["打开看板，选实验和日期区间", "把看板链接发给同事讨论结论"], why: "使用者是公司内部的分析师、产品和算法工程师，几十人规模，不是公网流量。" },
  react: { title: "React Dashboard", frs: ["fr2"], does: ["保存三个筛选状态：实验、开始日期、结束日期", "把状态写进 URL，发请求，拿 JSON 渲染表格和曲线", "不连数据库，不算统计量"], why: "前端只管交互和展示，换图表库不会改变任何数字。" },
  api: { title: "FastAPI Service", frs: ["fr2", "fr3"], does: ["校验参数（类型声明 + 日期顺序）", "用参数化 SQL 查 PostgreSQL", "调用统计模块，返回 JSON"], why: "所有看板共用一个后端，统计逻辑只有一份实现。" },
  stats: { title: "Stats module", frs: ["fr3"], does: ["转化率、差值、相对 lift", "双比例 z 检验、95% 置信区间", "SRM 检查：两组人数比和预期分流比是否一致"], why: "纯 Python 函数，输入两行汇总、输出结论，可以单独写单元测试。原来散落在各个 Notebook 里的就是这段逻辑。" },
  db: { title: "PostgreSQL", frs: ["fr1", "fr2", "fr3"], does: ["唯一的数据源：实验元数据 + 每日每组统计 + 原始快照", "主键、外键、CHECK 约束在写入时挡住脏数据", "WHERE + GROUP BY 在库里完成，只返回两行"], why: "表格型数据、固定列、要关联和聚合，正是关系型数据库的强项；数据量单机装得下。" },
  upstream: { title: "Upstream Business API", frs: ["fr1"], does: ["上游业务方维护，每分钟更新一次", "分流（谁进哪个组）在上游完成"], why: "平台只读不写，也不负责随机分流。" },
  worker: { title: "Ingestion Worker", frs: ["fr1"], does: ["定时拉取水位线之后的新数据", "原样写入 raw 快照，再清洗、校验", "按 (实验, 组, 日期) 汇总后 upsert"], why: "清洗规则写成代码，每次一样地执行；写入幂等，重跑不会多出行。" },
};

type Edge = { id: string; frs: Fr[]; points: [number, number][]; label: string; lx: number; ly: number; head?: "end" | "both"; color?: string };
const EDGES: Edge[] = [
  { id: "u-r", frs: ["fr2"], points: [[78, 120], [126, 120]], label: "", lx: 0, ly: 0 },
  { id: "r-a", frs: ["fr2"], points: [[302, 120], [396, 120]], label: "GET /summary", lx: 349, ly: 108, head: "both" },
  { id: "a-d", frs: ["fr2", "fr3"], points: [[640, 120], [726, 120]], label: "SQL", lx: 683, ly: 108, head: "both" },
  { id: "up-w", frs: ["fr1"], points: [[322, 360], [396, 360]], label: "pull", lx: 359, ly: 348 },
  { id: "w-d", frs: ["fr1"], points: [[642, 340], [700, 300], [770, 210]], label: "UPSERT", lx: 740, ly: 300, color: SK.green.stroke },
];


export default function HighLevelDesignViz() {
  const [fr, setFr] = useState<Fr | "all">("all");
  const [sel, setSel] = useState<NodeId>("db");
  const lit = (frs: Fr[]) => fr === "all" || frs.includes(fr);
  const node = NODES[sel];

  const nodeProps = (id: NodeId) => ({
    role: "button" as const, tabIndex: 0, "aria-pressed": sel === id, "aria-label": NODES[id].title,
    onClick: () => setSel(id),
    onKeyDown: (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(id); } },
    style: { opacity: lit(NODES[id].frs) ? 1 : 0.22, transition: "opacity .2s" },
  });
  const sw = (id: NodeId) => (sel === id ? 2.6 : 1.6);

  return (
    <SketchFigure
      title="High-level Design：按功能需求一条条加组件"
      caption="选一条需求，只亮出满足它的组件；点组件看它负责什么。数据库旁边写着关键表（教学示例）。"
      minWidth={660}
    >
      <div className="sk-chips" role="group" aria-label="按需求查看">
        {FRS.map((f) => <button key={f.id} type="button" className={`sk-chip${fr === f.id ? " is-on" : ""}`} onClick={() => setFr(f.id)}>{f.label}</button>)}
      </div>
      <svg viewBox="0 0 1060 440" role="group" aria-label="高层架构图">
        {EDGES.map((e) => (
          <g key={e.id} style={{ opacity: lit(e.frs) ? 1 : 0.18, transition: "opacity .2s" }}>
            <SkArrow seed={`hld-${e.id}`} points={e.points} head={e.head ?? "end"} stroke={e.color ?? SK.ink} curve={e.points.length > 2} />
            {e.label && <SkText x={e.lx} y={e.ly} size={16} color={e.color ?? SK.ink}>{e.label}</SkText>}
          </g>
        ))}

        <g {...nodeProps("user")}>
          <rect x={20} y={70} width={70} height={110} fill="transparent" />
          <SkPerson x={52} y={82} seed="hld-user" stroke={sel === "user" ? SK.teal.stroke : SK.ink} />
          <SkText x={52} y={172} size={16}>Analyst</SkText>
        </g>
        <g {...nodeProps("react")}>
          <SkBox x={130} y={80} w={170} h={80} seed="hld-react" tone="blue" strokeWidth={sw("react")} />
          <SkText x={215} y={116} size={21}>React</SkText>
          <SkText x={215} y={140} size={17} color={SK.blue.stroke}>Dashboard</SkText>
        </g>
        <g {...nodeProps("api")}>
          <SkBox x={400} y={50} w={238} h={140} seed="hld-api" tone="orange" strokeWidth={sw("api")} />
          <SkText x={519} y={80} size={21}>FastAPI Service</SkText>
          <SkText x={519} y={102} size={15} color={SK.muted}>validate · query · respond</SkText>
        </g>
        <g {...nodeProps("stats")}>
          <SkBox x={430} y={116} w={178} h={56} seed="hld-stats" stroke={SK.orange.stroke} fill="#fff" dashed strokeWidth={sw("stats")} radius={10} />
          <SkText x={519} y={150} size={18} color={SK.orange.stroke}>Stats module</SkText>
        </g>
        <g {...nodeProps("db")}>
          <SkCylinder x={730} y={50} w={150} h={150} seed="hld-db" strokeWidth={sw("db")} />
          <SkText x={805} y={128} size={21}>PostgreSQL</SkText>
        </g>
        <g style={{ opacity: lit(["fr1", "fr2", "fr3"]) ? 1 : 0.2 }}>
          <SkBox x={900} y={44} w={150} h={170} seed="hld-schema" stroke={SK.muted} fill="#fff" dashed radius={8} />
          <SkText x={975} y={70} size={16} color={SK.muted}>tables</SkText>
          {["experiments", "variants", "daily_variant_stats", "raw_snapshots"].map((t, i) => (
            <text key={t} x={912} y={98 + i * 28} fontSize={11.5} fontFamily="'Cascadia Code', Consolas, monospace"
              fill={(t === "raw_snapshots" ? lit(["fr1"]) : true) ? SK.ink : SK.muted}>{t}</text>
          ))}
        </g>
        <g {...nodeProps("upstream")}>
          <SkBox x={110} y={320} w={210} h={80} seed="hld-up" tone="grey" dashed strokeWidth={sw("upstream")} />
          <SkText x={215} y={354} size={19}>Upstream</SkText>
          <SkText x={215} y={378} size={16} color={SK.muted}>Business API · 1 min</SkText>
        </g>
        <g {...nodeProps("worker")}>
          <SkBox x={400} y={300} w={238} h={110} seed="hld-worker" tone="violet" strokeWidth={sw("worker")} />
          <SkText x={519} y={334} size={21}>Ingestion Worker</SkText>
          <SkText x={519} y={362} size={16} color={SK.violet.stroke}>fetch → clean → validate</SkText>
          <SkText x={519} y={386} size={16} color={SK.violet.stroke}>→ roll up → upsert</SkText>
        </g>
        <SkText x={20} y={430} size={15} color={SK.muted} anchor="start">— Write path (scheduled)</SkText>
        <SkText x={20} y={24} size={15} color={SK.muted} anchor="start">— Read path (one HTTP request)</SkText>
      </svg>
      <div className="sk-panel">
        <h5>{node.title}</h5>
        <ul>{node.does.map((d) => <li key={d}>{d}</li>)}</ul>
        <div style={{ marginTop: 6, color: SK.muted }}>{node.why}</div>
      </div>
    </SketchFigure>
  );
}
