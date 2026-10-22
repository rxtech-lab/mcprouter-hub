Batch 023 retains **seven verified tracker entries**, implemented as seven tools in six services. API-1859, API-2004 and API-2007 are excluded following genuine search HTTP 403 responses. Independent RxCode verification explicitly returned FINAL CLEANED SUBSET COMPLETE on 2026-10-22 at 07:26:37 UTC in thread `01a16276-5d72-7c61-93b7-d49c230bf02b`, with PASS for each retained ID. Publication is authorized for this subset; the original batch remains partial.

Worktree: `/private/tmp/mcprouter-batch023`; branch: `codex/batch023-environment`; fetched remote default base/head: `41461c35fdbdfbb71857918922e0eec646a9e6d8`. The original main checkout remains untouched at `dfc4a46`.

| Stable ID | Published contract selected | Final result / concrete tool |
|---|---|---|
| API-1859 | EPD `epd_rcd_1726710008226_15952`, FeatureServer layer 0 | **Excluded**: independent review found genuine search HTTP 403 |
| API-1860 | EPD `epd_rcd_1669597014943_12158`, FeatureServer layer 0 JSON query | Retained; `epd_recycling_stations` |
| API-1899 | FEHD `fehd_rcd_1629953200619_10363`, FeatureServer layer 0 JSON query | Retained; `fehd_exhibition_resource_centres` |
| API-1903 | FEHD `fehd_rcd_1665718209201_92678`, FeatureServer layer 0 JSON query | Retained; `fehd_refuse_camera_blackspots` |
| API-1919 | FEHD `fehd_rcd_1629969846020_11292`, FeatureServer layer 0 JSON query; three published CSV variants also inspected | Retained; `fehd_water_dispensers` |
| API-2004 | HyD `hyd_rcd_1632210213867_60179`, FeatureServer layer 0 | **Excluded**: independent review found genuine search HTTP 403 |
| API-2007 | HyD `hyd_rcd_1632210079220_19018`, FeatureServer layer 0 | **Excluded**: original known-record search returned HTTP 403 |
| API-2023 | HAD multilingual `community_used_clothes_recycling_banks.csv` | Retained; `had_clothes_recycling_banks` |
| API-0039 | HKO `opendata.php?dataType=RYES&lang=en&date=20261021`, localized JSON | Retained; `hko_daily_weather_radiation` |
| API-2359 | HKO `latest_hourly_rmn.csv`, `_uc.csv`, `_sc.csv` | Retained; `hko_hourly_gamma_radiation` |

All ten DATA.GOV.HK `package_show` records returned HTTP 200 during original discovery. Published resources and spatial layer schemas were read before implementation. Metadata success alone was not used as evidence of implementation. Orbit discovery identified HKO's endpoint; conflicting example date syntax and response shape in its integration brief were superseded by the official dataset URL and actual YYYYMMDD response.

Live evidence is historical and separate from this cleanup's local checks: the original production-runtime run at 2026-10-22 07:09:11–07:09:19 UTC made 76 HTTPS requests. The seven retained IDs passed bounded initial results, split-page equivalence, empty-page cursor behavior, known-record filtering, and all advertised languages. Retained spatial tools also passed bbox and WGS84 geometry checks. [Per-ID live evidence](environment023-live.json) retains those seven results and records the three exclusions. The 76-request total includes earlier probes for subsequently excluded entries; it is not a fresh seven-ID run.

Independent reviewer thread `01a16276-5d72-7c61-93b7-d49c230bf02b` independently passed the seven retained IDs but found genuine search HTTP 403 for API-1859 and API-2004. Its conclusions supersede the earlier broader pass claims. API-2007 had failed its original known-record search (`OBJECTID=1` with `UPPER(VEG_ID) LIKE '%13752V82057%'`). Under authorized rule6b cleanup, all three entries' task-added services, handlers, fixtures, provenance, manifest records, dedicated test cases, mock/discovery/live-case registrations, and generated services have been removed. No further upstream probes, API fixes, or retries were performed. Failure details remain only in validation reports. Permanent pre-existing tracker entries remain unchanged and Coming soon; total implemented count is **165**, the base 158 plus seven retained entries.

Retained contracts:

