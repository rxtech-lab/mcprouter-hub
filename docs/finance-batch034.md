# Finance batch 034 — API-0604–API-0613

Task: `3C85D673-EE59-4B1C-8CB1-FF102B110CBC`.

Worktree: `/private/tmp/mcprouter-finance034`; branch: `feat/finance-batch034`.
Based on freshly fetched `origin/main` at
`9e9666629022cb8ad99f6539b81bcc80de16c04e`. The primary checkout is unchanged.
Exactly the ten requested stable tracker IDs and their matching dataset IDs are
registered under `censtatd-government-markets`. Permanent `mcp/apis.yaml` IDs
and unrelated service definitions remain unchanged.

## Upstream verification

Verified on 2026-10-21 (Hong Kong time): all ten official DATA.GOV.HK pages
list English, Traditional Chinese and Simplified Chinese JSON resources. All
30 resource responses returned a successful provider status and structured
`header` / `dataSet` JSON. None was unavailable or file-only; no adapter or
invented API was needed. Authentication is not required. These dataset units
share one HTTP path, with ten fixed table IDs and 30 table/language variants:

`GET https://www.censtatd.gov.hk/api/get.php?id=<table>&full_series=1&lang=<en|tc|sc>`

| Tracker | Official dataset/table | MCP tool | Full rows | Frequencies | Latest period |
| --- | --- | --- | ---: | --- | --- |
| API-0604 | [340-47002](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-340-47002) | `government_quarterly_revenue_expenditure` | 232 | Q | 202606 |
| API-0605 | [340-47011](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-340-47011) | `government_revenue_funds` | 1,476 | Y | 2024 |
| API-0606 | [340-47012](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-340-47012) | `government_expenditure_funds` | 720 | Y | 2024 |
| API-0607 | [340-92002](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-340-92002) | `silver_trading_prices` | 192 | M/Y | 202609 |
| API-0608 | [340-95001](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-340-95001) | `interbank_market` | 164 | Q/Y | 202606 |
| API-0609 | [340-95002](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-340-95002) | `exchange_fund_bills_notes_turnover` | 82 | Q/Y | 202606 |
| API-0610 | [340-95003](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-340-95003) | `hkex_securities_statistics` | 2,788 | Q/Y | 202606 |
| API-0611 | [340-95004](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-340-95004) | `hkex_derivatives_volume` | 82 | Q/Y | 202606 |
| API-0612 | [340-95005](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-340-95005) | `stock_connect_trading_values` | 708 | Q/Y | 202606 |
| API-0613 | [340-95006](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-340-95006) | `gold_exchange_turnover` | 164 | Q/Y | 202606 |

Orbit discovery returned unrelated CSDI land/maritime endpoints; the implementation
uses the official Hong Kong dataset resource links and verified live contracts.
The Postman CLI is 1.75.0 with no signed-in account, so owner mock discovery was
unavailable. Local HTTP simulation replays compact official response captures;
it requires no login or publication. Python's local certificate store failed
verification during discovery; curl's working system certificate trust was used
without disabling TLS validation.

## Tool contract

The new service follows Finance 033's YAML HTTP transformer, contract and handler
conventions. Fixed table IDs prevent arbitrary URL/query injection. Input schemas
validate table-specific frequency, period, indicator, component, measure, language
and pagination bounds before HTTP. All tools are read-only.

- `lang` is `en` by default, or `tc`/`sc`, forwarded to C&SD for localized titles,
  labels, units, source and notes. Source text may contain markup; it is returned
  as text without rendering HTML.
- `period` accepts a four-digit provider year, or exact YYYYMM where supported.
  Quarter periods end in 03/06/09/12; monthly periods end in 01–12. A year matches
  all observations in that year; combine with `freq` to select a frequency.
  Revenue/expenditure including funds retains financial-year provider codes
  and the official April–March note. Quarterly accounts retain quarter codes.
- Indicator/component filtering preserves source codes. `TOTAL` aliases the
  explicit empty source dimension code; `NONE` identifies tables without a
  component dimension. Native numeric codes stay numeric in original rows,
  with string aliases for filtering. Parent totals overlap children and must
  not be summed together. Indicator-specific component sets are validated.
- `amount_million`/`amount_billion` mean HK$ million/billion; `rmb_billion` means
  RMB billion; `usd_million` means US$ million. No currency conversion or scaling.
  Stock Connect SSE/SZSE buy/sell and their daily averages are HK$ billion;
  turnover and average daily turnover are RMB billion. Gold ADT_CGSE retains
  HK$ million and ADT_LLG retains US$ million.
- `interest_rate` is the period-average three-month interbank rate in percent
  per annum; interbank average daily trading is separately HK$ billion.
  `silver_hkd_10oz` retains HK$ per ten ounces. HKEX `count` retains company/new
  issue counts, `contracts` retains derivatives contract volume, market
  capitalisation is HK$ billion and turnover/fundraising is HK$ million.
  Units are checked against the indicator contract in all three languages.
