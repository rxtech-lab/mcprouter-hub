# Batch 060 validation

Scope: exactly **API-0687–API-0696**, task **3A772981-4F20-487A-B9AE-1FDDEBE4DEA2**. All ten are individually **PASS** for implementation and implementer validation. Fresh independent RxCode verification of the final commit and every retained API remains pending; no push, PR, deployment or board transition is authorized here.

Base: `1e6dd7a5a9731cc388830e8b9699179ce140e7f4`, freshly fetched `origin/main` (remote default branch). Owned branch: `codex/batch060`; owned worktree: `/private/tmp/mcprouter-batch060`. The shared checkout and unrelated worktrees remain untouched. A successful-subset local commit is explicitly authorized by the current orchestrator instruction. Final head and diff are frozen in the external handoff after this document is committed.

## Verified source contracts

On 2026-10-24 Hong Kong time, inspected all ten linked DATA.GOV.HK dataset pages, checked their advertised resource URLs, and captured all 30 actual official en/tc/sc JSON responses. Every resource returned provider success and nonempty observations, with the declared record count matching the complete dataset. Pages advertise JSON, CSV and XLSX; tools use their linked JSON API. No file-only or unavailable source was found. CSV download links resolve to a browser page with client-side download generation; CSV/XLSX exports are not runtime dependencies and are not claimed verified.

Orbit discovery returned unrelated US Census endpoints; none was selected. Postman owner-workspace discovery was attempted but unavailable while signed out. The local stand-in replays captured official data rather than a published owner's mock. No remote Postman state was changed.

Added `censtatd-building-business`, using the existing YAML HTTP response-transformer convention: ten read-only tools and ten fixed requests to `/api/get.php?full_series=1`, one per stable API unit. No caller-controlled URLs or table IDs. Local schemas validate year, annual frequency, indicator, measure, industry and table-specific class codes. English, Traditional Chinese and Simplified Chinese use separate one-hour upstream cache entries; local filters reuse those entries. Output pages contain 1–100 observations, with offset 0–100000 and the shared 100 KB observation byte bound, newest years first. The full upstream envelope and every row are validated before filtering, including rows beyond the requested page. HTTP, timeout, network, invalid JSON, provider errors, malformed records and valid empty datasets have meaningful coverage, without automatic retries.

Original figures, empty figures, flags, units, periods, labels, notes and source strings remain intact. Empty class codes gain a `TOTAL` filter alias while the original empty code remains present. Counts, HK$ million levels and year-on-year percentage changes remain separate. `HC` counts companies; `PE_ASEA` counts persons engaged; `PE_D_ASEA` counts directly engaged persons. Indicator descriptions were checked against official English table metadata. The original classification thresholds are **HK$ thousand**, verified from four official table metadata resources; monetary observations remain **HK$ million**. No currency conversion, aggregation or extrapolation occurs. Rounding, HSIC and subsidy qualifications are preserved in source notes.

| API | Official table | MCP tool | Rows per language | Implementer result |
|---|---|---|---:|---|
| API-0687 | 615-73002 | `architecture_selected_statistics` | 200 | PASS |
| API-0688 | 615-73003 | `real_estate_selected_statistics` | 180 | PASS |
| API-0689 | 615-73011 | `construction_business_by_industry` | 1680 | PASS |
| API-0690 | 615-73012 | `construction_business_by_output` | 980 | PASS |
| API-0691 | 615-73013 | `construction_business_by_value_added` | 840 | PASS |
| API-0692 | 615-73021 | `main_contractors_business_statistics` | 560 | PASS |
| API-0693 | 615-73031 | `real_estate_business_by_industry` | 1400 | PASS |
| API-0694 | 615-73032 | `real_estate_business_by_receipts` | 980 | PASS |
| API-0695 | 615-73051 | `architecture_principal_statistics` | 280 | PASS |
| API-0696 | 615-73052 | `architecture_business_by_receipts` | 980 | PASS |

## Exact checks

