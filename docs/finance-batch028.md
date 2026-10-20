# MCP Finance batch 028

Verified on 2026-10-21 (Hong Kong time). Implements exactly API-0521 through
API-0530 in `censtatd-gdp`. Stable tracker IDs and `mcp/apis.yaml` are unchanged.
No sources are unavailable and there are no implementation blockers.

## Verified official resources

All ten DATA.GOV.HK pages below advertise XLSX, CSV and JSON resources in
English, Traditional Chinese and Simplified Chinese. The JSON links resolve to
one live C&SD HTTP path with ten fixed table IDs (30 table/language variants):

`GET https://www.censtatd.gov.hk/api/get.php?id=<table>&lang=<en|tc|sc>&full_series=1`

No authentication is needed. All 30 JSON requests returned a successful provider
status and a structured `header`/`dataSet` response. The generated tools also
completed 30 live calls through the shared HTTP fetcher and response transformer,
validating every observation before returning a bounded page. The counts below
are full upstream observation counts, not fixture sizes or endpoint counts.

| Stable ID | Official dataset page / table | MCP tool | Observations | Frequency |
| --- | --- | --- | ---: | --- |
| API-0521 | [310-30001](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-310-30001) | `gdp_real_growth` | 2,511 | Q/Y |
| API-0522 | [310-31001](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-310-31001) | `gdp_and_per_capita` | 3,069 | Q/Y |
| API-0523 | [310-31002](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-310-31002) | `gdp_expenditure_current` | 6,975 | Q/Y |
| API-0524 | [310-31003](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-310-31003) | `gdp_expenditure_chained` | 6,975 | Q/Y |
| API-0525 | [310-31004](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-310-31004) | `gdp_growth_contributions` | 1,728 | Q/Y |
| API-0526 | [310-31005](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-310-31005) | `gdp_implicit_deflators` | 5,580 | Q/Y |
| API-0527 | [310-31006](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-310-31006) | `gdp_expenditure_ratios` | 520 | Y |
| API-0528 | [310-31007](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-310-31007) | `gdp_seasonally_adjusted` | 2,336 | Q |
| API-0529 | [310-31011](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-310-31011) | `pce_components_current` | 4,932 | Q/Y |
| API-0530 | [310-31012](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-310-31012) | `pce_components_chained` | 4,932 | Q/Y |

Each registered dataset ID is `hk-censtatd-tablechart-<table>`. The catalogue also
links the [C&SD data dictionary](https://www.censtatd.gov.hk/datagovhk/WT_data_dict_en.pdf).
File adapters are unnecessary because all ten sources have working JSON APIs.
XLSX/CSV alternatives were identified in the catalogue; these tools use JSON.
Orbit discovery returned unrelated providers rather than a matching C&SD
contract, so implementation uses the verified official catalogue links and
actual responses. The Postman CLI is signed out; searching an owner's published
mock was skipped. The local simulation replays official response fixtures.

## Tool contract

- Uses the existing YAML HTTP path and shared response transformer convention.
  Inputs cannot supply an arbitrary URL, table ID, field name or query expression.
- Validates `freq`, `indicator`, `component` and `measure` against table-specific
  enums. Language is `en` (default), `tc` or `sc`, sent to the upstream API.
- `period` accepts a four-digit year or a six-digit quarter ending in `03`,
  `06`, `09` or `12`. A year includes its annual and quarterly observations;
  set `freq` to select one. The ratios table accepts only annual periods;
  the seasonally adjusted table accepts only quarterly frequency.
- `indicator` retains the upstream `sv` code. `svDesc` is the unit/measure label,
  not an indicator description. The same indicator may have both a level and
  growth rate: `measure` distinguishes `level`, `yoy`, `qoq`, `contribution`
  (percentage points) and `ratio` (percent of GDP), using labels verified in all
  three languages. Only the applicable measure values are offered per tool.
- `component=TOTAL` selects total GDP. The source represents total GDP with
  either an empty `GDP_COMPONENT` or an omitted field (including the headline
  seasonally adjusted growth series); both map to TOTAL. Original fields remain.
- Results sort by period descending, preserving source order within a period.
  `limit` defaults to 50, maximum 100. `offset` defaults to 0, maximum 100000.
  Response fields are `table`, localized `title`, `language`, `notes`, `source`,
  `total`, `returned`, `hasMore`, `nextOffset` and `results`.
  Continue with `nextOffset` using the same filters/language. Counts refer to
  observations, not years. An empty match returns an explicit empty page.
- Retains original numeric figures, negative/zero values, empty unavailable
  figures, `sd_value` revision/missing flags, units and component descriptions.
  Annual qoq placeholders remain unavailable; use quarterly frequency for qoq
  observations. Chained-dollar components need not add to GDP; table notes
  explain revisions and methodology. No financial advice or aggregation is added.
- Shared raw-response cache TTL is one hour, keyed by table and language;
  local filtering and paging reuse the same upstream body. Shared fetch timeout
  is 15 seconds. HTTP/network/timeout/JSON errors propagate as MCP tool errors;
  provider failure statuses and malformed observations raise actionable parse
  errors rather than returning an apparently empty successful dataset.
- Ten entries were added to the scheduled live-check registry with period-free
  inputs and assertions that the results page is nonempty.

## Verification

- `bun run codegen`: passed; generated registry, service definitions, schemas and
  API implementation status refreshed; APIS.md changes exactly these ten rows
  and the implementation total from 68 to 78. Generated TypeScript is gitignored
  by repository convention and must be regenerated after checkout.
- `bun scripts/codegen.ts --check`: passed (32 generated files).
- `bun run test`: 660 passed, 5 skipped, 44 test files passed. Existing skipped
  tests remain skipped. Includes all-tool coverage, 30 localized fixtures,
  malformed input/body cases, HTTP/provider errors, caching, pagination, search,
  stable ID ownership, scoped MCP discovery/calls and scheduled live-check coverage.
- `bun run typecheck`: passed (Next route type generation and TypeScript).
- ESLint on all changed/new JavaScript and TypeScript files: passed.
- `git diff --check`: passed.
- Live generated tools: 30/30 calls passed (10 tables x 3 languages), with
  full-table row validation and newest-period results (202606; ratios: 2025).
- Postman simulation: 60 real HTTP requests observed in the simulation log:
  30 localized successes, 10 HTTP 503 errors, 10 malformed JSON responses and
  10 provider-level failures. All assertions passed; ten invalid-input checks
  also passed before HTTP. Simulation stopped after validation.

The broad test run initially exposed a missing live-check registration and an
old search assertion that assumed the catalogue contained no price-related
services. Added the registrations and changed that unrelated-query assertion to
`quantum entanglement`; no search ranking behavior changed.

To repeat the local HTTP simulation (no login or deployment needed):

```sh
postman simulation run postman/simulations/finance028.sim.yaml --port 4901 --no-history --output ndjson
# In another terminal:
bun --conditions=react-server scripts/check-finance028-simulation.ts
```

The mock returns 501 for paths/parameters outside the recorded GDP contract.
The check script changes only its in-memory service base URL to loopback;
production endpoints are unchanged. Nothing was committed, deployed or published.
