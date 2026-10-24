# Unified news simulation

Created 2026-10-25 HKT from the RapidAPI playground contracts. Mock request and
response shapes are documented in `docs/unified-news.md`.

## Purpose

Exercise the registered news tools against all three HTTP dependencies. The local
mock handlers contain synthetic examples based on Trade Bloom's observed bulletin
metadata array, provider error envelopes, and official Hacker News story/item shapes.

## Execution

1. `postman simulation run postman/simulations/unified-news.sim.yaml --port 4988 --output ndjson`
2. Use the listening event's base URL:
   `UNIFIED_NEWS_SIM_URL=http://localhost:4988 bunx vitest run tests/unified-news.test.ts`
3. Inspect request events for both members; stop the foreground simulation with Ctrl-C.

## Assumptions

- 2026-10-25: Owner mock discovery was skipped because `postman whoami` reported
  no signed-in account. The RapidAPI stand-ins come from the inspected Chrome contracts; Hacker News
  synthetic examples follow its official GitHub API contract and Orbit brief.
- 2026-10-25: Trade Bloom detail now uses `/stories/bulletin?ids=...`. Its live
  response contains metadata without full text; the mock models that shape.

## Observations

<!-- begin:observations -->
- 2026-10-25: Bulletin change: 36 focused tests passed over HTTP. All three members
  served requests; Trade Bloom used `ids`, matched bulletin identity, and rejected
  access errors, empty/unmatched arrays, duplicate matches and oversized metadata.
- 2026-10-25: Separate live registered-tool calls passed headlines and details for
  all three sources with the local key; Trade Bloom returned bulletin metadata.
- 2026-10-25: All three members served registered-tool HTTP requests; none stayed
  silent. Hacker News ranking, filtering, stateless details, malformed/HTTP errors,
  empty feeds and missing RapidAPI credentials passed. Owner search remains skipped
  because the CLI is signed out. A separate live registered-tool check returned
  two top Hacker News stories and detail for item 8863 without RapidAPI credentials.
- 2026-10-25: Both members served requests from the registered tools via the real
  shared HTTP fetcher; no member stayed silent. Ranking, detail routing and source
  failures were exercised by `tests/unified-news.test.ts`.
<!-- end:observations -->

## What didn't work

- 2026-10-25: Sandbox denied server binding (`listen EPERM`) and localhost fetches
  (`upstream_network`); simulation and HTTP tests need approved network access here.
