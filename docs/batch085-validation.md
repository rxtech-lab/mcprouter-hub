# Batch085 — Lands Department Development APIs

Implemented locally on `batch085-development`, isolated at `/private/tmp/mcprouter-batch085` from remote `main` base `6cb2a0803a65d37b7736cc75bc6b82d51b9ef581`. Awaiting independent RxCode final-head verification. Nothing pushed or published; no board status changed.

## Verified provider contracts

Each dataset was individually resolved using the DATA.GOV.HK `package_show` catalogue endpoint. The nine land-case catalogue resources advertise GML (acquisition also advertises KML/GeoJSON), but link to official CSDI datasets with functioning FeatureServer layer 0 JSON queries. We use those actual live structured endpoints, not invented file APIs. Full metadata, layer schemas and original captures are archived in `/private/tmp/batch085-evidence`.

| Stable ID | Tool | Live result | Language aliases |
|---|---|---|---|
| API-3081 | `landsd_topographic_tile` | PNG fetched and validated, 256 × 256, 62,796 bytes | No tile language variants |
| API-3085 | `landsd_land_acquisition_notices` | PASS: nonempty structured records | en |
| API-3086 | `landsd_executed_land_exchanges` | PASS: nonempty structured records | en, tc |
| API-3087 | `landsd_executed_lease_extensions` | PASS: nonempty structured records | en, tc |
| API-3088 | `landsd_executed_lease_modifications` | PASS: nonempty structured records | en, tc |
| API-3089 | `landsd_land_sale_records` | PASS: nonempty structured records | en, tc |
| API-3097 | `landsd_industrial_2009_land_exchanges` | PASS: nonempty structured records | en, tc |
| API-3098 | `landsd_industrial_2009_lease_modifications` | PASS: nonempty structured records | en, tc |
| API-3099 | `landsd_industrial_2018_lease_modifications` | PASS: nonempty structured records | en, tc |
| API-3100 | `landsd_industrial_2009_special_waivers` | PASS: nonempty structured records | en, tc |

Land-case tools preserve source fields, nulls, dates, units and links; `lang` selects the published name field only. Acquisition publishes one mixed-language title rather than separate localized fields. Other layers publish English/Traditional Chinese only. Record output is bounded to 100 rows and 100 KB; geometry above 20 KB is explicitly omitted. Stable OBJECTID pagination, optional WGS84 bbox and allowlisted escaped single-field LIKE searches use the existing YAML HTTP transformers. Original case points are not lot polygons; historical cases are not current offers or legal title evidence. Cache TTL is one hour.

The raster tool fetches exactly one official LandsD PNG with a 15-second timeout, a 1 MB stream limit and bounded integer tile inputs. It returns the source download URL, PNG envelope/dimensions, SHA-256, spatial reference and provider attribution/terms. It does not decode map features, validate every PNG chunk CRC, or invent language variants. It reports HTTP 204 as no tile. Successful metadata is cached for 12 hours. The provider's documented HK80 example was captured unmodified; its provenance is in `tile-provenance.json`. Provider docs: https://portal.csdi.gov.hk/csdi-webpage/apidoc/TopographicMapAPI

## Validation and evidence

- Codegen and freshness check: passed, 89 generated files. `/generated` is ignored by repository convention and remains reproducible locally; tracked `APIS.md` registers exactly the ten requested IDs.
- Focused tests initially: 69 passed. Final route suite: 10 passed, covering all ten IDs, discovery, calls, malformed input and upstream errors.
- Final full suite: 4,555 passed, 46 existing skips across 99 test files (`full-tests-final.log`).
- Lint, typecheck, i18n check: passed. Translation catalogue: 836 strings.
- Production Webpack build: passed using only the isolated local SQLite schema; migrations initialized the build database. No production database used.
- Postman HTTP simulation: 105 checks passed, zero failed APIs. Stopped log records 84 requests, including 10 injected HTTP 503 responses; the sole `development` member served all ten APIs. It does not emulate provider SQL/spatial evaluation.
- Separate live execution: 18 checks passed, zero failed APIs (one acquisition language, two languages for each of eight case feeds, one PNG). Each actual provider request was made without genuine API retries.
- Repair budget: 1/3 used. The full suite identified missing central test/live-check registrations; added source-derived cases and inputs without removing or weakening any assertion. Complete ledger: `/private/tmp/batch085-evidence/repair-ledger.md`.

Environment issues were resolved separately: sandbox git/DNS/loopback required approved escalation; Python's local trust store failed before HTTP, so system curl used normal certificate verification. Build prerequisites were font network access and a migrated isolated database. Orbit discovery was consulted; its API-key hint conflicted with official docs and successful unauthenticated live requests. Postman was signed out, so provider-owned mock search was unavailable; local mocks replay actual provider captures.

No unavailable sources or excluded IDs remain in this batch. Independent verification of the final commit is still required before the parent publishes. No code from other batches or Task035 was changed.
