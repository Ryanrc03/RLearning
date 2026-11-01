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
