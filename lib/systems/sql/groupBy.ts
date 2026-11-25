export type ClickEvent = { eventId: string; adId: string; minute: string; costCents: number };
export type KeyMode = 'adId' | 'minute' | 'both';
export type Aggregate = 'COUNT' | 'SUM' | 'AVG';
export type FilterMode = 'none' | 'where' | 'having';
export type ClickGroup = { key: string; values: string[]; rows: readonly ClickEvent[]; count: number; sumCents: number; avgCents: number };
export const CLICK_EVENTS: readonly ClickEvent[] = [
  { eventId: 'e1', adId: 'A', minute: '10:00', costCents: 30 },
  { eventId: 'e2', adId: 'A', minute: '10:00', costCents: 50 },
  { eventId: 'e3', adId: 'B', minute: '10:00', costCents: 40 },
  { eventId: 'e4', adId: 'A', minute: '10:01', costCents: 20 },
  { eventId: 'e5', adId: 'B', minute: '10:01', costCents: 60 },
  { eventId: 'e6', adId: 'B', minute: '10:01', costCents: 20 },
  { eventId: 'e7', adId: 'C', minute: '10:00', costCents: 70 },
  { eventId: 'e8', adId: 'A', minute: '10:01', costCents: 40 },
];
export const groupColumns = (mode: KeyMode) => mode === 'both' ? ['adId', 'minute'] : [mode];
export function groupEvents(rows: readonly ClickEvent[], mode: KeyMode): ClickGroup[] {
  const buckets = new Map<string, { values: string[]; rows: ClickEvent[] }>();
  for (const row of rows) {
    const values = mode === 'both' ? [row.adId, row.minute] : [row[mode]];
    const id = JSON.stringify(values);
    const bucket = buckets.get(id) ?? { values, rows: [] };
    bucket.rows.push(row);
    buckets.set(id, bucket);
  }
  return [...buckets.values()].map(({ values, rows }) => {
    const sumCents = rows.reduce((sum, row) => sum + row.costCents, 0);
    return { key: values.join(' · '), values, rows, count: rows.length, sumCents, avgCents: sumCents / rows.length };
  }).sort((a,b) => a.key.localeCompare(b.key));
}
export function filterEvents(mode: FilterMode) {
  const rows = mode === 'where' ? CLICK_EVENTS.filter(row => row.costCents >= 40) : CLICK_EVENTS;
  const groups = groupEvents(rows, 'adId');
  const result = mode === 'having' ? groups.filter(group => group.count >= 2) : groups;
  return { rows, groups, result };
}
export const dollars = (cents: number) => (cents / 100).toFixed(2);
export function groupSql(mode: KeyMode) {
  const columns = groupColumns(mode).join(', ');
  return `SELECT ${columns}, COUNT(*) AS clicks\nFROM ClickEvents\nGROUP BY ${columns};`;
}
export function aggregationSql(op: Aggregate) {
  return `SELECT adId, ${op}(${op === 'COUNT' ? '*' : 'cost'}) AS ${op === 'COUNT' ? 'clicks' : op === 'SUM' ? 'totalCost' : 'avgCost'}\nFROM ClickEvents\nGROUP BY adId;`;
}
export function filterSql(mode: FilterMode) {
  return `SELECT adId, COUNT(*) AS clicks\nFROM ClickEvents${mode === 'where' ? '\nWHERE cost >= 0.40' : ''}\nGROUP BY adId${mode === 'having' ? '\nHAVING COUNT(*) >= 2' : ''};`;
}
