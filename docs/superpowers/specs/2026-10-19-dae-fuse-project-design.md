# DAE-Fuse project page — design

Page: `content/ml/multimodal/dae-fuse-project.mdx` (node 5 of the Multimodal chapter, after MultiSticker).
Source: arXiv 2409.10080v3 (tables I–IV, Eqs. 1–15); paper figures and demo videos in `public/projects/dae-fuse/`.
Toy computations and the paper tables live in `lib/ml/daefuse.ts`, tested by `tests/daefuse.test.ts`.

Section 2 gives every building block (CNN, ViT, GAN, AE / VAE, YOLO) the same three figures: ① architecture, ② a real training run stepped through snapshot by snapshot, ③ a comparison experiment, followed by the formulas. The tiny models are trained in the browser with hand-written gradients (`lib/ml/daefuseTrain.ts`, gradient-checked in `tests/daefuse-train.test.ts`); the exact runs and seeds are in `lib/ml/daefuseRuns.ts` and start only when the figure scrolls near the viewport (`useLazyRun` in `DfTrainKit.tsx`).

| Part | ① Architecture | ② Training dynamics | ③ Experiment |
| --- | --- | --- | --- |
| CNN | `DfCnnArch`: slide a hand-set kernel, see one output pixel computed | `DfCnnTrain`: 26-param CNN on 16 bars, kernels + feature maps + loss | `DfCnnExp`: CNN vs MLP on unseen bar positions (100% vs 56%) |
| ViT | `DfVitArch`: patch → embed + pos → [CLS] attention → head, stage focus | `DfVitTrain`: attention converging on the two decisive corners | `DfVitExp`: CNN + GAP vs ViT on "both corners lit" (≈70% vs 100%) |
| GAN | `DfGanArch`: D step vs G step, which params move | `DfGanTrain`: 1-D GAN, mean found, spread collapses, recovers | `DfGanExp`: minimax vs non-saturating G loss under a confident D |
| AE / VAE | `DfAeVaeArch`: neuron diagram, bottleneck differs | `DfAeTrain`: 2-D latent of 24 edge rows, AE vs VAE tabs | `DfAeVaeExp`: reconstruction vs sampling from N(0, I) |
| YOLO | `DfYoloArch`: grid cells, shared head, per-cell training target | `DfYoloTrain`: objectness map + best box on two test images | `DfYoloNms` (illustrative boxes): IR vs visible vs fused input |

Figures from the first version used in section 2 as mechanism explainers: `DfCnnVsVit` and `DfFrequencySplit` (2.3), `DfGanGame` (2.4), `DfVaeBlur` (2.5).


| Component | Section | What it shows |
| --- | --- | --- |
| `DfCnnVsVit` | 2.1–2.2 | Click a pixel: receptive field of L stacked 3 × 3 convs vs one ViT layer's attention over 4 × 4 patches |
| `DfFrequencySplit` | 2.3 | A scan line split into low (moving average, DLE / ViT) and high (residual, DHE / ResNet18); sliders for the correlation decomposition loss (Eq. 10) |
| `DfGanGame` | 2.4 | D(real), D(fake) sliders → discriminator loss, minimax vs non-saturating generator loss and gradient |
| `DfVaeBlur` | 2.5 | σ slider: two overlapping posteriors → MSE-optimal decode drifts toward the average; KL alongside |
| `DfYoloNms` | 2.6 | IR / visible / fused inputs, conf and NMS thresholds → kept boxes, IoU, TP / FP / missed |
| `DfArchitecture` | 3.1 | Static diagram; Phase 1 / Phase 2 buttons focus each phase's path |
| `DfCrossAttention` | 3.3 | 4 tokens per modality, both directions: q·k/√d, softmax weights, output, full 4 × 4 matrix |
| `DfReconLoss` | 3.4 Phase 1 | Blur-as-reconstruction → MSE, 1 − SSIM, L_corr, L_adv weighted by Eq. 8; discriminator loss |
| `DfFusionLoss` | 3.4 Phase 2 | Hand fusion rules → L_int, L_text with their max targets and the gradient error map |
| `DfMetricsToy` | 4.1 | EN / SD / SF / MI on the same toy fusions, next to the two losses |
| `DfResults` | 4.2, 4.5 | Tables I–II by dataset and metric, colored by method family; DAE-Fuse rank table |
| `DfDetection` | 4.4 | Table III per class, single-modality rows highlighted |
| `DfAblation` | 4.6 | Table IV, change vs the full model per metric |
