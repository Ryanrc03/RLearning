import { headingId } from "@/lib/headings";
import { SkBadge, SkLine } from "@/components/visualization/sketch/Sketch";
import { DELIVERY_STEPS } from "./steps";

// "You are here" strip under each step heading: six small badges, the current one filled.
export default function StepStrip({ n }: { n: number }) {
  const s = DELIVERY_STEPS[n - 1];
  const gap = 30;
  return (
    <div className="sk-step">
      <svg width={gap * 5 + 28} height={28} viewBox={`0 0 ${gap * 5 + 28} 28`} aria-hidden>
        <SkLine seed={`strip-${n}`} points={[[14, 14], [14 + gap * 5, 14]]} stroke="#ced4da" />
        {DELIVERY_STEPS.map((d, i) => (
          <a key={d.key} href={`#${headingId(d.heading)}`}>
            <SkBadge cx={14 + i * gap} cy={14} r={i === n - 1 ? 12 : 9} n={i === n - 1 ? d.n : ""} seed={`strip-${n}-${d.key}`} active={i === n - 1} />
          </a>
        ))}
      </svg>
      <span><b>Step {s.n} / 6</b> · {s.time}{s.optional ? " · 可选" : ""}</span>
    </div>
  );
}
