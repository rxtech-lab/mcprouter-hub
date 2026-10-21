# Finance batch 035 — Companies Registry, Customs and HKMA

**TASK_RESULT: INCOMPLETE** — four requested tracker entries remain blocked by upstream HTTP 405.

## Latest coordinator resume — 2026-10-21 05:02–05:04 UTC

Fetched `origin`; remote default remains `main`. Existing task branch
`feat/finance-batch035` and current `origin/main` both resolve to
`e2bec75f9736a2591d2571a2edfc1bb8608e626b`. All recovered task changes were
preserved in `/private/tmp/mcprouter-finance035`. The primary checkout remains
on `feat/site-search-live-check-retry`; it was not modified by this resume.

Current authoritative metadata for all ten datasets and all seven HKMA schemas
was fetched successfully again; see `finance-batch035-resources.json`.
Orbit discovery returned unrelated APIs and supplied no usable HKMA alternative.
The official endpoint paths have not changed. Exact published request examples
for exchange rates, liquidity and CMU members (`?offset=0`) each returned HTTP
405. The published securities-staff example with
`lang=en&searchtype=engName&is_curr_rel_indiv=0&surname=chan` also returned 405.
Responses are HTML block pages, not HKMA JSON provider error envelopes.
No authentication, undocumented endpoint, unofficial proxy or bypass was added.

