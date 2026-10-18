import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { TOOL_MODES, type ToolMode } from "@/db/schema";
import { searchTools } from "@/lib/agent/tool-search";
import { appStructuredContent, hasApp } from "@/lib/mcp/apps";
import { meterToolCall, type McpToolResponse } from "@/lib/mcp/meter";
import { executeTool } from "@/lib/mcp/runtime";
import type { CallerContext, ServiceDefinition, ToolDefinition, ToolInput } from "@/lib/mcp/types";

/**
 * Search mode: instead of every tool, the client sees three,
 * so a large catalogue doesn't fill its context. It searches for tools, reads
 * the one it wants, then calls it through `use_tool`. Only `use_tool` is a
 * metered call; searching and reading are free.
 */

export { TOOL_MODES, type ToolMode } from "@/db/schema";

export const META_TOOL_NAMES = { search: "search_tools", read: "read_tool", use: "use_tool" } as const;

export const DEFAULT_SEARCH_LIMIT = 8;
export const MAX_SEARCH_LIMIT = 20;

/** `?tools=all` or `?tools=search` picks the mode; without it (or with anything else) the endpoint's default applies. */
export function toolModeFrom(request: Request, fallback: ToolMode): ToolMode {
  const requested = new URL(request.url).searchParams.get("tools");
  return TOOL_MODES.find((mode) => mode === requested) ?? fallback;
}

export type SearchableTool = { service: ServiceDefinition; tool: ToolDefinition };

function text(value: unknown, isError = false): McpToolResponse {
  return { content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }], ...(isError ? { isError: true } : {}) };
}

function unknownTool(name: string) {
  return text(`Unknown tool "${name}". Call ${META_TOOL_NAMES.search} to find tool names.`, true);
}

/** Registers `search_tools`, `read_tool` and `use_tool` over the given tools. */
export function registerMetaTools(server: McpServer, entries: readonly SearchableTool[], caller: CallerContext, embeddingModel = process.env.AI_EMBEDDING_MODEL || undefined) {
  const byName = new Map(entries.map((entry) => [entry.tool.name, entry]));
  const candidates = entries.map(({ tool }) => ({ name: tool.name, description: tool.description }));
  const readOnly = { readOnlyHint: true, openWorldHint: false } as const;

  server.registerTool(
    META_TOOL_NAMES.search,
    {
      title: "Search tools",
      description: `Find mcprouter tools for a task, e.g. "next bus arrival" or "will it rain". Returns tool names and descriptions, best match first. Then call ${META_TOOL_NAMES.read} for a tool's arguments and ${META_TOOL_NAMES.use} to run it. ${entries.length} tools are available.`,
      inputSchema: z.object({
        query: z.string().trim().min(1).max(200).describe("What you need, in plain words"),
        limit: z.number().int().min(1).max(MAX_SEARCH_LIMIT).optional().describe(`How many tools to return (default ${DEFAULT_SEARCH_LIMIT}, at most ${MAX_SEARCH_LIMIT})`),
      }),
      annotations: readOnly,
    },
    async ({ query, limit }: { query: string; limit?: number }) => {
      const names = (await searchTools(query, candidates, embeddingModel)).slice(0, limit ?? DEFAULT_SEARCH_LIMIT);
      const tools = names.map((name) => {
        const { service, tool } = byName.get(name)!;
        return { name, title: tool.title, service: service.id, description: tool.description };
      });
      return text(tools.length ? { tools } : { tools, hint: "No tools matched. Try other words, or a broader query." });
    },
  );

  server.registerTool(
    META_TOOL_NAMES.read,
    {
      title: "Read tool",
      description: `Get a tool's full description and the JSON Schema of its arguments, before calling it with ${META_TOOL_NAMES.use}.`,
      inputSchema: z.object({ name: z.string().trim().min(1).describe(`A tool name from ${META_TOOL_NAMES.search}`) }),
      annotations: readOnly,
    },
    async ({ name }: { name: string }) => {
      const entry = byName.get(name);
      if (!entry) return unknownTool(name);
      const { service, tool } = entry;
      return text({ name, title: tool.title, service: service.id, description: tool.description, inputSchema: z.toJSONSchema(tool.inputSchema) });
    },
  );

  server.registerTool(
    META_TOOL_NAMES.use,
    {
      title: "Use tool",
      description: `Run a tool by name with its arguments (see ${META_TOOL_NAMES.read} for the schema). Each call counts against your plan.`,
      inputSchema: z.object({
        name: z.string().trim().min(1).describe("The tool to run"),
        arguments: z.record(z.string(), z.unknown()).optional().describe("The tool's arguments"),
      }),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ name, arguments: input = {} }: { name: string; arguments?: ToolInput }) => {
      const entry = byName.get(name);
      if (!entry) return unknownTool(name);
      const { service, tool } = entry;
      // Metered and logged as the tool itself, so usage by tool reads the same in both modes.
      return meterToolCall(
        caller,
        { service: service.id, tool: tool.name, structured: hasApp(service, tool) ? appStructuredContent(service, tool, input) : undefined },
        () => executeTool(service, tool, input),
      );
    },
  );
}
