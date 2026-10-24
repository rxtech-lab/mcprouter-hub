# Batch073 validation: five verified entries, exact batch incomplete

The requested batch is **incomplete: 5/10 retained**. Only API-2190, API-2414, API-2418, API-2420 and API-2430 are implemented. All task-introduced Coin Cart implementation and fixtures were removed after its generated live request failed. The four empty HKSTP statistics have no implementation, fixture or registration. Stable tracker IDs and all unrelated services remain unchanged.

Owned worktree: `/private/tmp/mcprouter-batch073`; branch: `codex/batch073`. Freshly fetched remote default base: `origin/main`, `f0211be8572925e29193d8517b60fca998e8d6bf`. The final local commit, diff hash and history audit are recorded in `/private/tmp/batch073-evidence/manifest.json`. Independent RxCode verification of the exact final commit and each retained API is pending. No push, PR, deployment or board transition was performed.

## Per-ID evidence and disposition

All ten DATA.GOV.HK package metadata responses and the actual published resource bodies were inspected on 2026-10-24. Metadata alone did not establish implementation. Raw headers, bodies, URLs and hashes are in `resources.json`, `body-manifest.json`, `contract-manifest.json` and their referenced capture files in the evidence directory.

| Stable ID | Current resource and contract | Disposition |
| --- | --- | --- |
| API-2156 | HKMA `/public/coin-cart-schedule?lang=en` and tc/sc default captures returned schedule JSON. The exact generated application request `https://api.hkma.gov.hk/public/coin-cart-schedule?pagesize=1&offset=0&lang=en` returned HTTP 405. The runtime error excerpt is retained in `live.log`; no full body was saved for that request. | Excluded; no retry, implementation/fixtures/tests/registration/live/discovery/simulation code removed. |
| API-2190 | Official CSDI `hkma_rcd_1640054678975_66504`, FeatureServer layer 0. Layer metadata and actual features confirm multilingual address/name fields and WGS84 point. | Retained: `hkma_information_centre`, en/tc/sc preference. |
| API-2414 | `https://opendata.hkstp.org/corporate/companydirectory/v1/`; documented `{value:[company]}` JSON. Capture has 1,734 companies. Gzip transfer body decoded locally. | Retained: `hkstp_companies`, en/tc/sc preferred fields, literal text search and exact English cluster filter. |
| API-2417 | `https://opendata.hkstp.org/corporate/figures/directinvestment/v1/` returned HTTP 200 with exactly `{"item":"","value":null}`. | Excluded; no usable statistic, no retry. |
| API-2418 | `https://opendata.hkstp.org/corporate/recruitment/v1/`; documented JSON array. Capture has 509 vacancies. Gzip transfer body decoded locally. | Retained: `hkstp_jobs`, literal text search; original source languages and date offsets retained. |
| API-2419 | `https://opendata.hkstp.org/corporate/figures/incubationgraduates/v1/` returned HTTP 200 with exactly `{"item":"","value":null}`. | Excluded; no usable statistic, no retry. |
| API-2420 | `https://opendata.hkstp.org/corporate/figures/laboffice/v1/` returned `{"item":"lab & office space","value":"4 million sq ft"}`; official dictionary specifies sq ft. | Retained: `hkstp_lab_office_space`; original textual value preserved, no inferred conversion or series. |
| API-2423 | `https://opendata.hkstp.org/corporate/figures/rdpractitioners/v1/` returned HTTP 200 with exactly `{"item":"","value":null}`. | Excluded; no usable statistic, no retry. |
| API-2424 | `https://opendata.hkstp.org/corporate/figures/technologycompanies/v1/` returned HTTP 200 with exactly `{"item":"","value":null}`. | Excluded; no usable statistic, no retry. |
| API-2430 | Hongkong Post JSON download returned 403 and was not retried. Its separately published official CSDI `hkpo_rcd_1639016844639_48104`, layer 0, returned 27 kiosks with addresses, weekday/Saturday/Sunday/holiday hours and WGS84 points. | Retained: `ipostal_kiosks`, en/tc preference with original bilingual attributes. |

The advertised resource sets contain JSON and CSDI APIs; no file-only dataset requires a download/parser adapter in this batch. HKSTP PDF data dictionaries were read as contracts, not treated as data APIs. Orbit search returned unrelated candidates, so none was integrated. Postman identity is unauthenticated; owner-mock lookup was unavailable. Local Postman mocks replay compact official captures; no remote workspace was changed.

## Implementation and limits

