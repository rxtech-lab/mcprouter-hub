# Finance batch 031: API-0551–API-0560

Implements exactly ten tracker entries as ten read-only tools in
`censtatd-external-accounts`. Fresh base: `origin/main` at `25bb51b`.
Worktree: `/private/tmp/mcprouter-finance031`; branch: `feat/finance-batch031`.
The primary checkout is untouched. No commit, push or PR is made by this turn;
RxCode automatic verification of the final changes is the next publication gate.

## Upstream verification

Verified 2026-10-21 (Asia/Hong_Kong). All ten official DATA.GOV.HK dataset pages
contain exact JSON links for `en`, `tc`, `sc`. All 30 resources returned successful
provider status and nonempty JSON `header` / `dataSet` responses. No source is
unavailable; no download/parser fallback is necessary. Ten table IDs share one
HTTP path, with 30 localized variants:

`GET https://www.censtatd.gov.hk/api/get.php?id=<table>&lang=<en|tc|sc>&full_series=1`

No authentication is required. Orbit discovery returned unrelated providers;
only the official catalogue links and downloaded responses inform this contract.
Postman CLI 1.75.0 is signed out, preventing an owner's published mock search.
The local simulation therefore reuses captured official responses; it does not
require publishing or a workspace binding.

| API ID | Official dataset | MCP tool | Full rows per language | Dimensions |
| --- | --- | --- | ---: | --- |
| API-0551 | [310-36202](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-310-36202) | `epif_income_components` | 3432 | INC_CPNT, FLOWS |
| API-0552 | [310-36203](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-310-36203) | `epif_countries` | 3807 | COUNTRY, FLOWS |
| API-0553 | [310-36204](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-310-36204) | `epif_real` | 429 | FLOWS |
| API-0554 | [310-36205](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-310-36205) | `gross_national_disposable_income` | 278 | none |
| API-0555 | [310-37011](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-310-37011) | `rest_of_world_account` | 756 | RWA_COMPONENT |
| API-0556 | [315-37001](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-315-37001) | `balance_of_payments` | 2070 | BOP_COMPONENT |
| API-0557 | [315-37002](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-315-37002) | `bop_gdp_ratios` | 1242 | BOP_COMPONENT |
| API-0558 | [315-37003](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-315-37003) | `bop_current_capital_account` | 8418 | BOP_COMPONENT |
| API-0559 | [315-37004](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-315-37004) | `bop_financial_account` | 10902 | BOP_COMPONENT |
| API-0560 | [315-37005](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-315-37005) | `current_account_seasonal_changes` | 1090 | BOP_COMPONENT |

## Contract

- Fixed table IDs and HTTPS base URL, existing YAML HTTP response-transformer
  convention, upstream timeout 15 seconds, shared cache TTL 3600 seconds.
  Cache keys separate tables and language; local filters/page requests reuse the
  cached complete response. No caller-supplied URL or table ID.
- Per-tool validated enums for frequency, indicator, component, measure and flow
  where available. `component` maps the named native dimension and `componentType`
  identifies it; `TOTAL` aliases an empty code or a dimensionless table. `flow`
  independently filters EPIFI (inflow), EPIFO (outflow), EPIFN (net flow).
  Original native codes and localized descriptions remain in every observation.
- `measure=level` means HK$ million; `yoy` means year-on-year percent change.
  `ratio` is percent of GDP, exclusively table 315-37002. `qoq` is seasonally
  adjusted quarter-to-quarter percent change, exclusively table 315-37005.
  Preserve source `svDesc`; percentages are not converted into currency or ratios.
- Four-digit year filters match all periods in that year; exact quarter codes end
  in 03, 06, 09, 12. Use `freq` for annual/quarterly distinction. Rest of world
  is annual only; seasonally adjusted changes are quarterly only; others Q/Y.
- Default page 50, maximum 100; offset 0–100000. Newest periods first, stable source
  order within a period. `total`, `returned`, `hasMore`, `nextOffset` support paging.
  Original figures, missing strings, negative values and revision flags are kept.
  Overlapping totals, flows and children must not be summed indiscriminately.
- Official title, notes, source and descriptions are localized upstream. Source
  descriptions may contain HTML and are returned as text. All observations are
  checked before filtering/paging: failed provider status, malformed rows,
  unknown indicators/units/components/flows/frequencies yield actionable MCP
  errors. HTTP, JSON, network and timeout failures use the shared fetcher errors.
- All ten tools have period-free scheduled live checks. Permanent tracker and
  dataset IDs are unchanged. APIS.md changes only these ten statuses, increasing
  implementation coverage from 98 to 108. Generated files remain gitignored.
  No UI or Next.js application code changed.

## Reproduce

```sh
bun run codegen
bun scripts/codegen.ts --check
bun run test
bun run lint
bun run i18n:check
bun run build
bun run typecheck
bun --conditions=react-server scripts/check-finance031-live.ts

# Separate terminals:
postman simulation run postman/simulations/finance031.sim.yaml --port 4904 --no-history --output ndjson
bun --conditions=react-server scripts/check-finance031-simulation.ts
```

The simulation overrides the service URL in memory only, leaving production
URLs fixed. Unknown requests get 501. Fixtures and provenance are in
`tests/fixtures/finance031/README.md`.

## Validation

- Codegen: passed, 35 files and two message catalogues; freshness check passed.
- Full Vitest suite: **934 passed, 5 skipped, all 47 files passed**. Includes
  exact ten-ID/dataset ownership, all ten scoped MCP discovery/call/input errors,
  generated HTTP/cache contracts, upstream route errors, all localized fixture
  observations, pagination, language cache separation, combined flow/country
  filtering, ratio/quarterly-change semantics, malformed rows and inputs,
  provider/HTTP/JSON/network/timeout errors and scheduled-check coverage.
- Repository ESLint: passed. Translation check: 766 strings current.
- Live generated tools: **30/30 passed**, validating every observation in the
  full responses before returning one. Latest period 202606, except annual
  rest of world account 2025.
- Postman simulation: **60 HTTP requests per run**, confirmed in NDJSON (two successful runs, 120 total): 30 localized
  successes, 10 HTTP 503 errors, 10 invalid JSON bodies, 10 provider failures.
  All assertions and ten invalid-input checks passed. Simulation log:
  `/private/tmp/finance031-sim.ndjson` (not committed). The local server was stopped.
- Production build: passed, including TypeScript and generation of 40 static
  pages. Typecheck passed separately after build. Initial sandboxed font fetch
  and cached worker-port permission failures required a clean `.next` cache and
  host permissions; no application changes were needed.
- `git diff --check`: passed. No implementation blockers remain. RxCode automatic
  verification on these final changes is pending; local validation is not that
  verdict. No commit, push, PR, merge or completion-column change has occurred.
