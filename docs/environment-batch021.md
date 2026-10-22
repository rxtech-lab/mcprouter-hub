# Environment batch 021 — authorized retry

Status: locally implemented and validated; **ready for independent RxCode verification**, not published. Scope is exactly API-1833–API-1842. No other failed batch was restarted.

Worktree: `/private/tmp/mcprouter-batch021-retry`  
Branch: `codex/batch021-environment-retry`  
Remote default branch: `origin/main`  
Base: `dfc4a4626b10c6be0a56e1662f047cb2e0ca05c0`  
Commits, pushes, PRs, deployments: **0**. Successful work is retained locally for the controller; independent per-API and final-subset verification remains pending.

## Retained APIs

| ID | Service / generated tool | Actual source and local live result |
|---|---|---|
| API-1833 | `epd-water-quality` / `epd_recent_marine_water_quality` | Official recent marine CSV; en/tc/sc PASS, 240 observations per file |
| API-1834 | `epd-recycling` / `epd_recyclable_collection_points` | Official CSDI FeatureServer query; en/tc/sc PASS |
| API-1835 | `epd-water-quality` / `epd_historical_river_water_quality` (`lang=en`) | Official annual river CSV; 1986 and 2025 PASS, 522 / 984 observations |
| API-1836 | Same historical tool (`lang=sc`) | Official annual river CSV; 1986 and 2025 PASS, 522 / 984 observations |
| API-1837 | Same historical tool (`lang=tc`) | Official annual river CSV; 1986 and 2025 PASS, 522 / 984 observations |
| API-1838 | `epd-water-quality` / `epd_recent_river_water_quality` | Official recent river CSV; en/tc/sc PASS, 312 observations per file |
| API-1839 | `epd-waste-collectors` / `epd_chemical_waste_collectors` | Official CSDI FeatureServer query; en/tc PASS |
| API-1840 | `epd-waste-collectors` / `epd_clinical_waste_collectors` | Official CSDI FeatureServer query; en/tc PASS |
| API-1841 | `epd-noise-permits` / `epd_construction_noise_permits` | Official CSDI FeatureServer query; en/tc PASS |
| API-1842 | `epd-complaints` / `epd_pollution_complaint_statistics` | Official CSDI FeatureServer query; en/tc PASS |

Eight generated tools in five services cover these ten permanent API IDs and their ten dataset IDs. No unrelated registry entries were changed. `APIS.md` is regenerated: 142 → 152 implemented entries. `generated/` is rebuilt locally and remains ignored by repository convention.

All ten DATA.GOV.HK metadata requests returned HTTP 200 with `success=true`. Six recent CSVs, three earliest-year and three latest-year historical CSVs, five CSDI layer schemas and five bounded CSDI record queries were rechecked. Dataset links/formats and concrete resource URLs are retained in [environment-batch021-resources.json](environment-batch021-resources.json). The CSV-labelled recycling resource is an HTML download page; the implementation uses its separately published spatial dataset, not HTML as records. Collector/permit resources labelled GML lead to a CSDI portal; structured access is through that dataset's actual FeatureServer query API. No file-only source was represented as an invented upstream API. No source remains unavailable in the final live checks.

## Contract

All tools validate inputs through generated schemas, use the existing handler/runtime/cache conventions and provide bounded pages (`limit` 1–100, nonnegative offset, 100 KB row budget, explicit nextOffset). Source URLs accompany results. Raw source requests cache for one hour; local tests use an isolated in-memory cache. ArcGIS results order by OBJECTID, optionally include WGS84 geometry, and explicitly omit oversized geometries. ArcGIS tools have a bounded 30-second timeout; CSV tools retain the runtime's 15-second default.

Water tools read the published UTF-8 CSVs using Papa Parse, validate column counts/identity headers/record dates, preserve original localized measurement labels, units and detection-bound strings, and normalize empty or literal `null` measurement cells to JSON null. Recent dates have month precision; historical dates have day precision. Exact station, month, language and substring filters are local to the cached file. The historical tool requires a year from the currently published 1986–2025 range. It fetches one annual language-specific file per call.

ArcGIS tools accept object ID, geographic bounding box, pagination and geometry selection. `searchField` selects exactly one fixed published field; its default follows `lang`. Schema enums prevent caller-supplied SQL identifiers. Search text is escaped by the shared spatial adapter. Recycling exposes en/tc/sc names; the other spatial datasets expose en/tc only because those are the published languages. Source multilingual attributes remain available.

## Failures found and corrected

