# Batch 064 validation

Scope: exactly API-0730, API-0731, API-0733, API-0734, API-0735, API-0736, API-0737, API-0738, API-0739 and API-0740. All ten pass implementer validation. Independent final-head RxCode verification remains pending; no push, PR, merge, deployment, notification, schedule change or task-board transition was performed.

Base: `860eb5d7eeaa2e1e8341d3cf91ccc4bc6d0aaf36`, freshly fetched `origin/main` (remote default). Owned worktree: `/private/tmp/mcprouter-batch064`; branch: `codex/batch064`. The shared main workspace and every unrelated worktree were preserved. The latest orchestration instruction authorizes the validated local commit; the external handoff manifest records its final hash.

## Verified upstream contracts

On 2026-10-24, captured all ten DATA.GOV.HK source pages, ten official English C&SD table metadata documents and thirty actual full-series JSON responses (en/tc/sc). All fifty requests returned HTTP 200. Every data response reports code 0, name Success, a nonempty dataSet and a matching record count. Each source page advertises JSON, CSV and XLSX and links to the actual C&SD API. None is file-only or unavailable. CSV/XLSX content is not used or independently validated. Metadata HTTP 200 alone was not treated as implementation evidence.

The dedicated `censtatd-business-performance` service follows existing YAML HTTP transformer conventions. Ten discoverable tools use fixed official `get.php` table IDs, validated annual periods, table-specific indicators, measures and industry/size codes, en/tc/sc localization, and one-hour raw-response caching independently per language and shared across local pages/filters. Outputs preserve original observations, units, labels, notes, flags, empty figures and negative values. Every row and the complete envelope are validated before filtering. Pages contain 1–100 observations, bounded to 100 KB of observations, with newest years first and nextOffset continuation. Failures produce actionable upstream errors without tool-level retry.

Grouping units are table-specific. Information/communications and professional/business receipts groups use **HK$ thousand**, while domestic banking table 645-75012 uses **HK$ million** (`<50`, `50_and_over`). Monetary observations remain **HK$ million**. Banking employment bands include `<5`, `5-49`, `200-499` and `500_and_over`, distinct from other sectors. Value-added groups include `<50` and `10000_and_over`. Table 645-75004 uses a distinct combined financing industry code and does not expose the investment/holding grouping of the receipts table. Raw counts, monetary amounts and year-on-year percentage changes are separate measures. No conversion, summation or interpolation is performed; localized rounding, confidentiality and subsidy notes remain intact.

| API | Table | Tool | Rows per language | Outcome |
|---|---|---|---:|---|
| API-0730 | 640-75103 | `information_communications_by_receipts` | 1176 | PASS |
| API-0731 | 640-75104 | `information_communications_by_value_added` | 1008 | PASS |
| API-0733 | 645-75001 | `financial_professional_business_statistics` | 1567 | PASS |
| API-0734 | 645-75002 | `professional_business_by_employment` | 3276 | PASS |
| API-0735 | 645-75003 | `professional_business_by_receipts` | 3822 | PASS |
| API-0736 | 645-75004 | `professional_business_by_value_added` | 3024 | PASS |
| API-0737 | 645-75011 | `banking_statistics_by_employment` | 450 | PASS |
| API-0738 | 645-75012 | `domestic_banking_by_receipts` | 90 | PASS |
| API-0739 | 645-75013 | `domestic_banking_detailed_statistics` | 96 | PASS |
| API-0740 | 645-75020 | `insurance_detailed_statistics` | 336 | PASS |

## Validation results

- Codegen exits 0: 74 generated files and two message catalogues. `bun scripts/codegen.ts --check` passes. Generated output follows the repository's ignored-output convention and is archived externally. APIS.md changes exactly the ten requested IDs, increasing implemented totals 257 → 267. Permanent tracker entries are unchanged.
- Full test suite: **85 files passed; 3838 tests passed, 5 pre-existing skips**, 3843 total. This includes 85 dedicated batch064 runtime/discovery/authenticated-route tests and ten new shared all-tool request/response/cache cases. Coverage includes complete source preservation, every row's filters, every industry/size code, language-separated cache reuse, pagination, empty results, invalid inputs, malformed envelopes/units/observations beyond the returned page, byte-bound continuation, HTTP failures, invalid JSON, provider errors, network errors and timeouts.
- Full lint with zero warnings and sequential post-build typecheck pass.
- Production Webpack build passes after migration against only `file:/private/tmp/batch064-evidence/build.db`; no production database was used.
- Capture harness: 30 success checks plus complete pagination preserves every original field of **44535 observations**, all ten tables in three languages, with record and byte limits verified.
- Live runtime harness: **30 real upstream calls** pass through the generated tools, actual HTTP fetcher and transformer, one per table/language. No genuine upstream failure occurred or was retried.
- Postman local simulation on port 4964: **80 real HTTP checks** pass, covering three-language success plus HTTP 503, invalid JSON/HTML, provider failure, a malformed final row and valid empty data for every table. Invalid limits fail before HTTP. The trace contains exactly 80 request events. The task-owned simulation was stopped after validation.
- Provenance audit passes: all 50 source hashes and 30 fixture hashes, every selected original index and field, categorical/value-kind coverage, source formats/API links, and exact ten-ID tracker diff. All 44535 captured observations are retained in fixtures; only fixture count metadata is explicitly normalized to the selected count. `git diff --check` passes.

## Repair ledger and boundaries

Repair count **2/3**, recorded in `/private/tmp/batch064-evidence/repair-ledger.json`.

1. The initial capture harness compared the entire status object to just code/name. Official success status also includes description and apiHelp. Diagnosis used the captured real responses: every one had code 0/name Success, nonempty data and matching record counts. The check now validates those fields individually without rejecting provider extensions. It was applied to archived originals; no network requests were replayed, fixtures invented or acceptance checks removed.
2. The exhaustive per-row filtering test for API-0734/API-0735 exceeded Vitest's default five-second budget (approximately 5–6 seconds for thousands of rows). All live/captured/simulation checks passed. Only this exhaustive test received a 30-second budget; every fixture, assertion, input case and filter check remains intact. The full suite passes after that repair.

Sandbox `.git` permissions, DNS, loopback binding/access and Google Fonts downloads required escalation. These environment restrictions were distinguished from provider failures and resolved without TLS bypass or contract changes. Orbit discovery returned unrelated APIs, so none was selected. Postman owner-workspace discovery was unavailable while signed out; the local mock instead uses the actual official captured responses. No remote Postman state changed. The installed Next.js route-handler guide was read; no Next.js/UI source needed modification.

`tests/fixtures/batch064/provenance.json` records exact source URLs, capture timestamps, hashes and original row indices. External evidence at `/private/tmp/batch064-evidence/` contains the original responses and metadata, scripts, failed and final validation logs, simulation trace, audit, repair ledger, generated archive, full diff, final commit audit and hash manifest. Live results prove current provider access; fixture and simulation results prove behavior against those observed contracts. Production deployment and independent final-head verification remain outside this evidence.

All ten APIs are retained. No failed, blocked or unverified task implementation requires removal. Keep the successful local commit frozen for independent per-ID verification; the parent handles any subsequent publication.
