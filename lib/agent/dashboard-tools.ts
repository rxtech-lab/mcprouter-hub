import { tool } from "ai";
import { z } from "zod";
import { msg } from "@/lib/i18n/translate";
import { INTRO_CARDS } from "@/lib/intro-cards";
import { MCP_CLIENTS } from "@/lib/mcp-clients";

/**
 * The web agent's dashboard tools: it can answer questions about the account, open any dashboard page,
 * and start an action by opening its dialog pre-filled. The user still confirms in that dialog, so the
 * agent never creates, changes or revokes anything itself, and a new key never lands in the chat history.
 */

export const OPEN_PAGE_TOOL_NAME = "open_dashboard_page";
export const START_ACTION_TOOL_NAME = "start_dashboard_action";
export const LIST_KEYS_TOOL_NAME = "list_api_keys";
export const ACCOUNT_SUMMARY_TOOL_NAME = "get_account_summary";

/** UI parts of the tools whose output is a link the chat shows as an "Open" button. */
export const NAVIGATION_PART_TYPES: string[] = [`tool-${OPEN_PAGE_TOOL_NAME}`, `tool-${START_ACTION_TOOL_NAME}`];

export type DashboardNavigation = { href: string; label: string };

export const DASHBOARD_PAGES = {
  overview: { href: "/dashboard", label: msg("Overview") },
  tour: { href: "/dashboard?intro=all", label: msg("Dashboard tour") },
  api_keys: { href: "/keys", label: msg("API keys") },
  connected_apps: { href: "/keys/apps", label: msg("Connected apps") },
  telegram: { href: "/keys/telegram", label: "Telegram" },
  whatsapp: { href: "/keys/whatsapp", label: "WhatsApp" },
  usage: { href: "/usage", label: msg("Usage") },
  usage_by_client: { href: "/usage/clients", label: msg("Usage by client") },
  credits: { href: "/usage/credits", label: msg("Credits") },
  services: { href: "/services", label: msg("Services") },
  tracker: { href: "/tracker", label: msg("Tracker") },
  billing: { href: "/billing", label: msg("Billing") },
  settings: { href: "/settings", label: msg("Settings") },
  new_chat: { href: "/chat", label: msg("New chat") },
} satisfies Record<string, DashboardNavigation>;

export type DashboardPage = keyof typeof DASHBOARD_PAGES;

const pageIds = Object.keys(DASHBOARD_PAGES) as [DashboardPage, ...DashboardPage[]];
const clientIds = MCP_CLIENTS.map((client) => client.id) as [string, ...string[]];
const featureIds = INTRO_CARDS.filter((card) => card.kind === "feature").map((card) => card.id) as [string, ...string[]];

export const DASHBOARD_NOTE = `You are also the guide to the mcprouter dashboard the user is signed in to. Its tabs:
Overview (calls today, plan usage, shortcuts; "Tour and what's new" replays the intro), API keys (keys; Connected apps for OAuth clients and per-client setup guides; Telegram and WhatsApp to link the chat bots),
Usage (calls per day, Usage by client, Credits), Services (every tool and its datasets), Tracker (which DATA.GOV.HK datasets are being converted), Agent (this chat), Billing (plan and allowance) and Settings (which regions, services and tools the MCP endpoints expose).
New: mcprouter works in ChatGPT, Gemini and Claude (set up under Connected apps), and the agent answers on Telegram and WhatsApp (link under API keys).
Answer questions about the dashboard and the user's account directly: use ${ACCOUNT_SUMMARY_TOOL_NAME} and ${LIST_KEYS_TOOL_NAME} for their numbers instead of guessing.
When the user wants to go somewhere, call ${OPEN_PAGE_TOOL_NAME}; the chat shows an Open button that opens it in a new tab. When they want something done (create, rename, revoke or change the services of a key, set up a chat client, link Telegram or WhatsApp), call ${START_ACTION_TOOL_NAME}: the Open button takes them to that dialog, filled in, for them to confirm. You can't create, change or revoke anything yourself, and nothing opens until they press Open, so never say it is done or opened; tell them to press Open to review and confirm.
Keep that reply to one short sentence. For a key, call ${LIST_KEYS_TOOL_NAME} first to find its id.`;

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create_api_key"), name: z.string().trim().max(60).optional().describe("A name for the key, e.g. the client it's for") }),
  z.object({ action: z.enum(["rename_api_key", "change_key_services", "revoke_api_key"]), keyId: z.string().min(1).max(100).describe("From list_api_keys") }),
  z.object({
    action: z.literal("set_up_client"),
    client: z.enum(clientIds).describe("The chat client to connect"),
    auth: z.enum(["oauth", "key"]).optional().describe("key: the API-key guide, for clients that take one. Default oauth"),
  }),
  z.object({ action: z.enum(["link_telegram", "link_whatsapp"]) }),
  z.object({ action: z.literal("show_new_feature"), card: z.enum(featureIds).describe("The new-feature card to show") }),
]);

