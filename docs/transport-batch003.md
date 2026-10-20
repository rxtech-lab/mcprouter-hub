# MCP transport batch 003

Verified on 2026-10-20. Scope is the ten stable API IDs below. `mcp/apis.yaml`
is unchanged. Six entries gain support, two already had working implementations,
and two remain blocked. Seven tools are new; three existing tools are reused.

| Stable ID | Dataset IDs | Result / tools |
| --- | --- | --- |
| API-1237 | hk-cad-cadpsi1-paragliding-area-location-data | `cad_paragliding_areas` |
| API-1264 | hk-cedd-csu-public-piers | `cedd_public_piers` |
| API-1294 | clp-team1-electric-vehicle-charging-stations | Blocked: both published CLP URLs return HTTP 403 from this environment |
| API-1427 | hk-customs-ced_stat-vehicle-clearance | Reuse `border_vehicle_throughput`; strengthen malformed-file validation |
| API-0029 | hk-devb-sps-sps | Reuse `ke_carparks` and `ke_parking_vacancy` |
| API-1541 | hk-dpo-datagovhk1-transport-bus-route-list-and-eta-spcific-bus-stop | `dpo_bus_stop_routes`, `dpo_bus_stop_eta` |
| API-1825 | hk-epd-evcpateam-evc-1 | `epd_public_ev_chargers` |
| API-0022 | ff-fortune-schedule2, ff-watertaxi-schedule2 | Blocked: published API and specification return Cloudflare HTTP 403 from this environment |
| API-1969 | hk-gpa-msd-gpa-psi-t-cp | `gpa_public_carparks` |
| API-1984 | hk-hyd-csdi-barrier-fence | `hyd_barrier_fences` |

## Verified upstream resources

Each dataset's official source is `https://data.gov.hk/en-data/dataset/<dataset-id>`.
Catalogue resources were inspected for all eleven dataset IDs (the ferry entry
has two). Official CSDI metadata resolves the spatial entries to real query
services, not invented endpoints:

| Entry | Official CSDI dataset ID | Verified layer / format |
| --- | --- | --- |
| CAD | cad_rcd_1697012233561_39672 | 0, geotagging, point |
| CEDD | cedd_rcd_1696844622988_9055 | 0, PMIS_point, point |
| EPD | epd_rcd_1631080339740_69941 | 0, geotagging, point |
| Highways | hyd_rcd_1632210391486_52565 | 0, BARRIER_FENCE, polyline |

Metadata: `https://portal.csdi.gov.hk/geoportal/rest/metadata/item/<csdi-dataset-id>`.
Query: `https://portal.csdi.gov.hk/server/rest/services/common/<csdi-dataset-id>/FeatureServer/0/query`.
Metadata also advertises WFS/WMS and a GeoJSON file download. These tools use
the verified ArcGIS JSON query endpoint with server-side filtering and paging.
Only the four fixed datasets/layers are accessible; callers cannot supply SQL,
URLs or field names.

- CAD returns reference locations, operating altitude and boundary coordinates
  in attributes, plus the current eAIP guidance link. Its point is not an area
  polygon or a flight permission.
- CEDD publishes structure codes and locations; this layer has no pier names.
- EPD publishes multilingual locations/addresses/districts and installed charger
  counts by speed/connector. These are not real-time available spaces.
- Highways publishes `BF_UID`, `LVL`, source length and fence polylines.
- Spatial tools support a WGS84 bounding box, OBJECTID, text/code search,
  geometry inclusion, limit and offset. Names are selected in en/tc/sc where
  published; all original non-null attributes are retained. CEDD/Highways
  have no translated names. Results are at most 100 records and 100 KB of
  serialized records. Geometry above 20,000 characters is explicitly omitted,
  never returned as a partial line. `nextOffset` continues the same query.
  Cache TTL is one day. Search permits LIKE wildcards, escapes apostrophes,
  and searches only fixed fields. HTTP-200 ArcGIS errors are surfaced as errors.

Other verified resources:

- **Customs:** the catalogue advertises XLSX and CSV. The English CSV at
  `https://www.customs.gov.hk/filemanager/common/csv/statistics/passenger_land_en.csv`
  works, but its advertised `_tc` and `_sc` variants return HTTP 404. The
  **existing service's** official `/hcms/filemanager/common/csv/statistics/passenger_land_{en,tc,sc}.csv`
  URLs work in all three languages, so they are retained. Records contain both
  quarterly and annual totals, measured in thousands; source quarter `-` maps
  to null. Existing year/quarter/control-point filters and one-day cache are
  retained. Do not add aggregate and component rows together.
- **Kowloon East:** verified the existing JSON calls at
  `https://sps-opendata.pilotsmartke.gov.hk/rest/getCarparkInfos?fullload=true&lang=en_US`
  and `/getCarparkVacancies`. Existing tools join capacity/name records to
  vacancies, retain each record's reporting timestamp, support en/tc (sc falls
  back to tc), and bound list output. No duplicate service or API declaration.
