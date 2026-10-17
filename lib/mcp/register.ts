import type { McpServer } from "@modelcontextprotocol/server";
import { keyAllowsService } from "@/lib/api-keys";
import { meterToolCall } from "@/lib/mcp/meter";
import { executeTool } from "@/lib/mcp/runtime";
import type { CallerContext, ServiceDefinition, ToolInput } from "@/lib/mcp/types";

/** Register every tool of the given services that the caller's key may use. */
export function registerServices(server: McpServer, services: readonly ServiceDefinition[], caller: CallerContext) {
  for (const service of services) {
    if (!keyAllowsService(caller.scopes, service.id)) continue;
    for (const tool of service.tools) {
      server.registerTool(
        tool.name,
        {
          title: tool.title,
          description: tool.description,
          inputSchema: tool.inputSchema,
          annotations: { readOnlyHint: true, openWorldHint: true },
        },
        async (input: ToolInput) =>
          meterToolCall(caller, { service: service.id, tool: tool.name }, () => executeTool(service, tool, input ?? {})),
      );
    }
  }
}
