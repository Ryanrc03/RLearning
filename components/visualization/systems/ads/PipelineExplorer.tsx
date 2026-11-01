"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import { CHAPTERS, NODES, SERVING_ORDER, TRAINING_ORDER, type PipelineNode, type View } from "@/lib/systems/ads/pipeline";

type Path = "training" | "serving";

const VIEWS: { id: View; name: string }[] = [
  { id: "event", name: "Event" },
  { id: "match", name: "Match Result" },
  { id: "label", name: "Label" },
];

const byId = Object.fromEntries(NODES.map((n) => [n.id, n])) as Record<string, PipelineNode>;
const CHAIN = ["collect", "validate", "mq", "identity", "attribution", "joiner", "flink", "builder", "store"];

const PATH_NOTE: Record<Path, string> = {
  training: "训练路径是异步的：事件从发生到变成训练样本，快的几分钟，慢的要等 label window 结束（几天）。它追求的是数据对、不重、不丢。",
  serving: "在线路径是同步的：一次广告请求要在几十毫秒内查特征、跑模型、出价。它只读训练路径产出的模型和特征，不等任何 label。",
};

export default function PipelineExplorer() {
  const [path, setPath] = useState<Path>("training");
  const [view, setView] = useState<View>("event");
  const [selected, setSelected] = useState("touch");
  const order = path === "training" ? TRAINING_ORDER : SERVING_ORDER;
  const node = byId[selected];
  const chapter = CHAPTERS.find((c) => c.no === node.chapter)!;
  const at = order.indexOf(selected);

  const step = (d: 1 | -1) => {
    const i = at < 0 ? 0 : Math.min(order.length - 1, Math.max(0, at + d));
    setSelected(order[i]);
  };
  const reset = () => {
    setPath("training");
    setView("event");
    setSelected("touch");
  };

  const card = (id: string) => {
    const n = byId[id];
    const on = n.paths.includes(path);
    const first = n.views[view].split("\n")[0];
    return (
      <button
        key={id}
        type="button"
        className={`ads-node${selected === id ? " is-on" : ""}${on ? "" : " is-dim"}${n.paths.includes("serving") && !n.paths.includes("training") ? " is-serving" : ""}`}
        onClick={() => setSelected(id)}
        aria-pressed={selected === id}
      >
        <b>{n.name}<small>Ch {n.chapter}</small></b>
        <code>{first}</code>
      </button>
    );
  };

  const detail = (
    <>
      <h5>{node.name}</h5>
      <div className="viz-chips" style={{ marginBottom: 6 }}>
        {node.paths.map((p) => <span key={p} className={`ads-tag ${p === "serving" ? "is-warn" : "is-info"}`}>{p === "serving" ? "online serving" : "training path"}</span>)}
      </div>
      <p>{node.duty}</p>
      <dl className="ads-kv">
        <dt>Input</dt><dd>{node.input}</dd>
        <dt>Output</dt><dd>{node.output}</dd>
      </dl>
      <div className="viz-k">{VIEWS.find((v) => v.id === view)!.name} · 在这一层：</div>
      <pre className="ads-pre">{node.views[view]}</pre>
      <p style={{ marginTop: 10 }}>
        <Link href={`/notes/${chapter.slug}/`}>Ch {chapter.no} · {chapter.title} →</Link>
      </p>
      <div className="viz-controls" style={{ marginTop: 10, marginBottom: 0 }}>
        <button type="button" className="viz-btn" onClick={() => step(-1)} disabled={at <= 0}>← 上一层</button>
        <button type="button" className="viz-btn primary" onClick={() => step(1)} disabled={at === order.length - 1}>下一层 →</button>
        <button type="button" className="viz-btn" onClick={reset}>Reset</button>
      </div>
    </>
  );
  // Narrow screens show the detail right under the selected node instead of below the whole chain.
  const inline = (ids: string[]) => (ids.includes(selected) ? <div className="viz-panel ads-inline-detail" aria-live="polite">{detail}</div> : null);

  return (
    <VisualizationFrame
      title="End-to-end Pipeline Explorer"
      description="点任意模块看它的输入、输出和职责；切换 Event / Match Result / Label，看同一次购买（purchase_501）在每一层变成了什么；切换路径，看在线服务和离线训练各经过哪些模块。"
      footnote="这是逻辑依赖图，不是部署图：真实系统可能把几个模块合成一个服务，或者并行、换序。所有 ID 与时间都是本系列的模拟数据。"
    >
      <div className="viz-controls">
        <div className="viz-tabs" role="tablist" aria-label="路径">
          <button type="button" role="tab" aria-selected={path === "training"} className={`viz-tab${path === "training" ? " is-on" : ""}`} onClick={() => { setPath("training"); setSelected("touch"); }}>Offline / Streaming 训练路径</button>
          <button type="button" role="tab" aria-selected={path === "serving"} className={`viz-tab${path === "serving" ? " is-on" : ""}`} onClick={() => { setPath("serving"); setSelected("store"); }}>Online Serving 路径</button>
        </div>
        <div className="viz-tabs" role="tablist" aria-label="查看对象">
          {VIEWS.map((v) => (
            <button key={v.id} type="button" role="tab" aria-selected={view === v.id} className={`viz-tab${view === v.id ? " is-on" : ""}`} onClick={() => setView(v.id)}>{v.name}</button>
          ))}
        </div>
      </div>

      <div className="ads-explorer">
        <div className="ads-flow">
          <div className="ads-pair">{card("touch")}{card("conversion")}</div>
          {inline(["touch", "conversion"])}
          <div className="viz-arrow">↓ Pixel / Events API / SDK / MMP ↓</div>
          {CHAIN.map((id, i) => (
            <Fragment key={id}>
              {card(id)}
              {inline([id])}
              {i < CHAIN.length - 1 && <div className="viz-arrow">↓</div>}
            </Fragment>
          ))}
          <div className="viz-arrow">↓ 样本表（离线）　　在线特征 ↓</div>
          {card("training")}
          {inline(["training"])}
          <div className="viz-arrow">↓ 发布模型 ↓</div>
          {card("serving")}
          {inline(["serving"])}
          <div className="viz-arrow">↓</div>
          {card("bidding")}
          {inline(["bidding"])}
          <div className="viz-arrow">↺ 胜出的广告被展示，回到最上面的 Impression / Click</div>
        </div>

        <div className="viz-panel ads-detail" aria-live="polite">{detail}</div>
      </div>

      <div className="viz-narr">{PATH_NOTE[path]}</div>
    </VisualizationFrame>
  );
}
