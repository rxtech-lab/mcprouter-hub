/**
 * Regions a service can belong to. A service's `region` in its YAML is one of
 * these ids; users can limit their MCP endpoints to some regions in settings.
 * Add a region here (and its name in `lib/regions.ts`) before adding the first service for it.
 */
export const REGIONS = ["hk"] as const;
export type RegionId = (typeof REGIONS)[number];
