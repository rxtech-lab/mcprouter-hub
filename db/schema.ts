import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/** How an MCP connection lists tools: every tool by name, or only `search_tools`, `read_tool` and `use_tool`. */
export const TOOL_MODES = ["all", "search"] as const;
export type ToolMode = (typeof TOOL_MODES)[number];

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`);

/** Successful public article scrapes, reused across news sources and process restarts. */
export const newsContent = sqliteTable("news_content", {
  url: text("url").primaryKey(),
  markdown: text("markdown").notNull(),
  scrapedAt: createdAt(),
});

export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    /** First characters of the key, shown in the dashboard so a key can be recognised. */
    prefix: text("prefix").notNull(),
    /** sha256 of the full key. The key itself is never stored. */
    hash: text("hash").notNull(),
    /** Service ids the key may call. Empty means every service. */
    scopes: text("scopes", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    /** How tools are listed: `all` by name, or `search` behind search_tools, read_tool and use_tool. Null means the endpoint's default. */
    toolMode: text("tool_mode", { enum: TOOL_MODES }),
    callCount: integer("call_count").notNull().default(0),
    lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("api_keys_hash_idx").on(table.hash),
    index("api_keys_user_idx").on(table.userId),
  ],
);

/** Where a tool call came from: an API key, an OAuth app, or the agent in the web chat, Telegram, WhatsApp or the free agent. */
export const CALL_CHANNELS = ["key", "oauth", "web", "telegram", "whatsapp", "free"] as const;
export type CallChannel = (typeof CALL_CHANNELS)[number];

export const toolCalls = sqliteTable(
  "tool_calls",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull(),
    /** Null for calls made by the in-app agent with the internal key. */
    apiKeyId: text("api_key_id"),
    /** How the call came in. Null on calls logged before channels were recorded. */
    channel: text("channel", { enum: CALL_CHANNELS }),
    /** The OAuth client behind an `oauth` call. */
    oauthClientId: text("oauth_client_id"),
    service: text("service").notNull(),
    tool: text("tool").notNull(),
    status: text("status", { enum: ["ok", "error", "denied"] }).notNull(),
    latencyMs: integer("latency_ms").notNull().default(0),
    errorCode: text("error_code"),
    createdAt: createdAt(),
  },
  (table) => [
    index("tool_calls_user_created_idx").on(table.userId, table.createdAt),
    index("tool_calls_key_idx").on(table.apiKeyId),
    index("tool_calls_user_channel_idx").on(table.userId, table.channel, table.createdAt),
  ],
);

/** One row per DATA.GOV.HK catalogue entry, filled by the catalogue sync. */
export const datasets = sqliteTable(
  "datasets",
  {
    id: text("id").primaryKey(),
    titleEn: text("title_en").notNull().default(""),
    titleTc: text("title_tc"),
    organization: text("organization"),
    organizationTitle: text("organization_title"),
    groups: text("groups", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    formats: text("formats", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    /** True when any resource is flagged `is_api=Y` upstream. */
    isApi: integer("is_api", { mode: "boolean" }).notNull().default(false),
    url: text("url"),
    metadataModified: text("metadata_modified"),
    syncedAt: integer("synced_at", { mode: "timestamp_ms" }),
    /** Set when the id disappears from `package_list`. */
    removedAt: integer("removed_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    index("datasets_org_idx").on(table.organization),
    index("datasets_synced_idx").on(table.syncedAt),
    index("datasets_live_org_idx").on(table.removedAt, table.organization),
  ],
);

export const DATASET_STATUSES = ["planned", "in_progress", "skipped"] as const;
export type ManualDatasetStatus = (typeof DATASET_STATUSES)[number];

/** Manual tracker state. `converted` is never stored; it comes from the manifest. */
export const datasetStatus = sqliteTable("dataset_status", {
  datasetId: text("dataset_id").primaryKey(),
  status: text("status", { enum: DATASET_STATUSES }).notNull(),
  reason: text("reason"),
  priority: integer("priority").notNull().default(0),
  updatedBy: text("updated_by"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

/** An agent conversation. The id comes from the client so the URL is stable before the first reply. */
export const chats = sqliteTable(
  "chats",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (table) => [index("chats_user_updated_idx").on(table.userId, table.updatedAt)],
);

/** One AI SDK UIMessage, stored as sent to the client so a reload shows the same message. */
export const chatMessages = sqliteTable(
  "chat_messages",
  {
    id: text("id").primaryKey(),
    chatId: text("chat_id").notNull().references(() => chats.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["system", "user", "assistant"] }).notNull(),
    parts: text("parts", { mode: "json" }).$type<unknown[]>().notNull(),
    /** Order within the chat. */
    position: integer("position").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("chat_messages_chat_position_idx").on(table.chatId, table.position)],
);

/**
 * Messages sent to the free (signed-out) agent, counted per subject and Hong Kong day.
 * A subject is `guest:<cookie id>` or `ip:<sha256 of the address>`.
 */
export const freeChatUsage = sqliteTable(
  "free_chat_usage",
  {
    subject: text("subject").notNull(),
    /** YYYY-MM-DD in Hong Kong time. */
    day: text("day").notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.subject, table.day] })],
);

/** MCP clients registered through OAuth dynamic client registration. Public clients: no secret, PKCE only. */
export const oauthClients = sqliteTable(
  "oauth_clients",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    redirectUris: text("redirect_uris", { mode: "json" }).$type<string[]>().notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("oauth_clients_created_idx").on(table.createdAt)],
);

/** One user's approval of one client for one MCP endpoint. Refreshing keeps the grant and slides its expiry. */
export const oauthGrants = sqliteTable(
  "oauth_grants",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull(),
    clientId: text("client_id").notNull().references(() => oauthClients.id, { onDelete: "cascade" }),
    /** The MCP endpoint URL the user approved (the token audience). */
    resource: text("resource").notNull(),
    /** Set when the resource is a single-service endpoint; null means every service. */
    service: text("service"),
    /** Service ids the client may call; `service` narrows it further. Empty means every service. */
    scopes: text("scopes", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    /** How tools are listed: `all` by name, or `search` behind search_tools, read_tool and use_tool. Null means the endpoint's default. */
    toolMode: text("tool_mode", { enum: TOOL_MODES }),
    scope: text("scope").notNull(),
    lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("oauth_grants_user_idx").on(table.userId), index("oauth_grants_expiry_idx").on(table.expiresAt)],
);

/** Authorization codes, stored as sha256 hashes. Single use, one minute. */
export const oauthCodes = sqliteTable(
  "oauth_codes",
  {
    hash: text("hash").primaryKey(),
    grantId: text("grant_id").notNull().references(() => oauthGrants.id, { onDelete: "cascade" }),
    redirectUri: text("redirect_uri").notNull(),
    challenge: text("challenge").notNull(),
    usedAt: integer("used_at", { mode: "timestamp_ms" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("oauth_codes_expiry_idx").on(table.expiresAt)],
);

/** Access and refresh tokens, stored as sha256 hashes. Used refresh hashes are kept to detect replay. */
export const oauthTokens = sqliteTable(
  "oauth_tokens",
  {
    hash: text("hash").primaryKey(),
    grantId: text("grant_id").notNull().references(() => oauthGrants.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["access", "refresh"] }).notNull(),
    usedAt: integer("used_at", { mode: "timestamp_ms" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("oauth_tokens_grant_idx").on(table.grantId), index("oauth_tokens_expiry_idx").on(table.expiresAt)],
);

/**
 * WhatsApp numbers linked to an account, so the bot answers as that user and bills their plan.
 * The number is kept only as a sha256 hash plus its last digits for display.
 */
export const whatsappLinks = sqliteTable(
  "whatsapp_links",
  {
    phoneHash: text("phone_hash").primaryKey(),
    userId: text("user_id").notNull(),
    userEmail: text("user_email").notNull().default(""),
    /** Last four digits, shown as ••••1234. */
    phoneHint: text("phone_hint").notNull(),
    /** Service ids the bot may call for this number. Empty means every service. */
    scopes: text("scopes", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    /** How the bot's agent sees tools: `all` by name (the default), or `search` behind search_tools, read_tool and use_tool. */
    toolMode: text("tool_mode", { enum: TOOL_MODES }),
    createdAt: createdAt(),
  },
  (table) => [index("whatsapp_links_user_idx").on(table.userId)],
);

/**
 * Telegram accounts linked to an account, so the bot answers as that user and bills their plan.
 * The Telegram user id is kept only as a sha256 hash, plus the @username or first name for display.
 */
export const telegramLinks = sqliteTable(
  "telegram_links",
  {
    telegramHash: text("telegram_hash").primaryKey(),
    userId: text("user_id").notNull(),
    userEmail: text("user_email").notNull().default(""),
    /** `@username` or first name at the time of linking. */
    displayName: text("display_name").notNull(),
    /** Service ids the bot may call for this account. Empty means every service. */
    scopes: text("scopes", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    /** How the bot's agent sees tools: `all` by name (the default), or `search` behind search_tools, read_tool and use_tool. */
    toolMode: text("tool_mode", { enum: TOOL_MODES }),
    createdAt: createdAt(),
  },
  (table) => [index("telegram_links_user_idx").on(table.userId)],
);

/** Dashboard intro cards (tutorial steps and new-feature cards) a user has read, so each is shown once. */
export const introReads = sqliteTable(
  "intro_reads",
  {
    userId: text("user_id").notNull(),
    /** An id from `INTRO_CARDS`. */
    cardId: text("card_id").notNull(),
    createdAt: createdAt(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.cardId] })],
);

/**
 * Which part of the catalogue a user's MCP endpoints expose, for every API key, OAuth app and the agent.
 * No row, or empty lists, means everything. API key scopes narrow it further.
 */
export const mcpSettings = sqliteTable("mcp_settings", {
  userId: text("user_id").primaryKey(),
  /** Region ids to expose. Empty means every region. */
  regions: text("regions", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  /** Service ids to expose. Empty means every service. */
  services: text("services", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  /** Tool names hidden from otherwise exposed services. */
  hiddenTools: text("hidden_tools", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
});

export type ApiKey = typeof apiKeys.$inferSelect;
export type OAuthClient = typeof oauthClients.$inferSelect;
export type OAuthGrant = typeof oauthGrants.$inferSelect;
export type ToolCall = typeof toolCalls.$inferSelect;
export type Dataset = typeof datasets.$inferSelect;
export type DatasetStatusRow = typeof datasetStatus.$inferSelect;
export type Chat = typeof chats.$inferSelect;
export type WhatsAppLink = typeof whatsappLinks.$inferSelect;
export type TelegramLink = typeof telegramLinks.$inferSelect;
export type McpSettings = typeof mcpSettings.$inferSelect;
