# Finance batch 032: API-0561–API-0570

Implemented exactly the ten requested tracker entries as ten read-only MCP tools
in `censtatd-investment`. Base: freshly fetched `origin/main` at `b0a80f4`.
Worktree: `/private/tmp/mcprouter-finance032`; branch: `feat/finance-batch032`.
Primary checkout and unrelated work are unchanged. Implementation is uncommitted;
publication waits for orchestrator confirmation of successful RxCode verification
of the final changes. No commit, push, PR or merge has been performed.

## Verified upstream resources

Verified 2026-10-21 (Asia/Hong_Kong). All ten official DATA.GOV.HK pages list
XLSX, CSV and live JSON resources in English, Traditional Chinese and Simplified
Chinese. Each page's three JSON links was checked against the actual provider
endpoint. All 30 resources returned successful provider status, a localized
`header`, and a nonempty structured `dataSet`. No unavailable sources or file-only
fallbacks remain. No authentication is needed. Ten fixed table IDs share one HTTP
path (30 localized variants):

`GET https://www.censtatd.gov.hk/api/get.php?id=<table>&full_series=1&lang=<en|tc|sc>`

Orbit discovery returned no matching APIs. The official catalogue links and
actual responses establish this contract. Postman CLI 1.75.0 is signed out;
owner workspace/mock discovery was unavailable. The local mock therefore replays
compact observations captured from the official responses, without publishing or
changing workspace bindings.

| Tracker | Official dataset | MCP tool | Full rows per language | Frequency | Native dimensions |
| --- | --- | --- | ---: | --- | --- |
| API-0561 | [315-37006](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-315-37006) | `net_investment_flows_sector` | 2070 | Q/Y | BOP_COMPONENT |
| API-0562 | [315-37021](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-315-37021) | `international_investment_position` | 6624 | Q/Y | IIP_COMPONENT |
| API-0563 | [315-37022](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-315-37022) | `iip_gdp_ratios` | 552 | Q/Y | IIP_COMPONENT |
| API-0564 | [315-37023](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-315-37023) | `iip_currency_composition` | 3760 | Q/Y | IIP_COMPONENT, CURRENCY |
| API-0565 | [315-37031](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-315-37031) | `external_debt` | 5856 | Q/Y | ED_COMPONENT |
| API-0566 | [315-38001](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-315-38001) | `direct_investment_statistics` | 828 | Q/Y | DI_COMPONENT |
| API-0567 | [315-38011](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-315-38011) | `inward_direct_investment_countries` | 972 | Y | COUNTRY |
| API-0568 | [315-38012](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-315-38012) | `inward_direct_investment_activities` | 516 | Y | ACTIVITY |
| API-0569 | [315-38021](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-315-38021) | `outward_direct_investment_countries` | 972 | Y | COUNTRY |
| API-0570 | [315-38022](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-315-38022) | `outward_direct_investment_activities` | 516 | Y | ACTIVITY |

## Contract and statistical distinctions

- Fixed HTTPS provider URL and table IDs use the repository YAML HTTP transformer
  convention. Inputs cannot choose an arbitrary table or URL. Schemas validate
  table-specific frequency, indicator, component and measure enums, plus currency
  for table 315-37023. `componentType` identifies the original dimension;
  `component=TOTAL` selects the source's empty total code for country/activity.
- The independent currency filter accepts TOTAL, HKD, USD and OC; denomination
  does not change the reporting unit. Native codes and localized descriptions
  remain in each returned row. Filtering component and currency never merges rows.
- `measure=level` retains source units: HK$ million for tables 315-37006 through
  315-38001, HK$ billion for the four annual country/activity tables. Amounts are
  never rescaled. Table 315-37022 includes both IIP monetary amounts and IIP_R
  ratios; `measure=ratio` selects percent of GDP. Parser checks table/indicator
  unit consistency in all three languages.
- Direct investment positions, transaction flows and income use distinct
  `indicator` values. Table 315-38001 follows the asset/liability principle;
  country/activity breakdowns follow the directional principle. Their totals
  should not be equated. Positions can change because of valuation and other
  adjustments as well as flows. Countries describe the immediate source or
  recipient economy. Official notes are returned with each page.
