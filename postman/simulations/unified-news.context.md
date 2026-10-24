# Unified news simulation

Created 2026-10-25 HKT from the RapidAPI playground contracts. Mock request and
response shapes are documented in `docs/unified-news.md`.

## Purpose

Exercise the registered news tools against both HTTP dependencies. The two local
mock handlers contain synthetic examples, including Trade Bloom's observed detail
access failure. No successful Trade Bloom detail response is fabricated.

## Execution

1. `postman simulation run postman/simulations/unified-news.sim.yaml --port 4988 --output ndjson`
2. Use the listening event's base URL:
   `UNIFIED_NEWS_SIM_URL=http://localhost:4988 bunx vitest run tests/unified-news.test.ts`
3. Inspect request events for both members; stop the foreground simulation with Ctrl-C.

## Assumptions

- 2026-10-25: Owner mock discovery was skipped because `postman whoami` reported
  no signed-in account. Both stand-ins come from the inspected Chrome contracts.
- 2026-10-25: Real Trade Bloom detail success remains unverified; the simulation
  proves its observed application-level 401 is rejected, not successful content access.

## Observations

<!-- begin:observations -->
- 2026-10-25: Both members served requests from the registered tools via the real
  shared HTTP fetcher; no member stayed silent. Ranking, detail routing and source
  failures were exercised by `tests/unified-news.test.ts`.
<!-- end:observations -->

## What didn't work

- 2026-10-25: Sandbox denied server binding (`listen EPERM`) and localhost fetches
  (`upstream_network`); simulation and HTTP tests need approved network access here.
