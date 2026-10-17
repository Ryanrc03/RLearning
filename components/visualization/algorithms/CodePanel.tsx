// Python template with the currently executing line highlighted. `tone` colours the active
// line: "keep" marks the step a reader most often gets wrong (e.g. r = mid keeps mid).
export default function CodePanel({ code, line, tone = "run", title }: { code: string[]; line: number; tone?: "run" | "keep" | "done" | "bad"; title?: string }) {
  return (
    <div className="viz-panel code-panel">
      {title && <h5>{title}</h5>}
      <pre className="code-lines" aria-label="Python 模板，当前执行行已高亮">
        {code.map((text, i) => (
          <span key={i} className={`code-line${i === line ? ` is-active is-${tone}` : ""}`}>
            <span className="code-no">{i + 1}</span>
            <span className="code-text">{text || " "}</span>
          </span>
        ))}
      </pre>
    </div>
  );
}
