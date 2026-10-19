import type { ReactNode } from "react";

type Tone = "tip" | "warn" | "note" | "example";
const ICON: Record<Tone, string> = { tip: "✦", warn: "!", note: "i", example: "◇" };
const LABEL: Record<Tone, string> = { tip: "要点", warn: "注意", note: "说明", example: "教学示例" };

// Colored aside for tips, warnings and "this part is a made-up example" notes.
export default function Callout({ tone = "tip", title, children }: { tone?: Tone; title?: string; children: ReactNode }) {
  return (
    <aside className={`sk-callout is-${tone}`}>
      <div className="sk-callout-head"><span className="sk-callout-icon" aria-hidden>{ICON[tone]}</span>{title ?? LABEL[tone]}</div>
      <div className="sk-callout-body">{children}</div>
    </aside>
  );
}

type Req = { id: string; text: ReactNode; detail?: ReactNode; target?: string };

/** Requirement list as cards: functional ones are "Users should be able to…", non-functional ones carry a number. */
export function RequirementList({ kind, items }: { kind: "functional" | "non-functional" | "out"; items: Req[] }) {
  const head = kind === "functional" ? "Functional · 用户应该能…" : kind === "non-functional" ? "Non-functional · 系统应该…" : "Out of scope · 这次不做";
  return (
    <div className={`sk-reqs is-${kind}`}>
      <div className="sk-reqs-head">{head}</div>
      <ol>
        {items.map((r) => (
          <li key={r.id}>
            <span className="sk-req-id">{r.id}</span>
            <div>
              <div className="sk-req-text">{r.text}</div>
              {r.detail && <div className="sk-req-detail">{r.detail}</div>}
            </div>
            {r.target && <span className="sk-req-target">{r.target}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}
