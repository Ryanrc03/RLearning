import { SK, SkArrow, SkBox, SketchFigure, SkLine, SkText, type Tone } from "@/components/visualization/sketch/Sketch";

type Entity = { key: string; name: string; tone: Tone; x: number; y: number; w: number; fields: string[]; note: string };

// Teaching example: field names are illustrative, not a real company's schema.
const ENTITIES: Entity[] = [
  { key: "exp", name: "Experiment", tone: "violet", x: 20, y: 30, w: 220, fields: ["experiment_id  PK", "key, name", "primary_metric", "start / end, status"], note: "一个实验一行" },
  { key: "var", name: "Variant", tone: "blue", x: 330, y: 30, w: 220, fields: ["experiment_id  FK", "variant  (control | treatment)", "expected_share"], note: "预期分流比，用来查 SRM" },
  { key: "daily", name: "Daily Stats", tone: "green", x: 640, y: 30, w: 240, fields: ["experiment_id, variant  FK", "metric_date", "users, converted_users"], note: "PK = (实验, 组, 日期)" },
  { key: "raw", name: "Metric Snapshot", tone: "grey", x: 640, y: 236, w: 240, fields: ["experiment_id, variant", "bucket_minute", "payload, ingested_at"], note: "上游原样落一份，分钟级" },
];

const H = 150;

export default function EntitiesSketch() {
  return (
    <SketchFigure
      title="四个核心实体（教学示例）"
      caption="实线是外键关系，1 对 N。虚线是清洗任务：分钟级原始快照按天汇总成 Daily Stats。看板只查 Daily Stats，原始快照用于回溯和重算。"
      minWidth={620}
    >
      <svg viewBox="0 0 900 400" role="img" aria-label="Experiment、Variant、Daily Stats、Metric Snapshot 四个实体及其关系">
        {ENTITIES.map((e) => {
          const h = e.key === "raw" ? 140 : H;
          return (
            <g key={e.key}>
              <SkBox x={e.x} y={e.y} w={e.w} h={h} seed={`ent-${e.key}`} tone={e.tone} radius={10} />
              <SkText x={e.x + e.w / 2} y={e.y + 28} size={22} color={SK[e.tone].stroke}>{e.name}</SkText>
              <SkLine seed={`ent-sep-${e.key}`} points={[[e.x + 10, e.y + 40], [e.x + e.w - 10, e.y + 40]]} stroke={SK[e.tone].stroke} />
              {e.fields.map((f, i) => (
                <text key={f} x={e.x + 16} y={e.y + 64 + i * 21} fontSize={13} className="mono" fill={SK.ink} fontFamily="'Cascadia Code', Consolas, monospace">{f}</text>
              ))}
              <SkText x={e.x + e.w / 2} y={e.y + h + 24} size={16} color={SK.muted}>{e.note}</SkText>
            </g>
          );
        })}
        <SkArrow seed="rel-exp-var" points={[[244, 100], [326, 100]]} />
        <SkText x={285} y={90} size={16}>1 : N</SkText>
        <SkArrow seed="rel-var-daily" points={[[554, 100], [636, 100]]} />
        <SkText x={595} y={90} size={16}>1 : N</SkText>
        <SkArrow seed="rel-raw-daily" points={[[862, 232], [862, 184]]} dashed stroke={SK.green.stroke} />
        <SkText x={540} y={290} size={17} color={SK.green.stroke}>clean + roll up by day</SkText>
      </svg>
    </SketchFigure>
  );
}
