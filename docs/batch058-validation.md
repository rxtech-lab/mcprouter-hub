# Batch 058 validation

Scope: exactly API-0667–API-0676. All ten retained and individually **PASS** for implementation, current upstream data, local tests and local HTTP simulation. Independent parent RxCode verification remains pending; no push, PR or deployment.

Base: `03f8d267729295cef347378a28c50ed84527c681` (fetched `origin/main`). Branch: `codex/batch058`. Worktree: `/private/tmp/mcprouter-batch058`. Shared main was left untouched.

## Source verification and contract

On 2026-10-24 Hong Kong time, read all ten DATA.GOV.HK pages and the 30 actual linked C&SD JSON resources (en/tc/sc). All returned HTTP 200, success status and nonempty data. Dataset pages also advertise CSV/Excel; the implementation uses their published JSON API rather than inventing a file API. Orbit discovery returned unrelated US Census endpoints, which were rejected.

One discoverable read-only tool per tracker entry, in `censtatd-manufacturing-construction`. All use YAML HTTP requests with a response transformer, a fixed `/api/get.php` endpoint, `full_series=1`, 3600-second upstream caching per table/language, validated local filters, 1–100 row pages, offset 0–100000, and the shared 100 KB observation-page limit. Full responses are checked before filtering; malformed rows beyond the page are rejected. Source numeric/string values, missing values, flags, units, localized labels, source and notes are retained. Empty dimension codes have a separate `TOTAL` filter alias; original dimension fields remain unchanged.

Manufacturing tables retain counts versus HK$ million. Mining/quarry preserves both annual/monthly frequencies in tonnes. Construction indices explicitly expose April 2003 or April 2021 = 100; distinct material definitions remain separate. No aggregation, rebasing, monetary conversion or extrapolation is performed.

| Stable ID | Official table | Full rows per language | Live en/tc/sc | Local / HTTP simulation |
|---|---|---:|---|---|
| API-0667 | 610-72003 | 1400 | PASS / PASS / PASS | PASS / PASS |
| API-0668 | 610-72004 | 1260 | PASS / PASS / PASS | PASS / PASS |
| API-0669 | 610-72005 | 1344 | PASS / PASS / PASS | PASS / PASS |
| API-0670 | 610-72006 | 504 | PASS / PASS / PASS | PASS / PASS |
| API-0671 | 610-72013 | 72 | PASS / PASS / PASS | PASS / PASS |
| API-0672 | 610-92091 | 209 | PASS / PASS / PASS | PASS / PASS |
| API-0673 | 615-21001 | 128 | PASS / PASS / PASS | PASS / PASS |
| API-0674 | 615-21001A | 560 | PASS / PASS / PASS | PASS / PASS |
| API-0675 | 615-21002 | 1344 | PASS / PASS / PASS | PASS / PASS |
| API-0676 | 615-21002A | 5880 | PASS / PASS / PASS | PASS / PASS |

## Validation

- `bun run codegen`: exit 0; regenerated APIS.md, registry, service modules and manifest. Generated directory is ignored by repository convention. Tracker changed only the ten requested entries (197 → 207 implemented).
- `bun run test`: exit 0; 73 files, 3267 passed, 5 skipped (3272 total). Includes 83 dedicated batch tool/route tests and ten added cases in the shared all-tool suite.
- `bun run lint`: exit 0, zero warnings.
- `bun run typecheck`: exit 0.
- `TURSO_DATABASE_URL=file:/private/tmp/batch058-evidence/build.db bunx drizzle-kit migrate`: exit 0 against a task-owned local database.
- `TURSO_DATABASE_URL=file:/private/tmp/batch058-evidence/build.db bunx next build --webpack`: exit 0; production compile, typecheck and 44 static pages passed. No live database credentials were used.
- `bun --conditions=react-server scripts/check-batch058.ts captures`: exit 0; all 30 complete archived responses pass through generated tool validation.
- Same script `live`: exit 0; all 30 current localized resources passed through generated tools and real HTTP fetcher. No retries after genuine API failures (none occurred).
- `postman simulation run postman/simulations/batch058.sim.yaml --port 4958 --output ndjson` with script `simulation`: exit 0 for the client; 80 HTTP calls, zero failed tables. Per tool: three languages, HTTP 503, invalid JSON, provider error, malformed final row and valid empty dataset. Ten invalid limits rejected before HTTP. The Postman request log contains all 80 calls.
- Authenticated service-scoped JSON-RPC `tools/list` and all ten `tools/call` paths tested, including invalid input and actionable HTTP/provider errors. Discovery tests search the full catalogue and require the matching table in the top eight.

## Provenance and reproducibility

`tests/fixtures/batch058/provenance.json` records complete-response SHA256 hashes and the original zero-based row selections for every localized fixture. Selection covers all observed series, dimension codes, frequencies, units, flags and value types, plus first/last rows. Only header.count.noOfRecords is adjusted to the sample length; all other source values remain unchanged.

External archive: `/private/tmp/batch058-evidence/`. It includes 10 source-page HTML captures, 30 complete JSON captures, `captures.json` (URLs/status/timestamps/hashes), `source-resources.json`, `repair-cycles.json`, check logs, Postman request log and final `manifest.json`. Fixtures are local sampled evidence; Postman results establish behavior against those stand-ins; the separate live run establishes current provider access. None establish deployment or independent review.

## Repairs, cleanup and remaining gate

Repair cycles: **1/3**. Initial broad tests identified missing shared tool-case and scheduled live-check registrations; typecheck identified invalid-input-array inference. Added those registrations and the explicit test type. Existing malformed, upstream-error and empty assertions were preserved. No production transformer repair was required. The final focused run also checks mismatched indicator/unit combinations and discovery across the complete catalogue.

Sandbox failures for Git metadata, DNS, loopback listener/client and Google Fonts were escalated; these were environmental reruns, not genuine upstream failures.

No API was failed, blocked, incomplete or removed. No unrelated API, board state, cadence or task was altered. Local successful-subset commit is authorized by the latest orchestrator instruction and remains local. Parent must independently verify all ten APIs before any publication. No further implementation blocker is known.
