# GPU Kernels 笔记系列 — 设计文档

日期：2026-10-15　状态：已实施（作者要求跳过实现计划，直接写页面）

## 目标

把 COMP 568（Deep Learning System Design & Optimization）课程仓库 <https://github.com/Ryanrc03/DeepLearning-System-Optimze> 里的实验，整理成 RLearning 上 AI Infrastructure › GPU Kernels 下的 7 篇短笔记。每篇讲一个 GPU 优化概念，用一组自己测到的数据作为例子。读者是刚接触 CUDA 的工程师，以及回头复习的作者本人。

## 写法：沿用 writing-fundamentals-note

每页都按 `.claude/skills/writing-fundamentals-note/SKILL.md` 的页面约定和图约定来写：

- 标题是 `# X vs Y`，概念术语保留英文。
- 正文只有四节：`## 一句话` → `## 一张图` → `## 一个真实的例子：<实验名>` → `## 再往下看`。
- 正文少于 450 字，不放代码块，不写代价 / 坑 / 历史这类小节，只举一个例子。
- 每页一张图：左右并排的静态 SVG，左边是 X，右边是 Y，两边用同一组角色。图里有两个事件按钮和一个重置按钮，每种状态配一句 `viz-narr` 说明。不用滑块，不做模式切换，不加定时器。图放在 `div.viz-scroll` 里，外层用 `VisualizationFrame` 包裹，样式只用 `styles/visualization.css` 里的 class。

**实验一节的写法（作者第二轮反馈，优先于下面的旧修订）**：例子一节必须讲清四件事，按这个顺序：`### 实验想做什么`（任务、对比的两种做法、改变的变量）→ `### 两边怎么做`（配图）→ `### 你会观察到什么`（先列出读者会看到的现象，再放模拟器或实测数据）→ `### 为什么会这样`（逐条对应回概念）。对比的两种做法必须就是本页的 X 和 Y：课程实验原本的对比和本页一致时用实测数据，不一致时用一个简单的模拟实验，并在图注里写明模拟参数。7 页都已按这个规则重写：第 1、2 页用模拟实验（数组相加、roofline），第 3–7 页分别用 exp5、exp2、exp3、exp7、exp6 的实测数据，实测结果统一用 `MeasuredBars` 组件画。第 3 页如实展示了 exp5 的三个版本：只加 shared memory 的第一版只快 0.96–1.10 倍，最终版加上寄存器分块和多通道复用后才快 2.6–4.3 倍。此前的安排是：exp2 的模型图和 batch 图（`MlpStructureFigure`、`MlpBatchOnGpuDiagram`）挪到第 4 页使用；第 1 页改成数组相加的模拟实验（`VectorAddMappingFigure`、`VectorAddSimulator`）。

**2026-10-15 作者反馈后的修订**：一两句话的例子讲不清楚实验，「一个真实的例子」这一节改为四个小节：`### 模型是什么`（配一张模型结构图）→ `### 在 GPU 上怎么算`（配一张交互图，把实验的计算过程和本页概念连起来）→ `### 测到了什么`（实测表格）→ `### 映射回定义`。因此这一节不再受 skill 的 5 句和 450 字限制，一页可以有多张图。第 1 页已经按这个格式重写，概念也改成了「延迟优先 vs 吞吐优先」。

这个 skill 原本是为 CS Fundamentals 写的，用在这里有三处有意的改动：

| skill 原要求 | 本系列的做法 | 原因 |
| --- | --- | --- |
| 例子用读者用过的产品（Chrome、微信） | 例子用我在课程实验里的实测数据，并标明 GPU 型号 | GPU kernel 没有对应的日常产品；这个系列本来就是在整理课程项目 |
| 「再往下看」链接站内长文 | 站内有相关长文时链接长文（第 1 页），没有时链接 GitHub 上对应实验的 `report.md` | 站内暂时没有讲 GPU 优化的长文 |
| 放在 CS Fundamentals | `categoryId: "ai-infra"`、`section: "GPU Kernels"` | 这些主题属于 AI Infra |

## 总览页（2026-10-19 新增）