1. **Original attempt: five cache/mock isolation failures.** “Spatial” means location/map data accessed through ArcGIS, not a separate kind of security test. The old tests queued HTTP-200 error-envelope and malformed-feature responses at one cached URL. The cache retained the first raw body, so subsequent calls did not consume their intended mocks. The eventual offset-100 empty-page request consumed a stale malformed-feature reply. This was a local test defect, not an upstream outage. Each error, malformed response and empty-page scenario now runs as its own test with a fresh cache and mock queue. Assertions check both the expected result/error and that HTTP was actually invoked. Assertions and error cases were preserved and expanded; caching is separately verified with repeat calls.
2. **Historical source nuance found by actual generated-tool checks.** Valid 1986 TR20A records have blank zone/river labels. The parser now retains those records instead of rejecting the entire year. Real 1986 fixtures in all three languages cover this case. Missing station/date and malformed structures still fail.
3. **Live search contract.** On these CSDI datasets, OR-combined field predicates returned HTTP 403, while individual UPPER/LIKE predicates and object-ID filters returned HTTP 200. EPD tools now expose one allowlisted field per request rather than reusing the shared adapter's cross-field search. The shared spatial adapter and existing transport tools were preserved. Fixture tests cover every selectable field, apostrophe escaping, field allowlisting and absence of OR; actual live checks verify known-record searches in every language.
4. **Latency.** One recycling high-offset empty-page query exceeded the 15-second default during a repeat live run. The EPD spatial tools now allow 30 seconds, with no blind retries. The final complete live run passed. Earlier failed-run evidence is retained outside the worktree.

Sandbox DNS/loopback EPERM failures were escalated before the real checks; they are not counted as provider outages. Postman owner discovery was unavailable because the CLI is signed out. Orbit returned no matching public API resources. Local Postman replay uses actual official captures, not guessed provider responses.

## Final validation

| Check | Result |
|---|---|
| `bun run codegen` | PASS; 47 generated files, two message catalogues |
| Focused environment/runtime/MCP route/discovery/live registry/API/codegen tests | PASS; 547 tests, six files |
| `bun run test` | PASS; 1,549 passed, five pre-existing skipped, 61 files |
| `bun run lint` | PASS |
| `bun run typecheck` | PASS |
| `TURSO_DATABASE_URL=file:/private/tmp/batch021-retry-evidence/build.db bun run build --webpack` | PASS; production build, temporary local database only |
| Postman simulation | PASS; 14 fixture variants, 80 actual loopback HTTP requests, 14 invalid-input rejections before HTTP |
| Final real generated-tool live checks | PASS; 23 language/year variants, 126 actual upstream HTTP requests, zero failures |
| `git diff --check` | PASS |

Live checks compare adjacent pages with a combined page, check terminal empty pages, retrieve a known record using filters, and exercise geographic bounding boxes and geometry for spatial tools. The central scheduled `liveCases`, central tool-case registry, scoped MCP discovery/call routes and MCP error responses cover every added tool. Fixture cases validate normalized observations independently of the TypeScript parser.

Postman simulation executes the actual generated tool schemas, handlers, cache/fetcher and parsers over HTTP. Only the official URL host is redirected to local Postman; provider replies are served by its fixture mock. The simulation includes HTTP 503, HTML returned as success, ArcGIS error envelopes, malformed features and empty pages. This proves behavior against the replay, separately from the real upstream evidence.

Reproduce:

```sh
bun run codegen
bun run test
bun run lint
bun run typecheck
TURSO_DATABASE_URL=file:/tmp/environment021-build.db bun run build --webpack
postman simulation run postman/simulations/environment021.sim.yaml --port 4921 --output ndjson
# In another shell:
bun --conditions=react-server scripts/check-environment021-simulation.ts
ENVIRONMENT021_LIVE_REPORT=/tmp/environment021-live.json bun --conditions=react-server scripts/check-environment021-live.ts
```

Latest bounded live evidence is retained locally as [environment-batch021-live.json](environment-batch021-live.json). Full validation logs, raw source probes, simulation NDJSON and earlier failed-run diagnostics remain under `/private/tmp/batch021-retry-evidence/`. The original failed-attempt report remains `/private/tmp/batch021-evidence/RESULT.md`.

## Remaining risks and handoff

Independent RxCode per-API and final-subset verification is **pending** and must precede publication. Catalogue declarations mean local implementation coverage, not deployment or independent approval. CSV availability beyond the published year range is not assumed. Annual files between 1986 and 2025 are enumerated in current metadata; live parser checks sample both endpoints of the range, not every annual file. Pollution statistics preserve the dataset's published reporting years (captured sample: 2022), and issued permits are not asserted to be currently valid. CSDI latency and future source/schema changes can still produce actionable upstream errors.

The original checkout remains unchanged. No commits, pushes, PRs, deployments, notifications, or manual board completion transitions were made. No failed API subset needs removal: all ten pass final local acceptance checks. The successful branch/worktree and ignored generated outputs are retained for the controller; do not remove them while independent verification is pending.
