'use client';
import { useId, useState } from 'react';
import { contextCost, modernRequest, protocolSteps, type Lane, type ProtocolVersion } from '@/lib/agent-harness/mcp';
import McpFrame, { McpCode, McpPanel } from './McpFrame';
const LANES:Lane[]=['model','host','client','server','api'];
const LABELS:Record<Lane,string>={model:'LLM',host:'Host',client:'Client',server:'Server',api:'API'};
export default function McpSequenceViz() {
  const marker=useId().replaceAll(':','');
  const [version,setVersion]=useState<ProtocolVersion>('2026-07-28');
  const [index,setIndex]=useState(0);
  const [servers,setServers]=useState(3);
  const [tools,setTools]=useState(14);
  const [deferred,setDeferred]=useState(true);
  const steps=protocolSteps(version);
  const step=steps[index];
  const cost=contextCost(servers,tools,deferred);
  const x=(lane:Lane)=>42+LANES.indexOf(lane)*105;
  const direction=x(step.to)>x(step.from)?1:-1;
  return <McpFrame title="MCP 时序 · 先选协议版本" description="这五个角色不是五个模型。当前一步展示调用方向；发现工具与执行业务是不同的消息。" footnote="所有时序为教学示意。现代协议每请求携带版本与能力；旧版先完成初始化。Host 自己定义工具别名、权限规则与结果大小限制。">
    <div className="mcp-controls" role="group" aria-label="MCP 协议版本">{(['2026-07-28','2025-11-25'] as const).map(v=><button type="button" key={v} aria-pressed={version===v} onClick={()=>{setVersion(v);setIndex(0);}}>{v}{v==='2026-07-28'?' · 无握手':' · 旧版握手'}</button>)}</div>
    <div className="mcp-controls"><button type="button" disabled={index===0} onClick={()=>setIndex(i=>i-1)}>上一步</button><button type="button" disabled={index===steps.length-1} onClick={()=>setIndex(i=>i+1)}>下一步</button><button type="button" onClick={()=>setIndex(0)}>重置</button><span role="status">步骤 {index+1} / {steps.length}</span></div>
    <svg className="mcp-lanes" viewBox="0 0 505 125" role="img" aria-label={`${LABELS[step.from]} 到 ${LABELS[step.to]}：${step.label}`}>
      <defs><marker id={marker} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="currentColor"/></marker></defs>
      {LANES.map(lane=><g key={lane}><rect x={x(lane)-35} y="10" width="70" height="32" rx="6" className={lane===step.from||lane===step.to?'is-active':''}/><text x={x(lane)} y="31" textAnchor="middle">{LABELS[lane]}</text><line x1={x(lane)} x2={x(lane)} y1="45" y2="112" strokeDasharray="4 4" className="mcp-lifeline"/></g>)}
      <line x1={x(step.from)} x2={x(step.to)-direction*4} y1="80" y2="80" className="mcp-message" markerEnd={`url(#${marker})`}/>
    </svg>
    <div className="mcp-note" aria-live="polite"><strong>{step.label}</strong><p>{step.narr}</p></div>
    {version==='2026-07-28'&&step.from==='client'&&['server/discover（客户端可选）','tools/list','tools/call get_experiment_metrics'].includes(step.label)&&<McpCode label="2026-07-28 JSON-RPC 请求体">{JSON.stringify(modernRequest(step.label.startsWith('server/')?'server/discover':step.label==='tools/list'?'tools/list':'tools/call'),null,2)}</McpCode>}
    <details className="mcp-details"><summary>展开完整时序</summary><ol>{steps.map((s,i)=><li key={i} aria-current={index===i?'step':undefined}><button type="button" onClick={()=>setIndex(i)}>{i+1}. {LABELS[s.from]} → {LABELS[s.to]} · {s.label}</button></li>)}</ol></details>
    <McpPanel title="Schema 的上下文成本 · Host 策略实验">
      <div className="mcp-controls"><label>Server 数<input aria-label="Server 数" type="range" min={1} max={6} value={servers} onChange={e=>setServers(+e.target.value)}/>{servers}</label><label>每个 Server 工具数<input aria-label="每个 Server 工具数" type="range" min={1} max={40} value={tools} onChange={e=>setTools(+e.target.value)}/>{tools}</label><label><input type="checkbox" checked={deferred} onChange={e=>setDeferred(e.target.checked)}/>Host 按需加载 Schema</label></div>
      <div className="mcp-cost-track" role="img" aria-label={`约 ${cost.used} token，占 200k 窗口 ${(cost.used/200000*100).toFixed(2)}%`}><span style={{width:`${cost.used/60000*100}%`}}/></div>
      <p aria-live="polite">{cost.total} 个工具；{deferred?`先保留名字，再将 ${cost.loaded} 个名字替换为完整 Schema`:'全量提供 Schema'} → 约 <strong>{cost.used.toLocaleString('en-US')} token</strong>，全量是 {cost.full.toLocaleString('en-US')}。</p><small>纯估算：每个完整定义 250 token，名字 20；不含查询、结果和其他上下文。具体 Host 可以缓存、搜索或分批注入，并非每轮都一定载入所有定义；按需策略也有搜索成本。</small>
    </McpPanel>
  </McpFrame>;
}
