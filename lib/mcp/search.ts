import type { ServiceDefinition } from "@/lib/mcp/types";

/** Matches every word of the query against the service and its tools, so "bus eta" finds KMB. */
export function matchesService(service: ServiceDefinition, query: string) {
  const haystack = [service.id, ...service.aliases, service.title, service.description ?? "", ...service.datasets, ...service.tools.flatMap((tool) => [tool.name, tool.title ?? "", tool.description])]
    .join(" ")
    .toLowerCase();
  return query.toLowerCase().split(/\s+/).filter(Boolean).every((word) => haystack.includes(word));
}
