import { z } from "zod";

/**
 * Schema for `mcp/services/<service>/service.yaml`, the hand-written source
 * of truth for every MCP service. `scripts/codegen.ts` validates each file
 * against this before generating code.
 */

const scalar = z.union([z.string(), z.number(), z.boolean()]);

export const paramSpec = z
  .object({
    type: z.enum(["string", "number", "integer", "boolean"]),
    description: z.string().optional(),
    enum: z.array(z.union([z.string(), z.number()])).min(1).optional(),
    default: scalar.optional(),
    required: z.boolean().default(false),
    /**
     * Where the value goes upstream. Defaults to `path` when the tool's path
     * contains `{name}`, otherwise `query`. `local` values never leave this
     * app; they drive `response.filter` and `response.search`.
     */
    in: z.enum(["query", "path", "body", "local"]).optional(),
    /** Upstream parameter name, when it differs from the tool input name. */
    name: z.string().optional(),
    minimum: z.number().optional(),
    maximum: z.number().optional(),
    pattern: z.string().optional(),
    /** Normalise case before sending, e.g. KMB route numbers are upper case. */
    transform: z.enum(["upper", "lower"]).optional(),
  })
  .strict()
  .superRefine((param, ctx) => {
    if (param.enum && param.type === "string" && param.enum.some((value) => typeof value !== "string")) {
      ctx.addIssue({ code: "custom", message: "string enums must only contain strings" });
    }
    if (param.enum && param.type !== "string" && param.enum.some((value) => typeof value !== "number")) {
      ctx.addIssue({ code: "custom", message: "numeric enums must only contain numbers" });
    }
    if (param.default !== undefined && param.enum && !param.enum.includes(param.default as string | number)) {
      ctx.addIssue({ code: "custom", message: "default must be one of enum" });
    }
    if (param.default !== undefined && param.required) {
      ctx.addIssue({ code: "custom", message: "a param with a default cannot be required" });
    }
  });

export const responseSpec = z
  .object({
    format: z.enum(["json", "xml", "csv", "text"]).default("json"),
    /** Dot path to the part of the body to return, e.g. `data` or `rss.channel.item`. */
    root: z.string().optional(),
    /** Keep array items whose `field` equals the named input (case-insensitive). Map of item field → input name. */
    filter: z.record(z.string(), z.string()).optional(),
    /** Keep array items where any listed field contains the input text (case-insensitive). */
    search: z.object({ input: z.string(), fields: z.array(z.string()).min(1) }).strict().optional(),
    /** Keys to keep, on the object or on each array item. */
    pick: z.array(z.string()).min(1).optional(),
    /** Maximum array items returned; the result says when it was truncated. */
    limit: z.number().int().positive().default(200),
  })
  .strict();

const identifier = /^[a-z][a-z0-9_]*$/;

export const toolSpec = z
  .object({
    name: z.string().regex(identifier, "tool names are snake_case"),
    title: z.string().optional(),
    description: z.string().min(1),
    method: z.enum(["GET", "POST"]).default("GET"),
    /** Overrides the service base URL for this tool. */
    baseUrl: z.url({ protocol: /^https?$/ }).optional(),
    path: z.string().startsWith("/").optional(),
    /** Fixed query parameters sent on every call. */
    query: z.record(z.string(), scalar).optional(),
    /** Fixed JSON body fields (POST only). */
    body: z.record(z.string(), z.unknown()).optional(),
    headers: z.record(z.string(), z.string()).optional(),
    input: z.record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/), paramSpec).default({}),
    response: responseSpec.optional(),
    /** Name of an export in the service's `handlers.ts`, for anything YAML can't express. */
    handler: z.string().regex(/^[a-zA-Z][a-zA-Z0-9]*$/).optional(),
    cacheTtl: z.number().int().nonnegative().optional(),
    timeoutMs: z.number().int().positive().max(60_000).optional(),
  })
  .strict()
  .superRefine((tool, ctx) => {
    if (!tool.path && !tool.handler) {
      ctx.addIssue({ code: "custom", message: `tool ${tool.name} needs a path or a handler` });
    }
    if (tool.body && tool.method !== "POST") {
      ctx.addIssue({ code: "custom", message: `tool ${tool.name}: body is only allowed with POST` });
    }
    for (const placeholder of pathPlaceholders(tool.path ?? "")) {
      if (placeholder === "lang") continue;
      const param = tool.input[placeholder];
      if (!param) {
        ctx.addIssue({ code: "custom", message: `tool ${tool.name}: path uses {${placeholder}} but no input declares it` });
      } else if (param.in && param.in !== "path") {
        ctx.addIssue({ code: "custom", message: `tool ${tool.name}: {${placeholder}} is in the path but declared in: ${param.in}` });
      }
    }
    const response = tool.response;
    for (const inputName of [...Object.values(response?.filter ?? {}), ...(response?.search ? [response.search.input] : [])]) {
      if (!tool.input[inputName]) {
        ctx.addIssue({ code: "custom", message: `tool ${tool.name}: response refers to undeclared input ${inputName}` });
      }
    }
  });

export const serviceSpec = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9-]*$/, "service ids are kebab-case"),
    title: z.string().min(1),
    description: z.string().optional(),
    /** DATA.GOV.HK (CKAN) dataset ids this service covers; read by the tracker. */
    datasets: z.array(z.string().min(1)).default([]),
    baseUrl: z.url({ protocol: /^https?$/ }).optional(),
    /** How this API spells languages. Applied to any tool input named `lang`. */
    lang: z
      .object({
        param: z.string(),
        in: z.enum(["query", "path", "body"]).default("query"),
        map: z.record(z.enum(["en", "tc", "sc"]), z.string()),
      })
      .strict()
      .optional(),
    cacheTtl: z.number().int().nonnegative().default(300),
    tools: z.array(toolSpec).min(1),
  })
  .strict()
  .superRefine((service, ctx) => {
    const seen = new Set<string>();
    for (const tool of service.tools) {
      if (seen.has(tool.name)) ctx.addIssue({ code: "custom", message: `duplicate tool name ${tool.name}` });
      seen.add(tool.name);
      if (tool.path && !tool.baseUrl && !service.baseUrl) {
        ctx.addIssue({ code: "custom", message: `tool ${tool.name} has a path but neither it nor the service has a baseUrl` });
      }
    }
  });

export type ParamSpec = z.infer<typeof paramSpec>;
export type ResponseSpec = z.infer<typeof responseSpec>;
export type ToolSpec = z.infer<typeof toolSpec>;
export type ServiceSpec = z.infer<typeof serviceSpec>;

export function pathPlaceholders(path: string) {
  return [...path.matchAll(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g)].map((match) => match[1]);
}
