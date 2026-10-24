# Batch 067 validation

Exactly API-0816–0825 are implemented by `censtatd-energy`. All ten pass implementer validation; independent verification of the final local head remains pending. No push, PR, deployment, notification or board transition is authorized or performed.

Base: remote default `origin/main` at `a775b9741fae188f9966712d751c453a0d64b48e`. Owned branch: `codex/batch067`; worktree: `/private/tmp/mcprouter-batch067`. The shared checkout and PR69 worktrees are untouched. The final commit and full diff are recorded in `/private/tmp/batch067-evidence/manifest.json` and its referenced audit files.

## Upstream contracts

On 2026-10-24, captured ten DATA.GOV.HK source pages and thirty actual full-series C&SD JSON bodies with verified TLS. Each portal advertises all three localized JSON URLs. Every body reports success, nonempty observations and matching record count. All requested sources support live JSON; none is unavailable or needs a file adapter. Alternative download contents were not validated or used. Orbit returned unrelated providers, so no candidate was selected. Postman owner-mock lookup required unavailable authentication; local mocks replay captured official responses instead. No remote Postman state changed.

| API | Table | Discoverable tool | Implementer result |
| --- | --- | --- | --- |
| API-0816 | 915-91103 | `energy_import_unit_values` | PASS |
| API-0817 | 915-91104 | `monthly_energy_net_imports` | PASS |
| API-0818 | 915-91105 | `oil_storage_and_stocks` | PASS |
| API-0819 | 915-91106 | `oil_sales_by_user` | PASS |
| API-0820 | 915-91107 | `oil_imports_by_supplier` | PASS |
| API-0821 | 915-91108 | `coal_imports_by_supplier` | PASS |
| API-0822 | 915-91109 | `oil_reexports_by_destination` | PASS |
| API-0823 | 915-91110 | `coal_reexports_by_destination` | PASS |
| API-0824 | 915-91201 | `monthly_electricity_gas_consumption` | PASS |
| API-0825 | 915-91202 | `electricity_gas_consumption_revenue` | PASS |

The service follows existing YAML HTTP transformer conventions. It validates language, period, frequency, indicator, measure and official category codes before HTTP. Responses validate every observation before filtering, including exact indicator/category/unit combinations. Original figures, localized labels, flags, notes and source are preserved; there is no conversion or aggregation. Output adds normalized filter aliases and units, sorts newest first and paginates at most 100 observations and 100 KB of rows. The one-hour raw-response cache varies by upstream resource and language; local filters and pagination reuse it. Explicit source totals map to `TOTAL`. Electricity exports lack a user dimension upstream; their normalized user is null, never a total. Revenue, consumption, percentage shares, stock utilization, days of offtake, unit prices and physical quantities remain distinct.

## Validation

- `bun run codegen` passes; `bun scripts/codegen.ts --check` verifies 80 generated files. Generated artifacts remain ignored by repository convention and are archived externally. APIS.md changes exactly ten IDs: 276 to 286 implemented.
- Final focused fixture/tool/discovery/MCP route tests: **87 passed** in two files, including absent user categories, product unit swaps and consumption/revenue/share separation.
- Final full suite: **4,240 passed, 5 existing skips**, 89 files passed. Every tool has central `tests/tools.test.ts` coverage through `commerceCases`, route/discovery coverage and a scheduled live-check case.
- `bun run lint`, `bun run typecheck`, `git diff --check` pass. `bunx next build --webpack` passes using migrated task-owned database `/private/tmp/batch067-evidence/build.db`.
- Full capture replay: **30 localized calls**, paginated traversal preserves every original field of **49,467 observations**. This validates captured data separately from current live access.
- Separate live runtime: **30/30 calls pass**, zero failed tables, no retries.
- Postman simulation: **80/80 calls pass**, exactly 80 request events in its trace. Every tool uses actual local HTTP for three languages, HTTP 503, invalid JSON, provider failure, malformed final observation and valid empty data. The simulation is stopped after validation.
- Provenance audit verifies **40 source artifact hashes**, **30 fixture hashes**, **1,257 unchanged fixture observations** against original indices, and exactly the ten requested tracker transitions. Fixtures cover each observed series/unit combination, frequency, flag, figure type, missing state and sign state.

## Repair ledger and evidence boundary

Used **2/3** evidence-driven repair cycles, recorded in `/private/tmp/batch067-evidence/repair-ledger.json`: (1) declare the omitted per-tool language input; (2) compact contract literal formatting to satisfy the existing 500-line lint ceiling. Assertions and coverage were preserved. No genuine or uncertain API failure was retried. Sandbox DNS, loopback access and build font downloads required approved escalated runs; these were environment restrictions, not provider failures. No TLS checks were disabled. No Next.js or UI implementation changed.

The evidence directory includes raw bodies, hashes, fixture provenance audit, validation logs, local HTTP simulation trace, repair ledger, generated archive, full diff and local commit audit. All ten IDs are retained; none is failed, blocked or unverified by the implementer. Stop at the local commit for parent-requested independent RxCode verification of the exact head, all retained IDs and complete clean diff. Do not push or create a PR before that gate.

## Integration after PR 69 merged

The parent integrated current main `1d4e3c8` after PR 69 auto-merged with all checks successful. The shared `commerceCases` conflict was resolved by preserving both cases064 and cases067; no case or assertion was removed. Regenerated tracker counts are 286 to 296 implemented, with exactly API-0816–0825 newly implemented relative to current main. This integration does not consume a harness-repair cycle: no test defect or API failure occurred. Final local validation: full suite 4335 passed, five existing skips; codegen freshness81 files, lint, translations831, isolated-database production Webpack build and sequential typecheck pass. The original implementation head and evidence above remain historical; final independent verification is required at the integration commit before publication.
