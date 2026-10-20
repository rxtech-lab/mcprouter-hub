# Finance batch 029 — API-0531–API-0540

Implemented exactly the ten requested tracker entries in `censtatd-gdp-expenditure`.
The existing uncommitted batch 028 work remains in place. This service reuses its
GDP observation transformer; the shared parser now recognizes distribution labels
in all three languages and treats table 310-31015 percentages as distributions.
Existing GDP ratio tools retain their previous measure semantics.

## Verified upstream contract

Verified on 2026-10-21 (Hong Kong time). Each official DATA.GOV.HK dataset page
listed working English, Traditional Chinese and Simplified Chinese JSON resources.
All 30 resources returned `header.status = {name: Success, code: 0}` and structured
`header` / `dataSet` JSON. No source was unavailable and no file adapter was needed.
No authentication is required. The ten dataset units use one HTTP path with ten
fixed table IDs (30 table/language variants), rather than ten different paths:

`GET https://www.censtatd.gov.hk/api/get.php?id=<table>&lang=<en|tc|sc>&full_series=1`

| Tracker ID | Official dataset/table | MCP tool | Full upstream rows | Frequency |
| --- | --- | --- | ---: | --- |
| API-0531 | [310-31013](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-310-31013) | `cxdm_groups_current` | 1,800 | Y |
| API-0532 | [310-31014](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-310-31014) | `cxdm_groups_chained` | 1,800 | Y |
| API-0533 | [310-31015](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-310-31015) | `cxdm_groups_distribution` | 900 | Y |
| API-0534 | [310-32021](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-310-32021) | `gce_components_current` | 2,177 | Q/Y |
| API-0535 | [310-32022](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-310-32022) | `gce_components_chained` | 2,177 | Q/Y |
| API-0536 | [310-32023](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-310-32023) | `gce_functions_current` | 520 | Y |
| API-0537 | [310-32024](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-310-32024) | `individual_collective_consumption` | 647 | Y |
| API-0538 | [310-32031](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-310-32031) | `gdfcf_components_current` | 5,435 | Q/Y |
| API-0539 | [310-32032](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-310-32032) | `gdfcf_components_chained` | 5,435 | Q/Y |
| API-0540 | [310-33041](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-310-33041) | `services_trade_components_current` | 5,088 | Q/Y |

Dataset registrations preserve the exact `hk-censtatd-tablechart-<table>` IDs.
Orbit discovery returned unrelated US Census APIs, so the implementation uses
the official Hong Kong catalogue links and actual response contracts. The Postman
CLI is signed out; the owner's published mock search was skipped. The local mock
replays compact observations from the verified official responses.

## Tool contract

- Read-only YAML HTTP tools with fixed upstream IDs, validated table-specific
  frequency, indicator, component and measure enums. Language is `en` (default),
  `tc` or `sc`, forwarded upstream. No arbitrary URL, query or field input.
- Annual-only tables accept a four-digit year. Other tables also accept a
  six-digit quarter ending in `03`, `06`, `09` or `12`. A year matches annual
  and quarterly observations; use `freq` to select one frequency.
- `measure=level` means monetary values in HK$ million; `yoy` means year-on-year
  percentage change. `distribution` means share of the table total, not share of
  GDP. Tables 310-31015 and 310-32023 expose distributions. Table-specific schemas
  offer only supported measures. `indicator` retains the original CUR/CON code.
- Component codes and descriptions retain upstream distinctions: CXDM commodity
  groups, GCE functions, individual/collective consumption, private/public capital
  formation, and exports/imports of services. Components within a hierarchy overlap;
  do not sum parent totals and children. Chained components need not add to totals.
- Responses retain original figures, units (`svDesc`), status/revision flags
  (`sd_value`), localized title, notes and source. Missing figures remain empty;
  they are never converted to zero. Provider descriptions can contain HTML markup;
  these tools return them as source text, without rendering HTML.
- Results sort newest first, preserving source order within a period. `limit`
  defaults to 50, maximum 100; `offset` defaults to zero, maximum 100000. Responses
  include `table`, `title`, `language`, `notes`, `source`, `total`, `returned`,
  `hasMore`, `nextOffset` and `results`. Continue with `nextOffset` and the same
  filters/language. Empty matches and exhausted pages return explicit empty pages.
- Shared full-response cache TTL is 3600 seconds, keyed by table and language;
  local filtering/paging reuses the cached body. Shared fetch timeout is 15 seconds.
  HTTP, network, timeout and invalid JSON failures become MCP errors. Failed
  provider statuses and malformed observations raise actionable errors directing
  callers to retry or check the official web table. The transformer validates the
  entire received table before filtering or returning a bounded page.
- All ten tools have period-free scheduled live-check registrations.

## Validation

- `bun run codegen`: passed; registry, definitions, schemas and tracker status
  regenerated. Generated TypeScript is gitignored by repository convention.
  APIS.md moves from 78 to 88 implemented relative to the starting working tree;
  this batch changes only API-0531–API-0540 and the count. Existing batch 028
  differences from HEAD remain intact. `mcp/apis.yaml` permanent IDs are unchanged.
- `bun scripts/codegen.ts --check`: passed, 33 files current.
- `bun run test`: **737 passed, 5 skipped; 45 test files passed**. Includes old
  batch 028 regression coverage, all-tool HTTP/TTL expectations, scoped MCP
  discovery/calls/errors, unique ID/dataset ownership, search, pagination, annual
  restrictions, localized distributions, invalid inputs, provider failures and
  malformed observations.
- `bun run typecheck`: passed (Next route type generation and TypeScript).
- ESLint on the new/changed TypeScript and mock JavaScript: passed.
- `git diff --check`: passed.
- Live generated tools: **30/30 passed**, all ten tables in all three languages.
  Full response validation succeeded; latest periods were 2025 for annual-only
  tables and 202606 for quarterly tables. Counts are listed above.
- Postman local HTTP simulation: **60 real requests** observed in its log:
  30 localized successes, 10 HTTP 503 failures, 10 invalid JSON responses and
  10 provider failures. All assertions passed. Ten malformed-input checks also
  passed before HTTP. Server stopped after verification.

Fixtures retain original earliest/latest observations for each component,
frequency and unit, plus examples of each available status flag. Header record
counts are adjusted to fixture size; they are not full live-table counts.

Reproduce local simulation (no Postman login or deployment required):

```sh
postman simulation run postman/simulations/finance029.sim.yaml --port 4902 --no-history --output ndjson
# In another terminal:
bun --conditions=react-server scripts/check-finance029-simulation.ts
```

The mock returns 501 for requests outside the recorded contract. Only the check
script's in-memory service base URL changes to loopback; production URLs stay
fixed. Run live validation with:

```sh
bun --conditions=react-server scripts/check-finance029-live.ts
```

No implementation blockers remain. No UI or Next.js application code changed.
No commit, publication or deployment was performed.
