import { z } from "zod";
import { combinedDescription } from "@/mcp/combined";
import type { ParamSpec } from "@/mcp/schema";
import type { ServiceDefinition } from "./types";

/** Keep operator feeds internal while registering a single public tool. */
export function combineServiceTools(service: ServiceDefinition): ServiceDefinition {
  if (!service.combinedTool) return service;
  const operations = service.tools;
  const input: Record<string, ParamSpec> = {
    action: { type: "string", required: true, enum: operations.map((tool) => tool.name), description: "Operation to perform; see the tool description for its arguments." },
  };
  for (const operation of operations) {
    for (const [name, param] of Object.entries(operation.spec.input)) {
      input[name] ??= { type: param.type, required: false, description: `Action-specific argument. See the selected action's description.` };
    }
  }
  const shape: Record<string, z.ZodType> = {};
  for (const [name, param] of Object.entries(input)) {
    const schema = name === "action" ? z.enum(input.action.enum as [string, ...string[]])
      : param.type === "string" ? z.string() : param.type === "boolean" ? z.boolean() : z.number();
    shape[name] = param.required ? schema : schema.optional();
  }
  const description = combinedDescription(service.description, operations.map((tool) => tool.spec));
  return { ...service, tools: [{
    name: service.combinedTool,
    title: service.title,
    description,
    spec: { name: service.combinedTool, title: service.title, description, method: "GET", input, app: true },
    inputSchema: z.object(shape),
    operations,
  }] };
}
