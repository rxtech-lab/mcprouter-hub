# Finance batch 035 — partial implementation

**TASK_RESULT: INCOMPLETE** — four of the ten requested API entries are retained.

PR: https://github.com/rxtech-lab/mcprouter-hub/pull/38
Task: AC5FF170-6AB1-4CFE-BC31-B7AE60ECF33D
Worktree: `/private/tmp/mcprouter-finance035`, branch `feat/finance-batch035`.

## Retained scope

| API | Tool | Source |
| --- | --- | --- |
| API-1313 | `cr_company_addresses` | Official Companies Registry local/foreign JSON searches |
| API-1332 | `cr_tcsp_licensees` | Official bilingual TCSP CSV |
| API-1428 | `customs_bonded_warehouses` | Official en/tc/sc warehouse CSV files |
| API-0047 | `hkma_hibor` | Official HKMA daily HIBOR JSON, `segment=hibor.fixing` |

These four IDs and their dataset IDs are registered. Permanent `mcp/apis.yaml`
entries are preserved. Structured outputs are bounded, inputs validated and
upstream responses cached for 3600 seconds. CSVs are validated before local
filtering/pagination; HIBOR uses bounded upstream pagination and date filters.
Missing HIBOR values remain null, not zero.

## Removed and incomplete

API-0046 (exchange rates), API-0048 (liquidity), API-2153 (securities staff),
API-2154 (money brokers), API-2158 (CMU instruments), and API-2159 (CMU members)
remain **Coming soon**. Their tools, handler branches, live-check registrations,
fixture/route test cases, simulation routes and fixtures have been removed at
user request. No tests were added. All synthetic HKMA fixtures were removed.

The [linked CI live-check job](https://github.com/rxtech-lab/mcprouter-hub/actions/runs/39548288457/job/119051375469?pr=38)
passed 6/10 tools. Money brokers, CMU instruments and CMU members failed HTTP
405; securities staff failed provider code `9999`, after three attempts each.
Exchange rates and liquidity passed that CI run but lacked full prior acceptance
and were unregistered; they are also removed from this partial implementation.
HIBOR and all three non-HKMA tools passed the linked job.

`finance-batch035-resources.json` records the official metadata/schema discovery
for all ten requested datasets. `finance-batch035-live.json` is historical
pre-removal evidence: eight successes, nine HTTP 405 failures, nine follow-ups
skipped. It does not describe current tool discovery or establish batch completion.
No alternative API, proxy bypass or fabricated live response was introduced.

## Validation

The prior full implementation passed 1,376 tests (five existing skips), 440
focused tests, 67 simulated HTTP requests, lint, typecheck and a Webpack build.
Those counts are historical and include the subsequently removed tool coverage.
After removal: **391/391 focused tests passed** across three files; codegen
regenerated 42 files and its freshness check passed; lint, typecheck and
`git diff --check` passed. No new tests or live probes were added. No new upstream probe is
needed to remove unsupported contracts. Successful full-batch RxCode verification
remains absent; this partial PR must not be treated as all-ten completion.

Reproduce retained local checks:

```sh
bun run codegen
bun scripts/codegen.ts --check
bun run test tests/finance035.test.ts tests/mcp-route.test.ts tests/tools.test.ts
bun run lint
bun run typecheck
```

The local Postman simulation now serves retained tools only. The standalone batch
live audit checks retained tools but always reports `complete=false` with the six
incomplete IDs; passing the subset never promotes the original batch to complete.
