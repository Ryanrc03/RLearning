"use client";

import { useState } from "react";
import VisualizationFrame from "@/components/visualization/VisualizationFrame";
import Bars from "@/components/visualization/ml/primitives/Bars";
import { CLASS_LABEL, CLASSES, posterior, TABLE, WORDS, type ClassPosterior, type MailClass, type Word } from "@/lib/ml/bayes";

// Page 1 of Classifiers: the notes' spam filter. Tick the words the email
// contains and watch both posteriors expand into prior × likelihoods. Ticking
// Lunch without smoothing multiplies the 垃圾 score by 0/7.

const DEFAULT_WORDS: Word[] = ["Dear", "Friend"];
const COLOR: Record<MailClass, string> = { ham: "#2a78d6", spam: "#eb6834" };
const CRIT = "#d03b3b";

const fmt = (x: number, digits = 3) => x.toFixed(digits);

function ProductTable({ r, smoothing }: { r: ClassPosterior; smoothing: boolean }) {
  const t = TABLE[r.cls];
  return (
    <table className="viz-table" aria-label={`${CLASS_LABEL[r.cls]}类的连乘式`}>
      <thead>
        <tr>
          <th>项</th>
          <th className="num">分数</th>
          <th className="num">小数</th>
        </tr>
      </thead>
      <tbody>
        {r.terms.map((term, i) => {
          const zero = term.fraction.num === 0;
          const word = i === 0 ? null : (term.label.match(/\((\w+) \|/)?.[1] as Word | undefined);
          return (
            <tr key={term.label} style={zero ? { color: CRIT, fontWeight: 600 } : undefined}>
              <td>
                {term.label}
                {smoothing && word && <small className="viz-k"> ({t.counts[word]} + 1) / ({t.total} + {WORDS.length})</small>}
              </td>
              <td className="num">{term.fraction.num}/{term.fraction.den}</td>
              <td className="num">{fmt(term.fraction.value)}</td>
            </tr>
          );
        })}
        <tr style={{ fontWeight: 600 }}>
          <td>连乘</td>
          <td className="num">{r.terms.map((x) => `${x.fraction.num}/${x.fraction.den}`).join(" × ")}</td>
          <td className="num" style={r.product === 0 ? { color: CRIT } : undefined}>= {fmt(r.product, 4)}</td>
        </tr>
      </tbody>
    </table>
  );
}

export default function NaiveBayesFigure() {
  const [words, setWords] = useState<Word[]>(DEFAULT_WORDS);
  const [smoothing, setSmoothing] = useState(false);
  const r = posterior(words, smoothing);
  const zeroTrap = r.spam.product === 0 && words.length > 0;
  const email = words.length ? `「${words.join(" ")}」` : "（空邮件）";

  const toggle = (w: Word) => setWords((prev) => (prev.includes(w) ? prev.filter((x) => x !== w) : WORDS.filter((x) => x === w || prev.includes(x))));
  const reset = () => {
    setWords(DEFAULT_WORDS);
    setSmoothing(false);
  };

  const termText = (c: ClassPosterior) => c.terms.map((t) => `${t.fraction.num}/${t.fraction.den}`).join(" × ");
  const narr = zeroTrap
    ? `邮件里有 Lunch，而 4 封垃圾邮件的 7 个词里 Lunch 一次都没出现，P(Lunch | 垃圾) = 0/7。连乘里只要有一个 0，垃圾类的分数就是 0：${words.includes("Money") ? "哪怕 Money 在垃圾邮件里占了 4/7 也翻不了盘" : "再加几个 Money 也翻不了盘"}。这就是零概率陷阱，打开 Laplace 平滑看看。`
    : words.length === 0
      ? `没勾任何词，两个分数就只剩先验：8/12 对 4/12，正常 ${fmt(r.ham.prob * 100, 0)}%。勾上词，看每个词把比例往哪边推。`
      : `邮件 ${email}：正常 = ${termText(r.ham)} = ${fmt(r.ham.product, 4)}，垃圾 = ${termText(r.spam)} = ${fmt(r.spam.product, 4)}。归一化后正常 ${fmt(r.ham.prob * 100, 1)}%、垃圾 ${fmt(r.spam.prob * 100, 1)}%，判${r.winner ? CLASS_LABEL[r.winner] : "不出"}。${smoothing ? "平滑给每个计数加了 1，垃圾类的 Lunch 从 0/7 变成 1/11，没见过的词从「不可能」变成「很少见」。" : ""}`;
  const tone = zeroTrap ? " is-bad" : r.winner === "spam" ? " is-warn" : "";

  return (
    <VisualizationFrame
      title="Naive Bayes：先验 × 每个词的似然，两个连乘式比大小"
      description="12 封邮件，8 封正常 4 封垃圾。正常邮件的 17 个词里 Dear / Friend / Lunch / Money 各出现 8 / 5 / 3 / 1 次，垃圾邮件的 7 个词里各 2 / 1 / 0 / 4 次。勾选新邮件里出现的词。"
    >
      <div className="viz-row">
        <span className="viz-k">邮件里有：</span>
        <div className="viz-chips" role="group" aria-label="邮件里出现的词">
          {WORDS.map((w) => (
            <button key={w} type="button" className={`viz-chip${words.includes(w) ? " is-on" : ""}`} aria-pressed={words.includes(w)} onClick={() => toggle(w)}>
              {w}
            </button>
          ))}
        </div>
        <label className="viz-check">
          <input type="checkbox" checked={smoothing} onChange={(e) => setSmoothing(e.target.checked)} />
          Laplace 平滑（每个计数 +1）
        </label>
        <button type="button" className="viz-btn" onClick={reset}>重置</button>
      </div>

      <div className="viz-grid2">
        {CLASSES.map((cls) => {
          const c = r[cls];
          return (
            <div className="viz-panel" key={cls} style={{ borderTop: `3px solid ${COLOR[cls]}` }}>
              <h5 style={{ color: COLOR[cls] }}>
                {CLASS_LABEL[cls]} · {TABLE[cls].docs}/12 封 · {TABLE[cls].total} 个词
              </h5>
              <ProductTable r={c} smoothing={smoothing} />
            </div>
          );
        })}
      </div>

      <div className="viz-panel" style={{ marginTop: 12 }}>
        <h5>归一化后的后验（两个连乘除以它们的和）</h5>
        <Bars
          rows={CLASSES.map((cls) => ({
            label: CLASS_LABEL[cls],
            hint: fmt(r[cls].product, 4),
            value: r[cls].prob,
            color: COLOR[cls],
            text: `${fmt(r[cls].prob * 100, 1)}%`,
          }))}
        />
      </div>

      <div className={`viz-narr${tone}`}>{narr}</div>
    </VisualizationFrame>
  );
}
