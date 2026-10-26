Implementation evidence for exactly API-0309–0318. Base/fetched `origin/main`: `736e2af3da2c7ee575d826916e4f90b9a7d319a6`. Owned branch `batch094-population`, worktree `/private/tmp/mcprouter-batch094`. Final commit/head and frozen file hashes are in `/private/tmp/batch094-evidence/handoff.json` and `evidence-manifest.json`. Independent verification and publication are the orchestrator's next gates; no push, PR, task-status move or deployment was performed.

## Final cycle-3 verification setup (resolved)

The independent report `/private/tmp/batch094-independent-report.md` at original implementation head `29aefc1b63fcfbf6772cc4b74f16f373e0294479` found all ten local implementations, 708 tests, 60 replays, 278 hashes, codegen and outgoing history PASS. Full markers remained UNVERIFIED because authoritative task input and a locked-version build were unavailable. The parent supplied the authoritative task export `/private/tmp/batch094-authoritative-task.json` for task `FB7E377F-910B-420D-ACA3-7FDE448CD084`, now archived under the evidence directory. Current explicit user rules authorize local commits and supersede the export's stale no-commit/attention text. No board changes were made.

Only the task-owned `node_modules` symlink was unlinked, after verifying its exact shared target. `bun install --frozen-lockfile` installed 743 packages into an isolated real directory: Next **16.4.3**, @types/node 26.6.5. `package.json` and `bun.lock` hashes are unchanged; shared Next/@types version-file hashes are unchanged. No shared dependencies were modified. Bun used was 1.4.0. Lock SHA-256: `885d880ad96f5674f844ea2017d62654b5519a8e9940d70236823709c9c7990d`.

| Locked-dependency command | Result | Evidence log |
|---|---|---|
| `bun install --frozen-lockfile` | PASS; Next 16.4.3 | `cycle3-install.log` |
| `bun run test` | 5,019 passed, 46 existing skips, 112 files passed | `cycle3-full-tests.log` |
| `bun run lint` | PASS | `cycle3-lint.log` |
| `bun run typecheck` | PASS | `cycle3-typecheck.log` |
| `bun scripts/codegen.ts --check` | 95 files current | `cycle3-codegen-check.log` |
| `bun run i18n:check` | 836 strings current | `cycle3-i18n.log` |
| `bun --conditions=react-server scripts/check-batch094.ts captures` | 60 complete-capture checks PASS | `cycle3-captures-checks.log` |
| `TURSO_DATABASE_URL=file:local.db bun run build` | Default Turbopack production build PASS on Next 16.4.3; TypeScript and 44 static pages PASS | `cycle3-build.log` |

Every command exited 0 in the owned worktree. Exact results/log hashes are in `cycle3-results.json`; dependency isolation evidence is in `cycle3-before.json` and `cycle3-dependencies.json`. This cycle made no provider calls or retries, no API behavior changes and no test/assertion changes. Earlier HTTP simulation and live-provider results remain archived evidence. The final local commit changes only this document and the tracked repair ledger; implementation files still match the independently inspected original head. Repair budget is **3/3 used, 0 remaining**. Setup is resolved; full final-head independent verification/publication markers remain for the parent to determine. No push, PR, deployment or review/done move.

## Per-ID acceptance

| API | Table | MCP tool | Rows per language | Implementation AC |
|---|---|---|---:|---|
| API-0309 | 110-06814 | `district_population_marital_status` | 14,250 | PASS |
| API-0310 | 110-06815 | `district_population_economic_activity` | 5,700 | PASS |
| API-0311 | 110-06831 | `district_population_median_age` | 5,700 | PASS |
| API-0312 | 110-06832 | `district_population_sex_ratio` | 1,900 | PASS |
| API-0313 | 110-06833 | `district_population_dependency_ratio` | 950 | PASS |
| API-0314 | 115-01011 | `population_vital_events` | 1,984 | PASS |
| API-0315 | 115-01012 | `births_mainland_mothers` | 119 | PASS |
| API-0316 | 115-01012A | `monthly_live_births_by_sex` | 2,019 | PASS |
| API-0317 | 115-01013 | `first_marriages_by_sex_age` | 800 | PASS |
| API-0318 | 115-01014 | `cross_boundary_marriages_certificates` | 280 | PASS |

Every listed ID passed: catalogue resource-URL verification; actual JSON envelope and complete en/tc/sc observation validation; original dataset join; YAML HTTP transformer registration; discoverability and scoped MCP route call; fixture tests including errors/malformed/empty data and bounded validated inputs; codegen and APIS.md generation; simulation and uncached live runtime calls. No unavailable or excluded API. Each tool calls one fixed official `get.php` resource; this is 10 tools on one upstream HTTP endpoint, with 10 fixed table selections. No invented file API or generic arbitrary URL fetch.

