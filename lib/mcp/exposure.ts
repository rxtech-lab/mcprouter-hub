import { eq } from "drizzle-orm";
import { db } from "@/db";
import { mcpSettings } from "@/db/schema";
import { serviceById } from "@/generated/registry";
import type { ServiceDefinition } from "@/lib/mcp/types";
import { combineServiceTools } from "@/lib/mcp/combined";

/**
 * A user's choice of what their MCP endpoints expose: some regions, some
 * services, and tools hidden within those. Empty lists mean everything, so a
 * user who never opened settings sees the whole catalogue.
 */
export type Exposure = { regions: string[]; services: string[]; hiddenTools: string[] };

export const OPEN_EXPOSURE: Exposure = { regions: [], services: [], hiddenTools: [] };

export function isOpenExposure(exposure: Exposure) {
  return !exposure.regions.length && !exposure.services.length && !exposure.hiddenTools.length;
}

export async function getExposure(userId: string): Promise<Exposure> {
  const [row] = await db
    .select({ regions: mcpSettings.regions, services: mcpSettings.services, hiddenTools: mcpSettings.hiddenTools })
    .from(mcpSettings)
    .where(eq(mcpSettings.userId, userId))
    .limit(1);
  return row ?? OPEN_EXPOSURE;
}

/** Why a service is or isn't exposed, for the settings page. */
export type ServiceExposure = "exposed" | "region" | "service" | "tools";

export function serviceExposure(service: ServiceDefinition, exposure: Exposure): ServiceExposure {
  if (exposure.regions.length && !exposure.regions.includes(service.region)) return "region";
  // Saved ids may be a service that was later merged into this one.
  if (exposure.services.length && !exposure.services.some((id) => serviceById.get(id)?.id === service.id)) return "service";
  if (service.tools.every((tool) => exposure.hiddenTools.includes(tool.name) || tool.operations?.every((operation) => exposure.hiddenTools.includes(operation.name)))) return "tools";
  return "exposed";
}

/** The services, each cut down to its visible tools, that the user exposes. */
export function exposedServices(services: readonly ServiceDefinition[], exposure: Exposure): ServiceDefinition[] {
  if (isOpenExposure(exposure)) return [...services];
  const hidden = new Set(exposure.hiddenTools);
  return services
    .filter((service) => serviceExposure(service, exposure) === "exposed")
    .map((service) => {
      const tools = service.tools.filter((tool) => !hidden.has(tool.name));
      if (service.combinedTool && tools[0]?.operations) {
        return combineServiceTools({ ...service, tools: tools[0].operations.filter((operation) => !hidden.has(operation.name)) });
      }
      return { ...service, tools };
    });
}
