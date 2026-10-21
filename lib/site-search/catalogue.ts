import "server-only";
import manifest from "@/generated/manifest.json";
import { apiTracker, filterApis } from "@/lib/apis";
import { serviceContent } from "@/lib/service-content";
import type { Translator } from "@/lib/i18n/translate";
import type { SearchDestination } from "./types";

export function searchNavigation(t: Translator): SearchDestination[] {
  return [
    { href: "/", label: t("Home"), key: "home" },
    { href: "/sources", label: t("Data sources"), key: "sources" },
    { href: "/guides", label: t("Setup guides"), key: "guides" },
    { href: "/#pricing", label: t("Pricing"), key: "pricing" },
  ];
}

/** Only the bounded matches leave the server; the browser never receives the catalogue. */
export function searchSite(query: string, t: Translator): SearchDestination[] {
  const navigation = searchNavigation(t);
  const text = query.trim().toLocaleLowerCase();
  if (!text) return navigation;
  const services = manifest.services.map((service) => ({
    href: `/sources/${service.id}`, label: t(serviceContent[service.id]?.title ?? service.title), key: service.id,
    description: t(service.description),
  }));
  const matches = [...navigation, ...services].filter((item) => `${item.label} ${item.key} ${item.description ?? ""}`.toLocaleLowerCase().includes(text));
  matches.sort((a, b) => Number(b.label.toLocaleLowerCase() === text) - Number(a.label.toLocaleLowerCase() === text));
  const apis = filterApis(apiTracker.apis, { query }).slice(0, 8).map((api) => ({
    href: `/sources/api/${api.id}`, label: api.title, key: api.id,
    description: `${api.provider} · ${api.status === "implemented" ? t("Implemented") : t("Coming soon")}`,
  }));
  return [...matches, ...apis].slice(0, 12);
}
