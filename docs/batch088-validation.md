# Batch088 — Development (nine-ID retained subset)

TASK_RESULT: PARTIAL (9/10)

The exact requested batch includes ten IDs. Nine have working tools; one excluded ID remains Coming soon and has no introduced code, tests, fixtures, registration, discovery, simulation or scheduled live-check inputs. Exclusion evidence is external at `/private/tmp/batch088-evidence/exclusions.md`. Independent RxCode verification is UNVERIFIED for every retained ID. This document does not authorize publication.

## Scope and source verification

Base: freshly fetched `origin/main` at `649d91cee3dfbd6cb5edf66e284de99512e9b529`. Isolated owned branch `batch088-development-owned`, worktree `/private/tmp/batch088-owned`. Main and the pre-existing batch080/081/082/083/087 worktrees were preserved. Local successful-subset commit authorized by the hourly parent; parent handles independent verification and publication.

All ten official DATA.GOV.HK pages were fetched on 2026-10-26 Hong Kong time. Original pages, current metadata, service schemas and captures are in `/private/tmp/batch088-evidence`. Fixture JSON files are unmodified original bounded provider responses, with SHA256 hashes. CSDI catalogue UUIDs are resolved through the public metadata records to the actual TPB service URLs; UUIDs are not service names. Raster services expose MapServer raster layers, not FeatureServer features. Exploratory non-published service-path probes are distinct from calls to the resolved published contracts.

| Permanent ID | Working access | Implementer evidence | Independent |
|---|---|---|---|
| API-3361 | `pland_regulated_areas`; official TPB RA_PLAN_CSDI layer 1, bilingual/trilingual names and source GeoJSON/GML/SHP download links | Actual schema + original polygon records; en/tc/sc runtime PASS | UNVERIFIED |
| API-3362 | `pland_completed_enforcement_cases`; CSDI point records for completed enforcement/prosecution, currently 2021–2025 rollover | Original nulls, use descriptions, epoch-ms dates and case numbers; en/tc PASS | UNVERIFIED |
| API-3363 | `pland_land_use_cell`; eight actual raster MapServer identify endpoints, 2018–2025 | All eight original cell responses and runtime calls PASS | UNVERIFIED |
| API-3366 | `pland_brownfield_sites`; CSDI polygon distribution from 2019 study | Actual source has one large multipart distribution geometry and published area fields; runtime PASS | UNVERIFIED |
| API-3369 | `pland_strategic_viewpoints`; CSDI multipoint records with maps/panorama links and source orientation/elevation | Original multipoint captures; en/tc/sc PASS | UNVERIFIED |
| API-3616 | `pland_statutory_plans`; official TPB OZP_PLAN_CSDI layer 0 | Original polygon records, plan numbers, dates and downloads; en/tc/sc PASS | UNVERIFIED |
| API-3617 | `pland_deep_bay_guideline_12c`; CSDI polyline wetland boundaries | Original line records; en/tc PASS | UNVERIFIED |
| API-3618 | `pland_storage_guideline_13g`; CSDI polygon category areas | Original categories, plan numbers, labels and geometry; en/tc PASS | UNVERIFIED |
| API-3621 | Four tools for current/past section 12A amendments and sections 16/17 applications with section 17B appeal fields; actual APP_AMEND_CSDI layers 0–3 | All four original schemas/record bodies and live tools PASS | UNVERIFIED |

## Contracts and limits

Eleven spatial tools use existing YAML HTTP request/response transformers. Inputs validate integer paging/object IDs, supported language, allowlisted search fields and WGS84 bbox ordering/range. Search quotes are SQL-escaped; `%` and `_` retain the documented LIKE wildcard meaning. No caller-supplied SQL, layer or URL. Stable OBJECTID ordering, at most 100 records and 100 KB per page; `nextOffset` preserves continuation when the byte bound shortens a page. A single oversized record raises an actionable error. Nulls and original source fields remain intact. Languages select a published name alias; no automatic field translation. Brownfield name is its numeric OBJECTID because the provider has no textual name field.