- **DPO:** verified `https://rt.data.gov.hk/v1.1/transport/batch/stop-route/CTB/001001?lang=en`
  and `https://rt.data.gov.hk/v1/transport/batch/stop-eta/NLB/1?lang=en`.
  Contract: [official v1.3 specification](https://static.data.gov.hk/opendata/eta/bus-route-list-and-eta-specific-stop-api-specifications.pdf).
  CTB IDs require six digits; NLB IDs are numeric. Languages map to en,
  zh-hant and zh-hans. Generated timestamps and empty/null predictions are
  retained. Paging is local over cached batches, with at most 200 records and
  100 KB of records per response; cache TTLs are 3600 seconds for routes and
  30 seconds for ETA. Limit/offset are never sent to the provider.
- **GPA:** verified `https://www.gpa.gov.hk/doc/psi/ds/psi-t-cp_{ENG,TC,SC}.csv`.
  The advertised ENG JSON responds with invalid literal control characters.
  The tool therefore parses official CSV downloads, including BOM, quoted
  multiline fields, literal newline escapes and trailing blank columns.
  Normalized keys retain source values as text, including mixed vehicle counts
  and unavailable markers. Search runs over name/district/address/vehicle type;
  pagination is bounded to 100 records and 100 KB, cached for one day. Language
  files differ in freshness/order, so they are not joined by row position.

## Unavailable resources

- **CLP API-1294:** the [official catalogue](https://data.gov.hk/en-data/dataset/clp-team1-electric-vehicle-charging-stations)
  announces migration from `https://api.clp.com.hk/evcharger/list` to
  `https://api.clp.com.hk/transDist/mgmtEVChargeInfra/v1/getEVChargerList`
  on 2026-08-15, with the old URL retiring on 2027-01-01. Both GETs returned
  Akamai Access Denied, HTTP 403. No working response contract was verified.
- **Fortune Ferry / Water Taxi API-0022:** both
  [Fortune Ferry](https://data.gov.hk/en-data/dataset/ff-fortune-schedule2) and
  [Water Taxi](https://data.gov.hk/en-data/dataset/ff-watertaxi-schedule2)
  advertise `https://www.hongkongwatertaxi.com.hk/eta/?route={route_code}` and
  `https://www.hongkongwatertaxi.com.hk/csv/Watertaxi_FortuneFerry_ETA_API_Specification_and_Data_Dictionary.pdf`.
  The specification and a probe of the ETA endpoint returned Cloudflare HTTP
  403. The route contract and payload could not be verified.

These results describe access from this environment, not permanent global
outages. Their API/dataset IDs are deliberately not declared in any service;
the tracker still reports them as coming soon. Completion requires access to
working official responses, route documentation for the ferry feeds, and live
validation before registration. No guessed API or fake data is exposed.

## Reproducible verification

Fixtures in `tests/fixtures/transport003/` were captured from the sources above
on 2026-10-20, trimmed to two records (one for the annual-total fixture).
Spatial field-definition metadata was removed; the response envelope,
attributes, geometry and transfer-limit flag are unchanged. Bus fixture
timestamps and empty ETA values are retained. They are historical test inputs,
not live predictions.

The installed Postman CLI was 1.75.0. Orbit search returned unrelated APIs and
provided no usable Hong Kong contract; official provider resources were used.
The Postman CLI was signed out, so owner-workspace mock discovery was unavailable.
Local mocks use the captured official fixtures; no workspace was created or
published. To start the retained local mock server:

```sh
postman simulation run postman/simulations/transport003.sim.yaml --port 4903 --output ndjson --no-history
```

During implementation, a temporary harness exercised eight tools over real HTTP,
each against a fixture, HTTP 503 HTML, and malformed HTTP-200 HTML. All **24
checks passed**, and all **24 requests** appeared in the simulation log. That
harness has since been removed; these results record the earlier run. Stop the
mock server with Ctrl-C (or SIGINT to its CLI).

Live verification:

```sh
bun run live-check --only cad-paragliding,cedd-piers,epd-ev-chargers,hyd-barrier-fence,gpa-carparks,dpo-bus-stop,kowloon-east-parking,border_vehicle_throughput --no-apps
```

**10/10 live tool checks passed** after retaining the existing multilingual
Customs implementation. This includes seven new tools, the existing Customs
tool, and both existing Kowloon East tools. CLP/Fortune Ferry are excluded
because they remain unregistered and blocked. MCP Apps/browser rendering was
not exercised; this batch adds no UI.

Codegen refreshes APIS.md and 32 generated files; `/generated` is intentionally
gitignored by the repository. The tracker moves from 62 to **68 of 3819**
implemented. Final validation:

- `bun run lint`: passed.
- `bun run typecheck`: passed (Next route type generation and TypeScript).
- `bun run test`: **554/554 tests passed across 34 files**. Coverage includes
  every new tool, fixed request URLs, cache TTLs, malformed input and responses,
  bounding boxes, escaping, language selection, pagination, output bounds,
  annual statistics, scoped MCP route discovery/calls and search ranking.
- `bun scripts/codegen.ts --check`: passed, **32 files up to date**.
- `git diff --check`: passed.
- Local simulation stopped cleanly; its summary reports **16 served + 8 failed
  requests**, matching the 24 expected success/malformed/HTTP-error cases.

The test runner emits an existing Vite config-loader compatibility notice.
No production build, browser/App rendering, commit or publication was performed.
