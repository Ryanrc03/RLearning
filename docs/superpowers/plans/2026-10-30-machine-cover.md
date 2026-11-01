# 3D Machine Cover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the homepage intro with a hero that pairs a short self-introduction with a 3D model of the author's Legion T5, with two modes: `整机` (hardware → System notes) and `跑一步 GRPO` (one real GRPO step flowing through the machine → ML notes).

**Architecture:** Data (`content/machine.ts`) and a pure simulation (`components/home/machine/sim.ts`, unit-tested) drive a framework-free Three.js scene (`scene.ts`) that `MachineHero.tsx` loads with `import()` only on the client. Labels are real `<a>` links laid over the canvas; before the scene loads, or without WebGL, the same labels render as a plain list.

**Tech Stack:** Next 16 App Router (static export), React 19, TypeScript, `three@0.187.0`, `node:test` via `tsx`.

**Spec:** `docs/superpowers/specs/2026-10-30-machine-cover-design.md`. One deviation, agreed below: no poster image. The first paint shows the dark panel with the parts as a list; that is also the no-WebGL fallback. Reduced motion renders one still frame and lists the five GRPO phases instead of animating them.

**Reference prototype:** the Three.js widget `rlearning_cover_3d_legion_grpo_prototype` shown in the brainstorming conversation (r128 UMD). `scene.ts` is a port of it.

---

## File map

| File | Action | Responsibility |
| --- | --- | --- |
| `lib/i18n.ts` | Create | `Lang` and `Localized` types only (the English plan grows this file) |
| `content/profile.ts` | Modify | add `fullName`, `homepageUrl`, `intro` |
| `content/machine.ts` | Create | parts, specs, links, GRPO phases |
| `components/home/machine/sim.ts` | Create | phase timing, telemetry easing, readout formatting |
| `tests/machine-sim.test.ts` | Create | tests for `sim.ts` and the machine data |
| `components/home/machine/scene.ts` | Create | Three.js scene with a small imperative API |
| `components/home/machine/MachineHero.tsx` | Create | client component: lazy load, loop, labels, tabs, HUD |
| `styles/machine.css` | Create | panel, labels, tabs, HUD, fallback list |
| `app/layout.tsx` | Modify | import `styles/machine.css` |
| `app/page.tsx` | Modify | hero layout, render `LearningActivity` below hero |
| `app/globals.css` | Modify | `.home-hero` grid and intro byline |
| `components/layout/NotebookShell.tsx` | Modify | skip the activity panel on `/` |
| `package.json`, `package-lock.json` | Modify | add `three`, `@types/three` |

---

### Task 1: Dependencies

**Files:** Modify `package.json`, `package-lock.json`

- [ ] **Step 1: Install dependencies into the worktree**

