"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { GRPO_TOTAL_STEPS, grpoPhases, machineModel, machineParts, type PartId } from "@/content/machine";
import { getNote } from "@/content/notes";
import type { Lang } from "@/lib/i18n";
import { advance, initialState, readout, withMode, type Mode, type SimState } from "./sim";
import type { MachineScene } from "./scene";

const COPY = {
  zh: {
    region: "我的主机：Legion T5 的 3D 模型。标签是链接，点进对应章节。",
    tabs: { machine: "整机", grpo: "跑一步 GRPO" } as Record<Mode, string>,
    drag: "拖动旋转",
    idle: "i7-12700 · 16 GB DDR5 · RTX 3060 12 GB。点「跑一步 GRPO」，看一次真实训练在这台机器里怎么流动。",
    simulated: "读数为模拟值",
    related: "相关笔记",
    colon: "：",
    loading: "正在装配主机…",
  },
  en: {
    region: "My PC: a 3D model of a Legion T5. Labels are links into the matching chapters.",
    tabs: { machine: "Machine", grpo: "Run one GRPO step" } as Record<Mode, string>,
    drag: "Drag to orbit",
    idle: "i7-12700 · 16 GB DDR5 · RTX 3060 12 GB. Press “Run one GRPO step” to watch a real training step move through this machine.",
    simulated: "Readouts are simulated",
    related: "Related notes",
    colon: ": ",
    loading: "Assembling the machine…",
  },
};

type Status = "loading" | "live" | "still" | "list";

function hasWebGL() {
  try {
    const probe = document.createElement("canvas");
    return Boolean(probe.getContext("webgl2") ?? probe.getContext("webgl"));
  } catch {
    return false;
  }
}

const noteHref = (slug: string) => `/notes/${slug}/`;

