type ActivityNote = {
  slug: string;
  title: string;
  created: string;
  updated: string;
};

export type ActivityDay = {
  date: string;
  count: number;
  level: number;
  isFuture: boolean;
  titles: string[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_COUNT = 26;

function chicagoDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)!.value;

  return `${part("year")}-${part("month")}-${part("day")}`;
}

function dateTimestamp(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp : null;
}

/**
 * Summarize recorded creation and latest-update dates, not a full edit history.
 * UTC calendar arithmetic keeps daily cells stable across daylight saving time.
 */
export function getActivityData(notes: readonly ActivityNote[], now = new Date()) {
  const today = chicagoDate(now);
  const todayTimestamp = dateTimestamp(today)!;
  const weekday = new Date(todayTimestamp).getUTCDay();
  const startTimestamp = todayTimestamp - (weekday + (WEEK_COUNT - 1) * 7) * DAY_MS;
  const updatesByDate = new Map<string, Map<string, string>>();

  for (const note of notes) {
    for (const date of new Set([note.created, note.updated])) {
      const timestamp = dateTimestamp(date);
      if (timestamp === null || timestamp < startTimestamp || timestamp > todayTimestamp) {
        continue;
      }
      const entries = updatesByDate.get(date) ?? new Map<string, string>();
      entries.set(note.slug, note.title);
      updatesByDate.set(date, entries);
    }
  }

  const days: ActivityDay[] = Array.from({ length: WEEK_COUNT * 7 }, (_, index) => {
    const timestamp = startTimestamp + index * DAY_MS;
    const date = new Date(timestamp).toISOString().slice(0, 10);
    const titles = Array.from(updatesByDate.get(date)?.values() ?? []);
    return {
      date,
      count: titles.length,
      level: Math.min(titles.length, 4),
      isFuture: timestamp > todayTimestamp,
      titles,
    };
  });

  const months: { label: string; column: number }[] = [];
  let previousMonth = "";
  for (const [index, day] of days.entries()) {
    const month = day.date.slice(0, 7);
    if (day.isFuture || month === previousMonth) continue;
    months.push({
      label: new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(
        new Date(`${day.date}T00:00:00Z`),
      ),
      column: Math.floor(index / 7) + 1,
    });
    previousMonth = month;
  }

  return {
    days,
    months,
    weeks: WEEK_COUNT,
    today,
    totalNotes: notes.length,
    activeDays: days.filter((day) => day.count > 0).length,
    totalUpdates: days.reduce((sum, day) => sum + day.count, 0),
  };
}