## Contract

Service `censtatd-population-vital` reuses the YAML HTTP executor and bounded `page` helper, with a service-local response transformer. `freq`, `period`, `indicator`, `measure` and table-specific dimension-code filters are local; only the published table ID/full_series/language reach upstream. Limit is 1–100 records, default 20, offset 0–1,000,000, and records are also bounded to 100 KB per page; notes/header are additional. Continuation uses nextOffset and identical filters. Newest source periods sort first. Raw localized bodies cache for 3,600 seconds; language selects distinct cache entries, and local pages/filters reuse them. Transport timeout is 30 seconds; upstream HTTP, network, timeout, JSON/envelope and observation failures remain actionable errors.

Original figures (including empty strings), units/descriptions, flags, notes and mixed numeric/string dimension values are preserved. `measure` is the English source unit label consistently across languages. Vital-events unit aliases are keyed by indicator because Chinese 比率 denotes both Rate and Ratio. Source SEX omission is distinct from explicit total; TOTAL filters only an existing empty dimension. The monthly births table contains annual as well as monthly series; `freq` separates them. Do not sum overlapping totals, percentages, rates and levels; notes retain survey exclusions, rounding, boundary comparability and revisions.

## Provenance

`tests/fixtures/batch094/manifest.json` records all 30 complete source SHA-256 hashes, fixture SHA-256 hashes, original row indices, exact source URLs, source row counts, stable API IDs and datasets. Fixtures contain the actual header and deterministic unmodified row excerpts covering every dimension code, indicator, source unit, frequency, source flag and figure type, plus boundary periods. `provenance.json` in the external evidence directory confirms exact excerpt/header equality against hash-verified complete captures and that each official catalogue advertises the implemented localized URL. Captures, times, HTTP status and hashes: `captures.json`, `catalogue.json`, `live/*.meta`; original byte bodies and catalogue HTML remain external. All en/tc/sc bodies have the same non-description fields.

## Historical cycle-2 validation

All logs below are in `/private/tmp/batch094-evidence/`.

| Check | Result | Log |
|---|---|---|
| Focused fixtures + scoped MCP routes | 103 passed | `focused.log` |
| Cycle-2 focused/tool/live-registration revalidation | 708 passed | `revalidation-focused.log` |
| Final full Vitest suite | 5,019 passed, 46 existing skips, 112 files passed | `full-tests-final.log` |
| ESLint | PASS | `lint-final.log` |
| Next typegen + TypeScript | PASS | `typecheck.log` |
| i18n freshness | 836 strings current | `i18n.log` |
| Codegen freshness | 95 files current | `codegen-check.log` |
| Production Webpack build | PASS; 44 static pages | `build-webpack.log` |
| Complete localized capture replay | 60 checks PASS, every row/field across all pages | `captures-checks.log` |
| Real HTTP Postman simulation | 270 checks PASS, 210 requests, all table/language combinations logged | `simulation-checks.log`, `simulation.ndjson` |
| Uncached generated-tool live execution | 30 localized calls PASS | `live-checks.log`, `live/` |
| Fixture/source/catalogue provenance | 30 PASS | `provenance.json` |
| Patch whitespace | PASS | `diff-check.log` |

Historical cycle-2 limitation (resolved by cycle 3 above): `bun run build` completed migrations/codegen but default Turbopack could not resolve shared node_modules outside the worktree. The repository-supported `next build --webpack` then passed; this is Webpack build evidence, not Turbopack success. Dependencies are linked to the existing main-workspace installation; the build reports Next 16.4.2, whereas package.json requests 16.4.3. No install or dependency changes were made. Sandbox DNS and loopback EPERM were escalated; these are separate from provider behavior. Postman CLI 1.75.0 ran locally. Orbit search returned unrelated public APIs, so no candidate was selected; the owner's mock search required login. Local mocks derive only from captured official responses. No remote Postman workspace mutation.

Generated files live under ignored `generated/` by repository convention and are reproducible with `bun run codegen`; APIS.md is tracked. No UI or Next.js application code changed. AGENTS.md and the installed route-handler guide were read. Existing meaningful malformed/error/empty/coverage assertions were retained. Repair budget at cycle-2 handoff: 2/3 used; see `batch094-repair-ledger.md` and external ledger. Initial failing logs remain external for audit. No deployment, browser, independent-agent or publication claims are made.
