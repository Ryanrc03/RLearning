"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";

type Q = "none" | "post" | "feed" | "doc";
type Col = { name: string; pk?: boolean; fk?: string };
const TABLES: { name: string; cols: Col[] }[] = [
  { name: "users", cols: [{ name: "id", pk: true }, { name: "name" }] },
  { name: "posts", cols: [{ name: "id", pk: true }, { name: "user_id", fk: "users" }, { name: "text" }] },
  { name: "comments", cols: [{ name: "id", pk: true }, { name: "post_id", fk: "posts" }, { name: "user_id", fk: "users" }, { name: "text" }] },
  { name: "likes", cols: [{ name: "user_id", fk: "users" }, { name: "post_id", fk: "posts" }] },
];

const QUERIES: Record<Exclude<Q, "none" | "doc">, { label: string; hl: Record<string, string[]>; sql: string[]; narr: string }> = {
  post: {
    label: "打开一个帖子页",
    hl: { posts: ["id", "user_id", "text"], users: ["id", "name"], comments: ["post_id", "text"], likes: ["post_id"] },
    sql: ["SELECT p.text, u.name,", "  (SELECT count(*) FROM likes l WHERE l.post_id = p.id) AS likes", "FROM posts p JOIN users u ON u.id = p.user_id", "WHERE p.id = 42;", "SELECT text FROM comments WHERE post_id = 42;"],
    narr: "帖子页要：帖子正文、作者名、点赞数、评论。四张表都碰到了，靠外键把它们连起来：posts.user_id 指向 users.id，comments.post_id 和 likes.post_id 指向 posts.id。每样东西只存一份，改作者名只改 users 一行。代价是读一页要 join 几张表。",
  },
  feed: {
    label: "首页信息流：我关注的人最近的 20 条",
    hl: { posts: ["id", "user_id", "text"], users: ["id"] },
    sql: ["SELECT * FROM posts", "WHERE user_id IN (我关注的 300 个人)", "ORDER BY created_at DESC LIMIT 20;", "-- 需要索引：posts(user_id, created_at)"],
    narr: "访问模式决定设计。信息流每秒被查几万次，要在 posts 上建 (user_id, created_at) 的索引；量再大，就要预先把每个人的信息流算好存起来（写扩散），这已经不是 schema 能解决的了。所以 schema 设计第一步是列出最频繁的几个查询。",
  },
};

export default function DataModelViz() {
  const [q, setQ] = useState<Q>("none");
  const hl = q === "post" || q === "feed" ? QUERIES[q].hl : {};
  return (
    <VisualizationFrame
      title="一个社交应用的 schema：四张表，两种查询，一种文档写法"
      description="PK 是主键，FK 是外键（指向哪张表写在后面）。点一个查询，高亮它要碰到的列。"
    >
      <div className="viz-controls">
        <button type="button" className={`viz-btn${q === "post" ? " is-on" : ""}`} onClick={() => setQ("post")}>打开一个帖子页</button>
        <button type="button" className={`viz-btn${q === "feed" ? " is-on" : ""}`} onClick={() => setQ("feed")}>首页信息流</button>
        <button type="button" className={`viz-btn${q === "doc" ? " is-on" : ""}`} onClick={() => setQ("doc")}>换成文档型怎么存</button>
        <button type="button" className="viz-btn" onClick={() => setQ("none")}>重置</button>
      </div>
      {q !== "doc" ? (
        <div className="viz-cards">
          {TABLES.map((t) => (
            <div key={t.name} className="viz-card" style={hl[t.name] ? { borderColor: "#2a78d6" } : undefined}>
              <h6>{t.name}</h6>
              {t.cols.map((c) => {
                const on = hl[t.name]?.includes(c.name);
                return (
                  <div key={c.name} className="viz-mono" style={{ fontSize: 12, padding: "2px 4px", borderRadius: 3, background: on ? "#eef5fd" : undefined, color: on ? "#1d5aa5" : "#30332c" }}>
                    {c.name}
                    {c.pk && <span style={{ marginLeft: 6, fontSize: 10, color: "#8a6d00" }}>PK</span>}
                    {c.fk && <span style={{ marginLeft: 6, fontSize: 10, color: "#0b7a4b" }}>FK → {c.fk}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <div className="viz-panel">
          <h5>同一个帖子，在 MongoDB 里存成一个文档</h5>
          <pre className="viz-mono" style={{ margin: 0, fontSize: 12, whiteSpace: "pre-wrap" }}>{`{ "_id": 42,
  "author": { "id": 7, "name": "小明" },   // 作者名复制了一份
  "text": "今天的晚霞",
  "like_count": 128,                       // 点赞数预先算好
  "comments": [                            // 评论直接嵌进来
    { "user": "小红", "text": "好看" },
    { "user": "小刚", "text": "在哪拍的" } ] }`}</pre>
        </div>
      )}
      {(q === "post" || q === "feed") && (
        <div className="viz-panel" style={{ marginTop: 10 }}>
          <h5>{QUERIES[q].label}</h5>
          <pre className="viz-mono" style={{ margin: 0, fontSize: 12, whiteSpace: "pre-wrap" }}>{QUERIES[q].sql.join("\n")}</pre>
        </div>
      )}
      <div className={`viz-narr${q === "doc" ? " is-warn" : ""}`}>
        {q === "none"
          ? "四个实体：用户、帖子、评论、点赞。每张表有一个主键（唯一标识一行），表和表之间的关系用外键表示。点上面的查询看它们怎么连起来。"
          : q === "doc"
            ? "文档型把帖子页需要的东西全塞进一个文档，一次读取就够，不用 join，加字段也随意（schema 灵活）。代价是数据重复：小明改名，要去改他写过的每一篇帖子和每一条评论；点赞数要在每次点赞时同步更新。读多写少、页面固定的场景很合适。"
            : QUERIES[q].narr}
      </div>
    </VisualizationFrame>
  );
}
