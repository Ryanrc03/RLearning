"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import { PIXEL, ids } from "@/lib/systems/ads/case";

type Toggles = { sameId: boolean; pixelBlocked: boolean; noConsent: boolean };
const DEFAULT: Toggles = { sameId: true, pixelBlocked: false, noConsent: false };

const STAGES = ["Schema 校验", "Consent / 使用限制", "Normalize", "Dedup key"];

export default function SignalMergeViz() {
  const [t, setT] = useState<Toggles>(DEFAULT);
  const flip = (k: keyof Toggles) => setT((prev) => ({ ...prev, [k]: !prev[k] }));

  const apiEventId = t.sameId ? "event_501" : "(未传)";
  const pixel = !t.pixelBlocked;
  const msgs = [
    pixel && { source: "pixel", receive: "10:31:04", body: `event_id: "event_501"\nevent: "Purchase"\nevent_time: 10:30:12\nvalue: 59.00, currency: "usd"\nclick_id: "ck_7f2"  ← 落地页 URL 带回` },
    { source: "events_api", receive: "10:33:40", body: `event_id: ${t.sameId ? '"event_501"' : "—"}\nevent: "Purchase"\nevent_time: 10:30:12\nvalue: 59.00, currency: "USD"\nemail_sha256: "9c1f…"  ← 已哈希` },
  ].filter(Boolean) as { source: string; receive: string; body: string }[];

  // Without a shared event_id the server copy gets a key derived from its own message id, so it never collides.
  const keys = msgs.map((m) => (m.source === "events_api" && !t.sameId ? `${PIXEL}:Purchase:msg_88213` : ids.dedupKey("event_501")));
  const logical = t.noConsent ? 0 : new Set(keys).size;

  let narr: string;
  let tone = "";
  if (t.noConsent) {
    narr = "这次购买的用户没有同意把数据用于广告衡量。事件可以被记录为“已收到但不可用于广告”，但不会进入匹配、归因和训练。Consent 检查要放在最前面，而不是训练前再过滤：后面每一层都可能复制、缓存这条数据。";
    tone = "is-warn";
  } else if (!t.sameId && msgs.length === 2) {
    narr = "Events API 没带 event_id，collector 只能用各自的 message id 当 key：两条消息变成了两个逻辑转化。报表里这个广告多了一次购买，下游 CVR 样本也会多一个正例。同一个事实被数了两次。";
    tone = "is-bad";
  } else if (msgs.length === 1) {
    narr = "浏览器拦截了 Pixel（广告拦截插件、网络中断、页面没加载完都会这样）。幸好服务器端的 Events API 还报了一次，转化没丢。这就是“双路上报”的意义：客户端覆盖面广但不可靠，服务端可靠但需要广告主接入。";
    tone = "is-good";
  } else {
    narr = "两条消息，event_id 相同 → dedup key 相同 → 一个逻辑转化。两条 message 不等于两个业务 event：Pixel 和 Events API 是同一次购买的两条上报路径，靠广告主在两边传同一个 event_id 才能对上。";
    tone = "is-good";
  }

  return (
    <VisualizationFrame
      title="同一次购买，从两条路进来"
      description="purchase_501 被 Pixel 和 Events API 各报一次。切换下面的情况，看 collector 最后得到几个逻辑转化。"
      footnote="字段与 ID 都是模拟数据。不同平台的去重规则（窗口长度、保留哪一条、是否合并字段）各不相同，以各自公开文档为准。"
    >
      <div className="viz-controls">
        <label className="viz-check"><input type="checkbox" checked={t.sameId} onChange={() => flip("sameId")} />Events API 传了同一个 event_id</label>
        <label className="viz-check"><input type="checkbox" checked={t.pixelBlocked} onChange={() => flip("pixelBlocked")} />Pixel 被浏览器拦截</label>
        <label className="viz-check"><input type="checkbox" checked={t.noConsent} onChange={() => flip("noConsent")} />用户未同意广告衡量</label>
        <button type="button" className="viz-btn" onClick={() => setT(DEFAULT)}>Reset</button>
      </div>

      <div className="ads-msgcards">
        {[{ source: "pixel", receive: "10:31:04" }, { source: "events_api", receive: "10:33:40" }].map((slot) => {
          const m = msgs.find((x) => x.source === slot.source);
          return (
            <div key={slot.source} className={`ads-msgcard${m ? "" : " is-out"}`}>
              <h6><span>{slot.source === "pixel" ? "Pixel（浏览器）" : "Events API（服务器）"}</span><span className="viz-k">recv {slot.receive}</span></h6>
              <pre className="ads-pre">{m ? m.body : "（被拦截，没有到达）"}</pre>
            </div>
          );
        })}
      </div>

      <div className="viz-arrow">↓ Event Collector ↓</div>
      <div className="viz-chips" style={{ justifyContent: "center" }}>
        {STAGES.map((s, i) => (
          <span key={s} className={`ads-tag ${t.noConsent && i >= 1 ? (i === 1 ? "is-bad" : "") : "is-good"}`}>{!t.noConsent || i === 0 ? `${s} ✓` : i === 1 ? `${s} ✕` : `${s} · 跳过`}</span>
        ))}
      </div>
      {!t.noConsent && (
        <div className="viz-k" style={{ textAlign: "center", marginTop: 6 }}>
          Normalize：currency 统一大写，时间统一 UTC；dedup key = <span className="viz-mono">{"{pixel_id}:{event}:{event_id}"}</span>（event_id 来自 {apiEventId === "(未传)" && msgs.length === 2 ? "Pixel；服务器那条只能退回 message id" : "上报字段"}）
        </div>
      )}
      <div className="viz-arrow">↓</div>

      <div className="ads-funnel">
        <div><small>收到的 message</small><b>{msgs.length}</b></div>
        <div><small>不同的 dedup key</small><b>{t.noConsent ? "—" : new Set(keys).size}</b></div>
        <div className={logical === 1 ? "is-good" : logical > 1 ? "is-bad" : ""}><small>逻辑转化（Deduplicated Event）</small><b>{logical}</b></div>
      </div>

      <div className={`viz-narr ${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}
