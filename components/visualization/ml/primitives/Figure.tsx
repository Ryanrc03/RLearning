import type { ReactNode } from "react";

type FigureProps = {
  width: number;
  height: number;
  label: string;
  children: ReactNode;
  /** Minimum rendered width before the figure scrolls sideways on narrow screens. */
  minWidth?: number;
};

// The svg shell every ML figure draws into: scrollable on phones, labelled for screen readers.
export default function Figure({ width, height, label, children, minWidth }: FigureProps) {
  return (
    <div className="viz-scroll">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} style={minWidth ? { minWidth } : undefined}>
        {children}
      </svg>
    </div>
  );
}
