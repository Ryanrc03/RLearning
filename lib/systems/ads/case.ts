// The one worked example the Ads Backend Systems series keeps coming back to:
// a user clicks two ads, buys on the advertiser's site, and the purchase is reported three times.
// Every id, time and number here is made up for teaching; nothing mirrors a real company's system.
// No React here; see tests/ads-backend.test.ts.

/** Minutes since midnight, so the example can do arithmetic on times. */
export type Minute = number;

export const hm = (h: number, m: number): Minute => h * 60 + m;

export function fmt(t: Minute): string {
  const day = Math.floor(t / 1440);
  const inDay = ((t % 1440) + 1440) % 1440;
  const clock = `${String(Math.floor(inDay / 60)).padStart(2, "0")}:${String(inDay % 60).padStart(2, "0")}`;
  return day > 0 ? `D+${day} ${clock}` : clock;
}

export const ADVERTISER = "adv_42";
export const PIXEL = "px_7";
export const USER = "user_1";

export type Touchpoint = { id: string; ad: string; label: string; time: Minute; user: string };

/** The two clicks of the running example. */
export const CLICKS: Touchpoint[] = [
  { id: "click_100", ad: "ad_A", label: "Click Ad A", time: hm(9, 50), user: USER },
  { id: "click_101", ad: "ad_B", label: "Click Ad B", time: hm(10, 0), user: USER },
];

export const PURCHASE = { id: "purchase_501", eventId: "event_501", orderId: "order_9001", time: hm(10, 30), value: 59, currency: "USD" };

export type Delivery = {
  /** Message number in arrival order, for display. */
  seq: number;
  eventId: string;
  source: "pixel" | "events_api" | "replay";
  region: "A" | "B";
  receiveTime: Minute;
  eventTime: Minute;
  note: string;
};

/** How the purchase (and one other user's purchase) actually reach the collector. */
export const DELIVERIES: Delivery[] = [
  { seq: 1, eventId: "event_501", source: "pixel", region: "A", receiveTime: hm(10, 31), eventTime: hm(10, 30), note: "浏览器里的 Pixel 上报" },
  { seq: 2, eventId: "event_502", source: "pixel", region: "A", receiveTime: hm(10, 32), eventTime: hm(10, 28), note: "另一个用户（user_2）的购买" },
  { seq: 3, eventId: "event_501", source: "events_api", region: "A", receiveTime: hm(10, 33), eventTime: hm(10, 30), note: "广告主服务器通过 Events API 再报一次" },
  { seq: 4, eventId: "event_501", source: "replay", region: "B", receiveTime: hm(11, 0), eventTime: hm(10, 30), note: "Region B 故障恢复后重放同一条消息" },
];

/** The late-conversion scenario used from chapter 03 on: a click whose purchase comes two days later. */
export const LATE = {
  clickId: "click_200",
  ad: "ad_C",
  clickTime: hm(10, 0),
  /** 52 hours after the click. */
  conversionTime: hm(10, 0) + 52 * 60,
  /** Label observation window: 7 days. */
  labelWindow: 7 * 24 * 60,
};

/** Stable ids for the three different "things" in the pipeline. They are never interchangeable. */
export const ids = {
  dedupKey: (eventId: string) => `${PIXEL}:Purchase:${eventId}`,
  attribution: (eventId: string, policy: string) => `attr:${eventId}:${policy}`,
  sample: (clickId: string, task = "cvr", labelPolicy = "lp_v3") => `s:${task}:${clickId}:${labelPolicy}`,
};

/** The four objects the series keeps apart, filled with the running example. Real schemas differ by system. */
export const OBJECTS = {
  rawEvent: {
    event_id: "event_501",
    advertiser_id: ADVERTISER,
    event_type: "Purchase",
    event_time: "2026-10-30T10:30:00Z",
    receive_time: "2026-10-30T10:31:04Z",
    source: "pixel",
    schema_version: 3,
  },
  identityMatch: {
    conversion_id: "event_501",
    candidate_touchpoint_id: "click_101",
    match_method: "deterministic:click_id",
    confidence: 1.0,
    model_version: "idm_2026_10",
  },
  attributionResult: {
    conversion_id: "event_501",
    touchpoint_id: "click_101",
    attribution_policy_id: "last_click_7d",
    credit: 1.0,
    revision: 1,
  },
  trainingSample: {
    experiment_id: "exp_base",
    task_id: "cvr",
    sample_id: "s:cvr:click_101:lp_v3",
    label: 1,
    label_status: "final",
    label_revision: 1,
    feature_version: "fv_88",
  },
};
