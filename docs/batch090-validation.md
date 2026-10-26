Batch090 implements exactly API-0204–0213 in `censtatd-census-history`, with one bounded read-only tool per dataset. Base: `649d91cee3dfbd6cb5edf66e284de99512e9b529` (`origin/main`, fetched before work). Owned branch: `batch090-population-owned`; worktree: `/private/tmp/batch090-owned`. No unrelated work was changed.

## Resource verification and contract

On 2026-10-26, all ten DATA.GOV.HK `package_show` records resolved to official CSDI FeatureServer layer 0 resources. Layer schemas and actual polygon/statistics bodies were acquired, not just metadata. The bodies are preserved byte-for-byte as provenance fixtures; `tests/fixtures/batch090/manifest.json` records original query URLs, sample hashes, layer-schema hashes and capture times. Full raw metadata, schemas and acquisitions are archived in `/private/tmp/batch090-evidence`. These are live structured APIs, not file-download APIs.

| ID | Tool | Dataset suffix | Provider/body + tool + simulation + live status |
| --- | --- | --- | --- |
| API-0204 | census_2006_ssbg | 2006-population-bycensus-by-ssbg | PASS |
| API-0205 | census_2006_stpu | 2006-population-bycensus-by-stpu | PASS |
| API-0206 | census_2011_dcca | 2011-population-census-by-dcca | PASS |
| API-0207 | census_2011_dcd | 2011-population-census-by-dcd | PASS |
| API-0208 | census_2011_lsbg | 2011-population-census-by-lsbg | PASS |
| API-0209 | census_2011_ltpu | 2011-population-census-by-ltpu | PASS |
| API-0210 | census_2011_ssbg | 2011-population-census-by-ssbg | PASS |
| API-0211 | census_2011_stpu | 2011-population-census-by-stpu | PASS |
| API-0212 | census_2016_dcca | 2016-population-bycensus-by-dcca | PASS |
| API-0213 | census_2016_dcd | 2016-population-bycensus-by-dcd | PASS |

Dataset IDs use the prefix `hk-censtatd-census_geo-`. Permanent IDs and original tracker entries are unchanged. APIS.md is regenerated; generated runtime/manifest artifacts remain ignored per repository convention and can be reproduced with `bun run codegen` (92 generated files).

The YAML HTTP tools reuse the existing `developmentRequest`/`developmentResponse` transformers with per-layer verified field/type contracts. Inputs: optional positive 32-bit objectId, validated WGS84 intersection bbox, geometry opt-in, English/Traditional Chinese name alias, limit 1–100 (default 10), offset 0–1,000,000. The server orders by OBJECTID. Continue with nextOffset and identical filters. Raw upstream responses cache for one hour; bilingual aliases share that cache. Each output page caps records and serialized record bytes at 100 KB; polygons over 20 KB are explicitly omitted with complete source query access via meta.source. Geometry requests use WGS84; Shape__Area/Shape__Length retain provider projected units.

Source fields, numeric strings, nulls and suppression markers are preserved without conversion. These historical census figures are not current population estimates. Field codes require the official source data dictionary; no measure labels or translations are invented. Simplified Chinese is not published by these layer name fields and is rejected explicitly. Name-search SQL is not exposed; object IDs and bbox provide selection. Prior batch089 IDs were not called or retried.

## Validation

| Check | Exact result | Evidence under `/private/tmp/batch090-evidence` |
| --- | --- | --- |
| Focused tools + fixtures + routes + discovery + live-input coverage | 649 passed, 4 files | focused-final.log |
| Full suite | 4,730 passed, 46 skipped, 105 files passed | full-final.log |
| Codegen / generated freshness | PASS, 92 files | codegen.log, codegen-check.log |
| Lint | PASS, zero warnings | lint-final.log |
| Typecheck | PASS | typecheck-initial.log |
| i18n | PASS, 836 strings up to date | i18n.log |
| Production Webpack build | PASS, using migrated worktree-local SQLite DB | build-final.log, local-db-setup.log |
| Postman real HTTP simulation | 130 checks passed, 0 failed APIs | simulation-checks.log, simulation.ndjson |
| Separate real-provider execution | 40 checks passed, 0 failed APIs | live-checks.log |

Simulation uses the real generated runtime/client against a single local Postman `census` member derived from official captures. Logs show requests for every retained ID. Each ID exercised bilingual aliases, paging/geometry, numeric ID filtering, empty/malformed/ArcGIS/HTML responses, HTTP 503, timeout, invalid input and unreachable network. Bbox predicate construction is asserted locally and exercised against the real provider; the mock does not emulate spatial intersection. The ten logged simulation HTTP failures are injected HTTP 503 cases, not unexpected failures. The server was stopped with SIGINT before freezing its log.

Live execution bypassed cache and made four successful generated-tool calls per ID: en, tc, offset 1 with geometry, and objectId=1 plus bbox. Archived provider captures separately include original polygon geometry and full source attributes. Live checks do not establish deployment or every feature's data quality.

## Repairs and publication boundary

Rule5a ledger: `/private/tmp/batch090-evidence/repair-ledger.md`. Two of three cycles used, conservatively counting integration/build-harness repairs: (1) add omitted scheduled live-check inputs after the first full suite failed coverage; (2) initialize the fresh local SQLite schema after sitemap prerender failed. No assertions, error/empty coverage or provenance checks were weakened. Sandbox DNS/loopback failures were escalated; no genuine upstream failures occurred and no failed APIs were retried.

No remaining implementation/provider blockers and no excluded IDs. Local commit is authorized by the current execution instructions. Push/PR/publication remains blocked pending explicit independent RxCode verification of every retained ID, the complete subset, outgoing history and final head. No notification or board-state change was made. External handoff with exact committed head and evidence hashes: `/private/tmp/batch090-evidence/handoff.json`.
