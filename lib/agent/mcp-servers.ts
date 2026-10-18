import { z } from "zod";

/**
 * `AGENT_MCP_SERVERS` lists the MCP servers the agent can use, as JSON:
 *   [{"name":"hk","url":"self","headers":{}}, {"name":"other","url":"https://…","headers":{"Authorization":"Bearer …"}}]
 * `url: "self"` is this app's own `/api/mcp/streamable`, called with the internal key
 * on behalf of the signed-in user so their calls are metered to them.
 */
export const mcpServerSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9_-]*$/i, "server names are letters, digits, - and _"),
  url: z.union([z.literal("self"), z.url({ protocol: /^https?$/ })]),
  headers: z.record(z.string(), z.string()).default({}),
});

export type McpServerConfig = z.infer<typeof mcpServerSchema>;

export const DEFAULT_AGENT_SERVERS: McpServerConfig[] = [{ name: "hk", url: "self", headers: {} }];

export function parseMcpServers(raw: string | undefined): McpServerConfig[] {
  if (!raw?.trim()) return DEFAULT_AGENT_SERVERS;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error("AGENT_MCP_SERVERS is not valid JSON");
  }
  const parsed = z.array(mcpServerSchema).min(1).safeParse(json);
  if (!parsed.success) throw new Error(`AGENT_MCP_SERVERS is invalid: ${parsed.error.issues[0]?.message}`);
  const names = new Set<string>();
  for (const server of parsed.data) {
    if (names.has(server.name)) throw new Error(`AGENT_MCP_SERVERS lists "${server.name}" twice`);
    names.add(server.name);
  }
  return parsed.data;
}

/** Resolve "self" to this deployment's endpoint and attach the internal credentials. */
export function resolveServer(server: McpServerConfig, context: { origin: string; userId: string; internalKey: string | undefined }) {
  if (server.url !== "self") return { name: server.name, url: server.url, headers: server.headers, self: false };
  if (!context.internalKey) throw new Error("MCPROUTER_INTERNAL_KEY must be set for the agent to use this app's MCP server");
  return {
    name: server.name,
    url: `${context.origin}/api/mcp/streamable`,
    headers: { ...server.headers, Authorization: `Bearer ${context.internalKey}`, "x-mcprouter-user": context.userId },
    self: true,
  };
}
