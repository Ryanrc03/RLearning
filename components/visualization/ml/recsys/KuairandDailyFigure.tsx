import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Figure from "@/components/visualization/ml/primitives/Figure";
import { dailySeries, type SplitName, splitRateTab1 } from "@/lib/ml/kuairandOverview";

// Recommender Systems, data overview, the static second figure: 31 days on one
// x axis. Top: exposures per day coloured by split. Bottom: the tab-1 like rate
// per day with each split's pooled rate dashed; the May Day holiday lifts it.

const W = 720;
const H = 340;
const X0 = 54;
const X1 = W - 14;
const TOP = { y0: 136, y1: 26 };
const BOT = { y0: 300, y1: 176 };
const COLOR: Record<SplitName, string> = { train: "var(--v1)", valid: "var(--v4)", test: "var(--v3)" };
const SPLIT_LABEL: Record<SplitName, string> = { train: "train", valid: "valid", test: "test" };

export default function KuairandDailyFigure() {
  const days = dailySeries();
  const step = (X1 - X0) / days.length;
  const cx = (i: number) => X0 + step * (i + 0.5);
  const maxExp = 450_000;
  const ey = (v: number) => TOP.y0 - (v / maxExp) * (TOP.y0 - TOP.y1);
  const [lo, hi] = [0.012, 0.026];
  const ly = (v: number) => BOT.y0 - ((v - lo) / (hi - lo)) * (BOT.y0 - BOT.y1);
  const splits: SplitName[] = ["train", "valid", "test"];
  const range = (s: SplitName) => {
    const idx = days.map((d, i) => (d.split === s ? i : -1)).filter((i) => i >= 0);
    return [idx[0], idx[idx.length - 1]] as const;
  };
  const holiday = [days.findIndex((d) => d.day === "04-30"), days.findIndex((d) => d.day === "05-04")];

  return (
    <VisualizationFrame
      title="31 天：每天多少曝光，tab 1 的点赞率怎么走"
      description="上：每天的推荐曝光数（全部 tab，不含随机曝光），颜色是它属于哪个集合。下：tab 1 每天的点赞率，虚线是该集合的整体点赞率。"
      footnote="随机曝光从 4/22 开始，每天 1–4 千条，单独作为无偏测试集，没画在这里。"
    >
      <Figure width={W} height={H} label="每日曝光数与 tab 1 点赞率">
        <rect x={cx(holiday[0]) - step / 2} y={TOP.y1 - 22} width={step * (holiday[1] - holiday[0] + 1)} height={BOT.y0 - TOP.y1 + 22} fill="#fdf3cd" opacity={0.7} />
        <text x={cx(holiday[0]) - step / 2 + 4} y={TOP.y1 - 9} fontSize={11} fill="#8a6d00" fontWeight={600}>五一假期</text>

        {[0, 200_000, 400_000].map((t) => (
          <g key={t}>
            <line x1={X0} y1={ey(t)} x2={X1} y2={ey(t)} stroke="#e4dfcb" />
            <text x={X0 - 6} y={ey(t) + 4} fontSize={11} textAnchor="end" fill="#76796f">{t === 0 ? "0" : `${t / 1000}k`}</text>
          </g>
        ))}
        <text x={X0} y={14} fontSize={11} fill="#76796f">每天曝光</text>
        {days.map((d, i) => (
          <rect key={d.day} x={cx(i) - step * 0.36} y={ey(d.exposures)} width={step * 0.72} height={TOP.y0 - ey(d.exposures)} rx={2} fill={COLOR[d.split]} opacity={0.85} />
        ))}
        {splits.map((s) => {
          const [a, b] = range(s);
          return (
            <text key={s} x={(cx(a) + cx(b)) / 2} y={TOP.y0 + 14} fontSize={11.5} textAnchor="middle" fill={COLOR[s]} fontWeight={600}>
              {SPLIT_LABEL[s]} {days[a].day.replace("-", "/")}–{days[b].day.replace("-", "/")}
            </text>
          );
        })}

        {[0.015, 0.02, 0.025].map((t) => (
          <g key={t}>
            <line x1={X0} y1={ly(t)} x2={X1} y2={ly(t)} stroke="#e4dfcb" />
            <text x={X0 - 6} y={ly(t) + 4} fontSize={11} textAnchor="end" fill="#76796f">{(t * 100).toFixed(1)}%</text>
          </g>
        ))}
        <text x={X0} y={BOT.y1 - 8} fontSize={11} fill="#76796f">tab 1 点赞率</text>
        {splits.map((s) => {
          const [a, b] = range(s);
          const r = splitRateTab1(s, "like");
          return (
            <g key={s}>
              <line x1={cx(a) - step / 2} y1={ly(r)} x2={cx(b) + step / 2} y2={ly(r)} stroke={COLOR[s]} strokeWidth={1.5} strokeDasharray="5 3" />
              <text x={cx(b) + step / 2 - 2} y={ly(r) - 5} fontSize={11} textAnchor="end" fill="#3b4234">{(r * 100).toFixed(2)}%</text>
            </g>
          );
        })}
        <polyline points={days.map((d, i) => `${cx(i)},${ly(d.likeRateTab1)}`).join(" ")} fill="none" stroke="#3b4234" strokeWidth={1.6} />
        {days.map((d, i) => (
          <circle key={d.day} cx={cx(i)} cy={ly(d.likeRateTab1)} r={3.2} fill={COLOR[d.split]} stroke="#fff" strokeWidth={1.2}>
            <title>{`${d.day}：点赞率 ${(d.likeRateTab1 * 100).toFixed(2)}%，点开率 ${(d.clickRateTab1 * 100).toFixed(1)}%，曝光 ${d.exposures.toLocaleString("en-US")}`}</title>
          </circle>
        ))}
        {[0, 8, 15, 22, 30].map((i) => (
          <text key={i} x={cx(i)} y={BOT.y0 + 16} fontSize={11} textAnchor="middle" fill="#76796f">{days[i].day.replace("-", "/")}</text>
        ))}
      </Figure>
      <div className="viz-legend">
        <span><i style={{ background: "var(--v1)" }} />train</span>
        <span><i style={{ background: "var(--v4)" }} />valid</span>
        <span><i style={{ background: "var(--v3)" }} />test</span>
      </div>
    </VisualizationFrame>
  );
}
