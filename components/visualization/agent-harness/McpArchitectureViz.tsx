'use client';
import { useState } from 'react';
import McpFrame, { McpPanel } from './McpFrame';
const ROLES=[
  {name:'LLM',copy:'选择工具、生成参数、理解结果；请求不等于已经执行。Host 可以调用远程模型服务，图里的包含关系不是部署位置要求。'},
  {name:'Host / Harness',copy:'Host 是应用整体，Harness 负责 Agent Loop、Tool Registry 和 Permission Gate。它把工具暴露给模型，并在获准后执行。'},
  {name:'MCP Client',copy:'Host 内针对 Server 的协议连接器。处理发现、调用、传输和结果返回；Client 不是整个 Host，也不是 LLM。'},
  {name:'MCP Server',copy:'暴露 Tools（可调用函数）、Resources（上下文数据）、Prompts（模板）。执行适配逻辑，调用 API/数据库/CLI；它不因此变成 Agent Framework。'},
];
export default function McpArchitectureViz() {
  const [mode,setMode]=useState<'direct'|'mcp'>('mcp');
  const [role,setRole]=useState(1);
  return <McpFrame title="接入层：标准化了哪一段" description="比较适配位置，再点选四个角色。服务端仍然复用已有 API。">
    <div className="mcp-controls" role="group" aria-label="接入方式">{([['direct','Without MCP'],['mcp','With MCP']] as const).map(([id,label])=><button type="button" key={id} aria-pressed={mode===id} onClick={()=>setMode(id)}>{label}</button>)}</div>
    <McpPanel title={mode==='mcp'?'MCP Host → Clients → Servers → Existing APIs':'Agent Harness → 每系统的适配器 → External APIs'}>
      <div className="mcp-branches">{['GitHub','PostgreSQL','Drive'].map(name=><div key={name} className="mcp-flow"><span>{mode==='mcp'?'MCP Client':`${name} Adapter`}</span><span aria-hidden="true">↓</span>{mode==='mcp'&&<><span>{name} MCP Server</span><span aria-hidden="true">↓</span></>}<span>{name} API / 数据接口</span></div>)}</div>
    </McpPanel>
    <div className="mcp-host"><h5>MCP Host · 应用边界</h5><div className="mcp-grid"><div className="mcp-role-list">{ROLES.slice(0,3).map((r,i)=><button type="button" key={r.name} aria-pressed={role===i} onClick={()=>setRole(i)}>{r.name}</button>)}</div><div className="mcp-flow"><span>Harness：Registry / Gate / Loop</span><span>Client A → GitHub Server</span><span>Client B → Database Server</span></div></div></div>
    <div className="mcp-controls"><button type="button" aria-pressed={role===3} onClick={()=>setRole(3)}>MCP Server · 应用外部</button></div>
    <div className="mcp-note" aria-live="polite"><strong>{ROLES[role].name}：</strong>{ROLES[role].copy}</div>
  </McpFrame>;
}
