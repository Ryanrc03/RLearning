"use client";

export type TabOption<K extends string> = { key: K; label: string };

type TabsProps<K extends string> = {
  options: TabOption<K>[];
  value: K;
  onChange: (key: K) => void;
  ariaLabel: string;
};

// A segmented control for switching the scenario or mode a figure shows.
export default function Tabs<K extends string>({ options, value, onChange, ariaLabel }: TabsProps<K>) {
  return (
    <div className="viz-tabs" role="tablist" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={o.key} type="button" role="tab" aria-selected={value === o.key} className={`viz-tab${value === o.key ? " is-on" : ""}`} onClick={() => onChange(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
