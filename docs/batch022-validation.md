# Batch022 Environment validation — PARTIAL

Independent RxCode verification passed for each of the six retained APIs and the cleaned subset on 2026-10-22. Original batch remains partial; four adapters are excluded.

- Branch: `codex/batch022-environment`
- Worktree: `/private/tmp/mcprouter-batch022`
- Fetched remote default: `origin/main`, base/head `f29de39e1f89f9832e2f40edfbcad1f76f74329e`
- Original main checkout preserved at `dfc4a46`.
- Repair budget: **1/3 used**. Central all-tool fixture harness omitted the newly added cases; added captured cases without changing the coverage assertion. The same repair cycle replaced the shared node_modules symlink with an isolated local dependency copy after Turbopack rejected resolution outside the worktree. No provider retries or provider implementation changes counted as test repairs.

## Source contract and per-ID outcome

Metadata, service schemas and two-record queries were fetched on 2026-10-22. Every listed DATA.GOV.HK resource links to CSDI. File-labelled catalogue resources also expose actual FeatureServer JSON query endpoints; this implementation uses those verified endpoints, not a fictional file API. Resource labels below are catalogue labels, not the format returned by the query endpoint. No listed source was proven unavailable.

| ID | Catalogue format | CSDI dataset | Outcome |
|---|---|---|---|
| API-1843 | CSV | `epd_rcd_1726709250759_21580` | Verified locally; retained |
| API-1844 | API | `epd_rcd_1696985921148_35462` | Incomplete adapter; excluded |
| API-1845 | API | `epd_rcd_1638153978303_23086` | Incomplete adapter; excluded |
| API-1851 | API | `epd_rcd_1664938140599_40077` | Incomplete adapter; excluded |
| API-1852 | SHP | `epd_rcd_1694592755253_45012` | Verified locally; retained |
| API-1853 | SHP | `epd_rcd_1694592602848_49157` | Verified locally; retained |
| API-1854 | FGDB | `epd_rcd_1696985725838_7798` | Verified locally; retained |
| API-1856 | GML | `epd_rcd_1726710187543_56551` | Verified locally; retained |
| API-1857 | API | `epd_rcd_1638154342238_45289` | Incomplete adapter; excluded |
| API-1858 | API | `epd_rcd_1685517560422_72556` | Verified locally; retained |

### Excluded adapter evidence (no failure retries)

These four sources returned valid service/layer metadata and two real features for unfiltered queries. Their proposed field searches did not return parseable JSON. The actual field names below occur in the provider layer schemas, so the evidence does **not** establish a nonexistent field, an unavailable API, or a precise gateway rejection reason. HTTP status and full HTML error bodies were not recorded by the exploratory field-search harness. Only the HTML prefix was retained. Treat the four adapters as incomplete, not the source APIs as unavailable. No task-added handlers, fixtures, tests, declarations, discovery entries or live cases for these IDs are retained.

#### API-1844