Three services follow the existing YAML HTTP request and response transformer conventions. Each tool validates integer limits (1–100), offsets (0–100,000) and supported languages/filters before HTTP. Responses validate provider envelopes and every returned source row before filtering/paging. Output retains original text, nulls, multilingual attributes, hours and coordinates; company tools add preferred-language aliases. Jobs and space do not invent translations. CSDI requests use fixed read-only layers, ordered OBJECTIDs, upstream paging and WGS84 output. HKSTP uses local paging over complete validated resources. Lab/office space is one published textual observation.

Raw bodies cache for one hour; local filters and language preference over multilingual bodies reuse the same resource cache. Requests time out after 30 seconds. Shared paging limits record data to 100 KB and returns continuation; a single oversized record produces an actionable error. Source HTML remains untrusted data. There are no UI or Next.js implementation changes.

## Validation results

| Check | Result and exact evidence |
| --- | --- |
| Codegen | PASS; `subset-codegen.log`; `subset-codegen-check.log` verifies **84 generated files**. Generated artifacts remain ignored by repository convention and are archived externally. APIS.md changes exactly five IDs; implemented count **296 → 301**. |
| Focused fixtures, central tool cases and scoped MCP routes | **561 passed**, three files; `subset-focused.log`. Includes source fields, language preference, literal filters, cached local paging, byte continuation, invalid inputs, HTTP/timeout/network/JSON/envelope/row errors, empty datasets and scoped discovery/calls. |
| Full suite | **4,373 passed, five existing skipped**, 93 files passed; `subset-full-tests.log`. No skip was added. |
| Full upstream capture replay | **10 localized calls passed**, five retained APIs; `subset-captures.log`. Validates full captured resource shapes, including all company/job rows before local paging. Archived replay is not a fresh live call. |
| Fresh application live execution | **10 localized calls passed** for the five retained APIs; `live.log`, extracted without rerunning into `subset-live.log`. Same run contains the excluded Coin Cart 405. No failed or uncertain upstream call was retried. |
| Postman real HTTP simulation | **30 checks passed**, five retained APIs; `subset-simulation-cycle3.log`. The log `subset-simulation-cycle3.ndjson` records **30 HTTP requests: 25 HTTP 200 and five injected 503**. Exercises actual adapters and fetch/parse paths against captured response fixtures, malformed JSON/envelopes and empty responses. These are simulated upstreams, not live evidence. |
| Lint | PASS, zero warnings; `final-lint.log`. |
| Translations | PASS, **831 strings** current; `subset-translations.log`. |
| Typecheck | PASS; `bun run typecheck` generates route types before tsc; `typecheck.log`. Direct preflight tsc initially lacked generated Next route types; no application repair was needed. |
| Build, after typecheck | PASS; isolated SQLite migration and codegen completed through `bun run build`. Turbopack could not resolve symlinked dependencies outside the worktree. `bunx next build --webpack` first hit sandbox Google Fonts network restrictions; approved network-enabled Webpack run passed, `build-webpack-escalated.log`. No Next configuration or TLS verification was changed. |
| Diff/history | PASS; staged/full diff, hashes, generated snapshot, changed-file list and every task commit audited in external evidence. No failed implementation exists in task history. |

Python's local certificate store rejected initial metadata requests before any HTTP response. System curl with normal certificate verification captured those resources successfully. Network, Git metadata and loopback operations used approved escalation. These environment problems were kept separate from provider HTTP failures.

## Rule5a repair ledger and handoff gate

**3/3 repair cycles used**, recorded in `/private/tmp/batch073-evidence/repair-ledger.json`:

1. Central cases lacked expected result values, and a byte-limit test assumed three large records fit in two pages. Added exact expectations and exhaustive continuation assertions; implementation was correct and coverage was preserved.
2. Removed all task-introduced Coin Cart implementation after the fresh generated request returned 405; regenerated the successful subset. Added required braces for a validation-script lint error. No upstream retry.
3. Postman stripped trailing slashes before forwarding HKSTP requests, causing the local mock to return 501. Official contracts, captured bodies and fresh application live calls confirmed the URLs. Normalized optional final slashes in the mock route table only; all implementation and test assertions were preserved.

No repair cycles remain. Failed-source raw evidence remains only outside the repository for audit. The locally committed subset requires parent independent RxCode verification **PASS for the final exact changes and each of the five retained APIs** before any push or PR. Do not mark this ten-ID task complete. Task035 and other failed tasks were not retried.