One real contract mismatch was fixed: securities-staff `current` now defaults
to `"0"`, sending mandatory `is_curr_rel_indiv=0` for current individuals.
Explicit `"1"` includes former individuals; unsupported values are rejected.
The official [staff request contract](https://apidocs.hkma.gov.hk/documentation/bank-svf-info/register-ais-secstaff/)
requires this parameter for all three search modes. Fixture assertions check
the default in all modes, explicit `1`, and rejection of `2`. The Postman mock
now rejects requests missing the mandatory status. This correction does not
resolve the provider's HTTP 405 response.

Validation of these final changes:

- Focused batch/MCP route/discovery tests: **440/440 passed**.
- Full suite: **1,376 passed, 5 existing skips**, 52 test files passed.
- Codegen: **42 files** regenerated; freshness check passed. Two message
  catalogues compiled. The tracker still registers only six requested IDs;
  API-0046, API-0048, API-2153 and API-2159 remain unregistered.
- Lint, TypeScript/Next route type generation, and `git diff --check`: passed.
- Production build: `TURSO_DATABASE_URL=file:/private/tmp/finance035-resume-build.db
  BILLING_ENABLED=false bun run build --webpack` passed, including isolated
  local SQLite migrations, compilation, TypeScript and **43 prerendered pages**.
  Installed Next CLI guidance was read; no Next application code changed.
  Default Turbopack was not rerun in this resume.
- Postman simulation: **67 real HTTP requests** passed assertions: 17 successes
  and 50 expected failures, including ten HTML HTTP 405 block pages. Ten invalid
  inputs were rejected before HTTP. The log contains exactly 67 request events:
  47 HTTP 200, ten HTTP 405 and ten HTTP 503. Intentional parse/provider errors
  account for 30 of the HTTP 200 responses. Evidence:
  `/private/tmp/finance035-resume-sim.ndjson`. Four successes still use explicitly
  synthetic schema fixtures and do not establish live coverage.
- Generated-tool live audit: **8 passed, 9 failed with HTTP 405, 9 follow-ups
  skipped**, exit 1, `complete=false`; updated `finance-batch035-live.json`.
  Companies Registry/Customs pass all eight variants. All seven HKMA endpoints
  fail across nine variants, including the corrected staff request. Pagination,
  date filtering and registration-number follow-ups remain live-unverified.

Full board acceptance remains **INCOMPLETE**. Successful RxCode verification of
the final changes has not been obtained. The coordinator owns publication after
that gate; no commit, push, PR, auto-merge, task-state change or notification was
performed. The following sections retain earlier recovery/validation history;
the results above supersede their earlier timestamps and request counts.

Worktree: `/private/tmp/mcprouter-finance035`, branch `feat/finance-batch035`, based
on freshly fetched `origin/main` at `e2bec75f9736a2591d2571a2edfc1bb8608e626b`.
At recovery time the primary checkout was on `main`; its unrelated dirty work was preserved.
No commit, push, PR, publication or task-state change.

## Recovery and current verification

The previous worktree and branch were absent. A fresh worktree was created after
fetching remote main. The unreachable Fork autostash
`b536ca8a3bfdd031692889de0a58a2d847a55bbf` retained five tracked task changes but
none of the untracked implementation files. Those files were recovered from the
original session `01a15bf9-a182-7a33-a17f-a832fb959080` file-writing commands and
the saved `/private/tmp/finance035-research` resources; the enhanced audit script
was recovered from `01a15c67-88c9-7e41-a3f4-183eb3a5ae4f`. No implementation
artifact remains missing. Original official captures and explicitly labelled
synthetic parser examples retain their original provenance; no synthetic fixture
is used as proof of a successful upstream response.

Current-main compatibility required descriptions on the four recovered service
definitions: catalogue pages consume a description for every generated service.
The prior Companies Registry 60-second timeout was also restored.

Current official metadata for all ten datasets and all seven HKMA schema links
was checked again; see `finance-batch035-resources.json`. The published URLs and
formats still match the recovered adapters. The live generated-tool audit at
2026-10-21 04:04–04:05 UTC is saved in `finance-batch035-live.json`:
**8 initial passes, 9 initial HTTP 405 failures, 9 skipped follow-up checks,
complete=false**. All seven HKMA tools fail (nine language variants); the three
other tools pass in all eight variants. HKMA paging, date filters and staff search
cannot be live-confirmed without a successful initial response. This is an
upstream block, not grounds to register the four missing stable IDs.

Current validation:

- Focused batch, MCP route and discovery tests: **440 passed** across three files.
- Full test suite: **1,376 passed, 5 skipped** across 52 files. The five skips are
  existing environment-dependent checks; no batch test is skipped.
- Postman simulation: **57 real HTTP request events** in
  `/private/tmp/finance035-restored-sim.ndjson`, matching 17 success scenarios and
  40 expected failure scenarios; ten invalid inputs rejected before HTTP. Four
  HKMA success scenarios use the explicitly synthetic parser examples.
- Codegen: **42 generated files**, two compiled message catalogues; freshness
  check passed. `APIS.md` reports 144/3819 implemented (six added by this batch).
- Lint and TypeScript checks passed after restoring the service descriptions.
- `bun run build --webpack`: **passed**, including migrations against the new
  worktree's local SQLite database, compilation, TypeScript, and 43 prerendered
  pages. No production database or credentials were used. Default Turbopack build
  did not pass: the sandbox first blocked Google Fonts downloads; the escalated
  retry failed while binding a port during CSS loader evaluation (`EPERM`). The
  successful Webpack result does not establish a successful Turbopack build.

Only six requested IDs are registered. API-0046, API-0048, API-2153 and API-2159
remain coming soon; declaring them would falsely claim verified coverage.
Independent RxCode verification has not succeeded for these final changes.
Publication remains deferred; no task was manually moved to review/done/complete.

Ten tools cover exactly the ten requested dataset units, using 13 distinct
published resource paths (including the three warehouse language files). Six
stable IDs have successful initial upstream responses and working fixture-tested
adapters. Four upstream sources never returned live data and remain unregistered:
**API-0046, API-0048, API-2153 and API-2159**. The batch cannot be called fully
live-verified or complete while these blockers remain.

## Official upstream contracts

Verified 2026-10-21 using official DATA.GOV.HK `package_show` metadata, published
resource URLs, and the seven HKMA OpenAPI documents. No authentication is required.
Orbit returned unrelated CSDI pedestrian/indoor APIs; none was used. Postman CLI
1.75.0 is signed out, so the owner's published mock search was skipped. Local
mocks use the official captures and explicitly labelled schema examples.

| ID | Official dataset | MCP tool | Resource and initial evidence |
| --- | --- | --- | --- |
| API-1313 | [hk-cr-crdata-list-addr](https://data.gov.hk/en-data/dataset/hk-cr-crdata-list-addr) | `cr_company_addresses` | JSON arrays from both `/cr/api/api/v1/api_builder/json/local/search` and `/foreign/search` at `data.cr.gov.hk`. Both published sample BRNs returned one company. |
| API-1332 | [hk-cr-crtcspdata-list-tcsp-licensees](https://data.gov.hk/en-data/dataset/hk-cr-crtcspdata-list-tcsp-licensees) | `cr_tcsp_licensees` | `https://www.tcsp.cr.gov.hk/open-data/licensees.csv`: 7,509 bilingual records. XLSX and CSDI portal alternatives are listed; the tool parses the CSV. |
| API-1428 | [hk-customs-ced_stat-warehouse](https://data.gov.hk/en-data/dataset/hk-customs-ced_stat-warehouse) | `customs_bonded_warehouses` | `https://www.customs.gov.hk/filemanager/common/csv/{en,tc,sc}/list_of_warehouse_{en,tc,sc}.csv`: 60 records per language. A CSDI portal alternative is listed; the tool parses the published CSV. |
| API-0046 | [hk-hkma-t06-t060103er-eeri-daily](https://data.gov.hk/en-data/dataset/hk-hkma-t06-t060103er-eeri-daily) | `hkma_exchange_rates` | HKMA `/market-data-and-statistics/monthly-statistical-bulletin/er-ir/er-eeri-daily`; timeout/HTTP 405, no live JSON. Not registered. |
| API-0047 | [hk-hkma-t06-t060303hk-interbank-ir-daily](https://data.gov.hk/en-data/dataset/hk-hkma-t06-t060303hk-interbank-ir-daily) | `hkma_hibor` | HKMA `/market-data-and-statistics/monthly-statistical-bulletin/er-ir/hk-interbank-ir-daily?segment=hibor.fixing`; initial three-record JSON, preserving null nine-month rates; later requests HTTP 405. |
| API-0048 | [hk-hkma-dms-daily-figures-interbank-liquidity](https://data.gov.hk/en-data/dataset/hk-hkma-dms-daily-figures-interbank-liquidity) | `hkma_interbank_liquidity` | HKMA `/market-data-and-statistics/daily-monetary-statistics/daily-figures-interbank-liquidity`; timeout/HTTP 405, no live JSON. Not registered. |
| API-2153 | [hk-hkma-banksvf-register-ais-secstaff](https://data.gov.hk/en-data/dataset/hk-hkma-banksvf-register-ais-secstaff) | `hkma_securities_staff` | HKMA `/bank-svf-info/register-ais-secstaff`; documented `engName`, `chiName`, `regNo` searches returned HTTP 405. Not registered. |
| API-2154 | [hk-hkma-banksvf-register-ambs](https://data.gov.hk/en-data/dataset/hk-hkma-banksvf-register-ambs) | `hkma_money_brokers` | HKMA `/bank-svf-info/register-ambs?lang=en&segment=en`; initial three names in JSON, later requests HTTP 405. |
| API-2158 | [hk-hkma-debtsec-list-of-cmu-instruments](https://data.gov.hk/en-data/dataset/hk-hkma-debtsec-list-of-cmu-instruments) | `hkma_cmu_instruments` | HKMA `/debt-securities-settlement-system/operational-information/list-of-cmu-instruments`; initial three full instrument records in JSON, later requests HTTP 405. |
| API-2159 | [hk-hkma-debtsec-list-of-cmu-members](https://data.gov.hk/en-data/dataset/hk-hkma-debtsec-list-of-cmu-members) | `hkma_cmu_members` | HKMA `/debt-securities-settlement-system/operational-information/list-of-cmu-members`; timeout/HTTP 405, no live JSON. Not registered. |

HKMA paths above are relative to `https://api.hkma.gov.hk/public`.
Official schema URLs, under `https://apidocs.hkma.gov.hk/wp-content/uploads/swagger/`:
`T060103-swagger.json`, `T060303-swagger.json`, `interbank-liquidity-swagger.json`,
`register-ais-secstaff-swagger.json`, `register-ambs-swagger.json`,
`cmu8026-swagger.json`, `cmu8030-swagger.json`. All seven schemas downloaded.
The address dictionaries and request parameter descriptions are linked in official
Companies Registry dataset metadata. No invented upstream API replaces a file.

## Tool behavior

- YAML HTTP tools use fixed provider URLs, request/response transformers, validated
  enums, bounded search strings, integer pagination and table-specific parameters.
  Arbitrary URLs, column names, query expressions and SQL are not accepted.
- `limit` defaults to 20, max 100. `offset` defaults to 0, max 1,000,000.
  Responses include `results`, `returned`, `hasMore`, `nextOffset`; file/address
  results also include the full matching `total`. The 100 KB serialized row budget
  can shorten a page without losing its continuation offset.
- CSV files are fetched in full, validated before searching/paging, and mapped to
  stable structured fields. Quoted commas/multiline cells, BOMs, mixed CR/CRLF,
  Chinese trailing empty columns, empty government-warehouse licences and leading
  zeros are supported. Unexpected headers, missing fields, malformed quotes and
  nonempty surplus columns fail explicitly.
- TCSP retains English/Chinese names and remarks; `en` selects English with an
  original Chinese fallback. `tc` and `sc` select original Traditional Chinese
  with an English fallback. No Simplified Chinese translation is claimed.
  Warehouse `en`, `tc`, `sc` select their actual published language files.
- Companies Registry `register=local|foreign`, `field=Brn|Comp_name`,
  `operator=equal|begins_with`, and required `value` construct the documented
  three-part query. Both original bilingual company schemas remain intact.
- HKMA daily tools allow valid inclusive `from`/`to` dates, reject reversed ranges,
  use fixed date columns (`end_of_day`, liquidity `end_of_date`) and descending
  order. HIBOR fixes the segment to `hibor.fixing`. Staff searches require a name
  or registration number and map the selected mode to the documented query field.
  Staff and AMBs accept only provider-supported `en|tc`; AMBs set both language
  and segment. Other HKMA sources expose original English fields without a
  fabricated language parameter. Values, nulls and nested register data are kept.
- HKMA upstream `datasize` is the returned page size, not a grand total. A full
  page gets a conservative continuation; a short/empty page terminates. Malformed
  envelopes, inconsistent counts, unsupported row shapes and provider-declared
  failures raise actionable errors instead of looking like empty success.
- Raw-response cache TTL: 3,600 seconds, keyed by full request URL and format.
  CSV local filters/pages share a cached file. Warehouse languages and HKMA
  upstream pages/searches are separate cache entries. Parsed malformed bodies may
  remain in the shared raw cache until expiry; they continue to fail validation.
- Default fetch timeout: 15 seconds. Companies Registry uses the supported
  service-specific 60-second timeout after intermittent 15-second timeouts.
  No credentials, proxy workaround or alternate unofficial host was introduced.
- All ten have scheduled live-check inputs, fixture tests, scoped MCP discovery,
  successful route calls and upstream HTTP-error route coverage. Four tools remain
  discoverable as explicitly unverified contracts without claiming their tracker IDs.
- `lib/sources.ts` uses an equivalent alias `.some` lookup to avoid a TypeScript
  `includes`/`never` error exposed by the expanded generated manifest. No UI change.

## Validation and independent-verifier handoff

Validation results are finalized below after all checks complete. The primary
checkout must remain unchanged. Only this task's changes may be committed after
RxCode independent verification of the final changes and the orchestrator's explicit
publication go-ahead. No task was manually moved to review/done/complete.

Reproduce:

```sh
cd /private/tmp/mcprouter-finance035
bun install --offline --frozen-lockfile
bun run codegen
bun scripts/codegen.ts --check
bun run test
bun run lint
bun run typecheck
bun run build
postman simulation run postman/simulations/finance035.sim.yaml --port 4905 --no-history --output ndjson
# Separate terminal:
bun --conditions=react-server scripts/check-finance035-simulation.ts
bun --conditions=react-server scripts/check-finance035-live.ts
```

The simulation replaces only in-memory service origins with loopback and exercises
real fetch/cache/parse/transform execution. Its mock rejects unmodelled endpoints
with 501. Four schema-derived fixtures prove local contract handling, not live
availability. `check-finance035-live.ts` exits nonzero when any source fails and
prints individual statuses; it never promotes tracker IDs automatically.
