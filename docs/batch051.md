# MCP batch 051 validation

Status: **partial, 9/10 verified and implemented**. API-0050 is excluded.
No push or PR. Parent must independently verify each retained API and the cleaned
subset before publication. No board completion/review status was set.

## Ownership and scope

- Branch: `codex/batch051`
- Worktree: `/private/tmp/mcprouter-batch051`
- Freshly fetched base: `57a289d039295facc67389135ced15abb336169b` (`origin/main`).
- Shared main was preserved. Task035 and other worktrees were not changed.
- Evidence archive outside the worktree: `/private/tmp/batch051-evidence`.
- Nine tools across six new services; stable tracker IDs and dataset IDs are
  registered only for the nine working APIs. `mcp/apis.yaml` IDs were unchanged.
- `APIS.md` and ignored generated artifacts were regenerated: implemented count
  178 → 187 of 3,819; API-0050 remains Coming soon.

## Per-ID results

All ten official CKAN package metadata responses were captured successfully.
The following outcomes refer to actual data, rather than metadata or portal HTML.

| Stable ID | Outcome | Tool | Live contract and coverage |
|---|---|---|---|
| API-2336 | success, retained | `hktr_interest_rate_positions` | HKMA `/public/financial-market-infra/trade-repository/hktr-data-disclose-ir?segment=positions`: successful header, numeric positions records, page size/offset; published Swagger captured. Generated tool passed live. |
| API-2337 | success, retained | `hktr_members_lei` | HKMA `/public/financial-market-infra/trade-repository/list-of-tr-member-with-lei`: TR code/name, service and nullable LEI; published Swagger captured. Generated tool passed live. |
| API-2598 | success, retained | `ird_offices` | CSDI `ird_rcd_1668166144542_67785/FeatureServer/0/query`: actual bilingual office features, hours and WGS84 points. Layer schema and feature response captured. Generated tool passed en/tc. |
| API-0049 | success, retained | `hk_address_lookup` | ALS `/lookup?q=central%20government%20offices` with `Accept: application/json`: bilingual structured suggestions, score and coordinates. Generated tool passed en/tc. |
| API-0050 | failed, excluded | none | Published `https://www.hongkongpost.hk/opendata/post-office.json` returned HTTP 403 CloudFront HTML on 2026-10-23 at 13:03 UTC. No genuine-failure retry, alternate attempt, implementation, fixture, registration or live case retained. This is observed access failure, not proof of global provider unavailability. |
| API-0051 | success, retained | `lcsd_swimming_pools` | CSDI `lcsd_rcd_1634540558875_77434/FeatureServer/0/query`: actual bilingual facilities, opening details, contacts and WGS84 points. Generated tool passed en/tc. |
| API-0052 | success, retained | `hk_government_press_releases` | Government RSS `general_en.xml`, `general_zh.xml` and ISD Simplified Chinese translation endpoint. Generated tool passed en/tc/sc. |
| API-0573 | success, retained | `regional_office_counts` | C&SD `325-43001` JSON, annual counts by office status, localized units and rounding notes. Full responses and generated tool passed en/tc/sc. |
| API-0574 | success, retained | `regional_office_employment` | C&SD `325-43002` JSON, annual persons engaged by office status, original counts and rounding notes. Full responses and generated tool passed en/tc/sc. |
| API-0575 | success, retained | `regional_offices_parent_location` | C&SD `325-43011` JSON, annual parent-location counts and percentages; source notes warn of multiple parent locations. Full responses and generated tool passed en/tc/sc. |

No blocked or unverified ID is registered. No file-only adapter was necessary:
working structured JSON, RSS/XML, or ArcGIS feature resources were verified for
all retained IDs. Portal HTML alone was not accepted as data.

## Contract behavior

YAML HTTP tools use the existing request/response transformer conventions.
Spatial tools reuse the shared bounded ArcGIS handler and validate source names,
IDs and geometry. Inputs have bounded paging, enums and patterns; malformed
inputs fail before HTTP. Responses preserve source fields and nulls, address
languages, statistical dimensions, original figures/units, missing values,
flags, rounding and overlap notes. HKMA's response lacks a unit label, so tool
discovery explicitly warns against interpreting or converting notional amounts
without its official disclosure notes. Provider breakdowns are not additive.

Outputs use the shared 100 KB record-page bound. HKMA positions are additionally
limited to 20 records; RSS to 50 and 2,000 summary characters with explicit
truncation. RSS summaries are plain text; full releases remain at source links.
Caches retain raw upstream responses for 3,600 seconds (RSS 300). Source language
variants are keyed by their actual URL. ALS local pagination covers returned
suggestions, RSS covers the current feed, and HKMA datasize denotes page size.

## Validation evidence

