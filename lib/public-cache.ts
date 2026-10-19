import manifest from "@/generated/manifest.json";

export const PUBLIC_CACHE_HOST = "mcprouter.app";
export const PUBLIC_CACHE_CONTROL = "public, max-age=300, must-revalidate";

// Only reviewed public routes, not every future page under /sources.
export const PUBLIC_CACHE_PATHS = ["/", "/sources", ...manifest.services.map(({ id }) => `/sources/${id}`)];
const publicPaths = new Set(PUBLIC_CACHE_PATHS);

// Cloudflare's default cache key does not vary on cookies, language, or RSC
// headers. Keep these requests out of BOTH cache reads and cache writes.
export const PUBLIC_CACHE_EXCLUDED_HEADERS = [
  "cookie", "authorization", "accept-language", "rsc", "next-router-state-tree",
  "next-router-prefetch", "next-router-segment-prefetch", "next-url", "next-action",
  "x-middleware-prefetch", "x-nextjs-data", "range",
] as const;

export function isPublicPage(pathname: string) {
  return publicPaths.has(pathname);
}

export function isPublicCacheRequest(request: { url: string; method: string; headers: Headers }) {
  const url = new URL(request.url);
  // Next's self-hosted server builds request.url with its listen hostname.
  // The incoming Host is the same public host Cloudflare uses in its rule.
  const host = request.headers.get("host") ?? url.host;
  return host.toLowerCase() === PUBLIC_CACHE_HOST && url.protocol === "https:"
    && request.method === "GET" && isPublicPage(url.pathname) && !url.search
    && PUBLIC_CACHE_EXCLUDED_HEADERS.every((name) => !request.headers.has(name));
}

/** Install these two rules in order; the last matching cache rule wins. */
export function publicCacheRules() {
  const paths = PUBLIC_CACHE_PATHS.map((path) => JSON.stringify(path)).join(" ");
  const scope = `(http.host eq "${PUBLIC_CACHE_HOST}" and http.request.uri.path in {${paths}})`;
  const eligible = [scope, "ssl", 'http.request.method eq "GET"', 'http.request.uri.query eq ""',
    "not http.request.headers.truncated",
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
