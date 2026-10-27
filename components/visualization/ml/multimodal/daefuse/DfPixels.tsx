import type { Img } from "@/lib/ml/daefuse";

type DfPixelsProps = {
  img: Img;
  x: number;
  y: number;
  cell: number;
  title?: string;
  /** Map a value to a fill; defaults to gray levels for values in [0, 1]. */
  color?: (v: number) => string;
  onPick?: (px: number, py: number) => void;
  dim?: boolean;
};

export const gray = (v: number) => {
  const g = Math.round(Math.min(1, Math.max(0, v)) * 255);
  return `rgb(${g},${g},${g})`;
};

// A small image drawn as one rect per pixel, with an optional caption above it.
// Every DAE-Fuse toy figure draws its 24 × 16 scenes with this.
export default function DfPixels({ img, x, y, cell, title, color = gray, onPick, dim }: DfPixelsProps) {
  const H = img.length;
  const W = img[0].length;
  return (
    <g opacity={dim ? 0.3 : 1}>
      {title && <text x={x} y={y - 6} fontSize={11} fontWeight={600} fill="#30332c">{title}</text>}
      {img.map((row, py) =>
        row.map((v, px) => (
          <rect
            key={`${px}-${py}`}
            x={x + px * cell}
            y={y + py * cell}
            width={cell + 0.4}
            height={cell + 0.4}
            fill={color(v)}
            onClick={onPick ? () => onPick(px, py) : undefined}
            style={onPick ? { cursor: "pointer" } : undefined}
          />
        )),
      )}
      <rect x={x} y={y} width={W * cell} height={H * cell} fill="none" stroke="#9a9c8d" strokeWidth={1} />
    </g>
  );
}
