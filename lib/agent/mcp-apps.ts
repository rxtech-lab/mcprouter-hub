import "server-only";
import { createMCPClient, mcpAppClientCapabilities, readMCPAppResource, splitMCPAppTools, type MCPAppResource, type MCPClient } from "@ai-sdk/mcp";
import { serviceById, services } from "@/generated/registry";
import { parseMcpServers } from "@/lib/agent/mcp-servers";
import { appResourceMeta, appStructuredContent, appHtml, hasApp, MCP_APP_MIME_TYPE, serviceIdFromAppUri } from "@/lib/mcp/apps";
import { meterToolCall, type McpToolResponse } from "@/lib/mcp/meter";
import { executeTool } from "@/lib/mcp/runtime";
import type { CallerContext, ServiceDefinition } from "@/lib/mcp/types";

/**
 * The chat's side of MCP Apps: loads the `ui://` resource for a tool part and
 * serves the app's own `tools/call` requests. This app's tools are answered
 * from the registry directly; tools of other `AGENT_MCP_SERVERS` (named
 * `<server>__<tool>` in the chat) go through an MCP client.
 */

export type ToolApp = {
  resource: MCPAppResource;
  /** Tools the app may call itself; the bridge refuses any other. */
  appTools: string[];
};

/** Splits a chat tool name into the server it came from (null for this app) and the server's own tool name. */
export function splitToolName(toolName: string): { server: string | null; tool: string } {
  const index = toolName.indexOf("__");
  return index > 0 ? { server: toolName.slice(0, index), tool: toolName.slice(index + 2) } : { server: null, tool: toolName };
}

function ownService(toolName: string): ServiceDefinition | null {
  return services.find((service) => service.tools.some((tool) => tool.name === toolName)) ?? null;
}

/** The app resource of one of this app's services, in the shape `readMCPAppResource` returns. */
export function ownToolApp(resourceUri: string, toolName: string): ToolApp {
  const service = serviceById.get(serviceIdFromAppUri(resourceUri) ?? "");
  if (!service?.app || ownService(toolName)?.id !== service.id) throw new Error("NOT_FOUND");
  return {
    resource: { uri: resourceUri, mimeType: MCP_APP_MIME_TYPE, html: appHtml(service), meta: appResourceMeta(service).ui },
    appTools: service.tools.filter((tool) => hasApp(service, tool)).map((tool) => tool.name),
  };
}

/** Runs one of this app's tools for an app, metered like any other call. It must belong to the same service as the tool that opened the app. */
export async function callOwnTool(caller: CallerContext, openedBy: string, name: string, args: Record<string, unknown>): Promise<McpToolResponse> {
  const service = ownService(openedBy);
  const tool = service?.tools.find((candidate) => candidate.name === name);
  if (!service || !tool || !hasApp(service, tool)) throw new Error("FORBIDDEN");
  return meterToolCall(caller, { service: service.id, tool: tool.name, structured: appStructuredContent(service, tool, args) }, () => executeTool(service, tool, args));
}

// ------------------------------------------------------------------ other servers

function externalServer(name: string) {
  const server = parseMcpServers(process.env.AGENT_MCP_SERVERS).find((candidate) => candidate.name === name && candidate.url !== "self");
  if (!server) throw new Error("NOT_FOUND");
  return server as typeof server & { url: string };
}

async function withClient<T>(serverName: string, run: (client: MCPClient) => Promise<T>) {
  const server = externalServer(serverName);
  const client = await createMCPClient({ transport: { type: "http", url: server.url, headers: server.headers }, capabilities: mcpAppClientCapabilities });
  try {
    return await run(client);
  } finally {
    await client.close().catch(() => {});
  }
}

async function appVisibleTools(client: MCPClient) {
  let page = await client.listTools();
  const tools = [...page.tools];
  while (page.nextCursor) {
    page = await client.listTools({ params: { cursor: page.nextCursor } });
    tools.push(...page.tools);
  }
  return splitMCPAppTools({ tools }).appVisible.tools.map((tool) => tool.name);
}

// Resources rarely change; keep them briefly so every rendered tool part doesn't reconnect.
const RESOURCE_TTL_MS = 5 * 60_000;
const resourceCache = new Map<string, { value: ToolApp; expires: number }>();

export async function externalToolApp(serverName: string, resourceUri: string): Promise<ToolApp> {
  const key = `${serverName} ${resourceUri}`;
  const hit = resourceCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = await withClient(serverName, async (client) => ({
    resource: await readMCPAppResource({ client, uri: resourceUri }),
    appTools: await appVisibleTools(client),
  }));
  resourceCache.set(key, { value, expires: Date.now() + RESOURCE_TTL_MS });
  return value;
}

export async function callExternalTool(serverName: string, name: string, args: Record<string, unknown>) {
  return withClient(serverName, async (client) => {
    if (!(await appVisibleTools(client)).includes(name)) throw new Error("FORBIDDEN");
    return client.callTool({ name, arguments: args });
  });
}
