import type { z } from "zod";
import type { ServiceSpec, ToolSpec } from "@/mcp/schema";

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

export type ToolDefinition = {
  name: string;
  title?: string;
  description: string;
  spec: Omit<ToolSpec, "handler">;
  inputSchema: z.ZodObject;
  handler?: ToolHandler;
};

export type ServiceDefinition = Omit<ServiceSpec, "tools"> & {
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
};
