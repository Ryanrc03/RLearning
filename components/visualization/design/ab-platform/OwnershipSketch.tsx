import { SK, SkArrow, SkBox, SketchFigure, SkText } from "@/components/visualization/sketch/Sketch";

const INFRA = ["Runtime (servers / containers)", "PostgreSQL instance", "Backups · upgrades · HA", "SSO · network isolation", "Secrets management", "Standard release pipeline", "Host & DB monitoring"];
const APP = ["Schema · migrations · indexes", "Ingestion & cleaning jobs", "FastAPI endpoints", "Stats module + tests", "React dashboard", "Metric definitions", "Data-freshness & quality checks"];

// Who owns what when an internal platform ships inside a company. Generic roles, no specific tools.
export default function OwnershipSketch() {
  const col = (x: number, title: string, tone: "violet" | "blue", items: string[], seed: string) => (
    <g>
      <SkBox x={x} y={20} w={330} h={330} seed={seed} tone={tone} dashed radius={16} />
      <SkText x={x + 165} y={54} size={24} color={SK[tone].stroke}>{title}</SkText>
      {items.map((it, i) => (
        <g key={it}>
          <SkBox x={x + 22} y={72 + i * 38} w={286} h={30} seed={`${seed}-${i}`} stroke={SK[tone].stroke} fill="#fff" radius={8} strokeWidth={1.2} roughness={0.8} />
          <SkText x={x + 165} y={93 + i * 38} size={16}>{it}</SkText>
        </g>
      ))}
    </g>
  );
  return (
    <SketchFigure
      title="部署分工：谁负责什么"
      caption="两边的接口是一份清楚的需求：要几个服务、多少资源、哪些数据库权限、哪些配置。具体用什么部署工具取决于公司已有的基础设施，这里不展开。"
      minWidth={620}
    >
      <svg viewBox="0 0 900 370" role="img" aria-label="Infra Team 与 Application Team 的职责">
        {col(20, "Infra Team", "violet", INFRA, "own-infra")}
        {col(550, "Application Team", "blue", APP, "own-app")}
        <SkArrow seed="own-req" points={[[540, 150], [362, 150]]} />
        <SkText x={451} y={138} size={16}>needs: resources,</SkText>
        <SkText x={451} y={176} size={16}>permissions, config</SkText>
        <SkArrow seed="own-give" points={[[362, 240], [540, 240]]} />
        <SkText x={451} y={228} size={16}>provides: env, DB,</SkText>
        <SkText x={451} y={266} size={16}>credentials via secrets</SkText>
      </svg>
    </SketchFigure>
  );
}
