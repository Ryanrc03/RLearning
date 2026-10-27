import { createRng, randomNormal } from "./random";

// Pedagogical single-example model, not a replay of the KuaiRand checkpoint.
export type EmbeddingModel = {
  embeddings: number[][];
  weights: number[];
  bias: number;
  selected: number;
  dense: number;
  label: number;
};
export const TOY_CATEGORIES = ["未见 / 缺失", "音乐", "美食", "运动"];
export const TOY_LR = 0.01;
export const TOY_BETA1 = 0.9;
export const TOY_BETA2 = 0.999;
export const TOY_EPS = 1e-8;

export function createEmbeddingExample(seed = 42): EmbeddingModel {
  const rng = createRng(seed);
  return {
    embeddings: Array.from({ length: TOY_CATEGORIES.length }, () => Array.from({ length: 2 }, () => randomNormal(rng, 0, 0.01))),
    weights: Array.from({ length: 3 }, () => randomNormal(rng, 0, 0.3)),
    bias: 0, selected: 2, dense: 0.6, label: 1,
  };
}

export function embeddingForward(model: EmbeddingModel) {
  const x = [...model.embeddings[model.selected], model.dense];
  const products = x.map((v, i) => v * model.weights[i]);
  const logit = products.reduce((a, b) => a + b, model.bias);
  const probability = 1 / (1 + Math.exp(-logit));
  const loss = Math.max(logit, 0) - model.label * logit + Math.log1p(Math.exp(-Math.abs(logit)));
  return { x, products, logit, probability, loss };
}

export function embeddingGradients(model: EmbeddingModel) {
  const f = embeddingForward(model);
  const error = f.probability - model.label;
  return {
    error,
    embeddings: model.embeddings.map((row, i) => row.map((_, j) => i === model.selected ? error * model.weights[j] : 0)),
    weights: f.x.map(v => error * v),
    bias: error,
  };
}

// First update only: m0 = v0 = 0, t = 1, no weight decay.
export function firstAdamStep(before: number, gradient: number) {
  const m = (1 - TOY_BETA1) * gradient;
  const v = (1 - TOY_BETA2) * gradient * gradient;
  const mHat = m / (1 - TOY_BETA1);
  const vHat = v / (1 - TOY_BETA2);
  const delta = -TOY_LR * mHat / (Math.sqrt(vHat) + TOY_EPS);
  return { before, gradient, m, v, mHat, vHat, delta, after: before + delta };
}

export function embeddingUpdate(model: EmbeddingModel): EmbeddingModel {
  const g = embeddingGradients(model);
  return {
    ...model,
    embeddings: model.embeddings.map((row, i) => row.map((v, j) => firstAdamStep(v, g.embeddings[i][j]).after)),
    weights: model.weights.map((v, i) => firstAdamStep(v, g.weights[i]).after),
    bias: firstAdamStep(model.bias, g.bias).after,
  };
}