- [Catalogue](https://data.gov.hk/en-data/dataset/hk-epd-rsteam-specified-process-licence) / [CSDI resource](https://portal.csdi.gov.hk/geoportal/?datasetId=epd_rcd_1696985921148_35462)
- Published fields: `Public_Register_A`, `Public_Register_R_L`, `Licence_Number`, `Trade_Code_Description_Eng`, `Trade_Code_Description_Chi`, `Applicant_Name_Eng`, `Applicant_Name_Chi`, `Premises_Address_Eng`, `Premises_Address_Chi`, `OBJECTID`.
- Proposed field: `Licence_Number`. Exact request: [Licence_Number query](https://portal.csdi.gov.hk/server/rest/services/common/epd_rcd_1696985921148_35462/FeatureServer/0/query?f=json&where=1%3D1+AND+%28UPPER%28Licence_Number%29+LIKE+%27%25L-3-275%281%29%25%27%29&outFields=%2A&returnGeometry=false&resultRecordCount=1&resultOffset=0&orderByFields=OBJECTID+ASC).
- Observed failure: JSON decoding failed; response began with `<!DOCTYPE html PUBLIC '-//W3C//DTD XHTML 1.0 Transitional//EN' 'http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd'>
<html xmlns='http://www.w3.o`. Detailed reason and HTTP status are unknown.
- Other known-record searches that returned a feature: `Applicant_Name_Eng`, `Applicant_Name_Chi`, `Trade_Code_Description_Eng`, `Trade_Code_Description_Chi`, `Premises_Address_Eng`, `Premises_Address_Chi`.

#### API-1845

- [Catalogue](https://data.gov.hk/en-data/dataset/hk-epd-rvmpsteam-reverse-vending-machine-pilot-scheme) / [CSDI resource](https://portal.csdi.gov.hk/geoportal/?datasetId=epd_rcd_1638153978303_23086)
- Published fields: `OBJECTID`, `DATASET_EN`, `DATASET_TC`, `NAME_EN`, `ADDRESS_EN`, `NAME_TC`, `ADDRESS_TC`, `SEARCH01_EN`, `SEARCH01_TC`, `NSEARCH01_EN`, `NSEARCH01_TC`, `NSEARCH02_EN`, `NSEARCH02_TC`, `NSEARCH03_EN`, `NSEARCH03_TC`, `NSEARCH04_EN`, `NSEARCH04_TC`, `NORTHING`, `EASTING`, `LATITUDE`, `LONGITUDE`, `LASTUPDATE`.
- Proposed field: `ADDRESS_TC`. Exact request: [ADDRESS_TC query](https://portal.csdi.gov.hk/server/rest/services/common/epd_rcd_1638153978303_23086/FeatureServer/0/query?f=json&where=1%3D1+AND+%28UPPER%28ADDRESS_TC%29+LIKE+%27%25%E8%A5%BF%E7%92%B0%E9%AB%98%E8%A1%972%E8%99%9F%E8%A5%BF%E7%87%9F%E7%9B%A4%E7%A4%BE%25%27%29&outFields=%2A&returnGeometry=false&resultRecordCount=1&resultOffset=0&orderByFields=OBJECTID+ASC).
- Observed failure: JSON decoding failed; response began with `<!DOCTYPE html PUBLIC '-//W3C//DTD XHTML 1.0 Transitional//EN' 'http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd'>
<html xmlns='http://www.w3.o`. Detailed reason and HTTP status are unknown.
- Other known-record searches that returned a feature: `NAME_EN`, `NAME_TC`, `ADDRESS_EN`.

#### API-1851

- [Catalogue](https://data.gov.hk/en-data/dataset/hk-epd-swsrsteam-school-waste-separation-recycling-scheme) / [CSDI resource](https://portal.csdi.gov.hk/geoportal/?datasetId=epd_rcd_1664938140599_40077)
- Published fields: `Latitude`, `Longitude`, `School_Address_EN`, `School_Address_SC`, `School_Address_TC`, `School_Name_EN`, `School_Name_SC`, `School_Name_TC`, `OBJECTID`.
- Proposed field: `School_Address_EN`. Exact request: [School_Address_EN query](https://portal.csdi.gov.hk/server/rest/services/common/epd_rcd_1664938140599_40077/FeatureServer/0/query?f=json&where=1%3D1+AND+%28UPPER%28School_Address_EN%29+LIKE+%27%2518+LEI+TUN%25%27%29&outFields=%2A&returnGeometry=false&resultRecordCount=1&resultOffset=0&orderByFields=OBJECTID+ASC).
- Observed failure: JSON decoding failed; response began with `<!DOCTYPE html PUBLIC '-//W3C//DTD XHTML 1.0 Transitional//EN' 'http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd'>
<html xmlns='http://www.w3.o`. Detailed reason and HTTP status are unknown.
- Other known-record searches that returned a feature: `School_Name_EN`, `School_Name_TC`, `School_Name_SC`, `School_Address_TC`, `School_Address_SC`.

#### API-1857

- [Catalogue](https://data.gov.hk/en-data/dataset/hk-epd-wfsteam-wfs-gov-pub) / [CSDI resource](https://portal.csdi.gov.hk/geoportal/?datasetId=epd_rcd_1638154342238_45289)
- Published fields: `OBJECTID`, `DatasetEN`, `DatasetTC`, `NameEN`, `AddressEN`, `NameTC`, `AddressTC`, `DistrictEN`, `DistrictTC`, `VenueTypeEN`, `VenueTypeTC`, `NumberofWaterDispensersEN`, `NumberofWaterDispensersTC`, `RemarksEN`, `RemarksTC`, `Northing`, `Easting`, `Latitude`, `Longitude`, `LastUpdate`.
- Proposed field: `AddressTC`. Exact request: [AddressTC query](https://portal.csdi.gov.hk/server/rest/services/common/epd_rcd_1638154342238_45289/FeatureServer/0/query?f=json&where=1%3D1+AND+%28UPPER%28AddressTC%29+LIKE+%27%25%E5%B1%AF%E9%96%80%E9%BE%8D%E6%BE%A4%E8%B7%AF5%E8%99%9F%25%27%29&outFields=%2A&returnGeometry=false&resultRecordCount=1&resultOffset=0&orderByFields=OBJECTID+ASC).
- Observed failure: JSON decoding failed; response began with `<!DOCTYPE html PUBLIC '-//W3C//DTD XHTML 1.0 Transitional//EN' 'http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd'>
<html xmlns='http://www.w3.o`. Detailed reason and HTTP status are unknown.
- Other known-record searches that returned a feature: `NameEN`, `NameTC`, `AddressEN`, `DistrictEN`, `DistrictTC`, `VenueTypeEN`, `VenueTypeTC`.

## Retained implementation

Six tools across five service folders: collector/recycler directory; direct environmental permit applications; EIA report approval applications; EIA habitat maps; food waste treatment suppliers; water pollution load inventory. Registration covers only API-1843, API-1852, API-1853, API-1854, API-1856 and API-1858.

The existing spatial helper now accepts an internal layer ID and unique object-ID field. Existing callers retain layer 0/OBJECTID. Habitat exposes all 16 verified layers with explicit mappings for case-sensitive report/district/habitat fields and OBJECTID_1 on layers 0 and 6. SSSI has no Project field, so habitat `name` consistently identifies the report reference. Other tools select a name only from the source's published languages. No units or translations are invented; pollution values preserve the original 2021/2041 scenario fields and parameter codes.

All tools support validated bounded paging, one allowlisted text-search field, object ID, WGS84 bounding boxes and optional geometry. Cached upstream bodies use a 3600-second TTL, 30-second timeout, 100-record and 100 KB row-output limits. Large geometries are explicitly omitted; the full source query URL remains available. Collector directory and non-exhaustive supplier disclaimers are in discoverable descriptions.

## Live runtime evidence

`bun --conditions=react-server scripts/check-environment022-live.ts` with `ENVIRONMENT022_LIVE_REPORT` set to a temporary report path: **21 layer/tool variants passed, 0 failed; 152 actual HTTP requests**. Production generated schemas, handlers, runtime and fetcher ran against CSDI with the cache disabled. Checks: real nonempty initial record; stable pagination; terminal empty page; combined known-record text and object-ID filtering; WGS84 bbox and geometry; every advertised name-language projection. No provider failure was retried.

Sandbox DNS failure was resolved by escalation and is not a provider failure. Postman server and client also needed escalation for loopback permissions. Those setup failures are not source failures.

- **API-1843**: 1 passed variant(s). Tool `epd_collector_recycler_directory`. [Layer query](https://portal.csdi.gov.hk/server/rest/services/common/epd_rcd_1726709250759_21580/FeatureServer/0/query?f=json&where=1%3D1&outFields=*&outSR=4326&returnGeometry=false&resultRecordCount=1&resultOffset=0&orderByFields=OBJECTID+ASC&geometryPrecision=6).
- **API-1852**: 1 passed variant(s). Tool `epd_direct_environmental_permit_applications`. [Layer query](https://portal.csdi.gov.hk/server/rest/services/common/epd_rcd_1694592755253_45012/FeatureServer/0/query?f=json&where=1%3D1&outFields=*&outSR=4326&returnGeometry=false&resultRecordCount=1&resultOffset=0&orderByFields=OBJECTID+ASC&geometryPrecision=6).
- **API-1853**: 1 passed variant(s). Tool `epd_eia_report_applications`. [Layer query](https://portal.csdi.gov.hk/server/rest/services/common/epd_rcd_1694592602848_49157/FeatureServer/0/query?f=json&where=1%3D1&outFields=*&outSR=4326&returnGeometry=false&resultRecordCount=1&resultOffset=0&orderByFields=OBJECTID+ASC&geometryPrecision=6).
- **API-1854**: 16 passed variant(s). Tool `epd_eia_habitat_maps`. [Layer query](https://portal.csdi.gov.hk/server/rest/services/common/epd_rcd_1696985725838_7798/FeatureServer/0/query?f=json&where=1%3D1&outFields=*&outSR=4326&returnGeometry=false&resultRecordCount=1&resultOffset=0&orderByFields=OBJECTID_1+ASC&geometryPrecision=6).
  Layers: 0 SeasonalWatercourse, 1 woodland, 2 Wetland, 3 Watercourse, 4 Wasteland, 5 VillageArea, 6 UplandGrassland, 7 SSSI, 8 Shrubland, 9 Pond, 10 Plantation, 11 Marsh, 12 GrasslandShrubland, 13 Grassland, 14 DevelopedArea, 15 AgriculturalLand.
- **API-1856**: 1 passed variant(s). Tool `epd_food_waste_treatment_suppliers`. [Layer query](https://portal.csdi.gov.hk/server/rest/services/common/epd_rcd_1726710187543_56551/FeatureServer/0/query?f=json&where=1%3D1&outFields=*&outSR=4326&returnGeometry=false&resultRecordCount=1&resultOffset=0&orderByFields=OBJECTID+ASC&geometryPrecision=6).
- **API-1858**: 1 passed variant(s). Tool `epd_water_pollution_load_inventory`. [Layer query](https://portal.csdi.gov.hk/server/rest/services/common/epd_rcd_1685517560422_72556/FeatureServer/0/query?f=json&where=1%3D1&outFields=*&outSR=4326&returnGeometry=false&resultRecordCount=1&resultOffset=0&orderByFields=OBJECTID+ASC&geometryPrecision=6).

## Reproducible fixture and simulation checks

Provider fixture captures and a contract manifest are under `tests/fixtures/environment022/`. The local-only Postman mock replays those captures; it is not a replacement for live evidence and was not published. Orbit discovery returned unrelated Lands Department APIs and supplied no EPD contract; official catalogue metadata and current CSDI layer schemas determined this implementation.

Start `postman simulation run postman/simulations/environment022.sim.yaml --port 4922 --output ndjson`, then run `bun --conditions=react-server scripts/check-environment022-simulation.ts`. Result: **21 variants passed; 147 actual loopback HTTP requests; 21 invalid-input cases rejected before HTTP**. Scenarios include paging, terminal empty results, HTTP 503 HTML, HTTP 200 HTML, ArcGIS JSON error envelopes and malformed feature attributes. Simulation logs contain the dependency request events. Mocks use only retained successful source captures; error bodies are deliberate fault injection.

Verification logs and complete exploratory metadata are preserved outside the publishable tree in `/tmp/batch022-evidence`. The live script reproduces the retained per-layer checks and can write an independent report. It makes real upstream calls without retries. Do not rerun excluded failure probes without authorization.

## Final validation

- `bun run codegen`: passed; 52 generated files, 2 message catalogues. `bun scripts/codegen.ts --check`: passed. Generated files are ignored by the repository; APIS.md is tracked and changes only the six retained API rows and totals.
- Initial focused fixture/MCP route run: **439 passed**.
- Final `bun run test`: **62 files passed; 1,857 tests passed; 5 existing skips; 0 failures**. Includes central all-tool request/response/TTL coverage, dedicated service route listing/calling/error coverage and malformed-input rejection.
- `bun run lint`: passed, no errors.
- `bun run typecheck`: passed (`next typegen` and `tsc --noEmit`).
- Default `bun run build`: **environment-blocked**, not passed. First the shared dependency symlink was rejected; isolated local dependencies resolved that. Sandbox blocked font downloads, then Turbopack failed on its worker IPC bind (`Operation not permitted`) even after escalation. No source changes were made to bypass the build.
- `TURSO_DATABASE_URL=file:/tmp/batch022-build.db BILLING_ENABLED=false bun run build --webpack`: **passed**, including migrations against the temporary local SQLite database, codegen, optimized production compilation, TypeScript validation and prerendering. This is the documented Next.js alternate bundler already supported in the repository config; it does not establish a successful default Turbopack build.
- Postman simulation: **21 variants passed, 147 dependency request events**, plus 21 invalid-input calls rejected before HTTP; log request count independently matched the runner count.
- Live runtime: **21 variants passed, 152 real HTTP requests**; all 16 habitat sublayers and six retained permanent IDs covered.
- `git diff --check`: passed. Full tracked and untracked diff reviewed; 21 fixture files verified byte-for-byte against live captures. Final publishable scope: 45 files (5 modified + 40 new), including this evidence document. No task-added references to excluded IDs remain in services, cases, fixtures, simulation, live checks or generated registrations.
- Branch commits relative to fetched base: **0** (`git log origin/main..HEAD` empty). Original main checkout remains clean at dfc4a46. No commit, push, PR, board-state change or deployment.

**Terminal marker: PARTIAL.** Verified local adapters: API-1843, API-1852, API-1853, API-1854, API-1856, API-1858. Incomplete/unverified adapters excluded: API-1844, API-1845, API-1851, API-1857. No genuine source-wide API unavailability established; no remaining sandbox blocker for the retained live queries. Default Turbopack build remains environment-blocked. Independent RxCode verification explicitly returned TASK_RESULT: COMPLETE for the retained subset in thread 01a1623e-528c-71f2-8853-59a12aaf3d19 after assessing the authoritative task criteria. Each retained API and excluded-code cleanup passed; the original batch remains PARTIAL. Publication of only this subset is authorized by the hourly workflow. Repair counter: **1/3**, unchanged after final revalidation.

The cleaned complete patch is `/tmp/batch022-evidence/complete-publishable.patch`; logs, source metadata, exact exploratory field queries and the live runtime JSON report remain alongside it. The implementation and reusable successful fixture/simulation files remain in the owned worktree for review.
