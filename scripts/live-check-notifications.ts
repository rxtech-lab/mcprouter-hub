export type Check = { id: string; service: string; ok: boolean; error?: string; ms: number };
export type Entry = { failures: number; since: string; error: string; alerted: boolean };
export type State = Record<string, Entry>;
export type Notification = Check & Entry;

/** Keep failures and pending recoveries durable until Telegram acknowledges them. */
export function prepareNotifications(state: State, checks: Check[], threshold: number, now: string) {
  const alerts: Notification[] = [];
  const recovered: Notification[] = [];
  for (const check of checks) {
    const previous = state[check.id];
    if (check.ok) {
      if (previous?.alerted) recovered.push({ ...check, ...previous });
      else delete state[check.id];
      continue;
    }
    const entry: Entry = { failures: (previous?.failures ?? 0) + 1, since: previous?.since ?? now, error: check.error ?? "", alerted: previous?.alerted ?? false };
    if (entry.failures >= threshold && !entry.alerted) alerts.push({ ...check, ...entry });
    state[check.id] = entry;
  }
  return { alerts, recovered };
}

export function acknowledgeNotifications(state: State, alerts: Notification[], recovered: Notification[]) {
  for (const alert of alerts) state[alert.id].alerted = true;
  for (const check of recovered) delete state[check.id];
}
