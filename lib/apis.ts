import tracker from "@/generated/apis.json";
import { msg } from "@/lib/i18n/translate";
import { API_CATEGORIES, API_STATUSES, type ApiCategory, type ApiEntry, type ApiStatus, type ApiTracker } from "@/mcp/apis";

/** The API tracker, generated from `mcp/apis.yaml` and the service YAML files. */
export const apiTracker = tracker as ApiTracker;

export { API_CATEGORIES, API_STATUSES, type ApiCategory, type ApiEntry, type ApiStatus };

/** UI labels for each status, marked for translation; render with `t(API_STATUS_LABELS[status])`. */
export const API_STATUS_LABELS: Record<ApiStatus, string> = { implemented: msg("Implemented"), "coming-soon": msg("Coming soon") };

/** UI labels for each category, marked for translation; render with `t(API_CATEGORY_LABELS[category])`. */
export const API_CATEGORY_LABELS: Record<ApiCategory, string> = {
  transport: msg("Transport"),
  weather: msg("Weather"),
  environment: msg("Environment"),
  health: msg("Health"),
  finance: msg("Finance"),
  places: msg("Places & addresses"),
  government: msg("Government"),
};

export type ApiFilters = { query?: string; status?: ApiStatus; category?: ApiCategory };

export function filterApis(apis: ApiEntry[], { query, status, category }: ApiFilters) {
  const text = query?.trim().toLowerCase();
  return apis.filter(
    (api) =>
      (!status || api.status === status) &&
      (!category || api.category === category) &&
      (!text || [api.id, api.title, api.description, api.provider, ...api.datasets].some((value) => value.toLowerCase().includes(text))),
  );
}

export function findApi(id: string | undefined) {
  return id ? (apiTracker.apis.find((api) => api.id === id.toUpperCase()) ?? null) : null;
}

/** The APIs a service implements, in id order. */
export function serviceApis(serviceId: string) {
  return apiTracker.apis.filter((api) => api.services.includes(serviceId));
}
