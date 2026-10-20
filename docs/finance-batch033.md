# Finance batch 033 — API-0571, API-0572, API-0596–API-0603

Task: `0EC076BA-0FB6-4797-BD62-598C50EC9C77`.

Worktree: `/private/tmp/mcprouter-finance033`; branch: `feat/finance-batch033`.
Based on freshly fetched `origin/main` at `3eadec3fa4c67ca1346d63725e3d47adca83b500`.
The primary checkout and unrelated work are unchanged. Exactly the ten requested
stable IDs and their matching datasets are registered in `censtatd-financial-markets`.

## Upstream verification

Verified on 2026-10-21 (Hong Kong time). All ten official DATA.GOV.HK pages list
English, Traditional Chinese and Simplified Chinese JSON resources. All 30
resources returned structured `header` / `dataSet` JSON and a successful provider
status. None was unavailable or file-only; no download/parser adapter was needed.
The resources share one unauthenticated HTTP path, with ten fixed table IDs:

`GET https://www.censtatd.gov.hk/api/get.php?id=<table>&full_series=1&lang=<en|tc|sc>`

| Tracker | Official dataset/table | MCP tool | Full rows | Frequencies | Latest period |
| --- | --- | --- | ---: | --- | --- |
| API-0571 | [315-38031](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-315-38031) | `mainland_outward_di_regions` | 162 | Y | 2024 |
| API-0572 | [315-38032](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-315-38032) | `mainland_outward_di_activities` | 432 | Y | 2024 |
| API-0596 | [340-45001](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-340-45001) | `currency_in_circulation` | 1,734 | Q/Y | 202606 |
| API-0597 | [340-45011](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-340-45011) | `money_supply_all_currencies` | 861 | Q/Y | 202606 |
| API-0598 | [340-45012](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-340-45012) | `money_supply_currency` | 2,336 | Q/Y | 202606 |
| API-0599 | [340-45021](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-340-45021) | `hkd_interest_rates` | 4,102 | M/Y | 202609 |
| API-0600 | [340-45022](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-340-45022) | `hkd_interest_settlement_rates` | 755 | Q/Y | 202609 |
| API-0601 | [340-46001](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-340-46001) | `exchange_rates` | 10,280 | M/Y | 202609 |
| API-0602 | [340-46002](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-340-46002) | `hkd_effective_exchange_indices` | 2,016 | M/Y | 202609 |
| API-0603 | [340-47001](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-340-47001) | `government_revenue_expenditure` | 192 | Y | 2025 |

Orbit discovery returned unrelated US Census endpoints; implementation uses the
official Hong Kong resource links and verified responses. The Postman CLI has no
signed-in account, so owner mock discovery was unavailable. The local simulation
uses compact captures from the official responses, without publication or login.

## Tool behavior

- Fixed upstream table IDs, validated enums for frequency, indicator, component,
  measure and language. No caller-supplied URLs or upstream query fragments.
- `period` accepts the provider year or exact YYYYMM period where supported.
  Quarter codes end in 03/06/09/12; month codes range from 01 to 12. A year
  matches all observations in that year; `freq` selects annual/quarterly/monthly.
- Components retain source codes and localized labels. Numeric issuer/currency
  codes remain numeric in the source row and have string aliases for filtering.
  `TOTAL` represents an explicit empty source dimension code; `NONE` represents
  an indicator with no component dimension. The latter occurs in circulation
  and lending/savings rates, and throughout tables without components.
- Mainland activity observations retain both COUNTRY=CN and ACTIVITY. Investment
  position and outward flows remain separate indicators. Monetary amounts remain
  HK$ billion or HK$ million, with no rescaling. Measures distinguish amounts,
  year-on-year percentage changes, interest rates, exchange rates and indices.
- Interest rates retain percent-per-annum units; 340-45021 describes period
  averages and 340-45022 describes period-end settlement rates. Exchange rates
  retain HK dollars per unit of foreign currency. Effective exchange rate indices
  retain the January 2020 = 100 base. Government account observations retain
  provider year codes and the note that the financial year runs April–March.