- Totals overlap child components. Missing figures remain empty strings, negative
  values and `sd_value` flags are preserved. No invented observations or zero
  substitution. Figures and descriptions may contain source markup; returned as
  source text rather than rendered HTML.
- Four-digit `period` selects all observations in that year. Quarterly tables
  also accept YYYY03, YYYY06, YYYY09 and YYYY12; `freq` distinguishes Q and Y.
  The final four tables are annual only and reject quarterly input.
- Stable newest-period-first ordering. `limit` defaults to 50, maximum 100;
  `offset` defaults to 0, maximum 100000. Responses include table, localized title,
  language, componentType, notes, source, total, returned, hasMore, nextOffset and
  results. Empty matches and exhausted pages are explicit. Page with nextOffset
  and the same filters/language.
- Shared cache TTL 3600 seconds, separated by fixed table/language. Local filters
  and pagination reuse the upstream body. Shared fetch timeout is 15 seconds.
  Provider failures, invalid JSON, malformed observations, dimensions, unsupported
  codes and inconsistent units yield actionable errors. HTTP, network and timeout
  errors retain shared MCP error codes. Entire upstream responses are validated
  before local filtering and pagination.
- All ten tools have period-free scheduled live-check registrations. Exact stable
  API IDs and dataset IDs are registered, with unique ownership. `mcp/apis.yaml`
  is unchanged. APIS.md changes only these ten rows and the implementation count
  (108 to 118); generated definitions/registry/schema artifacts are gitignored
  by repository convention and regenerated by codegen.

## Validation

- `bun run codegen`: passed; 36 generated files and two translation catalogues.
- `bun scripts/codegen.ts --check`: passed, all 36 files current.
- `bun run test`: **1037 passed, 5 skipped; 48 test files passed**. Includes
  fixture-based tool/runtime and scoped MCP route calls/discovery, search,
  unique registrations, upstream HTTP/provider/JSON/network/timeout failures,
  malformed dimensions and units, input bounds, annual restrictions, multilingual
  units, currency/component combinations, amounts versus GDP ratios, separate
  positions/flows/income, missing/negative figures and flags, pagination and cache.
- `bun run build`: passed, including TypeScript and generation of 40 static
  pages. Initial attempts encountered an external node_modules symlink, sandboxed
  Google Fonts fetching and a cached CSS worker-port permission failure. Local
  dependency copies, a clean `.next` cache and host permissions resolved these;
  no application/config changes were required.
- `bun run typecheck`: passed, including a final run after the production build.
- `bun run lint`: passed.
- `bun run i18n:check`: passed, 766 strings current.
- `git diff --check`: passed.
- Final live generated-tool run: **30/30 passed**, all ten tables in all three
  languages, validating the full upstream body before returning one observation.
  Annual country/activity data ends in 2024; Q/Y tables end in 202606.
- Postman simulation: **60 HTTP checks passed per run**: 30 localized successes,
  10 HTTP 503, 10 invalid JSON and 10 provider failures. Ten malformed-input checks
  passed before HTTP. The final run traversed the real shared HTTP executor and
  transformer; 120 request events were observed across two successful runs in
  `/private/tmp/finance032-simulation.ndjson`. The server was stopped after checks. This is local
  fixture evidence, distinct from the separate live provider run.

Fixtures retain earliest/latest observations for each native dimension, currency,
frequency and statistical variable, plus every observed status flag. Header
record counts match the compact fixtures, rather than the full live tables.
Synthetic missing/negative/revision edge cases are explicitly labeled in tests.

Reproduce live and simulated validation:

```sh
bun --conditions=react-server scripts/check-finance032-live.ts
postman simulation run postman/simulations/finance032.sim.yaml --port 4905 --no-history --output ndjson
# In a second terminal:
bun --conditions=react-server scripts/check-finance032-simulation.ts
```

The local mock returns 501 outside its recorded contract. Only the check script's
in-memory service URL changes to loopback. No UI or Next.js application code was
changed; the installed route guide was read during inspection.

No implementation blockers remain. RxCode automatic verification of these final
changes is pending; these local results are not its verdict.