The worktree has no `node_modules` of its own (Node currently resolves the main checkout's). Install so the new packages land here:

```bash
npm ci
npm install --save-exact three@0.187.0
npm install --save-exact --save-dev @types/three@0.187.0
```

Expected: `package.json` gains `"three": "0.187.0"` and `"@types/three": "0.187.0"`.

- [ ] **Step 2: Confirm the baseline is green**

Run: `npm test` then `npm run typecheck`
Expected: both pass (no changes yet besides the deps).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add three.js for the homepage machine cover"
```

---

### Task 2: Types, profile and machine data

**Files:** Create `lib/i18n.ts`, `content/machine.ts`; Modify `content/profile.ts`

- [ ] **Step 1: Create `lib/i18n.ts`**

```ts
export type Lang = "zh" | "en";

/** A reader-facing string in both site languages. */
export type Localized = Record<Lang, string>;
```

- [ ] **Step 2: Extend `content/profile.ts`**

```ts
import type { Localized } from "@/lib/i18n";

/** Personal details for the static site. Replace the avatar in public/ to update it. */
export const profile = {
  name: "Ryan",
  fullName: "Ryan Rongcheng Li",
  initials: "R",
  tagline: "Learning in public",
  avatarUrl: "/avatar.jpg" as string | null,
  githubUrl: "https://github.com/Ryanrc03" as string | null,
  homepageUrl: "https://nextmile-lime.vercel.app/" as string | null,
  intro: {
    zh: "我是 Ryan，在 Houston 的 Rice University 读书。这里是我公开学习的笔记：计算机系统、机器学习，最近在啃 LLM 后训练。图里是我桌上那台主机，笔记里的 GRPO 就是在这张 RTX 3060 上训的。",
    en: "I'm Ryan, a student at Rice University in Houston. These are my notes from learning in public: computer systems, machine learning, and lately LLM post-training. The machine pictured is the PC on my desk; the GRPO run in these notes trained on its RTX 3060.",
  } satisfies Localized,
};
```

- [ ] **Step 3: Create `content/machine.ts`**

```ts
import type { Localized } from "@/lib/i18n";

export type PartId = "cpu" | "ram" | "gpu" | "ssd" | "hdd" | "psu";
export type PacketPath = "ssdToRam" | "ramToGpu" | "gpuLoop" | "gpuToCpu";

export type MachinePart = {
  id: PartId;
  name: string;
  spec: Localized;
  /** Note the label links to; the PSU only shows a readout. */
  slug?: string;
  /** Dropped from the 3D overlay on narrow panels to keep it readable. */
  minor?: boolean;
};

export type GrpoPhase = {
  durationMs: number;
  path: PacketPath;
  /** Packet color in the scene. */
  color: number;
  gpuUtil: number;
  cpuTemp: number;
  text: Localized;
  slugs: string[];
};

// Read from the author's PC (Win32 CIM and nvidia-smi) on 2026-10-30.
export const machineModel = "Lenovo Legion T5 26IAB7";

export const machineParts: MachinePart[] = [
  { id: "cpu", name: "CPU", spec: { zh: "i7-12700 · 12 核 20 线程", en: "i7-12700 · 12 cores / 20 threads" }, slug: "cs/fundamentals/overview" },
  { id: "ram", name: "DRAM", spec: { zh: "16 GB DDR5-4800", en: "16 GB DDR5-4800" }, slug: "cs/fundamentals/memory-hierarchy" },
  { id: "gpu", name: "GPU", spec: { zh: "RTX 3060 12 GB", en: "RTX 3060 12 GB" }, slug: "ai-infra/gpu/overview" },
  { id: "ssd", name: "SSD", spec: { zh: "KIOXIA 256 GB NVMe", en: "KIOXIA 256 GB NVMe" }, slug: "systems/data/overview" },
  { id: "hdd", name: "HDD", spec: { zh: "WD 1 TB", en: "WD 1 TB" }, slug: "systems/data/overview", minor: true },
  { id: "psu", name: "PSU", spec: { zh: "整机功耗", en: "system power" }, minor: true },
];

// Numbers come from content/ml/post-training/grpo-3060-project.mdx.
export const grpoPhases: GrpoPhase[] = [
  {
    durationMs: 2600, path: "ssdToRam", color: 0x4cc9ff, gpuUtil: 6, cpuTemp: 44,
    text: { zh: "① 读一道 GSM8K 题：SSD → 内存，CPU 把题目分词（prompt ≤ 256 token）", en: "① Read one GSM8K question: SSD → RAM, tokenized on the CPU (prompt ≤ 256 tokens)" },
    slugs: ["ml/post-training/grpo-3060-project"],
  },
  {
    durationMs: 2400, path: "ramToGpu", color: 0x4cc9ff, gpuUtil: 12, cpuTemp: 46,
    text: { zh: "② 经 PCIe 拷进显存。显存里常驻 4-bit 的 Qwen2.5-3B 和 r = 32 的 LoRA", en: "② Copy it over PCIe into VRAM, where the 4-bit Qwen2.5-3B and its r = 32 LoRA stay resident" },
    slugs: ["ml/post-training/lora"],
  },
  {
    durationMs: 3800, path: "gpuLoop", color: 0x97c459, gpuUtil: 93, cpuTemp: 47,
    text: { zh: "③ Rollout：vLLM 为这道题采样 G = 6 个回答，每个 decode 步 30 ms，带宽下限只要 7 ms", en: "③ Rollout: vLLM samples G = 6 answers. Each decode step takes 30 ms against a 7 ms bandwidth floor" },
    slugs: ["ml/llms/decoding-strategies", "ai-infra/gpu/compute-vs-memory-bound"],
  },
  {
    durationMs: 2400, path: "gpuToCpu", color: 0xffb86b, gpuUtil: 18, cpuTemp: 61,
    text: { zh: "④ Reward：6 个回答回到 CPU，5 个规则函数打分，组内归一化成 advantage", en: "④ Reward: the 6 answers return to the CPU, 5 rule functions score them, and the scores are normalized within the group into advantages" },
    slugs: ["ml/post-training/grpo", "ml/post-training/reward-hacking"],
  },
  {
    durationMs: 3800, path: "gpuLoop", color: 0xff5fa2, gpuUtil: 63, cpuTemp: 48,
    text: { zh: "⑤ 反向传播 + 8-bit AdamW，只更新 LoRA。GPU 63% 的时间在算，37% 是 WSL 调度空转", en: "⑤ Backward pass and 8-bit AdamW update only the LoRA. The GPU computes 63% of the time; 37% is WSL scheduling idle" },
    slugs: ["ml/dl-blocks/backprop-chain-rule", "ml/training/gradient-descent-optimizers"],
  },
];

export const GRPO_TOTAL_STEPS = 500;
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/i18n.ts content/profile.ts content/machine.ts
git commit -m "Add machine specs, GRPO phases and profile intro for the cover"
```

---

### Task 3: Simulation (TDD)

**Files:** Create `tests/machine-sim.test.ts`, `components/home/machine/sim.ts`

- [ ] **Step 1: Write the failing tests** — `tests/machine-sim.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { grpoPhases, GRPO_TOTAL_STEPS, machineParts } from "@/content/machine";
import { getNote } from "@/content/notes";
import { advance, GPU_TEMP_MAX, initialState, readout, withMode } from "@/components/home/machine/sim";

const cycleMs = grpoPhases.reduce((sum, phase) => sum + phase.durationMs, 0);

test("machine mode never moves the GRPO phase or step", () => {
  const state = advance(initialState(), 60_000);
  assert.equal(state.phase, 0);
  assert.equal(state.step, 1);
});

test("grpo mode moves on once a phase's duration has passed", () => {
  const start = withMode(initialState(), "grpo");
  assert.equal(advance(start, grpoPhases[0].durationMs - 1).phase, 0);
  assert.equal(advance(start, grpoPhases[0].durationMs).phase, 1);
});

test("a full cycle returns to phase 0 and counts a step, even in one large tick", () => {
  const once = advance(withMode(initialState(), "grpo"), cycleMs);
  assert.equal(once.phase, 0);
  assert.equal(once.step, 2);
  assert.equal(advance(withMode(initialState(), "grpo"), cycleMs * 3).step, 4);
});

test("the step counter wraps after the last training step", () => {
  const last = { ...withMode(initialState(), "grpo"), step: GRPO_TOTAL_STEPS };
  assert.equal(advance(last, cycleMs).step, 1);
});

test("switching mode restarts the phase but keeps the step", () => {
  const running = advance(withMode(initialState(), "grpo"), cycleMs + grpoPhases[0].durationMs);
  const back = withMode(running, "machine");
  assert.equal(back.phase, 0);
  assert.equal(back.phaseElapsedMs, 0);
  assert.equal(back.step, running.step);
});

test("readouts settle on the rollout target and stay in physical bounds", () => {
  const hold = [{ ...grpoPhases[2], durationMs: Number.POSITIVE_INFINITY }];
  let state = withMode(initialState(), "grpo");
  for (let i = 0; i < 2000; i++) {
    state = advance(state, 16, hold);
    assert.ok(state.telemetry.gpuTemp <= GPU_TEMP_MAX);
    assert.ok(state.telemetry.gpuUtil >= 0 && state.telemetry.gpuUtil <= 100);
  }
  assert.ok(Math.abs(state.telemetry.gpuUtil - grpoPhases[2].gpuUtil) < 0.5);
  assert.ok(state.telemetry.ramUsedGb > 9.5);
});

test("readout formats what each label shows", () => {
  const t = { cpuTemp: 46.4, gpuTemp: 71.6, gpuUtil: 92.5, ramUsedGb: 9.84, watts: 213.2 };
  assert.equal(readout("cpu", t), "46°C");
  assert.equal(readout("gpu", t), "72°C · 93%");
  assert.equal(readout("ram", t), "9.8 / 16 GB");
  assert.equal(readout("psu", t), "213 W");
  assert.equal(readout("ssd", t), null);
});

test("every link on the machine points at a published note", () => {
  for (const part of machineParts) if (part.slug) assert.ok(getNote(part.slug), part.slug);
  for (const phase of grpoPhases) for (const slug of phase.slugs) assert.ok(getNote(slug), slug);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx --test tests/machine-sim.test.ts`
Expected: FAIL — cannot find module `@/components/home/machine/sim`.

- [ ] **Step 3: Implement** — `components/home/machine/sim.ts`

```ts
import { GRPO_TOTAL_STEPS, grpoPhases, type GrpoPhase, type PartId } from "@/content/machine";

export type Mode = "machine" | "grpo";
export type Telemetry = { cpuTemp: number; gpuTemp: number; gpuUtil: number; ramUsedGb: number; watts: number };
export type SimState = { mode: Mode; phase: number; phaseElapsedMs: number; step: number; telemetry: Telemetry };

export const GPU_TEMP_MAX = 83;
const IDLE = { cpuTemp: 40, gpuUtil: 4, ramUsedGb: 5.1 };
const GRPO_RAM_GB = 9.8;
// Readouts approach their targets with these time constants, so a phase change ramps instead of jumping.
const TAU_MS = { cpuTemp: 800, gpuUtil: 300, ramUsedGb: 600, gpuTemp: 2500, watts: 300 };

const gpuTempFor = (gpuUtil: number) => Math.min(GPU_TEMP_MAX, 34 + gpuUtil * 0.4);
const wattsFor = (gpuUtil: number, cpuTemp: number) => 60 + gpuUtil * 1.55 + (cpuTemp - 40) * 2;
const approach = (current: number, target: number, dtMs: number, tauMs: number) => target + (current - target) * Math.exp(-dtMs / tauMs);

export function initialState(): SimState {
  return {
    mode: "machine", phase: 0, phaseElapsedMs: 0, step: 1,
    telemetry: { ...IDLE, gpuTemp: gpuTempFor(IDLE.gpuUtil), watts: wattsFor(IDLE.gpuUtil, IDLE.cpuTemp) },
  };
}

export function withMode(state: SimState, mode: Mode): SimState {
  return { ...state, mode, phase: 0, phaseElapsedMs: 0 };
}

/** Advance the clock by dtMs: move through GRPO phases (grpo mode only) and ease every readout. */
export function advance(state: SimState, dtMs: number, phases: GrpoPhase[] = grpoPhases): SimState {
  let { phase, phaseElapsedMs, step } = state;
  if (state.mode === "grpo") {
    phaseElapsedMs += dtMs;
    while (phaseElapsedMs >= phases[phase].durationMs) {
      phaseElapsedMs -= phases[phase].durationMs;
      phase = (phase + 1) % phases.length;
      if (phase === 0) step = step >= GRPO_TOTAL_STEPS ? 1 : step + 1;
    }
  }
  const goal = state.mode === "grpo" ? { cpuTemp: phases[phase].cpuTemp, gpuUtil: phases[phase].gpuUtil, ramUsedGb: GRPO_RAM_GB } : IDLE;
  const t = state.telemetry;
  const cpuTemp = approach(t.cpuTemp, goal.cpuTemp, dtMs, TAU_MS.cpuTemp);
  const gpuUtil = approach(t.gpuUtil, goal.gpuUtil, dtMs, TAU_MS.gpuUtil);
  return {
    ...state, phase, phaseElapsedMs, step,
    telemetry: {
      cpuTemp,
      gpuUtil,
      ramUsedGb: approach(t.ramUsedGb, goal.ramUsedGb, dtMs, TAU_MS.ramUsedGb),
      gpuTemp: approach(t.gpuTemp, gpuTempFor(gpuUtil), dtMs, TAU_MS.gpuTemp),
      watts: approach(t.watts, wattsFor(gpuUtil, cpuTemp), dtMs, TAU_MS.watts),
    },
  };
}

/** The live part of a label; parts without a sensor show none. */
export function readout(part: PartId, t: Telemetry): string | null {
  switch (part) {
    case "cpu": return `${Math.round(t.cpuTemp)}°C`;
    case "gpu": return `${Math.round(t.gpuTemp)}°C · ${Math.round(t.gpuUtil)}%`;
    case "ram": return `${t.ramUsedGb.toFixed(1)} / 16 GB`;
    case "psu": return `${Math.round(t.watts)} W`;
    default: return null;
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx tsx --test tests/machine-sim.test.ts`
Expected: 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add tests/machine-sim.test.ts components/home/machine/sim.ts
git commit -m "Add the machine cover simulation with tests"
```

---

### Task 4: Three.js scene

**Files:** Create `components/home/machine/scene.ts`

The scene is a port of the approved prototype. Geometry, positions, colors and packet paths are copied from it unchanged; this task only changes the module shape and the parts that differ between three r128 and r187.

- [ ] **Step 1: Write the module with this exact public API**

```ts
import type { PartId } from "@/content/machine";
import type { SimState } from "./sim";

export type SceneOptions = { pixelRatio: number; animate: boolean };
export type ScreenPoint = { x: number; y: number; visible: boolean };
export type MachineScene = {
  /** Draw one frame for this state; nowMs drives RGB, fans and packets. */
  render(state: SimState, nowMs: number): void;
  /** Where a part's label anchor lands on the canvas, in CSS pixels. */
  partScreenPosition(id: PartId): ScreenPoint;
  resize(width: number, height: number): void;
  orbitBy(dxPx: number, dyPx: number): void;
  dispose(): void;
};

export function createMachineScene(canvas: HTMLCanvasElement, options: SceneOptions): MachineScene;
```

Port rules (prototype → module):

1. Named imports from `"three"` (`WebGLRenderer`, `Scene`, `PerspectiveCamera`, `Mesh`, `BoxGeometry`, `TorusGeometry`, `CylinderGeometry`, `PlaneGeometry`, `EdgesGeometry`, `LineSegments`, `LineBasicMaterial`, `MeshStandardMaterial`, `MeshBasicMaterial`, `SpriteMaterial`, `Sprite`, `Group`, `AmbientLight`, `DirectionalLight`, `PointLight`, `CanvasTexture`, `CatmullRomCurve3`, `Vector3`, `Color`, `AdditiveBlending`, `SRGBColorSpace`), no namespace import.
2. Lighting changed in r155 (physically based units). Start from: ambient `0x8090c0` at `0.55 * Math.PI`, directional at `0.55 * Math.PI`, point lights with `decay = 0`, intensity `1.6 * Math.PI` / `1.2 * Math.PI`, distance unchanged. Every `CanvasTexture` gets `colorSpace = SRGBColorSpace`. Tune in the browser in Task 7 until it matches the prototype; record final values in the code.
3. Part label anchors (`partAnchors: Record<PartId, Vector3>`): cpu `(-2, 19.4, -4)`, ram `(13, 20, -8)`, gpu `(-14, 2.6, 2.6)`, ssd `(2, 5.7, -9.4)`, psu `(-11, -12.4, 6)`, hdd `(11, -12.4, 6)`.
4. Packet curves keyed by `PacketPath` (`ssdToRam`, `ramToGpu`, `gpuLoop`, `gpuToCpu`) with the prototype's control points. In `render`, when `state.mode === "grpo"` and `options.animate`, spawn from the pool on `grpoPhases[state.phase].path` with that phase's `color`, every 70 ms on `gpuLoop` and 150 ms otherwise. Packet progress uses real elapsed time (`(nowMs - lastNow) / duration`), not a fixed 16 ms.
5. Fan speed `0.04 + gpuUtil * 0.004` rad per 16 ms, scaled by elapsed time. GPU emissive, edge line and glow follow `state.telemetry.gpuUtil / 100` as in the prototype. When `options.animate` is false, skip fan rotation, RGB cycling and packets.
6. Camera: spherical orbit around `(0, -3, 0)`, radius 100, `az = 0.62`, `el = 0.3`. `orbitBy` changes `az -= dx * 0.006` and `el = clamp(el + dy * 0.004, -0.15, 0.95)`, and records the time; after 2.5 s without input, ease back toward the idle sway `0.62 + 0.28 * sin(t * 0.22)` (only when animating).
7. `resize` sets renderer size (CSS pixels, `updateStyle = false`), camera aspect, and remembers width/height for `partScreenPosition`.
8. `partScreenPosition` projects the anchor with the camera; `visible` is false when `z > 1` or the point is outside the canvas.
9. `dispose` traverses the scene and disposes every geometry, material and texture, then `renderer.dispose()`.
10. Do not probe WebGL here: `MachineHero` checks it before `import()`, so a browser without WebGL never downloads three.

- [ ] **Step 2: Typecheck and lint**

Run: `npm run typecheck` then `npx eslint components/home/machine`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/home/machine/scene.ts
git commit -m "Add the Three.js scene for the Legion T5 cover"
```

---

### Task 5: `MachineHero` client component and styles

**Files:** Create `components/home/machine/MachineHero.tsx`, `styles/machine.css`; Modify `app/layout.tsx`

- [ ] **Step 1: Write `components/home/machine/MachineHero.tsx`**

```tsx
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
    loading: "正在装配主机…",
  },
  en: {
    region: "My PC: a 3D model of a Legion T5. Labels are links into the matching chapters.",
    tabs: { machine: "Machine", grpo: "Run one GRPO step" } as Record<Mode, string>,
    drag: "Drag to orbit",
    idle: "i7-12700 · 16 GB DDR5 · RTX 3060 12 GB. Press “Run one GRPO step” to watch a real training step move through this machine.",
    simulated: "Readouts are simulated",
    related: "Related notes",
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
  const panel = useRef<HTMLDivElement>(null);
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
    let last = performance.now();
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
      const dt = Math.min(100, now - last);
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
          <p>{current.text[lang]}<small>step {step} / {GRPO_TOTAL_STEPS} · {copy.related}：{relatedLinks(current.slugs)}</small></p>
        ) : (
          <ol>{grpoPhases.map((p) => <li key={p.text.en}>{p.text[lang]} <small>{relatedLinks(p.slugs)}</small></li>)}</ol>
        )}
      </div>
    </section>
  );
}
```

Note: `sceneRef` is kept so later work (OS / network tabs) can reach the scene from handlers; it is never read during render.

- [ ] **Step 2: Write `styles/machine.css`**

```css
/* Homepage machine cover: the one dark, animated element on an otherwise quiet light site. */
.machine-panel { position: relative; height: 460px; border-radius: 14px; overflow: hidden; background: #05070d; color: #d9e4ff; isolation: isolate; }
.machine-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; cursor: grab; touch-action: none; }
.machine-canvas:active { cursor: grabbing; }
.machine-tabs { position: absolute; top: 12px; left: 12px; display: flex; flex-wrap: wrap; gap: 6px; z-index: 2; }
.machine-tab { font: inherit; font-size: 12px; padding: 4px 11px; border-radius: 999px; border: 1px solid rgba(160, 180, 255, .3); background: rgba(10, 16, 32, .75); color: #b9c6ea; cursor: pointer; }
.machine-tab[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: #fff; }
.machine-tab:focus-visible { outline: 2px solid #9a87fe; outline-offset: 2px; }
.machine-model { position: absolute; top: 12px; right: 14px; margin: 0; font: 10px/1.5 ui-monospace, Menlo, monospace; color: #7f8fb8; text-align: right; pointer-events: none; z-index: 2; }
.machine-labels { position: absolute; inset: 0; pointer-events: none; z-index: 1; }
.machine-label { position: absolute; left: 0; top: 0; pointer-events: auto; font: 11px/1.35 ui-monospace, Menlo, monospace; color: #cfe3ff; background: rgba(10, 16, 32, .82); border: 1px solid rgba(120, 160, 255, .35); border-radius: 6px; padding: 3px 7px; white-space: nowrap; text-decoration: none; will-change: transform; }
a.machine-label:hover, a.machine-label:focus-visible { border-color: #9a87fe; color: #fff; }
.machine-label b { color: #fff; font-weight: 500; }
.machine-readout { color: #ffb86b; }
.machine-readout:empty { display: none; }
.machine-hud { position: absolute; left: 12px; right: 12px; bottom: 12px; z-index: 2; font-size: 12px; line-height: 1.55; background: rgba(8, 12, 24, .86); border: 1px solid rgba(120, 160, 255, .25); border-radius: 8px; padding: 8px 11px; }
.machine-hud p, .machine-hud ol { margin: 0; }
.machine-hud ol { padding-left: 0; list-style: none; display: grid; gap: 4px; }
.machine-hud small { display: block; color: #7f8fb8; font-size: 11px; }
.machine-hud a { color: #c9bcff; }

/* Before the scene loads, and without WebGL: the labels become a plain list. */
.machine-panel[data-status="loading"] .machine-labels,
.machine-panel[data-status="list"] .machine-labels { position: static; display: flex; flex-direction: column; gap: 8px; padding: 56px 14px 0; }
.machine-panel[data-status="loading"] .machine-label,
.machine-panel[data-status="list"] .machine-label { position: static; transform: none !important; align-self: flex-start; }
.machine-panel[data-status="list"] .machine-canvas { display: none; }

@media (max-width: 640px) {
  .machine-panel { height: 400px; border-radius: 10px; }
  .machine-label { font-size: 10px; padding: 2px 6px; }
  .machine-hud { font-size: 11px; }
}
```

- [ ] **Step 3: Import the stylesheet in `app/layout.tsx`**, after `@/styles/sketch.css`:

```tsx
import "@/styles/machine.css";
```

- [ ] **Step 4: Typecheck and lint**

Run: `npm run typecheck` then `npm run lint`
Expected: PASS. If `react-hooks/refs` or `react-hooks/set-state-in-effect` fire, the fix is to move the flagged access into an event handler or effect callback, never to disable the rule.

- [ ] **Step 5: Commit**

```bash
git add components/home/machine/MachineHero.tsx styles/machine.css app/layout.tsx
git commit -m "Add MachineHero: lazy 3D scene, linked labels, GRPO HUD"
```

---

### Task 6: Homepage hero and activity placement

**Files:** Modify `app/page.tsx`, `app/globals.css`, `components/layout/NotebookShell.tsx`

- [ ] **Step 1: Skip the activity panel on the homepage** — in `NotebookShell.tsx` replace `{activity}{children}` with:

```tsx
{pathname === "" ? null : activity}{children}
```

(`pathname` already has its trailing slash stripped, so `/` is `""`.)

- [ ] **Step 2: Replace the intro block in `app/page.tsx`**

Add imports:

```tsx
import Avatar from "@/components/layout/Avatar";
import LearningActivity from "@/components/layout/LearningActivity";
import MachineHero from "@/components/home/machine/MachineHero";
import { profile } from "@/content/profile";
```

Replace the `<div className="page-intro">…</div>` line with:

```tsx
<section className="home-hero">
  <div className="page-intro">
    <p className="eyebrow"><span /> THE KNOWLEDGE GARDEN</p>
    <h1>保持好奇，慢慢积累<span className="brand-dot">。</span></h1>
    <div className="intro-byline">
      <Avatar size="small" />
      <p>{profile.intro.zh}</p>
    </div>
    <p className="intro-links">
      {profile.githubUrl && <a href={profile.githubUrl} target="_blank" rel="noreferrer">GitHub</a>}
      {profile.homepageUrl && <a href={profile.homepageUrl} target="_blank" rel="noreferrer">Homepage</a>}
    </p>
  </div>
  <MachineHero lang="zh" />
</section>
<LearningActivity />
```

- [ ] **Step 3: Add hero layout CSS to `app/globals.css`** after the `.page-intro h1` rule (line ~176):

```css
.home-hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.45fr); gap: 34px; align-items: center; margin-bottom: 30px; }
.home-hero .page-intro { margin-bottom: 0; }
.intro-byline { display: flex; gap: 12px; align-items: flex-start; margin-top: 18px; }
.intro-byline p { margin: 0; color: #6b6b6b; font-size: 14px; line-height: 1.75; }
.intro-links { display: flex; gap: 14px; margin: 12px 0 0 48px; font-size: 13px; }
.intro-links a { color: var(--accent); text-decoration: underline; text-underline-offset: 3px; text-decoration-thickness: 1px; }
.home-page > .activity-panel { margin-bottom: 39px; }
@media (max-width: 1100px) { .home-hero { grid-template-columns: minmax(0, 1fr); gap: 22px; } }
```

- [ ] **Step 4: Typecheck, lint, test**

Run: `npm run typecheck`, `npm run lint`, `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx app/globals.css components/layout/NotebookShell.tsx
git commit -m "Homepage: intro plus 3D machine hero, activity grid below it"
```

---

### Task 7: Visual verification and tuning

- [ ] **Step 1: Start the preview** with `preview_start` (dev server from `.claude/launch.json`; create a config running `npm run dev` on port 3000 if none exists).
- [ ] **Step 2: Desktop check** — screenshot `/`. Compare against the prototype: case visible, fans spinning, RGB cycling, labels on their parts and readable. Tune light intensities in `scene.ts` until it matches; commit tuned values.
- [ ] **Step 3: Interactions** — drag rotates; idle sway resumes; `跑一步 GRPO` shows packets on the right paths and the HUD steps through ①–⑤ with working note links; clicking the GPU label navigates to `/notes/ai-infra/gpu/overview/`.
- [ ] **Step 4: Fallbacks** — with the `resize_window` mobile preset: panel 400 px tall, HDD/PSU labels hidden, no horizontal scroll. Reduced motion cannot be emulated from the preview tools, so temporarily change `const animate = !window.matchMedia(...)` to `const animate = false`, reload, and check: one still frame, no packets, the GRPO tab lists all five phases with links, dragging still re-renders. Revert the change before committing.
- [ ] **Step 5: Console and build** — `read_console_messages` shows no errors; `npm run build` succeeds and `out/index.html` contains the label list markup.
- [ ] **Step 6: Commit** any tuning.
