export type BarRow = { label: string; value: number; max?: number; color: string; text?: string; hint?: string };

// Horizontal metric bars (precision / recall / F1 …) with the number printed beside each one.
export default function Bars({ rows }: { rows: BarRow[] }) {
  return (
    <div className="viz-bars">
      {rows.map((r) => {
        const max = r.max ?? 1;
        const pct = max === 0 ? 0 : Math.max(0, Math.min(100, (r.value / max) * 100));
        return (
          <div className="viz-bar-row" key={r.label}>
            <div className="viz-bar-label">
              {r.label}
              {r.hint && <small className="viz-k"> {r.hint}</small>}
            </div>
            <div className="viz-bar-track"><span style={{ width: `${pct}%`, background: r.color, transition: "width .3s" }} /></div>
            <div className="viz-bar-val">{r.text ?? r.value.toFixed(2)}</div>
          </div>
        );
      })}
    </div>
  );
}
