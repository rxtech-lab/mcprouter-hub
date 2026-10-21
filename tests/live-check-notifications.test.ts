import { expect, it } from "vitest";
import { prepareNotifications, acknowledgeNotifications, type State } from "@/scripts/live-check-notifications";

const failed = { id: "tool:carpark_info", service: "td-carpark", ok: false, error: "timeout", ms: 45000 };
const healthy = { ...failed, ok: true, error: undefined };

it("alerts on the first failed run when attempts are exhausted and the threshold is one", () => {
  const state: State = {};
  const pending = prepareNotifications(state, [failed], 1, "now");
  expect(pending.alerts).toHaveLength(1);
  expect(state[failed.id].alerted).toBe(false);
  // Missing credentials or a failed send must leave the notification eligible.
  expect(prepareNotifications(state, [failed], 1, "later").alerts).toHaveLength(1);
});

it("alerts only at the streak threshold, retries undelivered alerts, and suppresses acknowledged failures", () => {
  const state: State = {};
  expect(prepareNotifications(state, [failed], 3, "now").alerts).toHaveLength(0);
  expect(prepareNotifications(state, [failed], 3, "now").alerts).toHaveLength(0);
  expect(prepareNotifications(state, [failed], 3, "now").alerts).toHaveLength(1);
  const pending = prepareNotifications(state, [failed], 3, "now");
  expect(pending.alerts).toHaveLength(1);
  acknowledgeNotifications(state, pending.alerts, pending.recovered);
  expect(prepareNotifications(state, [failed], 3, "now").alerts).toHaveLength(0);
});

it("retains recovery across healthy runs until delivery succeeds, then resets the streak", () => {
  const state: State = {};
  const failure = prepareNotifications(state, [failed], 1, "now");
  acknowledgeNotifications(state, failure.alerts, []);
  expect(prepareNotifications(state, [healthy], 1, "later").recovered).toHaveLength(1);
  const retry = prepareNotifications(state, [healthy], 1, "later");
  expect(retry.recovered).toHaveLength(1);
  acknowledgeNotifications(state, [], retry.recovered);
  expect(state).toEqual({});
  expect(prepareNotifications(state, [healthy], 1, "later").recovered).toHaveLength(0);
});

it("resets an unreported failure after a healthy check and leaves unselected checks alone", () => {
  const state: State = {};
  prepareNotifications(state, [failed], 3, "now");
  prepareNotifications(state, [], 3, "later");
  expect(state[failed.id].failures).toBe(1);
  prepareNotifications(state, [healthy], 3, "later");
  expect(state).toEqual({});
});
