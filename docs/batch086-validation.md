# Batch086 — Development (eight-ID retained subset)

TASK_RESULT: PARTIAL (8/10)

The exact request is API-3101, API-3103, API-3105, API-3106, API-3107, API-3116, API-3117, API-3118, API-3119 and API-3120. Only the eight successfully validated IDs below are retained. API-3101 and API-3118 remain Coming soon, with no introduced implementation, registrations, discovery/live inputs, fixtures or simulation endpoints. Independent RxCode verification is UNVERIFIED for every retained ID; no publication is authorized by this document.

Isolated branch `batch086-development`, worktree `/private/tmp/batch086-owned`, fresh fetched remote main base `6de4fdeabdd7ad96c70e2b34094b69b973d35c8f`. Main and pre-existing batch080–083 worktrees were preserved. A local subset commit is authorized for parent verification; no push, PR, board transition or delegation.

## Current upstream contracts and per-ID outcome

All ten official DATA.GOV.HK pages were freshly read on 2026-10-26 Hong Kong time. Full page bodies, CSDI schemas, original resource captures and rejected-source evidence are external at `/private/tmp/batch086-evidence`. Retained fixtures contain unmodified actual source bodies with hashes and source URLs, not fabricated records. The provider catalogue's current formats can differ from tracker titles.

| ID | Current resource and implementation | Implementer result | Independent |
|---|---|---|---|
| API-3101 | Catalogue advertises GeoTIFF; actual download is a ZIP containing TIFFs. System curl fetched 49,972,448 bytes; offline TIFF inspection confirmed 8,448 × 11,851 pixels. App-runtime fetch failed TLS chain verification (`unable to verify the first certificate`). | EXCLUDED; runtime unverified; no retry | UNVERIFIED |
| API-3103 | Five actual CSDI polygon sheet indices: OLD600, T1200, 1960s–1970s, 1980s–1990s, 2000s. Tools `landsd_old_survey_sheets_1` through `_5` preserve sheet numbers, edition/date and original GeoTIFF download links. Catalogue formats GeoTIFF/API. | PASS, all five actual record bodies | UNVERIFIED |
| API-3105 | GML catalogue links to a working CSDI point layer. `landsd_private_treaty_grants`. | PASS, en/tc | UNVERIFIED |
| API-3106 | GML catalogue links to a working CSDI point layer. `landsd_public_facilities`. | PASS, en/tc | UNVERIFIED |
| API-3107 | GML catalogue links to a working CSDI point layer. `landsd_public_open_space`. | PASS, en/tc | UNVERIFIED |
| API-3116 | Current catalogue FGDB; actual CSDI polyline layer. `landsd_road_centrelines` preserves nullable street names. | PASS, en/tc | UNVERIFIED |
| API-3117 | Actual public NTRIP ICY stream at `ntrip.geodetic.gov.hk:2101/HKFN_NMEA`. `landsd_satref_nmea_snapshot` validates GGA checksums and parses UTC, coordinates, quality, satellite count and original units. | PASS, actual live sentence | UNVERIFIED |
| API-3118 | Catalogue RTCM; initial bounded raw sample contained valid RTCM frames, but fresh adapter execution failed raw-frame validation. Root cause unverified; neither metadata nor an earlier sample proves adapter correctness. | EXCLUDED; no retry | UNVERIFIED |
| API-3119 | Public HTTPS host `rinex.geodetic.gov.hk`, actual gzip/Hatanaka CompactRINEX observation file. `landsd_satref_rinex_header` downloads and validates the file and exposes its complete structured header and original URL. | PASS, actual gzip file | UNVERIFIED |
| API-3120 | Current catalogue FGDB; actual CSDI tenancy polygons. `landsd_short_term_tenancies`. | PASS, en/tc | UNVERIFIED |

## Behavior and boundaries

The ten spatial tools reuse the repository YAML HTTP request/response transformer convention, with provider-verified field allowlists and schemas. Inputs validate integer bounds, bbox ordering/ranges, search length and supported language. SQL quotes are escaped; a single allowlisted search field avoids broad query gateway issues. Paging uses stable OBJECTID order, at most 100 records and 100 KB; geometries above 20 KB are explicitly omitted with the complete source URL retained. Provider fields, nulls, units, epoch-millisecond dates and original links are preserved. HTTP errors, malformed bodies, empty results and invalid CRS/coordinates have meaningful tests. Cache TTL is one hour.

