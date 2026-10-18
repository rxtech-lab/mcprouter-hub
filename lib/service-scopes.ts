import { z } from "zod";
import { serviceById } from "@/generated/registry";
import type { ServiceChoice } from "@/components/service-combobox";
import type { Translator } from "@/lib/i18n/translate";
import { NO_SERVICES, type ServiceSelection } from "@/lib/service-selection";

/**
 * The services a key, connected app, bot link or the user's settings allow:
 * known ids, stored as the service they became after a merge. Empty means
 * every service; `[NO_SERVICES]` means none.
 */
export const serviceScopesSchema = (t: Translator) =>
  z
    .array(z.string())
    .max(50)
    .refine((ids) => ids.every((id) => id === NO_SERVICES || serviceById.has(id)), t("Unknown service"))
    .transform((ids) => {
      const known = [...new Set(ids.filter((id) => id !== NO_SERVICES).map((id) => serviceById.get(id)!.id))].sort();
      return known.length || !ids.length ? known : [NO_SERVICES];
    });

/** Saved scopes as the services they are now, for showing and editing. */
export const currentScopes = (scopes: readonly string[]) => [...new Set(scopes.map((id) => serviceById.get(id)?.id ?? id))];

/** Scopes as combobox choices; ids no longer in the catalogue are dropped. */
export function serviceChoices(scopes: readonly string[]): ServiceChoice[] {
  return currentScopes(scopes).flatMap((id) => {
    const service = serviceById.get(id);
    return service ? [{ id: service.id, title: service.title, region: service.region, tools: service.tools.length }] : [];
  });
}

/** Saved scopes as what a service picker holds. */
export const serviceSelection = (scopes: readonly string[]): ServiceSelection => (scopes.length ? serviceChoices(scopes) : "all");
