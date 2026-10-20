"use client";

import { useMemo, useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Tabs from "@/components/visualization/ml/primitives/Tabs";
import Bars from "@/components/visualization/ml/primitives/Bars";
import { BASE_ALIASES, cosineTable, DEMO_IDF, DROP_TRAILING_QIAN, normalize, tfidf } from "@/lib/ml/tfidf";

// Representations, TF-IDF: a semantic cache compares a cached query with a new
// one in three steps — alias normalisation, character 1/2-gram TF-IDF with L2
// normalisation, dot product against a 0.9 threshold. Three scenarios: the
// alias rule already makes the keys equal; one extra character 「钱」 drops the
// cosine to 0.870; an extra alias rule brings it back to 1.

type Scenario = "alias" | "qian" | "fix";

const SCENARIOS: { key: Scenario; label: string; cached: string; incoming: string; extra: boolean }[] = [
  { key: "alias", label: "国家补贴多少 vs 国补多少", cached: "国补多少", incoming: "国家补贴多少", extra: false },
  { key: "qian", label: "国补多少 vs 国补多少钱", cached: "国补多少", incoming: "国补多少钱", extra: false },
  { key: "fix", label: "加一条别名：去掉句尾「钱」", cached: "国补多少", incoming: "国补多少钱", extra: true },
];

const THRESHOLD = 0.9;
const V1 = "#2a78d6";
const V2 = "#eb6834";
const GOOD = "#1d9e75";
const MUTED = "#76796f";

const f3 = (x: number) => x.toFixed(3);

// The un-fixed 「钱」 cosine, quoted in the third scenario.
const QIAN_COS = cosineTable(tfidf("国补多少"), tfidf("国补多少钱")).cosine;

export default function TfidfFigure() {
  const [key, setKey] = useState<Scenario>("alias");
  const sc = SCENARIOS.find((s) => s.key === key)!;
  const rules = sc.extra ? [...BASE_ALIASES, DROP_TRAILING_QIAN] : BASE_ALIASES;
  const keyA = normalize(sc.cached, rules);
  const keyB = normalize(sc.incoming, rules);
  const { a, b, table } = useMemo(() => {
    const a = tfidf(keyA);
    const b = tfidf(keyB);
    return { a, b, table: cosineTable(a, b) };
  }, [keyA, keyB]);
  const hit = table.cosine >= THRESHOLD - 1e-12;
  const same = keyA === keyB;

  const narr = (() => {
    if (key === "alias")
      return { tone: " is-good", text: `别名表把「国家补贴」换成「国补」，两条键都是「${keyB}」。真实服务到这里直接查精确缓存就命中了；硬算成向量，就是同一个向量和自己点积，cos = ${f3(table.cosine)}。` };
    if (key === "qian")
      return { tone: " is-bad", text: `「国补多少钱」多了「钱」和「少钱」两个 n-gram（idf ${DEMO_IDF["钱"].toFixed(2)}、${DEMO_IDF["少钱"].toFixed(2)}），它的长度从 ${a.norm.toFixed(2)} 涨到 ${b.norm.toFixed(2)}，归一化后七个共同 n-gram 的权重全被压小，「补多」从 ${f3(a.unit.get("补多")!)} 变成 ${f3(b.unit.get("补多")!)}。乘积和 ${f3(table.cosine)}，低于 ${THRESHOLD}，没命中。` };
    return { tone: " is-good", text: `别名表多一条「去掉句尾的钱」，第二条也归一成「${keyB}」，键相同，cos = ${f3(table.cosine)}，命中。另一个办法是不动别名、把阈值降到 0.85：${f3(QIAN_COS)} 就过线了，代价是别的近似句也更容易误命中。` };
  })();

  return (
    <VisualizationFrame
      title="语义缓存：两条查询的 TF-IDF 余弦"
      description="缓存里有「国补多少」，新来一条查询。先按别名表归一化成键，再拆成字符 1-gram 和 2-gram，权重是 (1 + ln tf) × idf，除以长度后逐项相乘求和。蓝色是缓存那条的权重，橙色是新查询的，最后一列是乘积。"
    >
      <div className="viz-row">
        <Tabs options={SCENARIOS} value={key} onChange={setKey} ariaLabel="对比的两条查询" />
      </div>

      <div className="viz-stat" style={{ marginBottom: 12 }}>
        <div><small>第 1 步 · 缓存里的</small><b style={{ fontSize: 13 }}>{sc.cached} → {keyA}</b></div>
        <div><small>第 1 步 · 新查询</small><b style={{ fontSize: 13 }}>{sc.incoming} → {keyB}</b></div>
        <div><small>键是否相同</small><b style={{ color: same ? GOOD : V2 }}>{same ? "相同" : "不同"}</b></div>
        <div><small>‖a‖ / ‖b‖（未归一化长度）</small><b>{a.norm.toFixed(2)} / {b.norm.toFixed(2)}</b></div>
      </div>

      <table className="viz-table" aria-label="每个 n-gram 的权重和乘积">
        <thead>
          <tr>
            <th>第 2 步 · n-gram</th>
            <th className="num">idf</th>
            <th className="num" style={{ color: V1 }}>a：{keyA}</th>
            <th className="num" style={{ color: V2 }}>b：{keyB}</th>
            <th className="num">第 3 步 · a × b</th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r) => (
            <tr key={r.gram} style={{ color: r.product === 0 ? MUTED : undefined }}>
              <td>{r.gram}</td>
              <td className="num">{r.idf.toFixed(2)}</td>
              <td className="num">{r.a ? f3(r.a) : "—"}</td>
              <td className="num">{r.b ? f3(r.b) : "—"}</td>
              <td className="num">{f3(r.product)}</td>
            </tr>
          ))}
          <tr style={{ fontWeight: 600 }}>
            <td colSpan={4}>cos = Σ a × b</td>
            <td className="num" style={{ color: hit ? GOOD : V2 }}>{f3(table.cosine)}</td>
          </tr>
        </tbody>
      </table>

      <Bars
        rows={[
          { label: "cos", value: table.cosine, color: hit ? GOOD : V2, text: f3(table.cosine), hint: hit ? "命中" : "未命中" },
          { label: "阈值", value: THRESHOLD, color: MUTED, text: THRESHOLD.toFixed(2) },
        ]}
      />

      <div className={`viz-narr${narr.tone}`}>{narr.text}</div>
    </VisualizationFrame>
  );
}
