import type { Matrix } from "@/lib/ml/attentionLayer";
import { P } from "../bahdanau/shared";

type HeatmapProps = {
  x: number;
  y: number;
  cellW: number;
  cellH: number;
  /** weights[j][i]: row j is a query, column i is a key. */
  weights: Matrix;
  rowLabels: string[];
  colLabels: string[];
  /** Selected query row. */
  selected: number;
  onSelect?: (row: number) => void;
  /** Hide the numbers when the cells are too small to hold them. */
  showValues?: boolean;
};

// An attention matrix as an SVG <g>: rows are queries, columns are keys. The
// cell's opacity is its value, the number is printed in it, and the selected
// row gets an outline, so nothing is carried by color alone.
export default function Heatmap({ x, y, cellW, cellH, weights, rowLabels, colLabels, selected, onSelect, showValues = true }: HeatmapProps) {
  const cols = weights[0]?.length ?? 0;
  return (
    <g>
      {colLabels.map((label, i) => (
        <text key={label} x={x + i * cellW + cellW / 2} y={y - 7} fontSize={9.5} fontWeight={600} textAnchor="middle" fill={P.ink}>{label}</text>
      ))}
      {weights.map((row, j) => {
        const on = j === selected;
        return (
          <g key={rowLabels[j]} onClick={onSelect ? () => onSelect(j) : undefined} style={onSelect ? { cursor: "pointer" } : undefined}>
            <text x={x - 8} y={y + j * cellH + cellH / 2 + 4} fontSize={9.5} fontWeight={on ? 700 : 400} textAnchor="end" fill={P.ink}>{rowLabels[j]}</text>
            {row.map((w, i) => (
              <g key={colLabels[i]} opacity={on ? 1 : 0.62} className="bah-fade">
                <rect x={x + i * cellW + 1} y={y + j * cellH + 1} width={cellW - 2} height={cellH - 2} rx={3} fill={P.surface} stroke={P.grey} strokeWidth={0.5} />
                <rect x={x + i * cellW + 1} y={y + j * cellH + 1} width={cellW - 2} height={cellH - 2} rx={3} fill={P.att} fillOpacity={Math.round((0.08 + 0.92 * w) * 100) / 100} />
                {showValues && <text x={x + i * cellW + cellW / 2} y={y + j * cellH + cellH / 2 + 4} fontSize={10} fontWeight={on ? 700 : 400} textAnchor="middle" fill={w >= 0.45 ? "var(--bah-on5)" : P.ink} className="mono">{w.toFixed(2)}</text>}
              </g>
            ))}
            {on && <rect x={x - 1} y={y + j * cellH - 1} width={cols * cellW + 2} height={cellH + 2} rx={4} fill="none" stroke={P.ink} strokeWidth={1.8} />}
          </g>
        );
      })}
    </g>
  );
}