export default function MachineHero({ lang = "zh" }: { lang?: Lang }) {
  const copy = COPY[lang];
  const panel = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const labels = useRef<Partial<Record<PartId, HTMLElement | null>>>({});
  const readouts = useRef<Partial<Record<PartId, HTMLElement | null>>>({});
  const sim = useRef<SimState>(initialState());
  const sceneRef = useRef<MachineScene | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [mode, setMode] = useState<Mode>("machine");
  const [phase, setPhase] = useState(0);
  const [step, setStep] = useState(1);

  const choose = (next: Mode) => {
    sim.current = withMode(sim.current, next);
    setMode(next);
    setPhase(0);
  };

  useEffect(() => {
    const el = panel.current;
    const cv = canvas.current;
    if (!el || !cv) return;
    const animate = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let scene: MachineScene | null = null;
    let raf = 0;
    let visible = true;
    let last = 0; // kick() sets it right before it requests the first frame.
    let lastText = 0;
    let disposed = false;

    const placeLabels = (now: number) => {
      if (!scene) return;
      const narrow = el.clientWidth < 520;
      for (const part of machineParts) {
        const node = labels.current[part.id];
        if (!node) continue;
        const p = scene.partScreenPosition(part.id);
        node.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
        node.hidden = !p.visible || (narrow && Boolean(part.minor));
      }
      if (now - lastText < 250) return;
      lastText = now;
      for (const part of machineParts) {
        const node = readouts.current[part.id];
        if (node) node.textContent = readout(part.id, sim.current.telemetry) ?? "";
      }
    };
    const draw = (now: number) => {
      scene?.render(sim.current, now);
      placeLabels(now);
    };
    const frame = (now: number) => {
      raf = 0;
      if (disposed || !scene) return;
      const dt = Math.max(0, Math.min(100, now - last));
      last = now;
      const prev = sim.current;
      sim.current = advance(prev, dt);
      if (sim.current.phase !== prev.phase) setPhase(sim.current.phase);
      if (sim.current.step !== prev.step) setStep(sim.current.step);
      draw(now);
      if (visible && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const kick = () => {
      if (!scene || raf || disposed) return;
      if (!animate) { draw(performance.now()); return; }
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };

    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) kick(); });
    const ro = new ResizeObserver(() => { scene?.resize(el.clientWidth, el.clientHeight); kick(); });
    const onVisibility = () => { if (!document.hidden) kick(); };
    let dragging = false;
    let px = 0;
    let py = 0;
    const onDown = (e: PointerEvent) => { dragging = true; px = e.clientX; py = e.clientY; cv.setPointerCapture(e.pointerId); };
    const onMove = (e: PointerEvent) => {
      if (!dragging || !scene) return;
      scene.orbitBy(e.clientX - px, e.clientY - py);
      px = e.clientX;
      py = e.clientY;
      if (!animate) draw(performance.now());
    };
    const onUp = () => { dragging = false; };

    if (!hasWebGL()) {
      queueMicrotask(() => { if (!disposed) setStatus("list"); });
    } else {
      import("./scene").then(({ createMachineScene }) => {
        if (disposed) return;
        scene = createMachineScene(cv, { pixelRatio: Math.min(window.devicePixelRatio || 1, el.clientWidth < 640 ? 1.5 : 2), animate });
        sceneRef.current = scene;
        scene.resize(el.clientWidth, el.clientHeight);
        setStatus(animate ? "live" : "still");
        io.observe(el);
        ro.observe(el);
        document.addEventListener("visibilitychange", onVisibility);
        cv.addEventListener("pointerdown", onDown);
        cv.addEventListener("pointermove", onMove);
        cv.addEventListener("pointerup", onUp);
        cv.addEventListener("pointercancel", onUp);
        kick();
      });
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      cv.removeEventListener("pointerdown", onDown);
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerup", onUp);
      cv.removeEventListener("pointercancel", onUp);
      scene?.dispose();
      sceneRef.current = null;
    };
  }, []);

  const current = grpoPhases[phase];
  const relatedLinks = (slugs: string[]) => slugs.map((slug, i) => (
    <span key={slug}>{i > 0 && " · "}<Link href={noteHref(slug)}>{getNote(slug)?.title ?? slug}</Link></span>
  ));

  return (
    <section ref={panel} className="machine-panel" data-status={status} aria-label={copy.region}>
      <canvas ref={canvas} className="machine-canvas" aria-hidden="true" />
      <div className="machine-tabs" role="group">
        {(Object.keys(copy.tabs) as Mode[]).map((m) => (
          <button key={m} type="button" className="machine-tab" aria-pressed={mode === m} onClick={() => choose(m)}>{copy.tabs[m]}</button>
        ))}
      </div>
      <p className="machine-model">{machineModel}<br />{status === "loading" ? copy.loading : copy.drag}</p>
      <div className="machine-labels">
        {machineParts.map((part) => {
          const body = <><b>{part.name}</b> {part.spec[lang]} <span className="machine-readout" ref={(node) => { readouts.current[part.id] = node; }} /></>;
          const setRef = (node: HTMLElement | null) => { labels.current[part.id] = node; };
          return part.slug
            ? <Link key={part.id} ref={setRef} href={noteHref(part.slug)} className="machine-label">{body}</Link>
            : <span key={part.id} ref={setRef} className="machine-label">{body}</span>;
        })}
      </div>
      <div className="machine-hud">
        {mode === "machine" ? (
          <p>{copy.idle}<small>{copy.simulated}</small></p>
        ) : status === "live" ? (
          <p>{current.text[lang]}<small>step {step} / {GRPO_TOTAL_STEPS} · {copy.related}{copy.colon}{relatedLinks(current.slugs)}</small></p>
        ) : (
          <ol>{grpoPhases.map((p) => <li key={p.text.en}>{p.text[lang]} <small>{relatedLinks(p.slugs)}</small></li>)}</ol>
        )}
      </div>
    </section>
  );
}
