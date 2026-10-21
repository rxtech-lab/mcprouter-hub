# Public search and sharing

MCPRouter identifies RxLab (`https://rxlab.app`) as its publisher, with a visible company link in the public footer and Organization/WebSite JSON-LD. Service, API and setup pages include visible breadcrumbs and matching BreadcrumbList JSON-LD.

## URLs and indexing

- Public content has stable `/en`, `/zh-CN` and `/zh-HK` URLs. Explicit URL languages override cookies and browser language. Existing unprefixed links continue to work and point canonically to the corresponding language URL.
- Public links and GET search forms preserve the language. Account routes, OAuth endpoints, webhooks and MCP endpoint URLs remain unprefixed. Changing language reloads the root layout so both HTML language and translations update.
- Service aliases permanently redirect to the service's canonical localized URL.
- Service chat/dialog/fullscreen state, attribution parameters and guide authentication tabs are omitted from canonicals. List pagination keeps a distinct canonical for each page.
- Search and filter results are `noindex, follow`. Private/account pages inherit `noindex, follow`; authentication still controls access. Unimplemented API detail pages are also noindex.
- `/sources/api/API-…` is the full API detail page. Existing tracker dialogs remain available and point to the same canonical detail page.
- `/sitemap.xml` contains canonical public URLs and language alternates, including active catalogue providers and implemented APIs. It refreshes hourly and requires the migrated catalogue database. It deliberately omits invented modification dates, private pages, filters and coming-soon API details.
- `/robots.txt` advertises the sitemap and excludes API/protocol paths. Pages marked noindex remain crawlable so crawlers can read that directive.
- Existing Cloudflare cache allowlists are preserved. Localized rewrites are not added to shared edge caching; do not broaden cache rules without checking language, session and RSC separation.

## Deployment and Search Console

1. Set `NEXT_PUBLIC_SITE_URL=https://mcprouter.app` in production. It controls canonical, sitemap, share image and public guide endpoint origins.
2. If using Search Console HTML-tag verification, set `GOOGLE_SITE_VERIFICATION` to the token from the tag's `content` attribute and redeploy. A DNS-verified domain property does not need this variable.
3. In a verified Search Console property, submit `https://mcprouter.app/sitemap.xml` and inspect representative English/Chinese service, guide and API URLs. Check the Google-selected canonical and rendered HTML.
4. Track indexed pages, search impressions, clicks, CTR and sign-in/checkout conversions by landing page. Compare periods rather than treating deployment as evidence of ranking gains.
5. Check production mobile Core Web Vitals in Search Console and run PageSpeed Insights on the homepage and a service page. Development timing and local synthetic results do not establish field performance. Use measured LCP, INP and CLS problems to guide chat loading, image, font or animation changes.

Local checks: `bun run codegen`, `bun run typecheck`, `bun run lint`, `bun run test`, and `bunx playwright test e2e/seo.spec.ts e2e/i18n.spec.ts`. Browser checks use a local database and mocked authentication; they do not prove production indexing, external client connection success or field performance.
