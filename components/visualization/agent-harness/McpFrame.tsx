import type { ReactNode } from 'react';
import VisualizationFrame from '@/components/visualization/VisualizationFrame';
import '@/styles/mcp.css';

export default function McpFrame(props:{title:string;description?:string;footnote?:ReactNode;children:ReactNode}) {
  return <div className="mcp-viz"><VisualizationFrame {...props}/></div>;
}
export function McpPanel({title,children}:{title:string;children:ReactNode}) {
  return <div className="mcp-panel"><h5>{title}</h5>{children}</div>;
}
export function McpCode({label,children}:{label:string;children:string}) {
  return <pre className="mcp-code" aria-label={label} tabIndex={0}><code>{children}</code></pre>;
}
