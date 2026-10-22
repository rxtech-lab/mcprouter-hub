# Health batch 025 — PARTIAL, awaiting independent RxCode verification

Implemented and locally validated five of the requested ten tracker entries. No commit, push, PR, task-status change, schedule change, or notification was performed. Independent explicit RxCode verification of this final subset is pending; publication must stop at that gate.

- Branch: `codex/batch025-health`
- Worktree: `/private/tmp/mcprouter-batch025`
- Freshly fetched remote default/base and current HEAD: `86121bda35581d72f5873eb52fee7bbb215a0a04` (`origin/main`)
- Original checkout: `/Users/qiweili/Desktop/rxlab/mcprouter-hub`, local `main` preserved at `dfc4a46`, clean.
- Evidence directory outside the publishable tree: `/private/tmp/batch025-evidence`.
- Repair cycles: **2/3 used**, described below. No genuine provider failures were retried.

## Per-ID source outcome

Every catalogue probe used `https://data.gov.hk/en-data/api/3/action/package_show?id=<dataset>`. Correct-path probes ran at 2026-10-22 09:04:47–48 UTC. Raw headers, bodies, timestamped request records and fixture hashes are retained in the evidence directory. A failed catalogue request does not establish that the underlying dataset has disappeared.

| ID | Metadata/resource evidence | Final outcome |
| --- | --- | --- |
| API-0842 | `API-0842.metadata.request.json`, `.metadata.headers`, `.metadata.json`: HTTP 502, official HTML error page | Excluded, no retry; resource formats and actual table availability unverified |
| API-0843 | Same per-ID evidence filenames: HTTP 502, official HTML error page | Excluded, no retry; resource formats and actual table availability unverified |
| API-0844 | Same per-ID evidence filenames: HTTP 502, official HTML error page | Excluded, no retry; resource formats and actual table availability unverified |
| API-0845 | Same per-ID evidence filenames: HTTP 502, official HTML error page | Excluded, no retry; resource formats and actual table availability unverified |
| API-0846 | Same per-ID evidence filenames: HTTP 502, official HTML error page | Excluded, no retry; resource formats and actual table availability unverified |
| API-0847 | Metadata HTTP 200; published XLSX/CSV/JSON in en/tc/sc; JSON table 930-92090 HTTP 200, 246 rows in each language | Retained: `health_hiv_aids_by_sex` |
| API-0848 | Metadata HTTP 200; published XLSX/CSV/JSON in en/tc/sc; JSON table 930-92092 HTTP 200, 132 rows in each language | Retained: `health_school_immunisation` |
| API-0849 | Metadata HTTP 200; published XLSX/CSV/JSON in en/tc/sc; JSON table 930-92093 HTTP 200, 27 rows in each language | Retained: `health_accident_emergency` |
| API-1292 | Metadata HTTP 200; published CSDI API links for en/zh-hk/zh-cn; service/layer schema and FeatureServer/0/query HTTP 200, 3 clinics | Retained: `health_chinese_medicine_clinics` |
| API-0044 | Metadata HTTP 200; CSV-only `http://www.chp.gov.hk/files/misc/flux_data.csv`, download HTTP 200, 668 weekly rows | Retained: `health_flu_express`; structured CSV adapter, no invented API |

[Retained official resource URLs and format declarations](health025-resources.json). No stable IDs were renumbered and `mcp/apis.yaml` was unchanged. Failed entries have no service declaration, fixture, adapter, live case or generated registration. APIS.md changes only the five retained rows and totals (165 → 170 implemented). All new fixture files are byte-for-byte copies of successful provider captures; `fixture-hashes.json` in the evidence directory records hashes and sizes.

## Contract

`mcp/services/hk-health/service.yaml` uses the existing YAML HTTP executor and response transformers. Each tool has validated `limit` (1–100), `offset` (0–100000), bounded substring search, en/tc/sc selection, and a one-hour raw-source cache. Table cache keys separate languages; the clinic and CSV downloads are reused across local language selections.

C&SD tools preserve all published observation fields, dimension descriptions, units, missing figures, revision flags and source notes. Filters cover year/quarter, frequency, statistical variable and text; observations sort newest first. Immunisation years identify academic years starting in September. HIV/AIDS totals overlap sex-specific observations; callers must not sum totals with their components.

The clinic tool preserves all published names/addresses and projects the selected official language into `name`/`address`, with validated WGS84 longitude/latitude. It downloads the small directory with a fixed 100-record bound, then filters/pages locally. A provider transfer-limit flag or an oversized directory fails explicitly rather than silently omitting clinics.

