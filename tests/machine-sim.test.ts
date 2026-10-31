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
