# Finance batch 030: API-0541–API-0550

Task: `2EB89D7B-AAC5-48E4-A867-2E61585661BF` — Implement remaining MCP catalogue coverage.

Adds exactly ten upstream dataset units as ten read-only tools in the
`censtatd-national-accounts` service. Permanent tracker IDs and dataset IDs are
unchanged. APIS.md increases from 88 to 98 implemented entries; only these ten
entries change status. No UI or Next.js application code changes.

## Verified upstream contract

Verified 2026-10-21 (Hong Kong time). All ten official dataset pages list English,
Traditional Chinese and Simplified Chinese JSON resources. All 30 resource URLs
returned nonempty `header` / `dataSet` JSON with provider status `Success` / `0`.
No sources were unavailable and no file adapter was needed. The ten fixed table
IDs share one HTTP path, with 30 table/language variants:

`GET https://www.censtatd.gov.hk/api/get.php?id=<table>&lang=<en|tc|sc>&full_series=1`

No authentication is required. These are observed official resources, not an
invented endpoint. Orbit discovery found unrelated providers; the implementation
uses the official Hong Kong catalogue links and captured responses instead.
The Postman CLI is signed out (`No authorization data found`), so the owner's
published mock search could not run. The local simulation replays captured
provider responses and injects explicit errors.

| API ID | Official dataset | MCP tool | Full rows per language | Frequency | Source dimension |
| --- | --- | --- | ---: | --- | --- |
| API-0541 | [310-33042](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-310-33042) | `services_trade_components_chained` | 5,088 | Q/Y | GDP_COMPONENT |
| API-0542 | [310-34101](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-310-34101) | `gdp_activity_current` | 2,516 | Y | ACTIVITY |
| API-0543 | [310-34102](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-310-34102) | `gdp_production_current` | 100 | Y | none |
| API-0544 | [310-34201](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-310-34201) | `activity_output_factor_income` | 2,100 | Y | ACTIVITY |
| API-0545 | [310-34401](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-310-34401) | `production_account` | 375 | Y | INS_SECTOR |
| API-0546 | [310-34402](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-310-34402) | `generation_of_income_account` | 500 | Y | INS_SECTOR |
| API-0547 | [310-34403](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-310-34403) | `national_accounts_aggregates` | 675 | Y | none |
| API-0548 | [310-34501](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-310-34501) | `gdp_activity_chained` | 5,180 | Q/Y | ACTIVITY |
| API-0549 | [310-35091](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-310-35091) | `real_gross_domestic_income` | 334 | Q/Y | none |
| API-0550 | [310-36201](https://data.gov.hk/en-data/dataset/hk-censtatd-tablechart-310-36201) | `gni_and_per_capita` | 1,144 | Q/Y | none |

## Tool behavior

- Validated table-specific frequency, indicator, component and measure enums;
  four-digit years, or exact six-digit quarters ending 03/06/09/12 where available.
  A year matches all observations in that year; use `freq` to distinguish them.
- `component` filters the table's native dimension. `componentType` identifies
  `GDP_COMPONENT`, `ACTIVITY`, `INS_SECTOR`, or `null`. `TOTAL` aliases an empty
  source dimension code or a dimensionless table. Original source fields remain
  intact, including empty codes. Totals and nested children overlap.
- `measure=level` retains original monetary units; `yoy` is year-on-year percent
  change. Table 310-34101 also has `share` (percent contribution to GDP, distinct
  from growth contribution); 310-34102 has `ratio` (statistical discrepancy as
  percent of GDP). The latter table's other indicators are monetary levels.
- Table 310-36201 distinguishes nominal/real GNI (`CURGNI`/`RGNI`, HK$ million)
  from nominal/real per capita GNI (`CURPGNI`/`PRGNI`, HK$). Preserve `svDesc`;
  never combine amounts with different units. Chained components are non-additive.
- `lang` forwards `en` (default), `tc`, `sc` upstream for localized title, notes,
  descriptions and units. Source labels may contain HTML and are returned as text.
- All received observations are validated before local filtering/paging. Unknown
  units, indicators, dimensions, frequencies, malformed observations and failed
  provider statuses raise actionable errors directing callers to the official
  table. HTTP, network, timeout and invalid JSON errors use shared MCP errors.
- Original figures, missing values, negative amounts and revision/preliminary flags
  are preserved; missing figures are never coerced to zero. Newest periods first,
  retaining source order within a period. Default limit 50, maximum 100, offset
  0–100000; `total`, `returned`, `hasMore`, `nextOffset` support continuation.
- Shared upstream cache TTL is 3600 seconds, keyed by table and language. Local
  paging and filters reuse the full cached body. Shared fetch timeout 15 seconds.
  No user-supplied URLs, table IDs or upstream query fields are accepted.
- All ten tools have period-free scheduled live checks. Generated service,
  registry, schemas and catalogue artifacts regenerate from YAML and handlers;
  generated TypeScript remains gitignored per repository convention.

## Reproduce verification

```sh
bun run codegen
bun scripts/codegen.ts --check
bun run test
bun run typecheck
bun run lint
bun run i18n:check
bun run build
bun --conditions=react-server scripts/check-finance030-live.ts

# In separate terminals:
postman simulation run postman/simulations/finance030.sim.yaml --port 4903 --no-history --output ndjson
bun --conditions=react-server scripts/check-finance030-simulation.ts
```

The simulation changes the in-memory service URL only. Production URLs stay
fixed. Requests outside the captured contract return 501. Fixtures and provenance
are under `tests/fixtures/finance030/`.

## Validation results

- `bun run codegen`: passed; 34 generated files and two message catalogues.
- `bun scripts/codegen.ts --check`: passed, all 34 files current.
- `bun run test`: **831 passed, 5 skipped; all 46 files passed**. Includes exact
  stable ID/dataset ownership, generated HTTP/TTL contracts, all ten scoped MCP
  discovery/call/input-error cases, representative route upstream errors,
  pagination/cache separation, all captured localized observations, unit and
  dimension distinctions, HTTP/JSON/provider/malformed-row/network/timeout errors.
- `bun run typecheck`: passed (Next route generation and TypeScript).
- `bun run lint`: passed (repository-wide ESLint).
- `bun run i18n:check`: passed (766 strings current).
- `bun run build`: passed (production Turbopack build, TypeScript and 40 static
  pages). Worktree-local dependencies and a clean build cache were required;
  sandboxed attempts first hit dependency-root, font-network and worker-port
  restrictions. The final clean build with host permissions completed successfully.
- `git diff --check`: passed.
- Live generated tools: **30/30 passed**, all ten tables in all three languages.
  Every full response was validated before returning one observation. Annual-only
  latest period was 2024; quarterly latest period was 202606. Row counts above.
- Postman simulation: **60 real HTTP requests** confirmed in its NDJSON log:
  30 localized successes, 10 HTTP 503 failures, 10 invalid JSON responses, and
  10 failed provider statuses. All assertions passed; ten malformed-input cases
  also failed before HTTP. The local server was stopped after verification.

No implementation blockers remain. GitHub checks and the actual PR merge state
are reported in the task thread/PR after publication.