For sheet indices, `lang=en` names language-neutral sheet numbers; no invented translations or pixel decoding. Other spatial tools offer the actual en/tc name aliases while preserving all bilingual fields. Tenancy names use language-neutral STTNo in both languages; usage/terms/rent remain in their original language fields. Road source null names remain null. CSDI endpoint sources are published official layers linked by the dataset IDs, not invented download APIs. Raster download availability is distinct from sheet-index access.

NMEA returns a bounded live snapshot of 1–3 complete GGA messages, at most 64 KB and 35 seconds, cached for 10 seconds. It handles actual ICY and HTTP responses, fragmented/chunked transport, provider errors, timeouts and closure without sufficient records. The public provider documents HKFN, HKQT and TCHK; fresh execution sampled HKFN. Other mountpoints are allowlisted from official documentation, not individually asserted live-tested. Raw sentences have no language variants. Production hosting must permit outbound TCP port 2101; deployment was not tested.

The RINEX tool supports actual documented hourly RINEX2 observation files with 1s/5s intervals. It bounds download to 2 MB and expanded gzip to 16 MB, validates the CompactRINEX header and station, preserves header lines and exposes SHA256 and original file URL. Hatanaka observations are not decoded; use RNXCMP for restoration. Missing dates/files return the exact provider HTTP error. The live sample was `2026/298/hkcl/5s/hkcl298a.26d.gz`, 217,359 compressed / 632,046 expanded bytes. The directory did not publish a 30s child for that date; that HTTP 404 path was not retried and is not exposed as a supported interval. Scheduled checks use two days ago in UTC.

## Final validation

- Focused: 77 passed across three files (`focused-confirmed.log`).
- Full suite: 4,644 passed; 46 pre-existing skips; 102 files passed (`full-confirmed.log`). No new skips.
- Codegen and freshness: PASS, 91 generated files (`codegen-final.log`, `codegen-check.log`). Generated files are ignored by repository convention and reproduced locally. APIS.md changes exactly eight requested statuses and aggregate totals.
- Lint/typecheck/translations: PASS (`lint-final.log`, `typecheck-final.log`, `i18n-final.log`); 836 translation strings.
- Production Webpack build: PASS (`build-confirmed.log`), with a migrated isolated SQLite build database. No production DB or deployment.
- Real HTTP/TCP Postman simulation: 118 asserted checks, zero failed APIs (`simulation-final-checks.log`); single `development` member served all twelve retained tools, including NMEA via the MCP route. Frozen log has 104 request events (92 served, 12 injected failures). It replays actual captures and does not emulate SQL/spatial evaluation.
- Separate fresh live checks: 17 passed, zero retained API failures (`live-final.log`). Excluded sources were not retried.
- Budget: 2/3 evidence-driven repair cycles used, ledger `/private/tmp/batch086-evidence/repair-ledger.md`. Assertions and error/empty/malformed coverage retained. Removed tests correspond only to removed failed APIs.

Postman CLI 1.75.0 is signed out, so provider-owned mock search was unavailable; local mocks replay official captures. Orbit discovery returned broader LandsD endpoints but did not resolve these exact raw/download contracts; official documentation and real bodies determined implementation. Sandbox git metadata, DNS and loopback failures used the required approval workflow. Initial font download failed sandbox DNS; approved build access resolved it. TLS validation for API-3101 was not disabled or bypassed.

## Acceptance and handoff

The full ten-ID task remains incomplete. Eight IDs have working bounded tools, validated inputs, source-aware languages, caching and actionable errors; two are explicitly excluded. Tests include provider-derived fixtures, MCP route/discovery, stable registration, malformed/error/empty behavior, geometry/CRS bounds, checksums and gzip parsing. No UI was needed. AGENTS.md, installed Next route documentation, Postman API Engineer/Discovery/Simulation/Mocking and the catalogue workflow were read.

Parent must independently verify each retained ID and the exact final local commit/diff/history. PUBLISHABLE_SUBSET: UNVERIFIED pending that verification. No automatic retry of excluded APIs, no push/PR/merge, and no manual review/done/complete transition.
