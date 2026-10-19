// Fictional data and the request path behind the A/B analytics platform case study.
// Nothing here mirrors a real system: table names, the endpoint and the metric are teaching examples.
// No React here; see tests/ab-platform.test.ts.

import { normalCdf, zTestTwoProportions } from "@/lib/ml/abtest";
import { createRng, randomNormal } from "@/lib/ml/random";

export type Experiment = {
  id: number;
  key: string;
  name: string;
  startDate: string;
  /** Daily new users per variant before noise. */
  dailyUsers: number;
  baseRate: number;
  /** True relative lift of treatment over control, used only to generate the fake rows. */
  trueLift: number;
};

export const EXPERIMENTS: Experiment[] = [
  { id: 101, key: "checkout_button_copy", name: "结算按钮文案", startDate: "2026-09-01", dailyUsers: 1200, baseRate: 0.082, trueLift: 0.06 },
  { id: 102, key: "search_ranking_v2", name: "搜索排序 v2", startDate: "2026-09-01", dailyUsers: 2600, baseRate: 0.145, trueLift: 0.015 },
  { id: 103, key: "onboarding_tooltip", name: "新手引导浮层", startDate: "2026-09-01", dailyUsers: 700, baseRate: 0.21, trueLift: 0 },
  { id: 104, key: "price_display_monthly", name: "价格按月展示", startDate: "2026-09-01", dailyUsers: 900, baseRate: 0.046, trueLift: -0.08 },
];

export const DAYS = 28;

export type Variant = "control" | "treatment";

/** One row of the teaching table daily_variant_stats. */
export type DailyRow = { experimentId: number; variant: Variant; metricDate: string; users: number; convertedUsers: number };

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Seeded so the dashboard shows the same numbers after every reload.
export function generateDailyRows(exp: Experiment, days = DAYS): DailyRow[] {
  const rng = createRng(exp.id * 7919);
  const rows: DailyRow[] = [];
  for (let d = 0; d < days; d += 1) {
    const date = addDays(exp.startDate, d);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const weekend = weekday === 0 || weekday === 6 ? 0.75 : 1;
    // Upstream assigns each user 50/50, so the two groups' daily counts differ only by binomial noise.
    const total = Math.max(2, Math.round(2 * exp.dailyUsers * weekend * (1 + randomNormal(rng, 0, 0.06))));
    const treated = Math.round(randomNormal(rng, total / 2, Math.sqrt(total / 4)));
    for (const variant of ["control", "treatment"] as const) {
      const users = Math.max(1, variant === "treatment" ? treated : total - treated);
      const rate = exp.baseRate * (variant === "treatment" ? 1 + exp.trueLift : 1);
      const mean = users * rate;
      const sd = Math.sqrt(users * rate * (1 - rate));
      const converted = Math.min(users, Math.max(0, Math.round(randomNormal(rng, mean, sd))));
      rows.push({ experimentId: exp.id, variant, metricDate: date, users, convertedUsers: converted });
    }
  }
  return rows;
}

export type Query = { experimentId: number; startDate: string; endDate: string };

export const SUMMARY_SQL = `SELECT s.variant,
       SUM(s.users)           AS users,
       SUM(s.converted_users) AS converted_users
FROM daily_variant_stats AS s
JOIN experiments AS e ON e.experiment_id = s.experiment_id
WHERE s.experiment_id = %(experiment_id)s
  AND s.metric_date BETWEEN %(start_date)s AND %(end_date)s
  AND e.status <> 'archived'
GROUP BY s.variant
ORDER BY s.variant;`;

export const DAILY_SQL = `SELECT metric_date, variant,
       converted_users::float / NULLIF(users, 0) AS rate
FROM daily_variant_stats
WHERE experiment_id = %(experiment_id)s
  AND metric_date BETWEEN %(start_date)s AND %(end_date)s
ORDER BY metric_date, variant;`;

/** What the WHERE clause does: the database filters, not the browser. */
export function filterRows(rows: DailyRow[], q: Query): DailyRow[] {
  return rows.filter((r) => r.experimentId === q.experimentId && r.metricDate >= q.startDate && r.metricDate <= q.endDate);
}

export type VariantTotals = { variant: Variant; users: number; convertedUsers: number };

/** What GROUP BY variant + SUM returns. */
export function groupByVariant(rows: DailyRow[]): VariantTotals[] {
  const acc: Record<Variant, VariantTotals> = {
    control: { variant: "control", users: 0, convertedUsers: 0 },
    treatment: { variant: "treatment", users: 0, convertedUsers: 0 },
  };
  for (const r of rows) {
    acc[r.variant].users += r.users;
    acc[r.variant].convertedUsers += r.convertedUsers;
  }
  return [acc.control, acc.treatment];
}

export type SummaryResponse = {
  experiment_id: number;
  experiment_key: string;
  date_range: { start: string; end: string; days: number };
  metric: "conversion_rate";
  variants: { variant: Variant; users: number; converted_users: number; rate: number }[];
  absolute_diff: number;
  relative_lift: number;
  ci95: [number, number];
  z: number;
  p_value: number;
  significant: boolean;
  /** Sample ratio mismatch: p-value that the observed split came from the planned 50/50. */
  srm_p_value: number;
  daily: { date: string; control: number; treatment: number }[];
};

const round = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d;

/** Sample ratio mismatch check: is the treatment share consistent with the planned share? */
export function srmPValue(control: number, treatment: number, expectedShare = 0.5): number {
  const n = control + treatment;
  if (n === 0) return 1;
  const z = (treatment - n * expectedShare) / Math.sqrt(n * expectedShare * (1 - expectedShare));
  return Math.min(1, 2 * (1 - normalCdf(Math.abs(z))));
}

/** The Python step: aggregate, run the two-proportion z test, shape JSON. */
export function buildSummary(exp: Experiment, q: Query, allRows: DailyRow[], alpha = 0.05): SummaryResponse {
  const rows = filterRows(allRows, q);
  const [c, t] = groupByVariant(rows);
  const zt = zTestTwoProportions(c.convertedUsers, c.users, t.convertedUsers, t.users);
  // Unpooled standard error for the interval, pooled one for the test, as usual.
  const seU = Math.sqrt((zt.pA * (1 - zt.pA)) / c.users + (zt.pB * (1 - zt.pB)) / t.users);
  const byDate = new Map<string, { control: number; treatment: number }>();
  for (const r of rows) {
    const e = byDate.get(r.metricDate) ?? { control: 0, treatment: 0 };
    e[r.variant] = r.users ? r.convertedUsers / r.users : 0;
    byDate.set(r.metricDate, e);
  }
  const days = byDate.size;
  return {
    experiment_id: exp.id,
    experiment_key: exp.key,
    date_range: { start: q.startDate, end: q.endDate, days },
    metric: "conversion_rate",
    variants: [c, t].map((v) => ({ variant: v.variant, users: v.users, converted_users: v.convertedUsers, rate: round(v.users ? v.convertedUsers / v.users : 0, 5) })),
    absolute_diff: round(zt.diff, 5),
    relative_lift: round(zt.pA ? zt.diff / zt.pA : 0, 4),
    ci95: [round(zt.diff - 1.96 * seU, 5), round(zt.diff + 1.96 * seU, 5)],
    z: round(zt.z, 3),
    p_value: round(zt.p, 4),
    significant: zt.p < alpha,
    srm_p_value: round(srmPValue(c.users, t.users), 4),
    daily: [...byDate.entries()].map(([date, v]) => ({ date, control: round(v.control, 4), treatment: round(v.treatment, 4) })),
  };
}
