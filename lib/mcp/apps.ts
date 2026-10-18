import { MCP_APP_MIME_TYPE } from "@ai-sdk/mcp";
import { APP_STYLES } from "@/generated/app-styles";
import type { ServiceDefinition, ToolDefinition, ToolInput } from "@/lib/mcp/types";

/**
 * MCP Apps (the `io.modelcontextprotocol/ui` extension): each service with an
 * `app.ts` gets one `ui://` HTML resource, and its tools point at it through
 * `_meta.ui.resourceUri`. Hosts that support MCP Apps render the resource in a
 * sandboxed iframe and push the tool input and result into it over postMessage.
 */

export { MCP_APP_MIME_TYPE };
export const MCP_APP_EXTENSION = "io.modelcontextprotocol/ui";

const URI_PREFIX = "ui://mcprouter/";

export function appResourceUri(serviceId: string) {
  return `${URI_PREFIX}${serviceId}`;
}

/** The service an app resource URI belongs to, or null for a URI this app doesn't serve. */
export function serviceIdFromAppUri(uri: string) {
  return uri.startsWith(URI_PREFIX) ? uri.slice(URI_PREFIX.length) : null;
}

export function hasApp(service: ServiceDefinition, tool: ToolDefinition) {
  return Boolean(service.app && tool.spec.app !== false);
}

// Inline code can't be allowed to close its own element early.
const inline = (code: string, tag: "script" | "style") => code.replace(new RegExp(`</(${tag})`, "gi"), "<\\/$1");

function escapeHtml(text: string) {
  return text.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!);
}

/** The app's HTML document: the shared styles and the service's bundled `app.ts` (which includes the runtime). */
export function appHtml(service: ServiceDefinition) {
  if (!service.app) throw new Error(`${service.id} has no app`);
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(service.title)}</title>`,
    `<style>${inline(APP_STYLES, "style")}</style>`,
    "</head>",
    `<body data-service="${escapeHtml(service.id)}">`,
    '<main id="app" aria-live="polite"></main>',
    `<script>${inline(service.app.script, "script")}</script>`,
    "</body>",
    "</html>",
  ].join("\n");
}

/** `_meta` of the app resource: what the host's iframe CSP must allow, and how to frame it. */
export function appResourceMeta(service: ServiceDefinition) {
  const app = service.app!;
  return {
    ui: {
      csp: { resourceDomains: app.resourceDomains, connectDomains: app.connectDomains },
      prefersBorder: app.prefersBorder,
    },
  };
}

/** The `resources/read` contents for a service's app. */
export function readAppResource(service: ServiceDefinition) {
  const uri = appResourceUri(service.id);
  return { contents: [{ uri, mimeType: MCP_APP_MIME_TYPE, text: appHtml(service), _meta: appResourceMeta(service) }] };
}

/** `_meta` for a tool that renders in its service's app. The flat key is for hosts on the draft spec. */
export function toolAppMeta(service: ServiceDefinition) {
  const resourceUri = appResourceUri(service.id);
  return { ui: { resourceUri, visibility: ["model", "app"] }, "ui/resourceUri": resourceUri };
}

/**
 * `structuredContent` of a result: never shown to the model, it tells the app
 * which tool ran and with what input, so one app can render every tool of its service.
 */
export function appStructuredContent(service: ServiceDefinition, tool: ToolDefinition, input: ToolInput) {
  return (value: unknown) => ({ service: service.id, tool: tool.name, input, ...(value && typeof value === "object" && !Array.isArray(value) ? value : { data: value }) });
}
