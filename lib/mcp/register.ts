import type { McpServer } from "@modelcontextprotocol/server";
import { keyAllowsService } from "@/lib/api-keys";
import { appResourceUri, appStructuredContent, hasApp, MCP_APP_MIME_TYPE, readAppResource, toolAppMeta } from "@/lib/mcp/apps";
import { meterToolCall } from "@/lib/mcp/meter";
import { executeTool } from "@/lib/mcp/runtime";
import type { CallerContext, ServiceDefinition, ToolInput } from "@/lib/mcp/types";

/** Register every tool of the given services that the caller's key may use, and each service's MCP App. */
export function registerServices(server: McpServer, services: readonly ServiceDefinition[], caller: CallerContext) {
  for (const service of services) {
    // Keys scoped to a service that was merged into this one keep their access.
    if (![service.id, ...service.aliases].some((id) => keyAllowsService(caller.scopes, id))) continue;
    if (service.app) {
      server.registerResource(
        `${service.id}-app`,
        appResourceUri(service.id),
        { title: service.title, description: `Shows ${service.title} results`, mimeType: MCP_APP_MIME_TYPE },
        async () => readAppResource(service),
      );
    }
    for (const tool of service.tools) {
      const app = hasApp(service, tool);
      server.registerTool(
        tool.name,
        {
          title: tool.title,
          description: tool.description,
          inputSchema: tool.inputSchema,
          annotations: { readOnlyHint: true, openWorldHint: true },
          ...(app ? { _meta: toolAppMeta(service) } : {}),
        },
        async (input: ToolInput) =>
          meterToolCall(
            caller,
            { service: service.id, tool: tool.name, structured: app ? appStructuredContent(service, tool, input ?? {}) : undefined },
            () => executeTool(service, tool, input ?? {}),
          ),
      );
    }
  }
}
