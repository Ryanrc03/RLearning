# 首页封面：3D 主机 — 设计文档

日期：2026-10-30　状态：设计已和作者确认，待实施

## 目标

把首页封面从一段文字介绍升级成作者自己那台主机的 3D 可视化：硬件是 system 视角，跑在上面的训练是 ML 视角。它同时承担自我介绍（这是我的机器，GRPO 就是在这张 3060 上训的）和目录入口（点部件进对应章节）。

调研过的同类站点（Lil'Log、Maggie Appleton、Eugene Yan、Andy Matuschak、Karpathy 等）几乎都不用 GitHub 式的 profile 卡；作者也认为「太像 GitHub 不好」。所以身份信息只保留一段短的自我介绍，个性放在 3D 主机上。

## 范围

- 做：首页 hero（左文字、右 3D 面板），两个视角 `整机` 和 `跑一步 GRPO`，部件标签可点进章节，静态海报兜底。
- 不做（之后）：`操作系统`、`网络` 视角；回放真实 `nvidia-smi` 日志；汇编执行 / CPU 模拟器；其它 workload（推荐模型训练、推理与 KV cache）。v1 不显示「之后」的占位 tab。
- 不改：笔记页顶部的学习活动方格、路线图、最近记录。

## 首页布局

1. **Hero**，桌面两栏：
   - 左：现有 eyebrow「THE KNOWLEDGE GARDEN」和标题「保持好奇，慢慢积累。」，下面一段自我介绍（小头像 + 2–3 句：Ryan，Rice University，Houston，最近在学什么），链接 GitHub（`Ryanrc03`）和主页（`https://nextmile-lime.vercel.app/`）。
   - 右：深色圆角 3D 面板，约 560 × 460。
   - 窄屏上下堆叠，面板在文字下面。
2. **学习活动方格**：首页上从页面最顶部挪到 hero 下面。实现上 `NotebookShell` 在 `/` 不渲染 `activity`，由首页自己渲染 `LearningActivity`；其它页面不变。
3. 知识路线图、最近记录：不变。

站点整体是浅色；深色 3D 面板是首页唯一的「fancy」元素，其余保持安静的文档风格。

## 机器（真实规格）

规格读自作者本机（Win32 CIM 和 `nvidia-smi`，2026-10-30）：

| 部件 | 规格 | 点进 |
| --- | --- | --- |
| 整机 | Lenovo Legion T5 26IAB7 | — |
| CPU | Intel Core i7-12700，12 核 20 线程 | `cs/fundamentals/overview` |
| 内存 | 16 GB DDR5-4800（2 × 8 GB） | `cs/fundamentals/memory-hierarchy` |
| GPU | NVIDIA GeForce RTX 3060 12 GB，功耗上限 170 W | `ai-infra/gpu/overview` |
| SSD | KIOXIA 256 GB NVMe | `systems/data/overview` |
| HDD | WD 1 TB | `systems/data/overview` |
| 电源 | — | 不链接，显示整机功耗 |

外观参照作者的照片：黑色机箱、玻璃侧板、双风扇塔式散热器带 RGB 环、显卡侧面绿色「RTX 3060」字样、电源仓顶部蓝色灯带、前面板竖向灯条。不画品牌 logo。

## 两个视角

**整机**：风扇转、RGB 渐变，标签显示规格和实时读数（温度、利用率、内存占用、功耗）。读数是模拟值，HUD 里注明「温度为模拟值」。

**跑一步 GRPO**：循环播放一次真实 GRPO step，数字全部来自 `content/ml/post-training/grpo-3060-project.mdx`：

| # | 数据流 | 说明 | 相关笔记 |
| --- | --- | --- | --- |
| 1 | SSD → 内存 | 读一道 GSM8K 题，CPU 分词，prompt ≤ 256 token | `ml/post-training/grpo-3060-project` |
| 2 | 内存 → PCIe → 显存 | 显存里常驻 4-bit Qwen2.5-3B 和 r = 32 的 LoRA | `ml/post-training/lora` |
| 3 | GPU 内部 | vLLM 为这道题采样 G = 6 个回答；每个 decode 步 30 ms，带宽下限 7 ms | `ml/llms/decoding-strategies`、`ai-infra/gpu/compute-vs-memory-bound` |
| 4 | 显存 → CPU | 5 个规则函数打分，组内归一化成 advantage | `ml/post-training/grpo`、`ml/post-training/reward-hacking` |
| 5 | GPU 内部 | 反向 + 8-bit paged AdamW，只更新 LoRA；GPU 63% 时间在算，37% 是 WSL 调度空转 | `ml/dl-blocks/backprop-chain-rule`、`ml/training/gradient-descent-optimizers` |

HUD 显示当前阶段、`step n / 500` 和相关笔记链接（表中是笔记 slug，链接到 `/notes/<slug>/`）；整机视角里 HUD 另给 `ml/overview` 和项目笔记的入口，作为 ML 部分的总入口。GPU 利用率、温度和风扇转速跟着阶段变化。

## 架构

| 单元 | 职责 | 依赖 |
| --- | --- | --- |
| `content/machine.ts` | 纯数据：规格、部件 → 链接、GRPO 阶段（文字、相关笔记 slug、利用率 / CPU 目标值）。所有面向读者的文字写成 `{ zh, en }`，给英文版直接用 | 无 |
| `components/home/machine/sim.ts` | 纯函数：阶段推进（按时长循环、step 计数）、读数向目标值缓动、功耗估算 | `content/machine.ts` |
| `components/home/machine/scene.ts` | Three.js 场景：机箱、主板、散热器与风扇、内存、显卡、SSD、电源仓、数据包粒子。对外只暴露 `createScene(canvas) → { update(dt, state), setMode, project(partId), resize, dispose }` | `three` |
| `components/home/machine/MachineHero.tsx` | `"use client"`。先渲染部件标签列表；面板可见、有 WebGL、未开启减少动态时 `import()` `scene.ts`；HTML 标签叠在 canvas 上（`<a>` 可点）；tab 切换；拖动旋转、空闲时轻微摆动 | 以上三个 |
| `app/page.tsx` | 组装 hero、活动方格、路线图、最近记录 | — |

- 依赖：新增 `three`（锁定版本）和 `@types/three`。只在首页动态加载，`npm run build` 的静态导出不受影响。
- 首屏与兜底（实施计划阶段改定，不用海报图）：3D 加载前，深色面板里先把各部件标签显示成一列文字；没有 WebGL 时一直是这一列。开启减少动态时渲染一帧静止画面，GRPO 视角改成五个阶段的列表。
- 性能：面板离开视口或标签页隐藏时停止渲染；`devicePixelRatio` 上限 2，窄屏上限 1.5。
- 可访问性：面板 `role="img"` 加一句描述；标签是真实链接，能用 Tab 聚焦；tab 是 `<button>`；`prefers-reduced-motion` 时不加载动画，只显示海报和标签。

## 测试

- `tests/machine-sim.test.ts`：阶段按时长推进并循环、step 到 500 后回到 1、读数缓动不越界、减少动态时不推进。
- `npm test`、`npm run typecheck`、`npm run lint`、`npm run build` 全过。
- 内置浏览器预览：桌面和手机宽度、两个 tab、列表兜底和减少动态、标签点击能跳转、无横向溢出、控制台无报错。
