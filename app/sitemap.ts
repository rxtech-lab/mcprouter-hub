import type { MetadataRoute } from "next";
import { isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { datasets } from "@/db/schema";
import manifest from "@/generated/manifest.json";
import { apiTracker } from "@/lib/apis";
import { LOCALES } from "@/lib/i18n/config";
import { localizedHref } from "@/lib/i18n/routing";
import { MCP_CLIENTS } from "@/lib/mcp-clients";
import { languageAlternates, seoOrigin } from "@/lib/seo";
import { and } from "drizzle-orm";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const providers = await db.selectDistinct({ id: datasets.organization }).from(datasets)
    .where(and(isNull(datasets.removedAt), isNotNull(datasets.organization)));
  const paths = ["/", "/sources", "/sources/apis", "/sources/providers", "/guides",
    ...manifest.services.map((service) => `/sources/${service.id}`),
    ...apiTracker.apis.filter((api) => api.status === "implemented").map((api) => `/sources/api/${api.id}`),
    ...providers.map((provider) => `/sources/providers/${encodeURIComponent(provider.id!)}`),
    ...MCP_CLIENTS.map((client) => `/guides/${client.id}`),
  ];
  return paths.flatMap((path) => LOCALES.map((locale) => ({
    url: `${seoOrigin()}${localizedHref(path, locale)}`,
    alternates: { languages: languageAlternates(path) },
  })));
}
