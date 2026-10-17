import type { Confusion } from "@/lib/ml/metrics";

type ConfusionGridProps = {
  c: Confusion;
  positive?: string;
  negative?: string;
  /** Which cells to emphasise, e.g. the ones a metric divides by. */
  highlight?: (keyof Confusion)[];
  compact?: boolean;
};

const CELL_TONE: Record<keyof Confusion, string> = { tp: "is-good", tn: "is-good", fp: "is-bad", fn: "is-bad" };
const CELL_NAME: Record<keyof Confusion, string> = { tp: "TP", fp: "FP", fn: "FN", tn: "TN" };

// The 2×2 confusion matrix as an HTML grid. Rows are predictions, columns are truth,
// matching the layout in the handwritten notes.
export default function ConfusionGrid({ c, positive = "dog", negative = "cat", highlight, compact }: ConfusionGridProps) {
  const cell = (k: keyof Confusion) => {
    const on = !highlight || highlight.includes(k);
    return (
      <div className={`cm-cell ${CELL_TONE[k]}${on ? "" : " is-dim"}`} key={k}>
        <small>{CELL_NAME[k]}</small>
        <b>{c[k]}</b>
      </div>
    );
  };
  return (
    <div className={`cm${compact ? " is-compact" : ""}`} role="table" aria-label={`混淆矩阵：TP ${c.tp}，FP ${c.fp}，FN ${c.fn}，TN ${c.tn}`}>
      <div className="cm-corner" />
      <div className="cm-head">真的是 {positive}</div>
      <div className="cm-head">真的是 {negative}</div>
      <div className="cm-side">猜 {positive}</div>
      {cell("tp")}
      {cell("fp")}
      <div className="cm-side">猜 {negative}</div>
      {cell("fn")}
      {cell("tn")}
    </div>
  );
}
