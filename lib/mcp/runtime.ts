import type { ParamSpec, ResponseSpec, ToolSpec } from "@/mcp/schema";
import { pathPlaceholders } from "@/mcp/schema";
import { cached } from "@/lib/mcp/cache";
import { fetchUpstream, type UpstreamFormat } from "@/lib/mcp/fetcher";
import type { HandlerContext, ServiceDefinition, ToolDefinition, ToolInput, UpstreamRequest } from "@/lib/mcp/types";

export type { UpstreamRequest };

/**
 * Shared executor for generated tools: builds the upstream request from the
 * YAML spec, fetches it through the cache, and shapes the response.
 */

export type ToolResult = {
  data: unknown;
  meta: { source?: string; total?: number; returned?: number; truncated?: boolean };
};

function placement(name: string, param: ParamSpec, tool: Pick<ToolSpec, "path">) {
  if (param.in) return param.in;
  return pathPlaceholders(tool.path ?? "").includes(name) ? "path" : "query";
}

function normalise(value: unknown, param: ParamSpec) {
  if (typeof value !== "string") return value;
  if (param.transform === "upper") return value.toUpperCase();
  if (param.transform === "lower") return value.toLowerCase();
  return value;
}

export function buildRequest(service: Pick<ServiceDefinition, "baseUrl" | "lang">, tool: Omit<ToolSpec, "handler">, input: ToolInput): UpstreamRequest {
  const base = (tool.baseUrl ?? service.baseUrl ?? "").replace(/\/+$/, "");
  let path = tool.path ?? "";
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(tool.query ?? {})) query.set(key, String(value));
  const body: Record<string, unknown> = { ...tool.body };

  for (const [name, param] of Object.entries(tool.input)) {
    let value = normalise(input[name], param);
    if (value === undefined || value === null || value === "") continue;
    let target = placement(name, param, tool);
    let upstreamName = param.name ?? name;

    if (name === "lang" && service.lang) {
      value = service.lang.map[value as "en" | "tc" | "sc"] ?? value;
      upstreamName = service.lang.param;
      target = pathPlaceholders(tool.path ?? "").includes("lang") ? "path" : service.lang.in;
    }

    switch (target) {
      case "path":
        path = path.replaceAll(`{${name}}`, encodeURIComponent(String(value)));
        break;
      case "query":
        query.set(upstreamName, String(value));
        break;
      case "body":
        body[upstreamName] = value;
        break;
      case "local":
        break;
    }
  }

  const unfilled = pathPlaceholders(path);
  if (unfilled.length > 0) throw new Error(`Missing required path value: ${unfilled.join(", ")}`);
  const search = query.toString();
  return {
    url: `${base}${path}${search ? `?${search}` : ""}`,
    method: tool.method,
    body: tool.method === "POST" ? body : undefined,
    headers: tool.headers,
  };
}

export function getPath(value: unknown, path: string | undefined): unknown {
  if (!path) return value;
  let current = value;
  for (const segment of path.split(".")) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function pickKeys(value: unknown, keys: string[]) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(keys.filter((key) => key in value).map((key) => [key, (value as Record<string, unknown>)[key]]));
}

function same(a: unknown, b: unknown) {
  if (typeof a === "string" && typeof b === "string") return a.toLowerCase() === b.toLowerCase();
  return String(a) === String(b);
}

export function shapeResponse(body: unknown, response: ResponseSpec | undefined, input: ToolInput): ToolResult {
  if (!response) return { data: body, meta: {} };
  let data = getPath(body, response.root);

  if (Array.isArray(data)) {
    for (const [field, inputName] of Object.entries(response.filter ?? {})) {
      const wanted = input[inputName];
      if (wanted === undefined || wanted === null || wanted === "") continue;
      data = (data as unknown[]).filter((item) => same(getPath(item, field), wanted));
    }
    const term = response.search ? input[response.search.input] : undefined;
    if (typeof term === "string" && term.trim()) {
      const needle = term.trim().toLowerCase();
      const fields = response.search!.fields;
      data = (data as unknown[]).filter((item) =>
        fields.some((field) => String(getPath(item, field) ?? "").toLowerCase().includes(needle)),
      );
    }
    const items = data as unknown[];
    const total = items.length;
    const limited = items.slice(0, response.limit);
    const picked = response.pick ? limited.map((item) => pickKeys(item, response.pick!)) : limited;
    return { data: picked, meta: { total, returned: picked.length, truncated: total > picked.length } };
  }

  return { data: response.pick ? pickKeys(data, response.pick) : data, meta: {} };
}

function cacheKey(request: UpstreamRequest, format: UpstreamFormat) {
  return `${request.method} ${request.url} ${format} ${request.body ? JSON.stringify(request.body) : ""}`;
}

export function handlerContext(service: ServiceDefinition, tool: ToolDefinition): HandlerContext {
  return {
    service,
    tool,
    fetchUpstream: (url, options = {}) => {
      const format = options.format ?? "json";
      const request: UpstreamRequest = { url, method: options.method ?? "GET", body: options.body as Record<string, unknown> | undefined, headers: options.headers };
      return cached(cacheKey(request, format), options.cacheTtl ?? tool.spec.cacheTtl ?? service.cacheTtl, () =>
        fetchUpstream({ ...request, format, timeoutMs: tool.spec.timeoutMs }),
      );
    },
  };
}

/** A request transformer may only hand back a well-formed http(s) request. */
function checkRequest(request: UpstreamRequest): UpstreamRequest {
  let url: URL;
  try {
    url = new URL(request?.url);
  } catch {
    throw new Error("The request transformer returned an invalid URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("The request transformer must return an http(s) URL");
  if (request.method !== "GET" && request.method !== "POST") throw new Error("The request transformer must return a GET or POST request");
  return { ...request, body: request.method === "POST" ? request.body : undefined };
}

export async function executeTool(service: ServiceDefinition, tool: ToolDefinition, rawInput: ToolInput): Promise<ToolResult> {
  const input = tool.inputSchema.parse(rawInput) as ToolInput;

  if (tool.operations) {
    const operation = tool.operations.find((candidate) => candidate.name === input.action);
    if (!operation) throw new Error("Unknown action");
    const args = { ...input };
    delete args.action;
    return executeTool(service, operation, args);
  }

  if (tool.handler) {
    const data = await tool.handler(input, handlerContext(service, tool));
    return tool.spec.response ? shapeResponse(data, tool.spec.response, input) : { data, meta: {} };
  }

  const context = tool.transformRequest || tool.transformResponse ? handlerContext(service, tool) : null;
  const built = buildRequest(service, tool.spec, input);
  const request = tool.transformRequest ? checkRequest(await tool.transformRequest(built, input, context!)) : built;
  const format = tool.spec.response?.format ?? "json";
  const ttl = tool.spec.cacheTtl ?? service.cacheTtl;
  // The cache holds the raw upstream body, keyed by the request actually sent.
  const raw = await cached(cacheKey(request, format), ttl, () =>
    fetchUpstream({ ...request, format, timeoutMs: tool.spec.timeoutMs }),
  );
  const body = tool.transformResponse ? await tool.transformResponse(raw, input, context!) : raw;
  const result = shapeResponse(body, tool.spec.response, input);
  return { ...result, meta: { source: request.url, ...result.meta } };
}
