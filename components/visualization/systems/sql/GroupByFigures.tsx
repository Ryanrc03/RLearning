'use client';

import { useState } from 'react';
import { CLICK_EVENTS, aggregationSql, dollars, filterEvents, filterSql, groupEvents, groupSql, type Aggregate, type FilterMode, type KeyMode } from '@/lib/systems/sql/groupBy';
import { Choices, Groups, RawEvents, Results, SqlCode, SqlFrame } from './SqlViews';

export function WhyGroupBy() {
  const groups = groupEvents(CLICK_EVENTS,'adId');
  return <SqlFrame title="从点击明细到广告报表" description="同一批 8 行数据，换一个回答问题的粒度。">
    <RawEvents />
    <p className="sql-arrow">↓ GROUP BY adId · 相同广告放入同一个组</p>
    <Groups groups={groups} showCount={false} />
    <p className="sql-arrow">↓ COUNT(*) · 对每个组数行数</p>
    <Results groups={groups} />
    <div className="sql-summary">8 rows → 3 groups → 3 result rows</div>
  </SqlFrame>;
}
export function GroupByPlayground() {
  const [mode, setMode] = useState<KeyMode>('adId');
  const groups = groupEvents(CLICK_EVENTS, mode);
  return <SqlFrame title="GROUP BY Playground" description="切换 Key，观察同一条 event 被放进哪个组。" footnote="演示按 Key 排列，方便比较；SQL GROUP BY 本身不保证输出顺序。">
    <Choices label="分组键" value={mode} onChange={setMode} options={[{value:'adId',label:'adId'},{value:'minute',label:'minute'},{value:'both',label:'adId, minute'}]} />
    <SqlCode>{groupSql(mode)}</SqlCode>
    <div aria-live="polite" aria-atomic="true">
      <div className="sql-summary">8 raw rows → {groups.length} groups → {groups.length} result rows</div>
      <div className="sql-columns"><div><h5>Group membership → COUNT(*)</h5><Groups groups={groups} /></div><Results groups={groups} mode={mode} /></div>
      <p className="viz-narr">{mode === 'both' ? '联合 Key 是 (adId, minute)：两列都相同才在同一组。A 的两分钟形成两个组；这不是分别做两次统计。' : `每个不同的 ${mode} 对应一个组；COUNT(*) 计算这个组中的输入行数。`}</p>
    </div>
  </SqlFrame>;
}
export function AggregationPlayground() {
  const [op,setOp] = useState<Aggregate>('COUNT');
  const groups = groupEvents(CLICK_EVENTS,'adId');
  const value = (g: typeof groups[number]) => op === 'COUNT' ? g.count : op === 'SUM' ? g.sumCents : g.avgCents;
  const max = Math.max(...groups.map(value));
  const formatted = (g: typeof groups[number]) => op === 'COUNT' ? `${g.count} clicks` : `$${dollars(value(g))}`;
  return <SqlFrame title="同样的组，不同的问题" description="固定 GROUP BY adId，只改变聚合函数。">
    <Choices label="聚合函数" value={op} onChange={setOp} options={[{value:'COUNT',label:'COUNT(*)'},{value:'SUM',label:'SUM(cost)'},{value:'AVG',label:'AVG(cost)'}]} />
    <SqlCode>{aggregationSql(op)}</SqlCode>
    <div aria-live="polite" aria-atomic="true">
      <p className="sql-summary">{op === 'COUNT' ? '每个广告有多少次点击？单位：clicks' : op === 'SUM' ? '每个广告的点击费用合计多少？单位：USD' : '每个广告平均每次点击花多少？单位：USD / click'}</p>
      <div className="sql-bars" role="img" aria-label={groups.map(g=>`${g.key}: ${formatted(g)}`).join('；')}>
        {groups.map((g,i) => <div className={`sql-bar-row sql-color-${i}`} key={g.key}><b>{g.key}</b><div className="sql-bar-track"><div className="sql-bar" style={{width:`${value(g)/max*100}%`}} /></div><span>{formatted(g)}</span></div>)}
      </div>
      <div className="sql-table-wrap"><table className="viz-table"><caption>SQL Result 与计算过程</caption><thead><tr><th scope="col">adId</th><th scope="col">{op === 'COUNT' ? 'clicks' : op === 'SUM' ? 'totalCost (USD)' : 'avgCost (USD)'}</th><th scope="col">怎么算</th></tr></thead><tbody>{groups.map(g=><tr key={g.key}><td>{g.key}</td><td>{op==='COUNT'?g.count:dollars(value(g))}</td><td>{op === 'COUNT' ? `${g.rows.map(r=>r.eventId).join(', ')} → ${g.count} 行` : `${op==='AVG'?'(':''}${g.rows.map(r=>dollars(r.costCents)).join(' + ')}${op==='AVG'?`) ÷ ${g.count}`:''} = ${dollars(value(g))}`}</td></tr>)}</tbody></table></div>
    </div>
  </SqlFrame>;
}
export function FilterPlayground() {
  const [mode,setMode] = useState<FilterMode>('none');
  const {rows,groups,result} = filterEvents(mode);
  return <SqlFrame title="WHERE vs HAVING · 数据经过了什么" description="从上到下读：先过滤行，再分组聚合，最后过滤组。" footnote="这是帮助理解的逻辑处理顺序，不代表数据库的物理执行计划。">
    <Choices label="过滤方式" value={mode} onChange={setMode} options={[{value:'none',label:'No Filter'},{value:'where',label:'WHERE cost ≥ 0.40'},{value:'having',label:'HAVING COUNT(*) ≥ 2'}]} />
    <SqlCode>{filterSql(mode)}</SqlCode>
    <div className="sql-pipeline" aria-live="polite">
      <div className="sql-stage"><b>01 · Raw Data → WHERE</b><p>{mode==='where' ? '8 → 5 rows：按 cost ≥ $0.40 保留原始行。' : '8 → 8 rows：没有 WHERE，不过滤原始行。'}</p><RawEvents kept={rows} /></div>
      <div className="sql-stage"><b>02 · GROUP BY adId</b><p>{rows.length} rows → {groups.length} groups；组内成员如下。</p><Groups groups={groups} showCount={false} /></div>
      <div className="sql-stage"><b>03 · COUNT(*)</b><Results groups={groups} heading="聚合后的全部组" /></div>
      <div className="sql-stage"><b>04 · HAVING → Results</b><p>{mode==='having' ? '3 → 2 groups：A (4) 和 B (3) 保留，C (1) 被过滤。' : '3 → 3 groups：没有 HAVING，保留全部组。'}</p><Results groups={result} heading="最终结果" /></div>
    </div>
  </SqlFrame>;
}
export function AdsAggregationFlow() {
  return <SqlFrame title="Ad Click Aggregator · 批量统计" description="示意架构：把明细变成广告主可以快速查询的分钟报表。">
    <ol className="sql-architecture">{[
      ['Click Events','广告点击明细'],['Click DB','保存输入记录'],['Spark Batch Aggregation','多个 Worker 并行聚合'],['GROUP BY (adId, minute)','每广告、每分钟一组'],['OLAP Database','写入聚合结果'],['Advertiser Dashboard','查询分钟点击量'],
    ].map(([name,description])=><li key={name}><strong>{name}</strong><span>{description}</span></li>)}</ol>
  </SqlFrame>;
}