Geometry is validated against its source type (point, multipoint, line or polygon), CRS and coordinate range. Full geometry over 20 KB is explicitly omitted; users can follow the complete source query URL. The single brownfield multipart polygon exceeds this bound; its published area fields and source link remain available. These are historical/planning data, not live weather, parcel-level land-use certification or legal title evidence.

The raster adapter queries the actual public MapServer at a bounded Hong Kong coordinate, uses tolerance zero, preserves the original pixel code and attributes, and distinguishes provider NoData from numeric zero. It returns at most one cell, at most sixteen attributes with bounded names/values. It does not invent class translations, serve raster bytes or decode arbitrary GeoTIFFs. The provider also publishes ZIP downloads; an actual 2024 ZIP was inspected externally and contains a GeoTIFF, world file, code table and auxiliary files. The implemented access uses the verified live raster endpoint rather than claiming that binary download inspection is MCP support.

Tools cache upstream responses for one hour. Failed HTTP/network requests are not cached. Malformed, invalid-CRS, provider error envelopes, invalid JSON, empty lists and unsupported inputs have explicit coverage. No UI or database schema change is needed.

## Validation

All final commands use frozen `bun.lock` dependencies: Bun 1.4.0, locked @types/node 26.6.5, TypeScript 5.9.3, Next 16.4.3. The lockfile is unchanged. Local Bun differs from CI's recorded Bun 1.4.4; no CI result is claimed.

- Focused: 92 tests passed across three files (`focused-final.log`).
- Full suite: 4,752 passed, 46 existing skips, 106 files passed (`full-final.log`). No new skips.
- Codegen and freshness: PASS, 92 generated files (`codegen-final.log`, `codegen-check-final.log`). Generated files are ignored by repository convention. APIS.md changes exactly the nine retained statuses plus totals; unrelated entries are unchanged.
- Lint, typecheck and translations: PASS (`lint-final.log`, `typecheck-final.log`, `i18n-final.log`); 836 translation strings.
- Production Webpack build: PASS using an isolated migrated SQLite database (`build-final.log`). No production DB or deployment.
- Actual HTTP Postman simulation: 100 passing checks, zero failures (`simulation-checks-final.log`). Every retained tool and raster year serves real HTTP requests from official captures, with injected HTTP503, invalid JSON, malformed, timeout, empty and unreachable-port cases. This replays source records; it does not emulate SQL/spatial or raster geography. Scoped MCP route tests independently cover tool discovery, valid execution, invalid inputs and provider failures for all twelve tools.
- Fresh live runtime: 28 checks passed, zero retained failures (`live-retained.log`), covering every retained tool, offered name language and raster year. Source records are parsed by the actual adapters. No excluded ID was retried. The later raster output-bound guard is covered with the same unmodified captures in final tests/simulation; live-retained.log precedes that guard.
- Repair ledger: 3/3 cycles used, recorded externally. Cycle 1 removed the failed ID and fixed validation-script type inference; cycle 2 corrected test file formatting at the unchanged legacy line ceiling; cycle 3 corrected an external exclusion scanner that falsely matched digits in original polygon coordinates. No retained meaningful assertions were weakened or removed.

Postman CLI 1.75.0 is signed out; provider-owned mock search was skipped. A local mock reuses original captures. Orbit discovery supplied general ArcGIS guidance but did not resolve these exact datasets; the official pages/metadata/service bodies determine their contracts. Required escalation resolved git metadata, dependency tempdir, DNS and loopback restrictions. Initial build font DNS failure was environmental and the authorized network build passed. TLS verification was not disabled.

## Handoff

Final base/head, owned worktree status, full outgoing-history/diff audit, hashes, exclusions and validation commands/results are recorded in `/private/tmp/batch088-evidence/HANDOFF.md` and `handoff.json`. The final full diff contains only the successful subset. No earlier outgoing commit contains removed code. No push, PR, merge, board transition, notification or additional implementation agent was launched. Parent must independently verify each retained ID and the final subset at the exact head before publication. The full ten-ID task remains incomplete.
