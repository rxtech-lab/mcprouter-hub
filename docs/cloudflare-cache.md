# Anonymous catalogue HTML caching

The production allowlist covers /sources and /sources/apis, unprefixed or prefixed by /en, /zh-CN or /zh-HK. The default language is English. Only HTTPS GET on mcprouter.app is eligible. The API catalogue accepts api, page, status, category and kind within a 512-character raw query. Keep the full hostname, path and query in the default Cloudflare cache key.

The normal application renders signed-in sessions, negotiated locales and client navigation. A separate Next.js root layout renders an anonymous catalogue with locale, view and raw query encoded in the ISR path. It uses the same components and metadata and revalidates after 300 seconds. The proxy fetches that HTML without client headers. Only a completed public 200 HTML response without Set-Cookie or a private, no-cache or no-store directive can receive the five-minute Cloudflare policy. Errors fall back to the ordinary dynamic page. Vercel shared caching is disabled on the outer response.

## Rollout and rollback

1. Inspect the current mcprouter.app cache rules. The previous observed state was an active bypass rule (5fcbaa967e3e4a09af63fdf38ecb1241) followed by a disabled anonymous GET rule (d03a8689920046f189ddeeb4820d56a5). Leave unrelated rules intact.
2. Compare the two predicates against the output of `bun scripts/cloudflare-cache-rules.ts`. Use the default cache key, respect origin cache-control, and prohibit storage for non-200 responses. Do not strip cookies or override origin prohibitions. Check that no later rule overrides these settings.
3. After the safe renderer is deployed, enable the eligible rule after the bypass, then apply PUBLIC_CDN_CACHE_ENABLED=true to the Production environment and deploy that configuration using the production pipeline.
4. Request each language twice with GET. Verify a Cloudflare HIT, a signed-out document, its HTML language and canonical URL. Check distinct api/page queries. Repeat warm URLs with Cookie, Authorization, Accept-Language, RSC, prefetch and SSE Accept headers and HEAD. These requests must bypass the warm HTML. Verify a real browser can navigate from the cached document.
5. Roll back by disabling the eligible rule first, leaving the bypass active. Remove the production flag and redeploy. Re-enable only after old eligible objects have expired or been purged. Keep the bypass while any previously cached object can still exist.
