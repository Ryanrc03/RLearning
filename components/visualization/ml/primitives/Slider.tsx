"use client";

type SliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  /** Text shown after the control, defaults to the raw value. */
  display?: string;
  id?: string;
};

// The one primary control most ML figures have: a labelled range input with its value beside it.
export default function Slider({ label, value, min, max, step = 1, onChange, display, id }: SliderProps) {
  return (
    <label className="viz-slider" htmlFor={id}>
      <span>{label}</span>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <b className="viz-mono">{display ?? String(value)}</b>
    </label>
  );
}
