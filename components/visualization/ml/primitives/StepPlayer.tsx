"use client";

import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/components/visualization/usePrefersReducedMotion";

type StepPlayerProps = {
  step: number;
  /** Number of steps; valid `step` values are 0 … total − 1. */
  total: number;
  onStep: (step: number) => void;
  /** Milliseconds between steps while playing. */
  intervalMs?: number;
  /** Text shown between the buttons, e.g. "第 3 轮 / 共 8 轮". */
  caption?: string;
  /** Called by 重置; defaults to onStep(0). */
  onReset?: () => void;
};

// The step-through control shared by figures that replay an algorithm one
// iteration at a time: 上一步 / 下一步 / 播放 / 重置. Autoplay is disabled when
// the reader prefers reduced motion; the buttons still work.
export default function StepPlayer({ step, total, onStep, intervalMs = 900, caption, onReset }: StepPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const reduced = usePrefersReducedMotion();
  const atEnd = step >= total - 1;
  // Playing stops by itself at the last step; no state write is needed for that.
  const running = playing && !atEnd;

  useEffect(() => {
    if (!running) return;
    const id = window.setTimeout(() => onStep(step + 1), intervalMs);
    return () => window.clearTimeout(id);
  }, [running, step, intervalMs, onStep]);

  const go = (next: number) => {
    setPlaying(false);
    onStep(next);
  };
  const reset = () => {
    setPlaying(false);
    if (onReset) onReset();
    else onStep(0);
  };

  return (
    <div className="viz-player" role="group" aria-label="步进控制">
      <button type="button" className="viz-btn" disabled={step <= 0} onClick={() => go(step - 1)}>← 上一步</button>
      <button type="button" className="viz-btn primary" disabled={atEnd} onClick={() => go(step + 1)}>下一步 →</button>
      {!reduced && (
        <button type="button" className={`viz-btn${running ? " is-on" : ""}`} disabled={atEnd} onClick={() => setPlaying(!running)}>
          {running ? "暂停" : "播放"}
        </button>
      )}
      <button type="button" className="viz-btn" onClick={reset}>重置</button>
      {caption && <span className="viz-k">{caption}</span>}
    </div>
  );
}
