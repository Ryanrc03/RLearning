import { noteEntries } from "@/content/notes";
import { getActivityData } from "@/lib/activity";
import { noteText, t, type Lang } from "@/lib/i18n";

export default function LearningActivity({ lang = "zh" }: { lang?: Lang }) {
  // Day tooltips list note titles in the page language where a translation exists.
  const activity = getActivityData(noteEntries.map((note) => ({ ...note, title: noteText(note, lang).title })));

  return (
    <section className="activity-panel" aria-labelledby="learning-activity-heading">
      <div className="activity-intro">
        <div>
          <p className="activity-eyebrow">LEARNING ACTIVITY</p>
          <h2 id="learning-activity-heading">{t(lang, "activityTitle")}</h2>
          <p>{t(lang, "activityBody")}</p>
        </div>
        <span className="activity-period">{t(lang, "activityPeriod")}</span>
      </div>

      <div className="activity-graph">
        <div className="activity-months" aria-hidden="true">
          {activity.months.map((month) => (
            <span key={`${month.label}-${month.column}`} style={{ gridColumn: month.column }}>
              {month.label}
            </span>
          ))}
        </div>
        <div
          className="activity-grid"
          role="img"
          aria-label={t(lang, "activityAria", { updates: activity.totalUpdates, days: activity.activeDays })}
        >
          {activity.days.map((day) => (
            <span
              key={day.date}
              className={`activity-cell${day.isFuture ? " is-future" : ""}`}
              data-level={day.level}
              title={
                day.isFuture
                  ? t(lang, "activityFuture", { date: day.date })
                  : day.titles.length
                    ? t(lang, "activityDayTitles", { date: day.date, n: day.count, titles: day.titles.join(t(lang, "listSeparator")) })
                    : t(lang, "activityDay", { date: day.date, n: day.count })
              }
            />
          ))}
        </div>
        <div className="activity-legend" aria-hidden="true">
          <span>{t(lang, "activityLess")}</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <span key={level} className="activity-cell" data-level={level} />
          ))}
          <span>{t(lang, "activityMore")}</span>
        </div>
      </div>

      <dl className="activity-stats">
        <div className="activity-stat">
          <dt>{t(lang, "statNotes")}</dt>
          <dd>{activity.totalNotes.toString().padStart(2, "0")}</dd>
        </div>
        <div className="activity-stat">
          <dt>{t(lang, "statDays")}</dt>
          <dd>{activity.activeDays.toString().padStart(2, "0")}</dd>
        </div>
        <div className="activity-stat">
          <dt>{t(lang, "statUpdates")}</dt>
          <dd>{activity.totalUpdates.toString().padStart(2, "0")}</dd>
        </div>
      </dl>
    </section>
  );
}
