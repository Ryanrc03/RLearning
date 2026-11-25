import type { ReactNode } from 'react';
import VisualizationFrame from '@/components/visualization/VisualizationFrame';
import { CLICK_EVENTS, dollars, groupColumns, type ClickEvent, type ClickGroup, type KeyMode } from '@/lib/systems/sql/groupBy';

export function SqlFrame({ title, description, children, footnote }: { title: string; description?: string; children: ReactNode; footnote?: ReactNode }) {
  return <div className="sql-viz"><VisualizationFrame title={title} description={description} footnote={footnote}>{children}</VisualizationFrame></div>;
}
export function Choices<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: readonly { value: T; label: string }[]; onChange: (value: T) => void }) {
  return <fieldset className="sql-choices"><legend>{label}</legend><div>{options.map(option => <label key={option.value} className={option.value === value ? 'is-selected' : ''}>
    <input type="radio" name={label} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} />{option.label}
  </label>)}</div></fieldset>;
}
export function SqlCode({ children }: { children: string }) {
  return <pre className="sql-code" tabIndex={0} aria-label="SQL 示例"><code>{children}</code></pre>;
}
export function RawEvents({ rows = CLICK_EVENTS, kept }: { rows?: readonly ClickEvent[]; kept?: readonly ClickEvent[] }) {
  return <div className="sql-table-wrap" tabIndex={0} role="region" aria-label="ClickEvents 数据表"><table className="viz-table"><caption>ClickEvents · {rows.length} rows · cost 单位 USD</caption><thead><tr><th scope="col">eventId</th><th scope="col">adId</th><th scope="col">minute</th><th scope="col">cost</th>{kept && <th scope="col">WHERE</th>}</tr></thead>
    <tbody>{rows.map((row,i) => <tr key={`${row.eventId}-${i}`} className={kept && !kept.includes(row) ? 'sql-removed' : ''}><td>{row.eventId}</td><td>{row.adId}</td><td>{row.minute}</td><td>${dollars(row.costCents)}</td>{kept && <td>{kept.includes(row) ? '保留' : '过滤'}</td>}</tr>)}</tbody></table></div>;
}
export function Groups({ groups, showCount = true }: { groups: readonly ClickGroup[]; showCount?: boolean }) {
  return <div className="sql-groups">{groups.map((group,i) => <div key={group.key} className={`sql-group sql-color-${i % 5}`}>
    <div><strong>({group.values.join(', ')})</strong>{showCount && <span>{group.count} clicks</span>}</div>
    <div className="sql-events">{group.rows.map((row,j) => <span key={`${row.eventId}-${j}`}>{row.eventId}</span>)}</div>
  </div>)}</div>;
}
export function Results({ groups, mode = 'adId', heading = 'SQL Result' }: { groups: readonly ClickGroup[]; mode?: KeyMode; heading?: string }) {
  return <div className="sql-table-wrap" tabIndex={0} role="region" aria-label={heading}><table className="viz-table"><caption>{heading} · {groups.length} rows</caption><thead><tr>{groupColumns(mode).map(column => <th scope="col" key={column}>{column}</th>)}<th scope="col">clicks</th></tr></thead><tbody>{groups.map(group => <tr key={group.key}>{group.values.map((v,i) => <td key={i}>{v}</td>)}<td>{group.count}</td></tr>)}</tbody></table></div>;
}
