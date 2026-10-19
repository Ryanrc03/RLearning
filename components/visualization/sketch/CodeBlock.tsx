// A code card with a file tab and a tiny keyword highlighter; enough for SQL, Python, HTTP and JSON,
// so the site does not need a full syntax-highlighting dependency.

import type { ReactNode } from "react";

export type Lang = "sql" | "python" | "http" | "json" | "text";

// Longest phrases first so "ON CONFLICT" wins over "ON".
const kw = (words: string) => new RegExp(`\\b(${words.split("|").sort((a, b) => b.length - a.length).join("|")})\\b`, "g");

const KEYWORDS: Record<Lang, RegExp | null> = {
  sql: kw("SELECT|FROM|WHERE|AND|OR|NOT|JOIN|ON|AS|GROUP BY|ORDER BY|BETWEEN|SUM|COUNT|INSERT INTO|VALUES|ON CONFLICT|DO UPDATE SET|CREATE TABLE|CREATE INDEX|PRIMARY KEY|REFERENCES|UNIQUE|DEFAULT|CHECK|IN|NULL|NULLIF|INTEGER|TEXT|DATE|TIMESTAMPTZ|BIGINT|EXCLUDED|EXPLAIN ANALYZE|LIMIT|DESC|ASC|now|float|NUMERIC|FOREIGN KEY|AS|TABLE"),
  python: kw("from|import|def|return|if|raise|for|in|not|and|or|None|True|False|async|await|with|as|class"),
  http: kw("GET|POST|PUT|PATCH|DELETE"),
  json: kw("true|false|null"),
  text: null,
};

type Tok = { t: string; c?: string };

function tokenizeLine(line: string, lang: Lang): Tok[] {
  if (lang === "text") return [{ t: line }];
  // Order matters: comments, strings, decorators, placeholders, numbers, then keywords.
  const comment = lang === "python" ? /#.*$/ : lang === "sql" ? /--.*$/ : null;
  const parts: Tok[] = [];
  let rest = line;
  let tail: Tok | null = null;
  if (comment) {
    const m = rest.match(comment);
    if (m && m.index !== undefined && !inString(rest, m.index)) {
      tail = { t: rest.slice(m.index), c: "sk-c-com" };
      rest = rest.slice(0, m.index);
    }
  }
  const re = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(@[\w.]+)|(%\(\w+\)s|\{\w+\})|(\b\d+(?:\.\d+)?\b)/g;
  let last = 0;
  for (let m = re.exec(rest); m; m = re.exec(rest)) {
    if (m.index > last) parts.push(...keywords(rest.slice(last, m.index), lang));
    const cls = m[1] ? (lang === "json" && rest.slice(m.index + m[0].length).trimStart().startsWith(":") ? "sk-c-key" : "sk-c-str") : m[2] ? "sk-c-dec" : m[3] ? "sk-c-var" : "sk-c-num";
    parts.push({ t: m[0], c: cls });
    last = m.index + m[0].length;
  }
  if (last < rest.length) parts.push(...keywords(rest.slice(last), lang));
  if (tail) parts.push(tail);
  return parts;
}

function inString(s: string, idx: number) {
  let q: string | null = null;
  for (let i = 0; i < idx; i += 1) {
    const ch = s[i];
    if (q) { if (ch === q) q = null; } else if (ch === "'" || ch === '"') q = ch;
  }
  return q !== null;
}

function keywords(s: string, lang: Lang): Tok[] {
  const re = KEYWORDS[lang];
  if (!re) return [{ t: s }];
  const out: Tok[] = [];
  let last = 0;
  re.lastIndex = 0;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    if (m.index > last) out.push({ t: s.slice(last, m.index) });
    out.push({ t: m[0], c: "sk-c-kw" });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ t: s.slice(last) });
  return out;
}

const LABEL: Record<Lang, string> = { sql: "SQL", python: "Python", http: "HTTP", json: "JSON", text: "" };

export default function CodeBlock({ lang = "text", title, children, note, compact }: { lang?: Lang; title?: string; children: string; note?: ReactNode; compact?: boolean }) {
  const lines = children.replace(/^\n+|\s+$/g, "").split("\n");
  return (
    <div className={`sk-code${compact ? " is-compact" : ""}`}>
      <div className="sk-code-bar">
        <span className="sk-code-dots" aria-hidden><i /><i /><i /></span>
        {title && <span className="sk-code-title">{title}</span>}
        {LABEL[lang] && <span className="sk-code-lang">{LABEL[lang]}</span>}
      </div>
      <pre><code>
        {lines.map((ln, i) => (
          <span key={i} className="sk-code-line">
            {tokenizeLine(ln, lang).map((tk, j) => (tk.c ? <span key={j} className={tk.c}>{tk.t}</span> : tk.t))}
            {"\n"}
          </span>
        ))}
      </code></pre>
      {note && <div className="sk-code-note">{note}</div>}
    </div>
  );
}
