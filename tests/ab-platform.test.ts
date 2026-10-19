import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, buildSummary, srmPValue, DAYS, EXPERIMENTS, filterRows, generateDailyRows, groupByVariant } from "@/lib/systems/abPlatform";

test("rows are deterministic and cover every day for both variants", () => {
  const exp = EXPERIMENTS[0];
  const a = generateDailyRows(exp);
  const b = generateDailyRows(exp);
  assert.deepEqual(a, b);
  assert.equal(a.length, DAYS * 2);
  for (const r of a) assert.ok(r.convertedUsers >= 0 && r.convertedUsers <= r.users);
});

test("addDays crosses month boundaries", () => {
  assert.equal(addDays("2026-09-30", 1), "2026-10-01");
});

test("date filter is inclusive on both ends", () => {
  const exp = EXPERIMENTS[1];
  const rows = filterRows(generateDailyRows(exp), { experimentId: exp.id, startDate: "2026-09-03", endDate: "2026-09-05" });
  assert.equal(rows.length, 6);
});

test("group by sums match the raw rows", () => {
  const exp = EXPERIMENTS[2];
  const rows = generateDailyRows(exp);
  const [c, t] = groupByVariant(rows);
  const total = rows.reduce((s, r) => s + r.users, 0);
  assert.equal(c.users + t.users, total);
});

test("a real positive lift on four weeks of traffic comes out significant, a null one does not", () => {
  const range = (e: (typeof EXPERIMENTS)[number]) => ({ experimentId: e.id, startDate: e.startDate, endDate: addDays(e.startDate, DAYS - 1) });
  const win = EXPERIMENTS[0];
  const s = buildSummary(win, range(win), generateDailyRows(win));
  assert.equal(s.significant, true);
  assert.ok(s.relative_lift > 0);
  assert.ok(s.ci95[0] > 0);
  const flat = EXPERIMENTS[2];
  const f = buildSummary(flat, range(flat), generateDailyRows(flat));
  assert.equal(f.significant, false);
  assert.ok(f.ci95[0] < 0 && f.ci95[1] > 0);
  assert.equal(f.daily.length, DAYS);
});

test("SRM flags a lopsided split but not a balanced one", () => {
  assert.ok(srmPValue(10000, 10050) > 0.05);
  assert.ok(srmPValue(10000, 10600) < 0.001);
  assert.equal(srmPValue(0, 0), 1);
});
