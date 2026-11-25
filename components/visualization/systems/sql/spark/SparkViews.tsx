import { useId, type ReactNode } from 'react';
import { SqlFrame } from '../SqlViews';

export function SparkFrame({children,...props}:{title:string;description?:string;footnote?:ReactNode;children:ReactNode}) {
  return <div className="spark-viz"><SqlFrame {...props}>{children}</SqlFrame></div>;
}
export function SparkCode({code,lang='python'}:{code:string;lang?:'python'|'sql'}) {
  // A deliberately small lexer for the curated examples; strings/comments are matched first.
  const tokens=code.split(/("[^"\n]*"|'[^'\n]*'|#[^\n]*|--[^\n]*|\b(?:from|import|for|in|lambda|as|return|SELECT|FROM|GROUP|BY|AS|COUNT|SUM|WHERE|AND)\b|\b\d+(?:\.\d+)?\b)/g);
  return <pre className="sql-code spark-code" tabIndex={0} aria-label={`${lang==='sql'?'SQL':'Python'} 示例`}><code>{tokens.map((token,i)=>{
    const kind=/^["']/.test(token)?'string':/^(#|--)/.test(token)?'comment':/^\d/.test(token)?'number':/^(from|import|for|in|lambda|as|return|SELECT|FROM|GROUP|BY|AS|COUNT|SUM|WHERE|AND)$/.test(token)?'keyword':'';
    return kind?<span className={`spark-token-${kind}`} key={i}>{token}</span>:token;
  })}</code></pre>;
}
export function SelectNodes({label,nodes,selected,onSelect}:{label:string;nodes:readonly string[];selected:number;onSelect:(i:number)=>void}) {
  return <div className="spark-node-controls" role="group" aria-label={label}>{nodes.map((node,i)=><button type="button" key={node} className={`spark-node ${selected===i?'is-selected':''}`} aria-pressed={selected===i} onClick={()=>onSelect(i)}>{node}</button>)}</div>;
}
export function Bars({labels,values,label}:{labels:string[];values:number[];label:string}) {
  const max=Math.max(1,...values);
  return <div className="spark-bars" role="img" aria-label={`${label}；${labels.map((s,i)=>`${s}: ${values[i].toLocaleString('en-US')}`).join('；')}`}>{values.map((value,i)=><div className={`spark-bar-row sql-color-${i%5}`} key={labels[i]}><span>{labels[i]}</span><div className="spark-bar-track"><div style={{width:`${value/max*100}%`,background:'var(--group-color)'}} /></div><b>{value.toLocaleString('en-US')}</b></div>)}</div>;
}
/** ViewBox keeps both node labels and edges in the mobile viewport. */
export function PartitionEdges({wide=false,sources=3}:{wide?:boolean;sources?:number}) {
  const id=useId().replaceAll(':','');
  const count=sources;
  const height=count*65+25;
  return <svg viewBox={`0 0 480 ${height}`} role="img" aria-label={wide?'Wide：每个目标分区接收多个源分区的数据':'Narrow：每个目标分区只依赖对应源分区'} className={`spark-edges ${wide?'is-wide':''}`}>
    <defs><marker id={id} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="currentColor" /></marker></defs>
    {Array.from({length:count},(_,i)=>Array.from({length:count},(_,j)=>wide||i===j?<path key={`${i}-${j}`} d={`M136 ${35+i*65} C225 ${35+i*65},255 ${35+j*65},344 ${35+j*65}`} fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.7" markerEnd={`url(#${id})`} />:null))}
    {Array.from({length:count},(_,i)=><g key={i}>{[20,345].map((x,j)=><g key={x}><rect x={x} y={15+i*65} width="115" height="40" rx="6" /><text x={x+57.5} y={40+i*65} textAnchor="middle">{j===0?'Source':'Target'} P{i}</text></g>)}</g>)}
  </svg>;
}
export function Info({children}:{children:ReactNode}) { return <div className="viz-narr">{children}</div>; }
