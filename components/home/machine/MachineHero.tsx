"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { GRPO_TOTAL_STEPS, grpoPhases, machineModel, machineParts, type PartId } from "@/content/machine";
import { getNote } from "@/content/notes";
import LangTag from "@/components/i18n/LangTag";
import { notePath, noteText, type Lang } from "@/lib/i18n";
import { advance, initialState, readout, withMode, type Mode, type SimState } from "./sim";
import type { MachineScene } from "./scene";

const COPY = {
  zh: {
    region: "我的主机：Legion T5 的 3D 模型。标签是链接，点进对应章节。",
    view: "视图",
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
    view: "View",
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

/** three r187 renders only through WebGL2; the probe context is released at once. */
function hasWebGL2() {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return Boolean(gl);
  } catch {
    return false;
  }
}

// English pages link to a translation when there is one, otherwise to the Chinese original.
const noteHref = (slug: string, lang: Lang) => notePath({ slug, en: getNote(slug)?.en }, lang);
const CALLOUT_GAP_PX = 22;
const EDGE_PX = 6;

type NodeRef = (node: HTMLElement | null) => void;

export default function MachineHero({ lang = "zh" }: { lang?: Lang }) {
  const copy = COPY[lang];
  const panel = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const labels = useRef<Partial<Record<PartId, HTMLElement | null>>>({});
  const readouts = useRef<Partial<Record<PartId, HTMLElement | null>>>({});
  const sim = useRef<SimState>(initialState());
  // One pair of ref callbacks per part, created once, so phase/step re-renders don't detach and reattach them.
  const partRefs = useMemo(() => machineParts.map((part): { label: NodeRef; readout: NodeRef } => ({
    label: (node) => { labels.current[part.id] = node; },
    readout: (node) => { readouts.current[part.id] = node; },
  })), []);
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
      const panelWidth = el.clientWidth;
      const narrow = panelWidth < 520;
      for (const part of machineParts) {
        const node = labels.current[part.id];
        if (!node) continue;
        const p = scene.partScreenPosition(part.id);
        node.hidden = !p.visible || (narrow && Boolean(part.minor));
        if (node.hidden) continue;
        // Callout: the label sits beside its part, kept inside the panel; the leader line spans the gap.
        const w = node.offsetWidth;
        const x = part.side === "left"
          ? Math.max(EDGE_PX, p.x - CALLOUT_GAP_PX - w)
          : Math.min(panelWidth - EDGE_PX - w, p.x + CALLOUT_GAP_PX);
        const lead = part.side === "left" ? p.x - (x + w) : x - p.x;
        node.style.transform = `translate(${x}px, ${p.y}px) translate(0, -50%)`;
        node.style.setProperty("--lead", `${Math.max(0, lead)}px`);
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

    const io = new IntersectionObserver((entries) => {
      visible = entries[entries.length - 1].isIntersecting;
      if (visible) kick();
    });
    let width = 0;
    let height = 0;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!scene || (w === width && h === height)) return;
      width = w;
      height = h;
      // Resizing clears the canvas; repaint now rather than on the next frame so it doesn't blink.
      scene.resize(w, h);
      draw(performance.now());
      if (animate) kick();
    });
    const onVisibility = () => { if (!document.hidden) kick(); };
    // Orbit follows one pointer at a time. Touch orbits horizontally only; vertical swipes scroll the page.
    let activeId: number | null = null;
    let px = 0;
    let py = 0;
    const onDown = (e: PointerEvent) => {
      if (activeId !== null || e.button !== 0) return;
      activeId = e.pointerId;
      px = e.clientX;
      py = e.clientY;
      cv.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== activeId || !scene) return;
      scene.orbitBy(e.clientX - px, e.pointerType === "touch" ? 0 : e.clientY - py);
      px = e.clientX;
      py = e.clientY;
      if (!animate) draw(performance.now());
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== activeId) return;
      activeId = null;
      if (cv.hasPointerCapture(e.pointerId)) cv.releasePointerCapture(e.pointerId);
    };

    if (!hasWebGL2()) {
      queueMicrotask(() => { if (!disposed) setStatus("list"); });
    } else {
      import("./scene").then(({ createMachineScene }) => {
        if (disposed) return;
        try {
          scene = createMachineScene(cv, { pixelRatio: Math.min(window.devicePixelRatio || 1, el.clientWidth < 640 ? 1.5 : 2), animate });
          width = el.clientWidth;
          height = el.clientHeight;
          scene.resize(width, height);
          setStatus(animate ? "live" : "still");
          io.observe(el);
          ro.observe(el);
          document.addEventListener("visibilitychange", onVisibility);
          cv.addEventListener("pointerdown", onDown);
          cv.addEventListener("pointermove", onMove);
          cv.addEventListener("pointerup", onUp);
          cv.addEventListener("pointercancel", onUp);
          cv.addEventListener("lostpointercapture", onUp);
          kick();
        } catch {
          // No usable WebGL2 after all: drop the scene; every handler above is a no-op without one.
          cancelAnimationFrame(raf);
          io.disconnect();
          ro.disconnect();
          scene?.dispose();
          scene = null;
          setStatus("list");
        }
      }).catch(() => { if (!disposed) setStatus("list"); });
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
      cv.removeEventListener("lostpointercapture", onUp);
      scene?.dispose();
    };
  }, []);

  const current = grpoPhases[phase];
  const relatedLinks = (slugs: string[]) => slugs.map((slug, i) => {
    const note = getNote(slug);
    const { title, translated } = note ? noteText(note, lang) : { title: slug, translated: true };
    const zhOnly = lang === "en" && !translated;
    return <span key={slug}>{i > 0 && " · "}<Link href={noteHref(slug, lang)} lang={zhOnly ? "zh-CN" : undefined}>{title}{zhOnly && <LangTag lang={lang} />}</Link></span>;
  });

  return (
    <section ref={panel} className="machine-panel" data-status={status} aria-label={copy.region}>
      <canvas ref={canvas} className="machine-canvas" aria-hidden="true" />
      <div className="machine-tabs" role="group" aria-label={copy.view}>
        {(Object.keys(copy.tabs) as Mode[]).map((m) => (
          <button key={m} type="button" className="machine-tab" aria-pressed={mode === m} onClick={() => choose(m)}>{copy.tabs[m]}</button>
        ))}
      </div>
      <p className="machine-model">
        {machineModel}
        {status !== "list" && <><br />{status === "loading" ? copy.loading : copy.drag}</>}
      </p>
      <div className="machine-labels">
        {machineParts.map((part, i) => {
          const refs = partRefs[i];
          const body = <><b>{part.name}</b> <span className="machine-spec">{part.spec[lang]}</span> <span className="machine-readout" ref={refs.readout} /></>;
          return part.slug
            ? <Link key={part.id} ref={refs.label} href={noteHref(part.slug, lang)} className="machine-label" data-side={part.side}>{body}</Link>
            : <span key={part.id} ref={refs.label} className="machine-label" data-side={part.side}>{body}</span>;
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
