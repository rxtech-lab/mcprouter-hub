# Batch 059 validation

Scope: exactly **API-0677–API-0686**. All ten retained and individually **PASS** for implementation, live localized resources, fixture tests, discovery/route coverage and local HTTP simulation. Independent parent RxCode verification remains pending. No push, PR or deployment.

Base: `24e5afa4d3b7bd810e7c04214262721dec85ecb7`, fetched from the current remote default `origin/main`. Branch: `codex/batch059`. Worktree: `/private/tmp/mcprouter-batch059`. Task: `task47350778-6290-468B-B1B8-BC7341176184`. Shared main and unrelated worktrees remain untouched.

## Verified sources and designed contract

On 2026-10-24 Hong Kong time, inspected all ten DATA.GOV.HK source pages, extracted their linked resources and captured all 30 official JSON responses (en/tc/sc). Every actual JSON resource returned HTTP 200, provider success status and nonempty observations. Each page advertises JSON, CSV and XLSX; this implementation uses the linked JSON API. Alternate CSV/XLSX downloads were not tested and are not used. No file-only source or unavailable API was found. Orbit discovery returned unrelated US Census resources, which were rejected. Postman workspace discovery was unavailable while signed out; the local mock replays captured official responses, not an owner's published mock.

Added service `censtatd-construction-output`, with one read-only tool per stable tracker unit and ten fixed table-specific upstream requests to `/api/get.php?full_series=1`. No caller-supplied URLs, SQL or upstream table IDs. YAML HTTP execution uses a response transformer, 3600-second upstream caching per table/language, validated local filters, 1–100 observations per page, offset 0–100000 and the shared 100 KB observation-page limit. Full responses are validated before filtering, including malformed rows beyond the requested page. Original figures, empty strings, flags, units, dimension labels, notes and source text are preserved. `TOTAL` aliases an empty dimension code without rewriting the original field. Newest periods appear first; `nextOffset` continues with the same filters and language.

Measures distinguish HK$ million, year-on-year percentage change, quarter-to-quarter percentage change and counts. Annual and quarterly data remain separate through `freq`; quarterly periods end in 03/06/09/12. Real levels preserve the provider's 2000 price basis, and seasonally adjusted series remain separate. Sub-contractor output in 615-66011 is explicitly identified as subject to double-counting. Industry company/person counts retain their distinct indicators; source notes retain HSIC 2.0 and the 2020–2022 subsidy qualification. No rebasing, monetary conversion, aggregation or extrapolation occurs.

| Stable ID | Official table | MCP tool | Full rows per language | Live en/tc/sc | Tests / simulation |
|---|---|---|---:|---|---|
| API-0677 | 615-66001 | construction_output | 528 | PASS / PASS / PASS | PASS / PASS |
| API-0678 | 615-66002 | construction_output_seasonally_adjusted | 422 | PASS / PASS / PASS | PASS / PASS |
| API-0679 | 615-66011 | construction_nominal_by_trade | 2204 | PASS / PASS / PASS | PASS / PASS |
| API-0680 | 615-66012 | construction_real_by_trade | 1838 | PASS / PASS / PASS | PASS / PASS |
| API-0681 | 615-66021 | construction_nominal_broad_end_use | 792 | PASS / PASS / PASS | PASS / PASS |
| API-0682 | 615-66022 | construction_real_broad_end_use | 792 | PASS / PASS / PASS | PASS / PASS |
| API-0683 | 615-66023 | construction_nominal_detailed_end_use | 2864 | PASS / PASS / PASS | PASS / PASS |
| API-0684 | 615-66024 | construction_real_detailed_end_use | 2864 | PASS / PASS / PASS | PASS / PASS |
| API-0685 | 615-66031 | construction_nominal_by_activity | 1300 | PASS / PASS / PASS | PASS / PASS |
| API-0686 | 615-73001 | construction_industry_statistics | 200 | PASS / PASS / PASS | PASS / PASS |

## Exact validation results

