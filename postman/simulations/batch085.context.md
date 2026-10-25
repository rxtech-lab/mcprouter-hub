## Purpose

Exercise the nine official LandsD CSDI case feeds and PNG topographic tile accessor through real HTTP. Source bodies are unmodified provider captures in `tests/fixtures/batch085`; the implementation under test is never a simulation member.

## Execution

Start `postman simulation run postman/simulations/batch085.sim.yaml --port 4985 --no-history --output ndjson`, then `bun --conditions=react-server scripts/check-batch085.ts simulation`. Stop the simulation with SIGINT before freezing its log. `live` mode separately calls official providers and must not be used to retry a genuine API failure.

## Assumptions

2026-10-26: Postman CLI 1.75.0 is signed out, so the owner's published-mock search was skipped. The local mock replays official captures with bounded paging and geometry exclusion, and does not emulate SQL/spatial filtering. Unit tests assert generated predicates. The PNG body comes from the official documented HK80 example. Orbit's auth hint conflicted with provider documentation; the documented endpoint answered unauthenticated HTTP 200.

## Observations

<!-- begin:observations -->
2026-10-26: one run passed 105 asserted checks for all ten IDs. The single `development` member served every retained API, including tile success/missing/error paths; no member was silent. Separate live execution passed 18 checks. Logs: `/private/tmp/batch085-evidence/simulation.ndjson`, `simulation-checks.log`, `live-checks.log`.
<!-- end:observations -->

## What didn't work

2026-10-26: sandbox loopback launch failed EPERM before listening; approved escalation resolved it. Build initially lacked network for Google Fonts, then an initialized local SQLite schema for static sitemap generation; these are environment prerequisites, not provider failures.