`overview.mdx` 放在系列第 1 位，slug `ai-infra/gpu/overview`，只总结本章 7 页，不列本章没写的方法。结构：一句话 → 一步训练的时间都花在哪（`TrainingStepFigure`，四段里标出本章只讲 kernel 启动和 GPU 计算）→ 先看哪些指标（表：怎么看、说明什么、对应页）→ 一张图（`TrainingBottleneckMap`：5 个现象按钮 → 高亮 step 的哪一段 → 该查的指标 → 本章哪一页）→ 本章的方法清单（按瓶颈分组，每条链接到页）→ 怎么读这一章（`SectionMapViz` 的 `gpu` 配置）。8 页都挂了 `series: gpu-kernels`，页尾有上一篇/下一篇。

## 七篇笔记

所有 MDX 放在 `content/ai-infra/gpu/`，所有图放在 `components/visualization/gpu/`。

| # | slug | 标题 | 一句话的对比 | 两个按钮 → 两边分别怎么变化 | 真实例子 | 再往下看 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `cpu-vs-gpu` | CPU vs GPU | CPU 靠几个强核各走各的路；GPU 靠上千个弱核，以 32 个一组（warp）同时执行同一条指令 | 「来了 100 万个加法」：CPU 排队算，GPU 一次铺满。「每个线程走不同分支」：CPU 不受影响，GPU 的 warp 要把各个分支轮流走一遍 | exp0 `gpu_info`，NVIDIA L40S：142 个 SM，每个 block 最多 1024 个线程（也就是 32 个 warp），每个 block 有 48 KB shared memory | 站内长文：`/notes/cs/os/processes-threads-coroutines/` 中讲 CUDA 线程的那一节 |
| 2 | `compute-vs-memory-bound` | Compute-bound vs Memory-bound | kernel 慢，要么是算不过来，要么是数据搬不过来，提速前先分清是哪一种 | 「算力翻倍」：只有 compute-bound 那一侧变快。「带宽翻倍」：只有 memory-bound 那一侧变快 | exp2 MLP，L40S，开启 TF32：512³ 网络、batch 64 时只有 3,327 GFLOP/s；1024×4096×1024 网络、batch 512 时达到 90,786 GFLOP/s，报告估算约为 TF32 峰值的 99% | exp2 `report.md` |
| 3 | `global-vs-shared-memory` | Global Memory vs Shared Memory | 每个线程都去显存里读，还是一个 block 先把一块数据搬进片上的 shared memory，再一起反复读 | 「相邻线程要同一块数据」：global 一侧每个线程各读一次，shared 一侧只读一次、大家复用。「卷积核从 3×3 变 5×5」：global 一侧每个输出要多读 16 次显存，shared 一侧多出来的读取都在片上完成（概念演示，实测只做了 K=3） | exp5 卷积，V100：baseline 在所有尺寸下都停在约 713–759 GFLOP/s；tiled 版本从 1,861 GFLOP/s 提升到 3,208 GFLOP/s，加速比从 2.56 倍增长到 4.29 倍 | exp5 `report.md` |
| 4 | `separate-vs-fused-kernels` | Separate Kernels vs Fused Kernel | 每一步结果都写回显存再交给下一个 kernel，还是在一个 kernel 里连续做完 | 「矩阵变小」：中间的读写和 kernel 启动占比变大，fusion 收益变大。「矩阵变大」：GEMM 占绝大部分时间，fusion 收益变小 | exp2 MLP，L40S：把 bias 和激活合并成一个 kernel，512³ 网络、batch 64 时快 1.18 倍，2048³ 网络、batch 512 时只快 1.08 倍，平均快 1.13 倍 | exp2 `report.md` |
| 5 | `thread-vs-warp-per-row` | Thread-per-row vs Warp-per-row | 稀疏矩阵的每一行交给一个线程独自处理，还是交给一个 warp 的 32 个线程一起处理 | 「看一次读内存」：thread-per-row 时 32 个线程读的是 32 个分散的行，访问不连续；warp-per-row 时 32 个 lane 读相邻的 32 列，合并成一次访问。「输出列 N 变多」：前者吞吐基本不变，后者越来越快 | exp3 SpMM，L40S，密度 0.01：8192×8192、N=64 时从 41.7 GFLOPS 提升到 2,012 GFLOPS；2048×2048 下 N 从 32 增加到 256，baseline 一直约 10 GFLOPS，加速比在 N=256 时达到 115.5 倍 | exp3 `report.md` |
| 6 | `aggregate-vs-project-first` | Aggregate-first vs Project-first | GCN 的一层可以按 (ÂH)W 先聚合，也可以按 Â(HW) 先降维，数学结果相同，但稀疏乘法要处理的宽度不同 | 「输入特征维度变大」：先聚合一侧的 SpMM 变宽变慢，先降维一侧不受影响。「hidden 变大」：两边的差距缩小 | exp7 GCN，hidden=64：Cora（输入 1433 维）快 2.14 倍，Citeseer（输入 3703 维）快 3.40 倍；Citeseer 的 hidden 增加到 256 时降到 1.77 倍 | exp7 `report.md` |
| 7 | `implicit-gemm-vs-fft` | Implicit GEMM vs FFT | 两种都是 cuDNN 的卷积算法：implicit GEMM 把卷积直接当矩阵乘来算，不需要额外内存；FFT 先变换到频域再计算，需要一块 workspace | 「batch 翻倍」：implicit GEMM 的 workspace 仍为 0，FFT 的 workspace 翻倍。「卷积核变大」：FFT 的相对优势变大（概念演示，不是实测） | exp6 LeNet，V100：batch 128 时 implicit GEMM 的 workspace 为 0、吞吐 872.85 GFLOP/s；FFT 的 workspace 6.7 MB、吞吐 616.52 GFLOP/s；batch 从 32 到 128，FFT 的 workspace 从 1.7 MB 增长到 6.7 MB | exp6 `report.md` |