- `bun run codegen`: exit 0, **70 generated files**, two message catalogues. `bun scripts/codegen.ts --check`: exit 0. APIS.md changes exactly these ten IDs and totals **217 → 227**. Ignored generated registry, service module and manifest follow repository convention and are archived externally.
- `bun run test`: exit 0, **77 files; 3458 passed, 5 existing skips (3463 total)**. Includes **88 dedicated tool/route tests** and ten added shared all-tool cases. No batch060 assertions were skipped or weakened. Covers bounded and malformed inputs, all languages, cache reuse/isolation, complete fixture pagination, each observed filter tuple, byte-bound continuation, flags, suppressed values, units, provider/HTTP/JSON/network/timeout errors and valid emptiness.
- Authenticated service-scoped JSON-RPC `tools/list` and `tools/call` cover all ten tools, including schema and provider failures. Each official table ID identifies its tool in the full discovery catalogue's top eight results. Unique ownership of API and dataset IDs is asserted.
- `bun run lint`: exit 0, zero warnings. `bun run typecheck`: exit 0.
- `TURSO_DATABASE_URL=file:/private/tmp/batch060-evidence/build.db bunx drizzle-kit migrate`: exit 0 against a task-owned local database. `TURSO_DATABASE_URL=file:/private/tmp/batch060-evidence/build.db bunx next build --webpack`: exit 0, final generated catalogue, production compilation and static generation. No production database credentials used; the repository build script's migration step was executed separately against that same local database.
- `bun --conditions=react-server scripts/check-batch060.ts captures`: exit 0, all **30 complete archived responses** validate through generated tools. Additional full pagination checks preserve every field of all **24,240 observations**, newest first, with count and byte bounds on every page.
- The same script in `live` mode: exit 0, **30 localized live tool calls**, zero failed tables. Every API passes en/tc/sc separately through the actual runtime HTTP fetcher and transformer.
- `postman simulation run postman/simulations/batch060.sim.yaml --port 4960 --output ndjson`, script `simulation`: client exit 0; **80 real HTTP requests**, zero failed tables. Per table: en/tc/sc success, HTTP 503, invalid JSON, provider failure, malformed final row and valid empty data. Invalid limit is rejected before HTTP. The request log contains all 80 calls; the implementation runs for real against the local stand-in.
- External `python3 /private/tmp/batch060-evidence/audit.py`: exit 0. All **30 fixtures / 2355 selected observations** match their SHA256-verified complete captures, covering every observed dimension/indicator/unit/frequency/flag/value-type tuple. Only the sample record count is adjusted. First and last observations are included. Confirms exactly the ten requested tracker rows changed and the documented class units match official metadata.
- `git diff --check`: exit 0.

## Provenance, repairs and limits

`tests/fixtures/batch060/provenance.json` records source URLs, capture timestamps, complete-body hashes, selected zero-based row indices and fixture hashes. External archive `/private/tmp/batch060-evidence/` contains ten source-page HTML captures, 30 full JSON responses, source manifest, official metadata captures, fixture audit, validation logs, local simulation trace, repair record, generated artifact snapshot and the final commit/diff handoff. Stand-in evidence establishes local implementation behavior; separate live evidence establishes current official data access. Neither substitutes for independent verification or deployment evidence.

Repair cycles: **1/3** across this run. The first full suite identified precisely the ten new tool names missing from scheduled live-check inputs (`tests/live-checks.test.ts`). Focused tests and complete-capture checks had already passed. Added the ten entries to `mcp/live-checks.ts` with the existing nonempty-page assertion, preserving all assertions and fixtures. Revalidation passed. No genuine upstream or implementation failure occurred or was retried.

Environment restrictions were handled separately from API failures: Git metadata writes and DNS required escalation; sandbox production build failed fetching Google Fonts and passed with network access; local Postman listener/client attempts exited unsuccessfully under sandbox and passed with escalation. Initial simulation stderr was overwritten by the successful rerun, so its original exact diagnostic is unavailable. These environment reruns are not API repair cycles.

All ten APIs retained; **zero FAIL, BLOCKED or UNVERIFIED implementations**. No failed API code, tests, fixtures, registrations, discovery additions, live checks or generated output remain to remove. Task-owned simulation is stopped after validation; worktree, branch, local commit and external evidence remain for the parent verifier. Unrelated work, excluded Task035, cadence and notifications were not changed. Task stays out of review/done/complete. Await parent publication after fresh explicit independent RxCode verification of every retained API and the final hash/diff.
