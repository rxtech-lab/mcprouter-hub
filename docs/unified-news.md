# Unified news MCP

Service: `unified-news`, available through the existing MCP endpoint at
`/api/mcp/s/unified-news/streamable`. Tools also appear in the combined catalogue and discovery.
The service belongs to the Global region. Existing Hong Kong-only exposure settings
must include Global to expose it.

Set `RAPIDAPI_KEY` in the server's `.env` and subscribe to both providers on RapidAPI.
Next.js loads `.env` into the server environment; the key is never bundled for clients.
Production needs the same environment variable in its deployment settings.

## Tool contract

`list_top_news({"x": 10})` returns up to 10 unique articles **per source** (20 total).
`x` defaults to 10 and accepts integers 1–50. Trade Bloom's home-page top-news feed
contains non-article modules; only article stories with detail IDs are included.
Each provider's rank is retained, duplicates within that provider are removed,
and the two ranked lists are interleaved, starting with Trade Bloom. No cross-source
deduplication or claim of a common editorial ranking is made. A provider may have
fewer available articles than requested.

The result includes `requestedPerProvider`, `returned`, `partial`, `providers`, and
`news`. Each news item has `id`, `provider`, `title`, `url`, `publishedAt` (ISO timestamp
or null), and `summary` (or null). Titles are capped at 1,000 characters and summaries
at 2,000. Each provider status includes its returned count; failures also include
an error code and HTTP/provider status when available. One failed source yields
explicit partial results; two failed sources produce a tool error. An empty valid
source is distinguished from an error. There are no automatic retries.

`get_news_detail({"id": "<exact list result id>"})` returns `{id, provider, article}`.
`article` preserves the provider's data object, including its original content
structure. Detail bodies above 90 KB fail explicitly rather than silently truncate.
The provider prefixes and routing are:

| Prefix | Reference | Upstream request |
|---|---|---|
| `trade-bloom:` | 14-character `internalID` | `GET /stories/detail?id=...` |
| `reuters:` | Base64url-encoded canonical HTTPS Reuters URL | `GET /details?url=...` |

IDs are stateless, survive process restarts and need no preceding list call.
Reuters references must resolve to `reuters.com` or `www.reuters.com`; credentials,
foreign hosts, ports, fragments and non-HTTPS URLs are rejected. Requests always
go to the fixed RapidAPI gateway, with the proper `x-rapidapi-host` header.
The existing fetcher supplies a 15-second timeout. Authenticated upstream responses
bypass the shared cache, whose key does not include credentials.

## Provider contracts inspected in Chrome (2026-10-25 HKT)

- [Trade Bloom Finance](https://rapidapi.com/vibapidev/api/trade-bloom-finance):
  `https://trade-bloom-finance.p.rapidapi.com/news/top-news` takes no parameters.
  Its successful envelope has `status_code: 200`, `status: true`, and
  `data.modules[].stories[]`. Article stories have `internalID`, `title`, `longURL`,
  Unix-seconds `published`, and summary fields. The story-detail playground documents
  `GET /stories/detail?id=<internalID>`. A request using a listed article returned
  **HTTP 200 with `{status_code: 401, status: false}`**. That is an access failure,
  and the integration reports it. No successful Trade Bloom detail body was observed;
  the adapter's successful `data` object envelope remains unverified live.
- [Reuters API](https://rapidapi.com/mahmudulhasandev/api/reuters-api):
  `https://reuters-api.p.rapidapi.com/latest?limit=2` returned a top-level array of
  `{link, title, published_at}` records. `/details?url=...` returned
  `{status: "success", data: {...}}`, with title, content, description, URL, dates,
  author, category and tags. This is the third-party provider's response; its
  `data_source: "live"` label does not independently establish reporting quality
  or freshness.

Orbit discovery returned no matching contracts for the chosen providers, so the
Chrome playgrounds supplied the contracts. Postman is signed out; the owner mock
search was skipped. The local simulation uses explicitly synthetic structural
examples and the observed Trade Bloom detail failure, not invented successful detail.

## Reproduce HTTP verification

```sh
postman simulation run postman/simulations/unified-news.sim.yaml --port 4988 --output ndjson
# In another terminal, using the bound URL from the listening event:
UNIFIED_NEWS_SIM_URL=http://localhost:4988 bunx vitest run tests/unified-news.test.ts
```

Use synthetic credentials only. The tests direct the real registered tools and
HTTP fetcher to both simulation members. They cover ranking, routing, source limits,
duplicate stories, empty feeds, JSON/HTTP/envelope errors, partial failure, complete
failure, unknown detail and credential redaction. These results establish behavior
against stand-ins; live end-to-end validation still requires a configured `.env`
key and successful provider access to Trade Bloom details.

`TRADE_BLOOM_BASE_URL` and `REUTERS_BASE_URL` are server-only overrides for local
simulation. Leave them unset for live RapidAPI calls.
