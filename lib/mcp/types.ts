import type { z } from "zod";
import type { CallChannel } from "@/db/schema";
import type { AppSpec, ServiceSpec, ToolSpec } from "@/mcp/schema";

export type ToolInput = Record<string, unknown>;

export type HandlerContext = {
  service: ServiceDefinition;
  tool: ToolDefinition;
  /** Fetch and parse an upstream URL through the shared cache and timeout. */
  fetchUpstream: (
    url: string,
    options?: { method?: "GET" | "POST"; body?: unknown; headers?: Record<string, string>; format?: "json" | "xml" | "csv" | "text"; cacheTtl?: number },
  ) => Promise<unknown>;
};

export type ToolHandler = (input: ToolInput, context: HandlerContext) => Promise<unknown>;

/** The upstream HTTP call a YAML tool makes, before it is sent. */
export type UpstreamRequest = {
  url: string;
  method: "GET" | "POST";
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
};

/** `transform.request`: rewrite the built request, e.g. encode a query param or add a computed header. */
export type RequestTransformer = (
  request: UpstreamRequest,
  input: ToolInput,
  context: HandlerContext,
) => UpstreamRequest | Promise<UpstreamRequest>;

/** `transform.response`: reshape the parsed upstream body before `response` shaping runs. */
export type ResponseTransformer = (body: unknown, input: ToolInput, context: HandlerContext) => unknown;

export type ToolDefinition = {
  name: string;
  title?: string;
  description: string;
  spec: Omit<ToolSpec, "handler">;
  inputSchema: z.ZodObject;
  handler?: ToolHandler;
  transformRequest?: RequestTransformer;
  transformResponse?: ResponseTransformer;
};

export type ServiceDefinition = Omit<ServiceSpec, "tools" | "app"> & {
  /** The service's MCP App, with its bundled `app.ts`. */
  app?: AppSpec & { script: string };
  tools: ToolDefinition[];
};

/** Who is calling, resolved from the API key or the internal agent key. */
export type CallerContext = {
  userId: string;
  apiKeyId: string | null;
  /** Service ids the caller may use. Empty means all. */
  scopes: string[];
  /** A signed-out visitor of the free agent: logged, but never billed. */
  guest?: boolean;
  /** Where the call came from, for usage by client. */
  channel?: CallChannel;
  /** The OAuth client, when `channel` is `oauth`. */
  oauthClientId?: string | null;
};
