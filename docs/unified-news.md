# Unified news MCP

Service: `unified-news`, available through the existing MCP endpoint at
`/api/mcp/s/unified-news/streamable`. Tools also appear in the combined catalogue and discovery.
The service belongs to the Global region. Existing Hong Kong-only exposure settings
must include Global to expose it.

Set `RAPIDAPI_KEY` in the server's `.env` and subscribe to both providers on RapidAPI.
Next.js loads `.env` into the server environment; the key is never bundled for clients.
Production needs the same environment variable in its deployment settings.
Hacker News uses its public official API and requires no key. Missing RapidAPI
credentials are reported as `configuration_error` errors for the two paid sources; Hacker News remains available.

## Tool contract

`list_top_news({"x": 10})` returns up to 10 unique articles **per source** (30 total).
`x` defaults to 10 and accepts integers 1–50. Trade Bloom's home-page top-news feed
contains non-article modules; only article stories with detail IDs are included.
Each provider's rank is retained, duplicates within that provider are removed,
and the three ranked lists are interleaved in Trade Bloom, Reuters, Hacker News order. No cross-source
deduplication or claim of a common editorial ranking is made. A provider may have
fewer available articles than requested.

The result includes `requestedPerProvider`, `returned`, `partial`, `providers`, and
`news`. Each news item has `id`, `provider`, `title`, `url`, `publishedAt` (ISO timestamp
or null), and `summary` (or null). Titles are capped at 1,000 characters and summaries
at 2,000. Each provider status includes its returned count; failures also include
an error code and HTTP/provider status when available. Any failed source yields
explicit partial results; all three failed sources produce a tool error. An empty valid
source is distinguished from an error. There are no automatic retries.

`get_news_detail({"id": "<exact list result id>"})` returns `{id, provider, article}`.
`article` preserves the provider's data object, including its original content
structure. Trade Bloom returns the matching bulletin object from `data[]`, with
metadata such as title, URLs, tickers and word count, not full article text.
Empty or unmatched bulletin results return 404; duplicate matches or malformed
envelopes fail explicitly. Detail bodies above 90 KB fail explicitly rather than silently truncate.
The provider prefixes and routing are:

| Prefix | Reference | Upstream request |
|---|---|---|
| `trade-bloom:` | 14-character `internalID` | `GET /stories/bulletin?ids=...` |
| `reuters:` | Base64url-encoded canonical HTTPS Reuters URL | `GET /details?url=...` |
| `hacker-news:` | Positive safe-integer item ID | `GET /v0/item/<id>.json` |

IDs are stateless, survive process restarts and need no preceding list call.
Reuters references must resolve to `reuters.com` or `www.reuters.com`; credentials,
foreign hosts, ports, fragments and non-HTTPS URLs are rejected. Trade Bloom and Reuters requests
go to their fixed RapidAPI gateways, with the proper `x-rapidapi-host` header.
The existing fetcher supplies a 15-second timeout. Authenticated upstream responses
bypass the shared cache, whose key does not include credentials.

## Hacker News

The [official API contract](https://github.com/HackerNews/API) and Orbit discovery
were checked on 2026-10-25. `GET /v0/topstories.json` returns ranked IDs; the service
examines the first `x` unique candidates and fetches items with at most ten concurrent
requests (at most `x + 1` requests total). Missing, deleted, dead and non-story items
are skipped without backfilling, so fewer than `x` stories may be returned. An item
request failure or malformed response fails that source explicitly. No retries occur.

Story URLs accept HTTP/HTTPS without credentials; absent or unsafe URLs fall back to
`https://news.ycombinator.com/item?id=<id>`. The summary is the optional story `text`
(HTML), not fetched article content. Detail returns the original story object with
metadata such as score, author and comment IDs, not the linked article or comment tree.
Missing, deleted, dead and non-story details return an explicit unavailable error.
RapidAPI credentials are never sent to Hacker News.

## Provider contracts inspected in Chrome (2026-10-25 HKT)

- [Trade Bloom Finance](https://rapidapi.com/vibapidev/api/trade-bloom-finance):
  `https://trade-bloom-finance.p.rapidapi.com/news/top-news` takes no parameters.
  Its top-news envelope has `status_code: 200`, `status: true`, and
  `data.modules[].stories[]`. Article stories have `internalID`, `title`, `longURL`,
  Unix-seconds `published`, and summary fields. The old `/stories/detail` endpoint
  returned HTTP 200 with `{status_code: 401, status: false}`, including in the
  RapidAPI playground with an ID from `/stories/list`.
  On 2026-10-25, `/stories/bulletin?ids=TNBP6OT9NJLV00` succeeded in the playground
  and with the local key. Its envelope contains `status_code: 200`, `status: true`,
  and a `data` array. The returned object includes `internalID`, title, URLs,
  tickers, section, timestamps, ad parameters and word count; no full text was
  present. Detail now uses this endpoint with one ID and returns the matching object.
- [Reuters API](https://rapidapi.com/mahmudulhasandev/api/reuters-api):
  `https://reuters-api.p.rapidapi.com/latest?limit=2` returned a top-level array of
  `{link, title, published_at}` records. `/details?url=...` returned
  `{status: "success", data: {...}}`, with title, content, description, URL, dates,
  author, category and tags. This is the third-party provider's response; its
  `data_source: "live"` label does not independently establish reporting quality
  or freshness.

Orbit discovery returned no matching contracts for the two RapidAPI providers, so the
Chrome playgrounds supplied the contracts. Postman is signed out; the owner mock
search was skipped. The local simulation uses explicitly synthetic structural
examples based on the observed bulletin shape and provider access-error envelopes.

## Reproduce HTTP verification

```sh
postman simulation run postman/simulations/unified-news.sim.yaml --port 4988 --output ndjson
# In another terminal, using the bound URL from the listening event:
UNIFIED_NEWS_SIM_URL=http://localhost:4988 bunx vitest run tests/unified-news.test.ts
```

Use synthetic credentials only. The tests direct the real registered tools and
HTTP fetcher to all three simulation members. They cover ranking, routing, source limits,
duplicate stories, empty feeds, JSON/HTTP/envelope errors, partial failure, complete
failure, unknown detail and credential redaction. These results establish behavior
against stand-ins; live end-to-end validation still requires a configured `.env`
key. Local live checks verify bulletin metadata access, not full article content.

`TRADE_BLOOM_BASE_URL`, `REUTERS_BASE_URL` and `HACKER_NEWS_BASE_URL` are server-only overrides for local
simulation. Leave them unset for live provider calls. The Hacker News override includes `/v0`
when pointing at the official API; the simulation member serves that base directly.

## Bulletin replacement verification (2026-10-25 HKT)

The updated registered tools returned fresh headlines from all three providers
(`partial: false`) and successful detail results for each returned ID using the
local configured key. Trade Bloom used `/stories/bulletin` and returned metadata.
The HTTP simulation passed 36 focused news and live-case tests; typecheck, lint
and translation checks passed. These local results do not establish a remote CI rerun.
