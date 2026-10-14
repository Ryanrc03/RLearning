import { noteEntries } from "@/content/notes";
import { getActivityData } from "@/lib/activity";

export default function LearningActivity() {
  const activity = getActivityData(noteEntries);

  return (
    <section className="activity-panel" aria-labelledby="learning-activity-heading">
      <div className="activity-intro">
        <div>
          <p className="activity-eyebrow">LEARNING ACTIVITY</p>
          <h2 id="learning-activity-heading">每一点积累，都算数。</h2>
          <p>记录笔记的创建与最近更新，慢慢把知识连成线。</p>
        </div>
        <span className="activity-period">过去 26 周</span>
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
          aria-label={`过去 26 周的笔记更新：${activity.totalUpdates} 次更新，${activity.activeDays} 个活跃日。每天一个方格，颜色越深表示当天更新的笔记越多。`}
        >
          {activity.days.map((day) => (
            <span
              key={day.date}
              className={`activity-cell${day.isFuture ? " is-future" : ""}`}
              data-level={day.level}
              title={
                day.isFuture
                  ? `${day.date} · 尚未到来`
                  : `${day.date} · ${day.count} 篇笔记更新${day.titles.length ? `：${day.titles.join("、")}` : ""}`
              }
            />
          ))}
        </div>
        <div className="activity-legend" aria-hidden="true">
          <span>少</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <span key={level} className="activity-cell" data-level={level} />
          ))}
          <span>多</span>
        </div>
      </div>

      <dl className="activity-stats">
        <div className="activity-stat">
          <dt>篇公开笔记</dt>
          <dd>{activity.totalNotes.toString().padStart(2, "0")}</dd>
        </div>
        <div className="activity-stat">
          <dt>个活跃日</dt>
          <dd>{activity.activeDays.toString().padStart(2, "0")}</dd>
        </div>
        <div className="activity-stat">
          <dt>次笔记更新</dt>
          <dd>{activity.totalUpdates.toString().padStart(2, "0")}</dd>
        </div>
      </dl>
    </section>
  );
}
