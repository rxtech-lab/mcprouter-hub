import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`);

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

export const toolCalls = sqliteTable(
  "tool_calls",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id").notNull(),
    /** Null for calls made by the in-app agent with the internal key. */
    apiKeyId: text("api_key_id"),
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

export type ApiKey = typeof apiKeys.$inferSelect;
export type ToolCall = typeof toolCalls.$inferSelect;
export type Dataset = typeof datasets.$inferSelect;
export type DatasetStatusRow = typeof datasetStatus.$inferSelect;
export type Chat = typeof chats.$inferSelect;
