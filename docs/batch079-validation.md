# Batch079 Development validation

Exact requested batch: **PARTIAL — nine of ten APIs retained**. API-3020 remains unregistered. This is an implementation handoff, pending independent RxCode verification of every retained API and the cleaned subset/history at the final exact commit. Nothing was pushed or published, and no board state was changed.

Owned branch: `batch079-development-owned`; worktree: `/private/tmp/batch079-owned`; freshly fetched default base: `origin/main`, `9aac4cc719360fa136fdbb85356208c9fcb5e61d`. Final commit and immutable evidence hashes are in `/private/tmp/batch079-evidence/handoff.json`.

## Per-ID upstream and implementation evidence

All ten catalogue contracts were read through the existing DATA.GOV.HK `en-data/api/3/action/package_show` convention. Published CSDI layer contracts and actual feature bodies were then inspected individually with normal TLS verification. Metadata success alone was not treated as implementation evidence.

| Stable ID | Published formats | Retained structured access | Outcome |
| --- | --- | --- | --- |
| API-1961 | API, CSV, GeoJSON | `gpa_domestic_properties_for_sale` | PASS; retains the published no-tender/no-public-auction notice and agency contact location. A row does not establish property availability. |
| API-1962 | API | `gpa_government_office_open_spaces` | PASS; uses real numeric OID `OBJECTID_1`, preserving the separate string `OBJECTID`. |
| API-1963 | API, CSV, GeoJSON | `gpa_ngo_accommodation` | PASS; retains multilingual availability, lift, heritage, managing department and contact fields. |
| API-2027 | API, JSON, GML | `had_village_boundaries_2019_2022` | PASS; named election term only. |
| API-2028 | API, JSON, GML | `had_village_boundaries_2023_2026` | PASS; named election term only. |
| API-2029 | API, JSON, GML | `had_village_boundaries_2027_2030` | PASS; named election term only. |
| API-2031 | API | `had_historical_district_boundaries` | PASS; published years 1999, 2003, 2007 and 2015, all four actual schemas verified. |
| API-2033 | API, JSON, GML | `had_district_boundaries` | PASS; official district attributes and polygon queries. |
| API-2044 | API | `had_permitted_burial_boundaries` | PASS; site codes, bilingual names, dates and polygon queries. |
| API-3020 | API, GeoJSON, SHP | None | INCOMPLETE; CSDI venue index worked, but the published indoor GeoJSON ZIP download timed out after 40 seconds with 1,662,291 of 3,775,437 bytes received. Interior data parsing could not be verified. No failed download retry; no claim that the provider is unavailable. |

Raw contracts, bodies, localized filter calls and the incomplete archive are outside the repository in the evidence directory. `plan.json`, `discovery.json`, `layers.json`, `bodies-summary.json`, `filters-summary.json` and `3020-download.json` map exact URLs and outcomes. The blocked API has no task-introduced runtime code, fixtures, registrations, datasets, discovery/live entries or generated mapping. It remains Coming soon in the pre-existing tracker. The exact ten-ID task is incomplete.

## Tool contracts

Two service declarations register exactly the nine working stable IDs and their matching dataset IDs. YAML HTTP tools use request/response transformers with fixed endpoints and allowlisted fields. No caller-supplied URLs or SQL are accepted. A single-field substring search escapes quotes, preserves documented SQL LIKE wildcards, and defaults to the selected source name field. WGS84 bounding boxes and exact OIDs are validated. Stable OID ordering, offsets and upstream transfer flags preserve continuation.

Source attributes, nulls, units, remarks, source URLs and all original language fields are retained. `lang` selects an alias; no translation is invented. GPA sale and NGO tools support en/tc/sc; the other seven tools support the actual en/tc data. Historical 2015 uses a different schema from 1999/2003/2007. Village polygons carry the official election-purpose limitation.

Each request has a 30-second timeout and one-hour cache. Outputs are limited to 100 records and 100 KB of record data, with explicit continuation. Complete polygon validity is checked before oversized geometry is explicitly omitted at 20 KB; `meta.source` provides the full source query. Source projected Shape__Area/Shape__Length values are not reinterpreted as WGS84 degrees. HTTP, ArcGIS, parse, network and timeout errors are actionable and do not trigger retries.

Fixtures contain the complete geometries of two observed records per layer (one record for the no-tender notice); no synthetic polygon truncation is used. They are representative captured responses, not live paging guarantees. In particular, the open-space capture originally used its separate string OBJECTID ordering; the implemented query and live checks correctly use OBJECTID_1.

## Validation

| Check | Result and evidence |
| --- | --- |
| Focused runtime/route/central tool tests | **615 passed**, `focused-final.log`; includes nine scoped MCP discovery/call/error cases and every new tool in central cases. |
| Full suite | **4,460 passed, 5 skipped**, 95 files, `full-tests-final.log`. |
| Upstream localized search contracts | **20 successful actual record queries**, `filters-summary.json`. |
| Fresh live application calls | **26 passed, zero failed APIs**, `live-checks.log`; nine retained IDs, every supported language and historical year. |
| Real HTTP simulation | **106 checks passed per run**, final `simulation-checks-final.log`; stopped combined HTTP log records 194 requests, including 18 intentional 503 responses. See simulation context for limitations. |
| Codegen/freshness | PASS; **86 generated files** current, `codegen-final.log`, `codegen-final-check.log`. Generated output is gitignored by repository convention and archived externally; APIS.md is tracked. |
| Lint | PASS, zero warnings, `lint-cycle2.log`. |
| Translation freshness | PASS, **831 strings**, `i18n.log`. |
| Typecheck | PASS after Next route type generation, `typecheck-cycle2.log`. |
| Production Webpack build | PASS with isolated migrated SQLite database and approved font network access, `build-migrate.log`, `build-final.log`. No deployment or remote database writes. |
| Scope/diff/history | Exact nine-ID registration and blocked-ID cleanup audited; full diff, per-file hashes, every outgoing commit patch and generated snapshot preserved externally. |

Initial build attempts were environment setup failures: sandbox Google Fonts DNS restrictions, then a missing datasets table in an unmigrated worktree database. The passing run explicitly used the isolated local database at `/private/tmp/batch079-evidence/build.sqlite`. Neither required application changes. Initial metadata discovery used an incorrect language-less CKAN URL; the repository's documented language-specific URL resolved it. Orbit discovery returned unrelated candidates, so provider contracts were read directly rather than adopting a mismatched integration.

## Repair ledger and gate

**3/3 evidence-driven repair cycles used**. Cycle 1 corrected malformed-fixture tests: changing `wkid` alone left authoritative `latestWkid=4326`, and the historical-default test deleted a 2003 field from a 2015 record. Both tests still reject their intended malformed inputs. Cycle 2 added required braces and explicit ToolDefinition annotations to the validation harness for lint/TypeScript. Cycle 3 corrected an external evidence-finalizer assumption: another session changed the original checkout from `fix/vercel-validation-harnesses` to clean `main` during the run. The finalizer records both observations and continues to require a clean owned worktree and exact source/history/hash audits. Shared checkout state was not restored or modified. No runtime behavior or test assertion was weakened.

The simulation was stopped and its process exited before the immutable manifest was created. The locally committed successful subset is preserved for the parent to obtain independent explicit RxCode PASS at the final exact head. No push/PR/auto-merge action is authorized in this task run.
