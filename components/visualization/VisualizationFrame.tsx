import type { ReactNode } from "react";

type VisualizationFrameProps = {
  title: string;
  description?: string;
  children: ReactNode;
  footnote?: ReactNode;
};

// Shared container so every interactive figure in a note has the same title, border, and footnote slot.
export default function VisualizationFrame({ title, description, children, footnote }: VisualizationFrameProps) {
  return (
    <section className="viz" aria-label={title}>
      <div className="viz-head">
        <h4>{title}</h4>
        {description && <p>{description}</p>}
      </div>
      {children}
      {footnote && <div className="viz-foot">{footnote}</div>}
    </section>
  );
}