- Original figure, unit, revision/status flags and all dimensions are retained.
  Missing figures remain empty strings, never zero; flags include `-`, `[#7]`,
  `[-§25]` and `r`. Unexpected figure text or malformed observations fail with
  an actionable upstream parse error. Every row is validated before paging,
  including malformed rows beyond the first returned page.
- Results sort newest first, preserving source order within a period. `limit`
  defaults to 50 and is capped at 100; `offset` is bounded to 0–100000. The page
  includes table/title/language/componentType/notes/source, total, returned,
  hasMore, nextOffset and results. Continue using the same filters and language.
  Empty matches and exhausted offsets return explicit empty pages.
- Shared runtime caches the full response for 3600 seconds per table and
  language, so local filtering/paging reuses it. HTTP timeout is 15 seconds.
  Network, timeout, HTTP, JSON, provider-status, malformed-period, dimension,
  figure and unit failures are mapped to MCP errors. Provider parse errors
  direct callers to retry or check the official web table.
- Each tool has a period-free scheduled live-check registration. No UI or
  Next.js application code changed; installed Next CLI documentation was read
  before build validation.

## Validation

- `bun run codegen`: passed; registry, service definitions, schemas and tracker
  artifacts regenerated. APIS.md increases from 128 to 138 implemented and
  changes only the ten requested entries and totals. Generated TypeScript is
  gitignored by repository convention. `mcp/apis.yaml` is unchanged.
- `bun scripts/codegen.ts --check`: passed, **38 files current**.
- `bun run test`: **1282 passed, 5 skipped; 50 test files passed**.
  Includes all ten tools' HTTP request and 3600-second TTL checks, unique API
  and dataset ownership, scoped MCP discovery and calls, malformed route inputs,
  upstream route errors, table search, localized units/observations, pagination,
  yearly/quarterly/monthly validation, indicator/component relationships,
  currencies, counts, contract volume, missing values and source flags.
- Final strengthened Finance 034 assertions: `bun run test tests/finance034.test.ts`
  passed **106/106**. Every returned source column is compared to its fixture.
  Fixtures cover all supported measures, all languages and each status flag.
- `bun run typecheck`: passed after production build, including Next route type
  generation and TypeScript.
- `bun run lint`: passed, no warnings.
- `bun run i18n:check`: passed, **766 strings current**.
- `git diff --check`: passed. Primary checkout remains clean at
  `9ebcef32b15af21dedeb96e0f3e0c35da75c85d4`.
- Production migrations: passed against isolated
  `file:/private/tmp/finance034-build.db` with billing disabled.
- Production build: the default `bun run build` initially could not fetch the
  existing Google Fonts under the sandbox. An escalated retry passed that
  network boundary but Turbopack's CSS worker failed to bind a port with
  `Operation not permitted`. The installed CLI's supported Webpack fallback
  passed without source/configuration changes:
  `TURSO_DATABASE_URL=file:/private/tmp/finance034-build.db BILLING_ENABLED=false bunx next build --webpack`.
  Compilation, TypeScript, all **40 static pages**, and build traces passed.
  The default Turbopack build remains environment-blocked.
- Final generated-tool live checks:
  `bun --conditions=react-server scripts/check-finance034-live.ts` passed
  **30/30** calls against real official resources. All full response rows were
  validated in all three languages before returning one-row pages. Row counts
  and latest periods are recorded above.
- Final local Postman simulation:
  `bun --conditions=react-server scripts/check-finance034-simulation.ts` passed
  **60 real HTTP calls**: 30 localized successes, ten HTTP 503 responses, ten
  invalid JSON responses and ten failed provider statuses, plus **10 malformed
  input checks** rejected before HTTP. It ran twice, including after final
  parser validation tightened: **120 requests** are recorded in
  `/private/tmp/finance034-simulation.ndjson` (100 HTTP 200 and 20 HTTP 503).
  The 200s include intentional invalid JSON/provider-failure payloads, so the
  assertion results, not status codes alone, establish correct handling.
  Simulation stopped after verification. Final live evidence is also saved in
  `/private/tmp/finance034-live.log`.

No upstream sources are unavailable and no implementation blockers remain.
The default Turbopack environment failure and pending RxCode/publication gate
remain explicitly separate from the passing Webpack build and local checks.

The 30 compact fixtures preserve earliest/latest observations per indicator,
frequency, component and unit, plus each source status flag. Header counts match
fixture length rather than full live resources. Dependencies were copied locally
so the isolated worktree is compatible with Turbopack's workspace restrictions.

Reproduce live checks:

```sh
bun --conditions=react-server scripts/check-finance034-live.ts
```

Reproduce the local HTTP simulation:

```sh
postman simulation run postman/simulations/finance034.sim.yaml --port 4907 --no-history --output ndjson
# In another terminal:
bun --conditions=react-server scripts/check-finance034-simulation.ts
```

The mock returns 501 outside its recorded contract. Only the check script's
in-memory service base URL changes to loopback; production URLs remain fixed.

## Verification and publication gate

Implementation and validation are ready for automatic RxCode task verification.
Successful RxCode verification and explicit publication go-ahead have not been
received. No commit, push, PR, deployment, manual board transition or notification
was performed. The orchestrator must confirm verification and publication
permission before committing or opening the single task-linked PR.
