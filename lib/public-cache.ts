import { LOCALES } from "./i18n/config";
import manifest from "@/generated/manifest.json";

export const PUBLIC_CACHE_HOST = "mcprouter.app";
export const PUBLIC_CACHE_CONTROL = "public, max-age=300, must-revalidate";

// Only reviewed public routes, not every future page under /sources.
const cataloguePaths = ["/sources/apis", ...LOCALES.map(locale => `/${locale}/sources/apis`)];
export const PUBLIC_CACHE_PATHS = ["/sources", ...LOCALES.map(locale => `/${locale}/sources`), ...cataloguePaths];
const servicePaths = new Set(manifest.services.map(({ id }) => `/sources/${id}`));
const publicPaths = new Set(PUBLIC_CACHE_PATHS);
const catalogueQueryKeys = ["api", "page", "status", "category", "kind"];
const maxCatalogueQueryLength = 512;

function isPublicCacheQuery(url: URL) {
  if (!url.search) return true;
  const query = url.search.slice(1);
  // Match Cloudflare's raw argument names: do not decode encoded keys here.
  // Free-text searches and Next's internal navigation queries stay uncached.
  return cataloguePaths.includes(url.pathname) && query.length <= maxCatalogueQueryLength
    && query.split("&").every((argument) => catalogueQueryKeys.includes(argument.split("=", 1)[0]));
}

// Cloudflare's default cache key does not vary on cookies, language, or RSC
// headers. Keep these requests out of BOTH cache reads and cache writes.
export const PUBLIC_CACHE_EXCLUDED_HEADERS = [
  "cookie", "authorization", "accept-language", "rsc", "next-router-state-tree",
  "next-router-prefetch", "next-router-segment-prefetch", "next-url", "next-action",
  "x-middleware-prefetch", "x-nextjs-data", "range", "purpose", "sec-purpose", "upgrade",
] as const;

export function isPublicPage(pathname: string) {
  return publicPaths.has(pathname) || pathname === "/" || servicePaths.has(pathname);
}

export function isPublicCacheRequest(request: { url: string; method: string; headers: Headers }) {
  const url = new URL(request.url);
  // Next's self-hosted server builds request.url with its listen hostname.
  // The incoming Host is the same public host Cloudflare uses in its rule.
  const host = request.headers.get("host") ?? url.host;
  return host.toLowerCase() === PUBLIC_CACHE_HOST && url.protocol === "https:"
    && request.method === "GET" && publicPaths.has(url.pathname)
    && [null, "*/*", "text/html"].includes(request.headers.get("accept")) && isPublicCacheQuery(url)
    && PUBLIC_CACHE_EXCLUDED_HEADERS.every((name) => !request.headers.has(name));
}

/** Install these two rules in order; the last matching cache rule wins. */
export function publicCacheRules() {
  const paths = PUBLIC_CACHE_PATHS.map((path) => JSON.stringify(path)).join(" ");
  const scope = `(http.host eq "${PUBLIC_CACHE_HOST}" and http.request.uri.path in {${paths}})`;
  const queryKeys = catalogueQueryKeys.map((key) => JSON.stringify(key)).join(" ");
  const query = `(http.request.uri.query eq "" or (http.request.uri.path in {${cataloguePaths.map(path => JSON.stringify(path)).join(" ")}} and len(http.request.uri.query) le ${maxCatalogueQueryLength} and all(http.request.uri.args.names[*] in {${queryKeys}})))`;
  const eligible = [scope, "ssl", 'http.request.method eq "GET"', query,
    "not http.request.headers.truncated",
    '(not any(lower(http.request.headers.names[*])[*] eq "accept") or all(http.request.headers["accept"][*] eq "*/*") or all(http.request.headers["accept"][*] eq "text/html"))',
    ...PUBLIC_CACHE_EXCLUDED_HEADERS.map((name) => `not any(lower(http.request.headers.names[*])[*] eq "${name}")`),
  ].join(" and ");
  return [
    { description: "Public pages: bypass personalized and client navigation requests", expression: scope,
      action: "set_cache_settings", action_parameters: { cache: false }, enabled: true },
    { description: "Public pages: cache anonymous default-language crawler HTML", expression: eligible,
      action: "set_cache_settings", action_parameters: {
        cache: true, edge_ttl: {
          mode: "respect_origin",
          // Proxy cannot see the final renderer status. Never cache an error,
          // redirect, or partial response under a public page's URL.
          status_code_ttl: [
            { status_code_range: { to: 199 }, value: -1 },
            { status_code_range: { from: 201 }, value: -1 },
          ],
        }, browser_ttl: { mode: "respect_origin" },
      }, enabled: true },
  ];
}

export function catalogueVariantQuery(view: string, variant: string): string | null {
  if (view !== "apis" && view !== "services") return null;
  if (variant === "index") return "";
  if (view !== "apis" || !/^q-[A-Za-z0-9_-]{1,683}$/.test(variant)) return null;
  const bytes = Buffer.from(variant.slice(2), "base64url");
  const query = bytes.toString("utf8");
  if (bytes.toString("base64url") !== variant.slice(2) || !query || query.length > maxCatalogueQueryLength) return null;
  return query.split("&").every(arg => catalogueQueryKeys.includes(arg.split("=", 1)[0])) ? query : null;
}
