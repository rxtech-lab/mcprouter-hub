import tracker from "@/generated/apis.json";
import { API_CATEGORIES, API_STATUSES, type ApiCategory, type ApiEntry, type ApiStatus, type ApiTracker } from "@/mcp/apis";

/** The API tracker, generated from `mcp/apis.yaml` and the service YAML files. */
export const apiTracker = tracker as ApiTracker;

export { API_CATEGORIES, API_STATUSES, type ApiCategory, type ApiEntry, type ApiStatus };

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
