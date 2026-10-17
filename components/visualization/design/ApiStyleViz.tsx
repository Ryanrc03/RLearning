"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Style = "rest" | "graphql" | "rpc";
const NEED = ["活动名称、日期", "场馆名称、地址", "票档、价格"];

const STYLES: Record<Style, { name: string; calls: { line: string; extra?: string }[]; trips: number; bytes: string; narr: string; tone?: string }> = {
  rest: {
    name: "REST",
    calls: [
      { line: "GET /events/123", extra: "返回活动的全部 20 个字段，只用到 2 个" },
      { line: "GET /events/123/tickets", extra: "拿到票档列表" },
      { line: "GET /venues/5234", extra: "venue id 要等第一个请求回来才知道" },
    ],
    trips: 2,
    bytes: "≈ 6 KB",
    narr: "REST 把一切看成资源，每个资源一个 URL，用 HTTP 动词操作：GET 读、POST 创建、PUT 整体更新、PATCH 部分更新、DELETE 删除。直观、通用、好缓存。代价在这个页面上很明显：要 3 个请求，第 3 个还要等第 1 个回来才知道场馆 id，所以是 2 个来回；每个资源都整个返回，多拿了一堆用不上的字段（over-fetching）。",
  },
  graphql: {
    name: "GraphQL",
    calls: [
      { line: "POST /graphql", extra: "query { event(id: 123) { name date venue { name address } tickets { section price } } }" },
    ],
    trips: 1,
    bytes: "≈ 1 KB",
    narr: "GraphQL 让客户端自己写出要哪些字段、嵌套到哪一层，服务端一次返回刚好这些。一个请求、一个来回、不多拿也不少拿，所以手机端特别喜欢它：网络慢、屏幕小、每个页面要的字段不一样。代价在服务端：查询形状由客户端决定，服务端要防止有人写出一个嵌套十层的巨型查询，HTTP 缓存也不好用了。",
    tone: "is-good",
  },
  rpc: {
    name: "RPC（gRPC）",
    calls: [
      { line: "ticketService.GetEventPage(event_id: 123)", extra: "Protobuf 二进制编码，函数签名在 .proto 文件里定义" },
    ],
    trips: 1,
    bytes: "≈ 0.4 KB",
    narr: "RPC 把远程调用写得像调本地函数。在 .proto 文件里定义 service TicketService { rpc GetEvent; rpc CreateBooking } 和消息格式，就能生成 Python、Java、Go 等各种语言的客户端和服务端代码，二进制编码最紧凑。适合服务之间的内部调用（索引、排序服务）。代价是浏览器不能直接调，对外接口一般还是 REST 或 GraphQL。",
    tone: "is-good",
  },
};

export default function ApiStyleViz() {
  const [style, setStyle] = useState<Style>("rest");
  const s = STYLES[style];
  return (
    <VisualizationFrame
      title="同一个活动详情页，三种 API 怎么取数据"
      description={`页面需要三样东西：${NEED.join("；")}。切换三种 API 风格，看要发几个请求、几个来回、多少字节。`}
    >
      <div className="viz-chips" role="group" aria-label="API 风格" style={{ marginBottom: 10 }}>
        {(Object.keys(STYLES) as Style[]).map((k) => (
          <button key={k} type="button" className={`viz-chip${style === k ? " is-on" : ""}`} onClick={() => setStyle(k)}>{STYLES[k].name}</button>
        ))}
      </div>
      <div className="viz-panel">
        <h5>客户端发出的请求</h5>
        <div style={{ display: "grid", gap: 8 }}>
          {s.calls.map((c, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "22px minmax(0, 1fr)", gap: 8 }}>
              <span className="viz-mono" style={{ color: "#76796f" }}>{i + 1}</span>
              <div>
                <div className="viz-mono" style={{ fontSize: 12, fontWeight: 600, wordBreak: "break-word" }}>{c.line}</div>
                {c.extra && <div className="viz-k" style={{ wordBreak: "break-word" }}>{c.extra}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
      <table className="viz-table">
        <thead><tr><th></th>{(Object.keys(STYLES) as Style[]).map((k) => <th key={k} className="num">{STYLES[k].name}</th>)}</tr></thead>
        <tbody>
          <tr><td>请求数</td>{(Object.keys(STYLES) as Style[]).map((k) => <td key={k} className="num" style={k === style ? { fontWeight: 700 } : undefined}>{STYLES[k].calls.length}</td>)}</tr>
          <tr><td>网络来回</td>{(Object.keys(STYLES) as Style[]).map((k) => <td key={k} className="num" style={k === style ? { fontWeight: 700 } : undefined}>{STYLES[k].trips}</td>)}</tr>
          <tr><td>传输量（示意）</td>{(Object.keys(STYLES) as Style[]).map((k) => <td key={k} className="num" style={k === style ? { fontWeight: 700 } : undefined}>{STYLES[k].bytes}</td>)}</tr>
        </tbody>
      </table>
      <div className={`viz-narr${s.tone ? ` ${s.tone}` : " is-warn"}`}>{s.narr}</div>
    </VisualizationFrame>
  );
}
