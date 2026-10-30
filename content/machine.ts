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

// Phase text (G = 6, 30 ms vs 7 ms, 63% / 37%, LoRA r = 32) comes from content/ml/post-training/grpo-3060-project.mdx; gpuUtil and cpuTemp are illustrative animation targets.
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
