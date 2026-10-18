import tracker from "@/generated/apis.json";
import { msg } from "@/lib/i18n/translate";
import { API_CATEGORIES, API_KINDS, API_STATUSES, type ApiCategory, type ApiEntry, type ApiKind, type ApiStatus, type ApiTracker } from "@/mcp/apis";

/** The API tracker, generated from `mcp/apis.yaml` and the service YAML files. */
export const apiTracker = tracker as ApiTracker;

export { API_CATEGORIES, API_KINDS, API_STATUSES, type ApiCategory, type ApiEntry, type ApiKind, type ApiStatus };

/** Cards per page on /sources/apis. */
export const APIS_PAGE_SIZE = 48;

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
  commerce: msg("Commerce & industry"),
  development: msg("Development"),
  population: msg("Population"),
  security: msg("Law & security"),
  employment: msg("Employment & labour"),
  welfare: msg("Social welfare"),
  technology: msg("IT & broadcasting"),
  recreation: msg("Recreation & culture"),
  education: msg("Education"),
  city: msg("City management"),
  housing: msg("Housing"),
  legislature: msg("Legislature"),
  tourism: msg("Tourism"),
  food: msg("Food"),
  other: msg("Miscellaneous"),
};

/** UI labels for each kind, marked for translation; render with `t(API_KIND_LABELS[kind])`. */
export const API_KIND_LABELS: Record<ApiKind, string> = { api: msg("Live API"), files: msg("Data files") };

export type ApiFilters = { query?: string; status?: ApiStatus; category?: ApiCategory; kind?: ApiKind };

export function filterApis(apis: ApiEntry[], { query, status, category, kind }: ApiFilters) {
  const text = query?.trim().toLowerCase();
  return apis.filter(
    (api) =>
      (!status || api.status === status) &&
      (!category || api.category === category) &&
      (!kind || api.kind === kind) &&
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