- `bun run codegen`: exit 0; 69 generated files and two message catalogues. APIS.md changes only these ten tracker rows and totals (207 → 217 implemented). Registry, service module and manifest regenerated; generated directory is ignored by repository convention.
- `bun run test`: exit 0; **75 files, 3360 passed, 5 skipped (3365 total)**. Includes 83 dedicated batch tool/route tests plus ten shared all-tool cases. Tests cover validated bounds and filters, three languages, cache behavior, pagination, original units/flags/missing values, malformed envelopes/rows, invalid quarter periods, mismatched indicator/units, empty data, HTTP/JSON/network/timeout errors and no automatic retries. Service-scoped authenticated JSON-RPC `tools/list` and all ten `tools/call` paths are tested. Discovery requires each table in the full catalogue's top eight results.
- `bun run lint`: exit 0; zero warnings, including naming and 500-line enforcement.
- `bun run typecheck`: exit 0.
- `TURSO_DATABASE_URL=file:/private/tmp/batch059-evidence/build.db bunx drizzle-kit migrate`: exit 0 against a task-owned local database.
- `TURSO_DATABASE_URL=file:/private/tmp/batch059-evidence/build.db bunx next build --webpack`: exit 0; production compilation, typechecking and 44 static pages. No live database credentials used.
- `bun --conditions=react-server scripts/check-batch059.ts captures`: exit 0; all 30 complete archived responses validated through generated MCP tools.
- Same script `live`: exit 0; all 30 localized resources passed through the generated tools and real HTTP client, zero failed tables.
- `postman simulation run postman/simulations/batch059.sim.yaml --port 4959 --output ndjson`, with script `simulation`: client exit 0; **80 HTTP calls, zero failed tables**. Per table: three languages, HTTP 503, invalid JSON, provider error, malformed final row and valid empty data. Invalid limit rejected before HTTP. Request log contains all 80 calls; the real tool runtime, HTTP fetcher and transformer execute against the local fixture stand-in.
- External `python3 /private/tmp/batch059-evidence/audit.py`: exit 0; all 30 fixtures exactly match selected rows of SHA256-verified complete captures, only sample record count adjusted. All source pages link the implemented JSON resources; tracker diff contains exactly the ten requested IDs.
- `git diff --check`: exit 0.

## Provenance and evidence boundaries

`tests/fixtures/batch059/provenance.json` records complete-response hashes, zero-based selected rows and fixture hashes. Selection covers every observed indicator/unit/frequency/dimension tuple, flag and figure type, plus first and last rows. Only `header.count.noOfRecords` is adjusted to the sample length. All other response content remains unchanged. Empty values in sub-contractor data remain empty with their original not-applicable flags.

External archive: `/private/tmp/batch059-evidence/`. Contains ten source-page HTML captures, 30 complete JSON responses, source-resource manifest, capture metadata, provenance audit script/log, validation logs, local simulation log, repair-cycle record, final hashed manifest and implementation handoff. Generated ignored artifacts are hashed there too. Fixture and simulation evidence establishes behavior against stand-ins; the separate live run establishes current official resource access. Neither establishes deployment or independent parent verification.

## Repairs and remaining gate

Repair cycles: **1/3**. The initial capture harness compared the entire provider status dictionary to only `name` and `code`. The official successful response also contains `description` and `apiHelp`. Corrected the harness to require the success fields while permitting that documented metadata; re-used already captured English responses rather than refetching them. Success/nonempty assertions were preserved. No tool-test or production implementation repair was required. No genuine upstream failure occurred or was retried.

Sandbox Git metadata, DNS, loopback listener/process cleanup and Google Fonts failures were escalated as environment restrictions. They were not classified as upstream failures or repair cycles.

All ten APIs are retained; no exclusions or unverified implementation remain. Publication gate: the parent must obtain fresh independent RxCode successful verification for **every retained API and the final diff** before push or PR. Local successful-subset commit is authorized by the current orchestrator instruction. Board status, cadence and notifications were not changed.