| Check | Exact result | Archive |
|---|---|---|
| Initial focused tests | 3 files, 474 tests passed | `focused.log` |
| Full suite after cycle 1 | 69 files, 3,082 passed, 5 skipped, 3,087 total; exit 0 | `full-tests.log` |
| Lint after cycle 1 | `eslint . --max-warnings=0`, exit 0 | `lint-cycle1.log` |
| Typecheck after cycle 1 | Next typegen and `tsc --noEmit`, exit 0 | `typecheck-cycle1.log` |
| Codegen | 66 files generated, 2 message catalogues compiled | `codegen-final.log` |
| Codegen freshness | 66 files up to date, exit 0 | `codegen-check.log` |
| Generated-tool live checks | 20 passed, 0 failed; all supported languages | `generated-live-escalated.log` |
| Postman simulation | 20 successes, 36 expected errors, 56 real HTTP requests; 9 invalid inputs rejected before HTTP; exit 0 | `simulation-check-escalated.log`, `simulation-escalated.ndjson` |
| Production build | Local isolated SQLite migrations, codegen, Turbopack compile, TypeScript and page generation; exit 0 | `build-cycle2-escalated.log` |
| Diff whitespace | `git diff --check`, exit 0 | final archive manifest |

The five suite skips are pre-existing optional integration cases; no Batch051
tests were skipped. Simulation runs actual generated tools and the shared HTTP
client against checked-in replays; it does not prove upstream availability.
Separate live checks establish the latter for the retained subset.

Fixtures contain compact original captured records. Member fixtures include a
real null LEI. Artificial malformed/provider/error/empty cases are labeled as
failure scenarios, not presented as provider captures. No assertions were
weakened, deleted or replaced to obtain a passing run.

Orbit discovery returned general Hong Kong CSDI candidates, not the exact ten
contracts; official metadata, Swagger, layer schemas and actual data were the
contract evidence. No Postman workspace search, publication or authentication
setup was needed; local mocks replay the verified official captures.

## Repair cycle 1 of 3: static declarations

**Root cause evidence:** The initial runtime/route/central suite passed 474
checks. Lint then failed on the unused `ToolInput` import in `tests/tools.test.ts`
after its unchanged `Case` type was moved to `tests/tool-case.ts` to keep the
legacy file below its existing line ceiling (`lint.log`). Typecheck reported
five TS2339 errors for `period`, `STATUS` and `COUNTRY_PARENT`: TypeScript inferred
the mapped C&SD row as only `{ measure: string }`, losing the keys preserved by
the runtime spread (`typecheck.log`). Actual C&SD records and generated live
calls showed those fields were preserved, so this was a static declaration
repair; it was not diagnosed as bad provider data or an assertion defect.

**Affected checks:** lint and typecheck. No runtime test or provider contract
was changed.

**Fix:** remove the unused test import and annotate the C&SD mapping callback's
return type as `Record<string, unknown>`.

**Revalidation:** lint and typecheck exited 0; the full suite passed 3,082 tests
with five existing skips. All malformed/error/empty assertions remain intact.
The simulation subsequently passed all 56 HTTP cases and nine invalid inputs.

## Repair cycle 2 of 3: isolated build dependencies

**Root cause evidence:** The first production build failed because the isolated
worktree's `node_modules` symlink pointed outside Turbopack's filesystem root.
`build.log` reports `Could not find the Next.js package (next/package.json)` and
explicitly identifies root `/private/tmp/mcprouter-batch051`. Installed Next.js
Turbopack root-resolution guidance was read before the repair.

**Affected check:** production Turbopack build, not tool tests or live contracts.

**Fix:** replace only the task-owned dependency symlink with an APFS cloned local
copy of the existing dependency installation. No package, lockfile, Next config,
product source, fixture or assertion changed.

**Revalidation:** a sandbox run started compilation but was interrupted before
completion (`build-cycle2.log`); it is not counted as a pass. Required process
inspection was escalated after sandbox EPERM and confirmed no build remained.
The escalated production command then completed successfully with migrations,
codegen, optimized Turbopack compilation, TypeScript checking, and static/dynamic
route output (`build-cycle2-escalated.log`, exit 0). **No Webpack fallback was
used.**

Budget consumed: **2/3**, including both declaration and environment repairs
conservatively. No additional repair cycle was used.

## Sandbox escalation and remaining boundary

Initial curl and generated-tool reads failed at sandbox DNS resolution before
reaching providers. They were rerun with required escalation and succeeded for
the nine retained APIs. Postman initially failed to bind loopback (`listen EPERM`)
and the sandbox client could not connect; both server and client were escalated.
These were environment escalations, not genuine API retries or assertion changes.
TLS verification stayed enabled throughout.

API-0050 remains failed and excluded without retry. Exact ten-ID acceptance is
therefore incomplete. The successful subset is ready for the parent's independent
verification, not for automatic publication. The archive manifest records final
base/head, per-ID outcomes, owned files and exact diff.