- Four spatial tools reuse the existing bounded ArcGIS handler and single-field search allowlist. Original attributes are preserved, with localized `name`. EPD/FEHD expose English and Traditional Chinese fields only. FEHD NSEARCH fields preserve published dispenser location, count, and service hours.
- The clothes-bank CSV is selected over CSDI because it includes the scheme manager's fax. The adapter preserves multilingual district, region, bank address, manager, telephone, fax, and manager address.
- HKO hourly CSV returns provisional readings with original missing-value markers and normalized nullable numeric values. HKO daily JSON retains source weather fields, report/bulletin dates, narrative and notes. The default date is yesterday in Hong Kong; invalid calendar dates fail before HTTP. Both support English, Traditional Chinese and Simplified Chinese.
- Paging is bounded to 100 records and approximately 100 KB of records; source/report metadata is separate. Shared cache TTL is 3600 seconds for directories/spatial data and 300 seconds for radiation.

[Fixture provenance](../../tests/fixtures/environment023/provenance.json) contains only retained real-provider captures, their URLs and SHA-256 hashes. Fixture tests cover mapping, language, caching, validated inputs, HTTP/parse/provider errors, malformed records, bounded output and empty pages. The two mixed geometry/size tests now run on **each of the four retained spatial tools**, replacing their dependency on an excluded API without reducing retained behavior coverage. Dedicated excluded-API cases are removed. The central all-tool coverage gate and MCP route tests include all seven retained tools.

Final local validation after cleanup:

- `bun run codegen`: passed; removed two additional stale generated services. APIS.md now adds exactly seven implemented entries. Generated registry/manifest artifacts remain ignored according to repository conventions.
- `bun scripts/codegen.ts --check`: passed, **58 generated files** current.
- `bun run test`: **64 files passed; 2018 tests passed, 5 skipped**. This is 26 fewer passing tests than the prior 2044: excluded API cases were removed and shared bounds/geometry checks expanded across retained tools.
- `bun run lint`: passed.
- Production-build TypeScript check: passed. No standalone typegen was run concurrently with the build.
- `git diff --check`: passed.

Final local Postman simulation (CLI 1.75.0): `postman simulation run postman/simulations/environment023.sim.yaml --port 4923 --output ndjson --no-history`, followed by `bun --conditions=react-server scripts/check-environment023-simulation.ts`: **13 variants passed, 78 real HTTP requests, 13 invalid-input cases rejected before HTTP**. The clean simulation log has exactly 78 request events and zero error events. Successful, paginated, empty, HTTP-error, HTML and malformed-data paths execute production handlers and the fetcher against captured stand-ins. No excluded route is modeled. This is simulated evidence, separate from historical live verification. Nothing was pushed or deployed.

Authorized rule5a build-harness repair, **cycle 2/3**:

The independent reviewer reproduced compilation and TypeScript success, then identified an isolated local prerequisite failure: sitemap prerender queried a database lacking the `datasets` table. Turbopack's permission block had already been confirmed after escalation. After reading the installed Next.js build/CLI guides and inspecting `db/index.ts`, `drizzle.config.ts` and the sitemap query, the repair used the existing Webpack build path and a new task-owned local SQLite database. No application/API code, migration files or Next configuration changed.

Both migration and build ran with exactly:

```
TURSO_DATABASE_URL=file:/private/tmp/mcprouter-batch023-build-80e7108b19e14e91891a01a0c89c772a.sqlite
TURSO_AUTH_TOKEN=
NEXT_TELEMETRY_DISABLED=1
```

`bunx drizzle-kit migrate` exited **0** against that newly created local file; then `bunx next build --webpack` exited **0**, compiling, typechecking, generating all **44/44 static pages**, optimizing pages and collecting build traces. A read-only local SQLite inspection confirmed `datasets` exists and has **0 rows**. This proves the build/schema prerequisite with an empty local catalogue; it does not verify live/shared database contents. No live/shared database was migrated. The package's migration-bearing `bun run build` wrapper was not invoked. See [local evidence metadata](environment023-local.json).

Repair count is now **2/3**; one cycle remains unused. Cycle 1 corrected the central tool-case registration and finite-capture cursor assertion without weakening their gates. Cycle 2 initialized the explicitly authorized local build prerequisite. The genuine upstream 403s were excluded under rule6b, not treated as test defects or retried. No additional repair cycle was attempted.

No Next.js application/UI code changed. No excluded upstream was called during cleanup. Independent RxCode verification of the final seven-ID subset passed: the reviewer reproduced 2018 tests (5 skipped), lint, codegen, Postman 13 variants/78 requests and the production Webpack build including 44/44 pages and build traces; matched all 11 fixture hashes and all 23 retained service/fixture fingerprints; and confirmed complete removal of excluded API artifacts. The seven-ID subset passes the publication gate. Full ten-entry completion remains blocked by the three excluded APIs.