数据都来自各实验的 `report.md`，写作时还要回到对应的 CSV 再核对一遍。

### 数据使用规则

- 每页的例子只引用一个实验，写明 GPU 型号。L40S 和 V100 的数字不放在同一句话里比较。
- 不引用 exp1（GEMM 代码的 TODO 没有完成，也没有报告）和 exp4（图只有 5 个节点，测出的时间主要是 kernel 启动开销）。
- exp7 的报告没有写 GPU 型号，正文写成「课程 Slurm GPU 节点」，不猜型号。
- 第 3 页「卷积核变 5×5」和第 7 页「卷积核变大」两个按钮演示的是原理，不是实测，narr 里要说明这一点。

## 架构与注册

- 7 个客户端组件，放在 `components/visualization/gpu/`，命名为 `<Concept>Diagram.tsx`（如 `CpuVsGpuDiagram.tsx`），结构参照 `components/visualization/os/ProcessVsThreadDiagram.tsx`。
- `content/notes.ts` 新增 7 条：`categoryId: "ai-infra"`、`category: "AI Infrastructure"`、`section: "GPU Kernels"`、`status: "seed"`、`readingMinutes` 3–5，tags 包含 `"gpu"`。按上表顺序排列，导航顺序也会跟着这个顺序。
- `app/notes/[...slug]/page.tsx` 中加 import，并在 `noteComponents` 里登记。
- 不需要改 `content/navigation.ts`：导航由注册表生成，ai-infra 的 topics 里已经有 "GPU"。
- `content/ai-infra/gpu/.gitkeep` 在第一篇 MDX 落地后删除。

## 测试

`npm run typecheck && npm run lint && npm run build` 全部通过。用 `dev` 启动配置打开 7 个页面，逐个点击每个按钮和重置，确认每种状态的 narr 都正确；在手机宽度下检查 SVG 区域可以横向滚动，页面本身不出现横向滚动。

## 实施顺序

1. 第 1、2 页（概念基础），确认样式和写法都符合 skill 后，再批量写后面几页。
2. 第 3、4 页（内存与 fusion）。
3. 第 5、6 页（稀疏计算与 GNN）。
4. 第 7 页（cuDNN 算法选择）。
5. 删除 `.gitkeep`，完成全量构建和预览验收。

## 不做

- 不新写站内长文，也不做 lab / 数据看板页面（以后可以作为后续工作）。
- 不写 Slurm 使用教程。
- 不把课程仓库的图片或 CSV 拷进站内，数字直接写进正文。
