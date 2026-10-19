# Public crawler HTML cache

Anonymous requests used to run the Auth.js refresh proxy and mint CSRF/callback
cookies. The public header also reads the browser session. These responses cannot
be shared safely by simply ignoring `Cache-Control` in Cloudflare.

Public pages now skip session initialization when no Cookie or Authorization
header is present. Session rendering returns signed-out state without invoking
Auth.js when there is no Cookie header. Signed-in visitors still refresh normally.
`skipProxyUrlNormalize` keeps Next.js from stripping RSC/prefetch headers and
internal query parameters before the proxy makes its cache decision.

The optional Cloudflare cache policy is deliberately narrow:

- HTTPS GET requests to `mcprouter.app`, on `/`, `/sources`, `/sources/apis`, and the service detail
  paths generated from the service manifest. No future routes are opted in implicitly.
- No query string except the public API catalogue's `api`, `page`, `status`,
  `category`, and `kind` parameters (at most 512 raw query characters). Keep the
  complete query string in Cloudflare's default cache key: different API selections,
  filters, and pages contain different content. Free-text `q` searches, unknown
  parameters, and internal `_rsc` queries bypass. Other routes still require no query.
- No Cookie, Authorization, Accept-Language, Range, server action,
  RSC, or Next.js router/prefetch headers. Empty headers also bypass.
- Five minutes at Cloudflare (`Cloudflare-CDN-Cache-Control`); browser and Vercel
  cache policies remain unchanged. Successful responses respect the origin TTL;
  every status other than 200 has a no-store status TTL (-1). No Set-Cookie stripping.
- No language header means the existing default English rendering. Localized
  requests bypass because Cloudflare's normal URL cache key ignores language.
  Crawlers sending language preferences or cookies will still reach the origin.
- APIs, dashboard, login, billing, live MCP calls, chat actions, and static assets
  retain their existing behavior. This does not block bots or cache live tool results.

## Rollout

1. Deploy this code with `PUBLIC_CDN_CACHE_ENABLED=false` (the default).
2. Run `bun scripts/cloudflare-cache-rules.ts` after `bun run codegen`.
   It prints two Cloudflare rule objects. Append them, in emitted order, to the
   zone's `http_request_cache_settings` phase, after any broader cache rules.
   Do not replace the whole ruleset or remove unrelated rules. In the dashboard,
   use each object's expression and action parameters in Caching → Cache Rules.
3. The first rule bypasses caching for all reviewed public paths. The second
   opts in only eligible requests. Both cache reads and writes must use these
   conditions: an origin `no-store` response cannot protect a personalized request
   from an already cached object. Keep these rules together, with the eligible
   rule last. Refresh their path lists when adding services.
4. Select **respect origin headers** for edge and browser TTLs, with the emitted
   no-store status TTLs for non-200 responses. Do not enable
   "Ignore cache-control", positive status-code TTL overrides, or custom keys that omit
   path/query/host. Keep Origin Cache Control enabled. Before activation, disable
   the eligible rule, purge any existing cache, then re-enable it. A GET-only rule
   can prevent single-URL purges from matching; use the dashboard's Purge Everything
   if a targeted purge cannot be verified. That also evicts static assets temporarily.
5. Set `PUBLIC_CDN_CACHE_ENABLED=true` for production and redeploy. Development,
   preview hosts, and the development authentication bypass remain uncacheable.

## Verify

Use two GETs (not `curl -I`, which sends HEAD):

```sh
curl -sS -D - -o /dev/null https://mcprouter.app/sources
curl -sS -D - -o /dev/null https://mcprouter.app/sources
```

Also repeat the actual crawler URL from the Vercel logs:

```sh
curl -sS -D - -o /dev/null 'https://mcprouter.app/sources/apis?api=API-2426&page=50&status=coming-soon'
```

Repeat with a different `api` and `page` and confirm the returned HTML differs.
Each full URL needs its own initial fill; a crawl of previously unseen URLs still
reaches Vercel once per Cloudflare location and cache lifetime. This policy reduces
repeat origin requests, not the number of unique URL combinations a crawler visits.

Expect MISS then HIT with increasing Age and no Set-Cookie. A miss may require
another request in the same Cloudflare location. Cloudflare consumes its private
cache-control header, so check it directly on a trusted origin/local production
build with `Host: mcprouter.app` if needed.

Repeat with a Cookie header (a test-only fake session cookie is sufficient),
`Accept-Language: zh-HK`, `RSC: 1`, a router-prefetch header, an unsupported query
(for example `/sources/apis?q=weather` or `?_rsc=test`), and a
POST; none may receive the cached HTML. Verify Chinese pages still render Chinese,
the signed-in header still shows Dashboard, and authenticated APIs remain live.
Check the page's HTML and its Next.js client navigation, not only response headers.
Do not test with real session tokens in logs or shell history.

To roll back, disable the eligible Cloudflare rule first, keep the bypass rule,
and purge the cache as above. Then disable the environment flag and redeploy.
The flag alone does not invalidate existing edge objects. Deploys may otherwise
serve public HTML from the previous version for up to five minutes; purge these
URLs when immediate freshness is required.

References: [Cloudflare-specific cache control](https://developers.cloudflare.com/cache/concepts/cdn-cache-control/),
[Set-Cookie behavior](https://developers.cloudflare.com/cache/concepts/cache-behavior/),
[case-insensitive header matching](https://developers.cloudflare.com/ruleset-engine/rules-language/values/).
