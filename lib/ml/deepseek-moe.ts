export type MoEToken = {
  scores: number[];
  expertOutputs: number[];
  sharedOutput: number;
  topK: number;
  target: 0 | 1;
};

// Scalar logit example for the figure. DeepSeekMoE itself uses vector FFNs
// and next-token softmax cross-entropy; this binary head keeps gradients visible.
export function routeToken({ scores, expertOutputs, sharedOutput, topK, target }: MoEToken) {
  if (!scores.length || scores.length !== expertOutputs.length || topK < 1 || topK > scores.length ||
      !scores.every(Number.isFinite) || !expertOutputs.every(Number.isFinite) || !Number.isFinite(sharedOutput)) {
    throw new RangeError("Invalid MoE token fixture");
  }
  const maxScore = Math.max(...scores);
  const weights = scores.map((score) => Math.exp(score - maxScore));
  const denominator = weights.reduce((sum, weight) => sum + weight, 0);
  const affinities = weights.map((weight) => weight / denominator);
  const selected = scores.map((_, index) => index).sort((a, b) => scores[b] - scores[a] || a - b).slice(0, topK);
  const chosen = new Set(selected);
  const gates = affinities.map((affinity, index) => chosen.has(index) ? affinity : 0);
  const output = sharedOutput + gates.reduce((sum, gate, index) => sum + gate * expertOutputs[index], 0);
  const probability = 1 / (1 + Math.exp(-output));
  const loss = Math.max(output, 0) - output * target + Math.log1p(Math.exp(-Math.abs(output)));
  const outputGradient = probability - target;
  return {
    affinities, selected, gates, output, probability, loss,
    expertOutputGradients: gates.map((gate) => gate * outputGradient),
    sharedOutputGradient: outputGradient,
  };
}

export type ToyBatchInput = {
  scoresByToken: number[][];
  expertOutputs: number[];
  sharedOutput: number;
  targetIndices: number[];
  outputClassIndices: number[];
  vocabularySize: number;
  topK: number;
  balanceAlpha: number;
  learningRate: number;
};

// A two-token teaching model: each expert output is one scalar parameter and
// the MoE result is added to one class logit chosen by the toy head,
// independently of the label. All other logits are zero. This is not a
// real LM head or AdamW update.
export function trainToyBatch(input: ToyBatchInput) {
  const { scoresByToken, expertOutputs, sharedOutput, targetIndices, outputClassIndices, vocabularySize, topK, balanceAlpha, learningRate } = input;
  if (!scoresByToken.length || scoresByToken.length !== targetIndices.length || scoresByToken.length !== outputClassIndices.length || !Number.isInteger(vocabularySize) || vocabularySize < 2 ||
      ![...targetIndices, ...outputClassIndices].every((index) => Number.isInteger(index) && index >= 0 && index < vocabularySize) ||
      !Number.isFinite(balanceAlpha) || balanceAlpha < 0 || !Number.isFinite(learningRate) || learningRate < 0) {
    throw new RangeError("Invalid toy training batch");
  }
  const selectionCounts = expertOutputs.map(() => 0);
  const affinitySums = expertOutputs.map(() => 0);
  const expertGradients = expertOutputs.map(() => 0);
  let sharedGradient = 0;
  const tokens = scoresByToken.map((scores, tokenIndex) => {
    const route = routeToken({ scores, expertOutputs, sharedOutput, topK, target: 1 });
    route.selected.forEach((expertIndex) => selectionCounts[expertIndex]++);
    route.affinities.forEach((affinity, expertIndex) => affinitySums[expertIndex] += affinity);
    const outputClassIndex = outputClassIndices[tokenIndex];
    const correctOutputClass = outputClassIndex === targetIndices[tokenIndex];
    const maxLogit = Math.max(0, route.output);
    const logPartition = maxLogit + Math.log(Math.exp(route.output - maxLogit) + (vocabularySize - 1) * Math.exp(-maxLogit));
    const targetLogit = correctOutputClass ? route.output : 0;
    const targetProbability = Math.exp(targetLogit - logPartition);
    const outputProbability = Math.exp(route.output - logPartition);
    const loss = logPartition - targetLogit;
    const outputGradient = (outputProbability - Number(correctOutputClass)) / scoresByToken.length;
    route.gates.forEach((gate, expertIndex) => expertGradients[expertIndex] += gate * outputGradient);
    sharedGradient += outputGradient;
    return {
      targetIndex: targetIndices[tokenIndex],
      outputClassIndex,
      selected: route.selected,
      affinities: route.affinities,
      gates: route.gates,
      output: route.output,
      targetProbability,
      loss,
      outputGradient,
    };
  });
  const meanLanguageLoss = tokens.reduce((sum, token) => sum + token.loss, 0) / tokens.length;
  const averageAffinities = affinitySums.map((sum) => sum / tokens.length);
  const relativeLoads = selectionCounts.map((count) => expertOutputs.length * count / (topK * tokens.length));
  const balanceLoss = balanceAlpha * relativeLoads.reduce((sum, load, index) => sum + load * averageAffinities[index], 0);
  return {
    tokens,
    selectionCounts,
    averageAffinities,
    relativeLoads,
    meanLanguageLoss,
    balanceLoss,
    totalLoss: meanLanguageLoss + balanceLoss,
    expertGradients,
    sharedGradient,
    updatedExpertOutputs: expertOutputs.map((value, index) => value - learningRate * expertGradients[index]),
    updatedSharedOutput: sharedOutput - learningRate * sharedGradient,
  };
}
