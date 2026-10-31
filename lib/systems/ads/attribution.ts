// Attribution credit and click-level CVR labels for the running example (chapter 03).
// Attribution decides who gets credit for a conversion; the label policy decides which training
// samples are positive. They are separate functions on purpose.
// No React here; see tests/ads-backend.test.ts.

import type { Minute, Touchpoint } from "./case";

export type AttributionPolicy = "last_click" | "first_click" | "linear" | "time_decay";

export const POLICIES: { id: AttributionPolicy; name: string; blurb: string }[] = [
  { id: "last_click", name: "Last-click", blurb: "窗口内最后一次点击拿走全部 credit。" },
  { id: "first_click", name: "First-click", blurb: "窗口内第一次点击拿走全部 credit。" },
  { id: "linear", name: "Linear", blurb: "窗口内每次点击平分 credit。" },
  { id: "time_decay", name: "Time-decay", blurb: "离转化越近权重越大；这里半衰期取 30 分钟（示意）。" },
];

export type Credit = { touchpointId: string; credit: number; eligible: boolean; reason: string };

/**
 * Splits one conversion's credit across touchpoints.
 * A touchpoint is eligible when it happened before the conversion and within `windowMinutes` of it.
 * Credits of eligible touchpoints sum to 1, or all are 0 when nothing is eligible.
 */
export function attribute(
  touchpoints: Touchpoint[],
  conversionTime: Minute,
  windowMinutes: number,
  policy: AttributionPolicy,
  halfLifeMinutes = 30,
): Credit[] {
  const eligible = touchpoints
    .filter((t) => t.time <= conversionTime && conversionTime - t.time <= windowMinutes)
    .sort((a, b) => a.time - b.time);
  const weights = new Map<string, number>();
  if (eligible.length) {
    if (policy === "last_click") weights.set(eligible[eligible.length - 1].id, 1);
    else if (policy === "first_click") weights.set(eligible[0].id, 1);
    else if (policy === "linear") for (const t of eligible) weights.set(t.id, 1 / eligible.length);
    else {
      const raw = eligible.map((t) => 2 ** (-(conversionTime - t.time) / halfLifeMinutes));
      const sum = raw.reduce((s, w) => s + w, 0);
      eligible.forEach((t, i) => weights.set(t.id, raw[i] / sum));
    }
  }
  return touchpoints.map((t) => {
    const ok = eligible.includes(t);
    const reason = t.time > conversionTime ? "发生在转化之后" : ok ? "在归因窗口内" : `距转化 ${conversionTime - t.time} 分钟，超出 ${windowMinutes} 分钟窗口`;
    return { touchpointId: t.id, credit: weights.get(t.id) ?? 0, eligible: ok, reason };
  });
}

export type LabelPolicy = "follow_attribution" | "any_conversion_in_window";

export const LABEL_POLICIES: { id: LabelPolicy; name: string; blurb: string }[] = [
  { id: "follow_attribution", name: "跟随归因结果", blurb: "拿到 credit > 0 的 click 记 1，其余记 0。" },
  { id: "any_conversion_in_window", name: "窗口内有转化即为正", blurb: "每个 click 独立判断：点击后 label window 内同一用户在同一广告主有转化就记 1。" },
];

/** Click-level CVR label for one click under a label policy. Returns 1 or 0. */
export function clickLabel(
  click: Touchpoint,
  credits: Credit[],
  conversionTime: Minute,
  labelWindowMinutes: number,
  policy: LabelPolicy,
): 0 | 1 {
  if (policy === "follow_attribution") return (credits.find((c) => c.touchpointId === click.id)?.credit ?? 0) > 0 ? 1 : 0;
  return conversionTime >= click.time && conversionTime - click.time <= labelWindowMinutes ? 1 : 0;
}

export type LabelStatus = "pending" | "positive" | "final_negative";

export type LabelState = {
  /** Value a training job would read right now. */
  label: 0 | 1;
  status: LabelStatus;
  /** Bumped every time the stored label changes. */
  revision: number;
  /** Whether the stored value can still change. */
  mature: boolean;
  explain: string;
};

/**
 * Label of one click as seen at observation time `now`, when the pipeline emits an early sample.
 * Strategy "emit_and_correct" writes label 0 as provisional and revises it when a conversion arrives.
 * Strategy "treat_missing_as_negative" closes the label at `cutoffMinutes` after the click and never revisits it.
 */
export function labelAt(
  clickTime: Minute,
  conversionTime: Minute | null,
  labelWindowMinutes: number,
  now: Minute,
  strategy: "emit_and_correct" | "treat_missing_as_negative",
  cutoffMinutes = 60,
): LabelState {
  const windowEnd = clickTime + labelWindowMinutes;
  const convInWindow = conversionTime !== null && conversionTime >= clickTime && conversionTime <= windowEnd;
  if (strategy === "treat_missing_as_negative") {
    const closeAt = clickTime + cutoffMinutes;
    const seenByClose = convInWindow && conversionTime! <= closeAt;
    if (now < closeAt) return { label: 0, status: "pending", revision: 0, mature: false, explain: "还没到截止时间，样本尚未写出。" };
    if (seenByClose) return { label: 1, status: "positive", revision: 1, mature: true, explain: "截止前看到了转化，写出 label = 1。" };
    const missed = convInWindow && conversionTime! <= now;
    return {
      label: 0,
      status: "final_negative",
      revision: 1,
      mature: true,
      explain: missed ? "转化已经发生了，但样本在截止时就被定成 0，之后不再修改：这是一个错误的负样本。" : "截止时没看到转化，直接定成 0，之后不再修改。",
    };
  }
  // Both strategies write the first version of the sample `cutoffMinutes` after the click.
  const firstWrite = clickTime + cutoffMinutes;
  if (now < firstWrite) return { label: 0, status: "pending", revision: 0, mature: false, explain: "样本还没写出：第一次写出在点击后 1 小时。" };
  if (convInWindow && conversionTime! <= now) {
    const mature = now >= windowEnd;
    const revision = conversionTime! <= firstWrite ? 1 : 2;
    const how = revision === 1 ? "第一次写出时转化已经到了，直接写 label = 1" : "转化到了：label 从 provisional 0 修正为 1（revision 2）";
    return { label: 1, status: "positive", revision, mature, explain: mature ? `窗口已结束，label = 1 定稿（revision ${revision}）。` : `${how}。正样本一般不会再变回 0，除非之后出现退款等撤销规则。` };
  }
  if (now >= windowEnd) return { label: 0, status: "final_negative", revision: 1, mature: true, explain: "整段 label window 都没有观察到转化，label = 0 定稿。这仍只是“观察窗口内没看到”，不是证明用户没买。" };
  return { label: 0, status: "pending", revision: 1, mature: false, explain: "窗口还没结束：先写出 provisional 0，下游要知道它可能被修正。" };
}
