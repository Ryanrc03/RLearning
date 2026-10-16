// Previous / Next / Reset for a precomputed trace. Owns no state; the visualizer keeps the index.
export default function StepControls({ step, total, onStep }: { step: number; total: number; onStep: (next: number) => void }) {
  return (
    <div className="viz-controls step-controls">
      <button type="button" className="viz-btn" onClick={() => onStep(step - 1)} disabled={step <= 0}>← 上一步</button>
      <button type="button" className="viz-btn primary" onClick={() => onStep(step + 1)} disabled={step >= total - 1}>下一步 →</button>
      <button type="button" className="viz-btn" onClick={() => onStep(0)} disabled={step === 0}>重置</button>
      <span className="viz-k">第 {step} / {total - 1} 步</span>
    </div>
  );
}