- Original figures, empty missing values, revision/status flags, title, source,
  notes and all source dimensions are preserved. Notes are source text and may
  contain markup. Parent totals overlap children and should not be added together.
- Newest observations first, stable source order within a period. `limit` defaults
  to 50 and is capped at 100; `offset` is bounded to 0–100000. Responses include
  total/returned/hasMore/nextOffset; use identical filters and language on later
  pages. Empty matches and exhausted offsets return explicit empty pages.
- The shared HTTP runtime caches full responses for 3600 seconds per table and
  language; filtering and paging reuse that response. The existing timeout is
  15 seconds. Network, timeout, HTTP, JSON, provider-status and malformed-row
  errors become MCP errors. Every observation is validated before paging, so a
  bad row beyond the first page cannot be silently hidden. Provider parse errors
  direct callers to retry or check the official web table.
- Each tool has a period-free scheduled live-check registration. No UI or Next.js
  application implementation was changed.

## Validation

- `bun run codegen`: passed. APIS.md increases from 118 to 128 implemented;
  only the ten requested entries and count change. `mcp/apis.yaml` is unchanged.
  Registry, schemas and definitions were regenerated; generated TypeScript is
  gitignored by repository convention.
- `bun scripts/codegen.ts --check`: passed, 37 files current.
- `bun run test`: **1155 passed, 5 skipped; 49 test files passed**.
  Coverage includes all ten tools' HTTP requests/TTL, unique ID/dataset ownership,
  scoped MCP discovery and calls, malformed route inputs, upstream route errors,
  three languages, full pagination, unit distinctions, monthly/quarterly/year
  validation, numeric/absent/total components, provider failures, malformed rows
  beyond the first page, negative flows, missing values and discovery search.
- `bun run typecheck`: passed, including Next route type generation.
- `bun run lint`: passed with no warnings.
- `bun run i18n:check`: passed, 766 strings current.
- `git diff --check`: passed.
- Production build: migrations passed against an isolated local database.
  `TURSO_DATABASE_URL=file:/private/tmp/finance033-build.db BILLING_ENABLED=false bunx next build --webpack`
  passed compilation, TypeScript, all 40 static pages and build traces.
  The default `bun run build` Turbopack path remains environment-blocked: its
  CSS loader worker could not bind a port (`Operation not permitted`), including
  an escalated retry. The supported Webpack fallback passed without source or
  configuration changes. Initial sandbox attempts also lacked access to Google
  Fonts; the escalated Webpack build fetched the existing fonts successfully.
- `bun --conditions=react-server scripts/check-finance033-live.ts`:
  **30/30 generated-tool live calls passed**, all ten tables in all three
  languages; full upstream bodies validated before returning a one-row page.
- Postman local simulation: **60 real HTTP requests observed in its NDJSON log**:
  30 localized successes, ten HTTP 503 responses, ten invalid JSON responses and
  ten failed provider statuses. All assertions passed, plus ten malformed-input
  checks before HTTP. Simulation stopped after validation.

Fixtures preserve the earliest/latest observations for every indicator,
frequency, dimension and unit combination, plus each observed status flag.
Header record counts reflect fixture size rather than the full live table.
Local dependencies are copied into this worktree because Turbopack cannot resolve
an external node_modules symlink as a hermetic workspace dependency.

Reproduce live checks:

```sh
bun --conditions=react-server scripts/check-finance033-live.ts
```

Reproduce the local Postman simulation (no publication or login required):

```sh
postman simulation run postman/simulations/finance033.sim.yaml --port 4906 --no-history --output ndjson
# In another terminal:
bun --conditions=react-server scripts/check-finance033-simulation.ts
```

The mock returns 501 for calls outside its recorded contract. Only the check
script's in-memory service base URL points to loopback; production URLs remain
fixed. No commits, push, PR, deployment, board transition or notification was
performed. Final publication is deferred until the orchestrator explicitly
confirms successful RxCode verification of these final changes.