Flu Express is parsed strictly with Papa Parse from the actual CSV download. Headers, field counts, dates, weeks and numerical cells are validated. Source column names and numeric strings remain intact, blanks remain missing, and proportions remain fractions. Year/week filters are available. The source publishes English column names; tc/sc requests retain those source names and report `sourceLanguage: en`.

Output pages stop at 80 KB of record content, with at most 100 rows and an offset for the next unconsumed row. Malformed or individually oversized records, failed query statuses, provider error envelopes, invalid coordinates and unsupported formats fail actionably. Source notes have a separate size bound. There is no automatic provider retry. No Next.js/UI source was edited.

## Validation

- `bun run codegen`: passed, 59 generated files and 2 message catalogues. `bun scripts/codegen.ts --check`: passed. Generated artifacts are ignored by the repository; APIS.md is the tracked generated change.
- Focused tests: 640 passed before the final five additional MCP route failure checks.
- Final `bun run test`: **65 files passed; 2150 tests passed, 5 skipped (2155 total)**. Includes captured fixtures, pagination, filters, empty results, language/cache behavior, malformed inputs/records, HTTP/format failures, central `tests/tools.test.ts` coverage, MCP scoped route discovery/calls and route errors, tool search, and full live-case registry coverage. Existing global coverage assertions remain intact.
- `bun run lint`: passed.
- `bun run typecheck`: passed (`next typegen && tsc --noEmit`), after production build.
- `git diff --check`: passed.
- [Production-executor live evidence](validation/health025-live-escalated.json): **15 language variants passed, 11 real provider HTTP requests, 0 failures**. Checks cover source values, output bounds, language selection, paging, empty/search results, raw-download caching and input rejection before network. These checks do not prove future upstream availability.
- [Postman simulation evidence](validation/health025-simulation-escalated.json): **15 variants passed, 75 actual loopback HTTP requests, 0 failures**, with 75 `request` events in `simulation.ndjson`. Fault injection covers HTTP 503 HTML, HTTP 200 HTML, malformed payloads and valid empty sources. Production adapters and the shared fetcher ran against captured-source stand-ins. Error/empty payloads are deliberate simulation scenarios, not fabricated live fixtures.
- Default `bun run build`: sandbox-blocked Google Fonts download. Repeated with escalation as required; then Turbopack failed on restricted worker IPC/port binding (`Operation not permitted`). Default Turbopack build remains environment-blocked.
- `TURSO_DATABASE_URL=file:/private/tmp/batch025-build.db BILLING_ENABLED=false bun run build --webpack`: **passed**, including migrations against an isolated temporary SQLite database, optimized production compilation, TypeScript and **44 prerendered pages**. No remote database was migrated.

Orbit discovery returned unrelated US Census services and supplied no usable Hong Kong contract. Official catalogue metadata, provider schemas and actual downloads determined this implementation. No provider-owned mock was supplied; the local Postman mock replays these captured public resources. Nothing was pushed to a Postman workspace or deployed.

## Reproduction and restrictions

Run `postman simulation run postman/simulations/health025.sim.yaml --port 4925 --output ndjson`, then in another terminal run:

```
HEALTH025_SIM_URL=http://127.0.0.1:4925/upstream HEALTH025_REPORT=/tmp/health025-simulation.json bun --conditions=react-server scripts/check-health025.ts
```

For retained sources only, run `HEALTH025_REPORT=/tmp/health025-live.json bun --conditions=react-server scripts/check-health025.ts`. The live script stops further language probes for an ID after any genuine failure. Do not re-probe excluded API-0842–0846 without authorization.

Sandbox DNS failures and Postman loopback EPERM/access failures were re-executed with escalation and never classified as provider outages. Initial sandbox results remain in the evidence directory alongside successful escalated results.

Repair cycle 1: the exploratory metadata probe omitted `/en-data/` and received HTTP 404. Existing `docs/environment-batch021-resources.json` proved the correct path. Corrected the probe and retained both attempts; these wrong-path responses were not source failures.

Repair cycle 2: three fixture assertions expected an annual A&E observation within a two-row page containing newer quarterly rows. Added the captured row's frequency to the filter while preserving the exact-row assertion. Static type validation also required binding the narrowed clinic attributes before a callback. Raw fixture bytes and all coverage assertions were preserved. Initial direct `tsc` lacked generated Next.js route types; the documented build/typecheck commands generated them. No source failure was repaired or retried.

Final diff/history audit: no commits beyond the fetched base; only the five successful IDs appear in new service/fixture/manifest/live entries. The five excluded rows remain Coming soon. Unrelated branches and worktrees were preserved, including task035. The task-owned worktree remains for independent verification; no publication is authorized until that verification explicitly succeeds.
