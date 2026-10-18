import { describe, expect, it } from "vitest";
import {
  ACCOUNT_SUMMARY_TOOL_NAME,
  actionHref,
  DASHBOARD_PAGES,
  dashboardTools,
  LIST_KEYS_TOOL_NAME,
  OPEN_PAGE_TOOL_NAME,
  START_ACTION_TOOL_NAME,
  type DashboardData,
  type KeySummary,
} from "@/lib/agent/dashboard-tools";

const key = (id: string, status = "active"): KeySummary => ({ id, name: id, prefix: "mcpr_ab…", status, services: "All services", calls: 0, lastUsedAt: null });
const data: DashboardData = {
  listKeys: async () => [key("k1"), key("k2", "revoked")],
  accountSummary: async () => ({ callsToday: 3 }),
};
const options = { toolCallId: "1", messages: [] } as never;
const tools = dashboardTools(data);
const run = (name: keyof typeof tools, input: unknown) => (tools[name].execute as unknown as (input: unknown, options: never) => Promise<unknown>)(input, options);

describe("dashboard tools", () => {
  it("open pages by name", async () => {
    expect(await run(OPEN_PAGE_TOOL_NAME, { page: "usage_by_client" })).toEqual(DASHBOARD_PAGES.usage_by_client);
    expect(DASHBOARD_PAGES.tour.href).toBe("/dashboard?intro=all");
  });

  it("link each action to its dialog, filled in", () => {
    expect(actionHref({ action: "create_api_key", name: "Claude Code & me" }).href).toBe("/keys?create=1&name=Claude+Code+%26+me");
    expect(actionHref({ action: "create_api_key" }).href).toBe("/keys?create=1");
    expect(actionHref({ action: "revoke_api_key", keyId: "k1" }).href).toBe("/keys?revoke=k1");
    expect(actionHref({ action: "change_key_services", keyId: "k1" }).href).toBe("/keys?scopes=k1");
    expect(actionHref({ action: "set_up_client", client: "chatgpt" })).toEqual({ href: "/keys/apps?client=chatgpt", label: "Set up ChatGPT" });
    expect(actionHref({ action: "set_up_client", client: "cursor", auth: "key" }).href).toBe("/keys/apps?client=cursor&auth=key");
    // Claude only signs in with OAuth, so there is no key guide to open.
    expect(actionHref({ action: "set_up_client", client: "claude", auth: "key" }).href).toBe("/keys/apps?client=claude");
    expect(actionHref({ action: "show_new_feature", card: "feature-chat-agents" }).href).toBe("/dashboard?intro=feature-chat-agents");
  });

  it("only act on the user's own active keys", async () => {
    expect(await run(START_ACTION_TOOL_NAME, { action: "rename_api_key", keyId: "k1" })).toEqual({ href: "/keys?rename=k1", label: "Rename key" });
    expect(await run(START_ACTION_TOOL_NAME, { action: "revoke_api_key", keyId: "someone-else" })).toMatchObject({ error: expect.stringContaining("No API key") });
    expect(await run(START_ACTION_TOOL_NAME, { action: "revoke_api_key", keyId: "k2" })).toMatchObject({ error: expect.stringContaining("revoked") });
  });

  it("read the account", async () => {
    expect(await run(LIST_KEYS_TOOL_NAME, {})).toEqual({ keys: [key("k1"), key("k2", "revoked")] });
    expect(await run(ACCOUNT_SUMMARY_TOOL_NAME, {})).toEqual({ callsToday: 3 });
  });
});
