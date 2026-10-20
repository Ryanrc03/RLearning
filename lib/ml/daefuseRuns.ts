// The exact training runs the DAE-Fuse background figures show. Each run is
// computed once per page and shared by its "training dynamics" and
// "experiment" figures, so both always plot the same numbers.
// No React here; the trainers are tested in tests/daefuse-train.test.ts.

import {
  barData,
  barTestSet,
  cornerData,
  detData,
  edgeData,
  trainAe,
  trainClassifier,
  trainDetector,
  trainGan,
  type AeSnap,
  type ClsSnap,
  type DetSample,
  type DetSnap,
  type GanSnap,
  type Sample,
} from "./daefuseTrain";

const cache = new Map<string, unknown>();
function once<T>(key: string, f: () => T): T {
  if (!cache.has(key)) cache.set(key, f());
  return cache.get(key) as T;
}

/** 16 training bars, 80 test bars (every position): CNN vs MLP. */
export const barsRun = () =>
  once("bars", () => {
    const train = barData(16, 5);
    const test = barTestSet(99);
    return {
      train,
      test,
      cnn: trainClassifier("cnn", train, test, { steps: 300, lr: 0.05, batch: 16, seed: 11, every: 10 }) as ClsSnap[],
      mlp: trainClassifier("mlp", train, test, { steps: 300, lr: 0.02, batch: 16, seed: 11, every: 10 }) as ClsSnap[],
    };
  });

/** "Both corners lit": the smallest ViT vs the same CNN. */
export const cornersRun = () =>
  once("corners", () => {
    const train = cornerData(120, 5);
    const test: Sample[] = cornerData(120, 77);
    return {
      train,
      test,
      vit: trainClassifier("vit", train, test, { steps: 300, lr: 0.01, batch: 16, seed: 11, every: 10 }) as ClsSnap[],
      cnn: trainClassifier("cnn", train, test, { steps: 300, lr: 0.01, batch: 16, seed: 12, every: 10 }) as ClsSnap[],
    };
  });

/** One GAN trained the usual way (Adam, 5 D steps per G step). */
export const ganRun = () => once("gan", () => trainGan({ steps: 800, every: 10, seed: 3, loss: "nonsat", lrG: 0.01, lrD: 0.05, dSteps: 5 }) as GanSnap[]);

/** The loss experiment: same start, discriminator pre-trained to be confident, plain SGD on G. */
export const ganLossRun = () =>
  once("ganLoss", () => {
    const cfg = { steps: 400, every: 5, seed: 3, preTrainD: 300, lrG: 0.05, lrD: 0.05, dSteps: 5, sgdG: true } as const;
    return { minimax: trainGan({ ...cfg, loss: "minimax" }) as GanSnap[], nonsat: trainGan({ ...cfg, loss: "nonsat" }) as GanSnap[] };
  });

export const VAE_BETA = 0.05;

/** AE and VAE on the same 24 edge rows, same initial weights. */
export const aeRun = () =>
  once("ae", () => ({
    data: edgeData(4),
    ae: trainAe({ vae: false, steps: 1500, every: 50, seed: 4 }) as AeSnap[],
    vae: trainAe({ vae: true, beta: VAE_BETA, steps: 1500, every: 50, seed: 4 }) as AeSnap[],
  }));

/** The grid detector; two fixed test images are drawn at every snapshot. */
export const detRun = () =>
  once("det", () => ({
    snaps: trainDetector({ steps: 600, every: 20, seed: 6 }) as DetSnap[],
    show: detData(60, 6 + 100).slice(0, 2) as DetSample[],
  }));
