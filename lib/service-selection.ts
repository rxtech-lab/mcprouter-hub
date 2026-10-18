import type { ServiceChoice } from "@/components/service-combobox";

/**
 * Saved as the only scope to mean "no services", since an empty list means
 * every service. It isn't a valid service id, so it never matches one and
 * every scope check already refuses everything.
 */
export const NO_SERVICES = "!none";

/** What a service picker holds: every service, or the picked ones (none picked means no services). */
export type ServiceSelection = "all" | ServiceChoice[];

export function selectionToScopes(selection: ServiceSelection): string[] {
  if (selection === "all") return [];
  return selection.length ? selection.map((service) => service.id) : [NO_SERVICES];
}