export type DashboardAction = z.infer<typeof actionSchema>;

const keyParam = { rename_api_key: "rename", change_key_services: "scopes", revoke_api_key: "revoke" } as const;

/** Where an action's dialog lives. Pure, so the links can be tested without a database. */
export function actionHref(action: DashboardAction): DashboardNavigation {
  switch (action.action) {
    case "create_api_key": {
      const query = new URLSearchParams({ create: "1" });
      if (action.name) query.set("name", action.name);
      return { href: `/keys?${query}`, label: msg("Create API key") };
    }
    case "rename_api_key":
    case "change_key_services":
    case "revoke_api_key": {
      const label = { rename_api_key: msg("Rename key"), change_key_services: msg("Change key services"), revoke_api_key: msg("Revoke key") }[action.action];
      return { href: `/keys?${new URLSearchParams({ [keyParam[action.action]]: action.keyId })}`, label };
    }
    case "set_up_client": {
      const client = MCP_CLIENTS.find((item) => item.id === action.client)!;
      const query = new URLSearchParams({ client: client.id });
      if (action.auth === "key" && client.apiKey) query.set("auth", "key");
      return { href: `/keys/apps?${query}`, label: `Set up ${client.name}` };
    }
    case "link_telegram":
      return { href: "/keys/telegram", label: msg("Link Telegram") };
    case "link_whatsapp":
      return { href: "/keys/whatsapp", label: msg("Link WhatsApp") };
    case "show_new_feature":
      return { href: `/dashboard?intro=${action.card}`, label: INTRO_CARDS.find((card) => card.id === action.card)!.title };
  }
}

export type KeySummary = { id: string; name: string; prefix: string; status: string; services: string; calls: number; lastUsedAt: string | null };

export type AccountSummary = Record<string, unknown>;

/** What the tools need from the account; the route passes database-backed versions. */
export type DashboardData = {
  listKeys: () => Promise<KeySummary[]>;
  accountSummary: () => Promise<AccountSummary>;
};

export function dashboardTools(data: DashboardData) {
  return {
    [OPEN_PAGE_TOOL_NAME]: tool({
      description: "Link the user to a page of the mcprouter dashboard. The chat shows an Open button; nothing opens until they press it.",
      inputSchema: z.object({ page: z.enum(pageIds) }),
      execute: async ({ page }): Promise<DashboardNavigation> => DASHBOARD_PAGES[page],
    }),
    [START_ACTION_TOOL_NAME]: tool({
      description:
        "Prepare an action in the dashboard: links to its dialog, filled in, for the user to open and confirm: create, rename, revoke or change the services of an API key, set up a chat client, link Telegram or WhatsApp, or show a new-feature card.",
      inputSchema: actionSchema,
      execute: async (action): Promise<DashboardNavigation | { error: string }> => {
        if ("keyId" in action) {
          const key = (await data.listKeys()).find((item) => item.id === action.keyId);
          if (!key) return { error: "No API key with that id. Call list_api_keys for the ids." };
          if (key.status !== "active") return { error: `That key is ${key.status}; only active keys can be changed.` };
        }
        return actionHref(action);
      },
    }),
    [LIST_KEYS_TOOL_NAME]: tool({
      description: "The user's API keys: id, name, prefix, status, the services each may call, call count and last use. Never includes the keys themselves.",
      inputSchema: z.object({}),
      execute: async () => ({ keys: await data.listKeys() }),
    }),
    [ACCOUNT_SUMMARY_TOOL_NAME]: tool({
      description: "The user's account at a glance: calls today and in the last 30 days, plan usage, active API keys, connected apps and linked Telegram and WhatsApp accounts.",
      inputSchema: z.object({}),
      execute: async () => data.accountSummary(),
    }),
  };
}
