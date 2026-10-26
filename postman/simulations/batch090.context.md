## Purpose

Exercise the ten C&SD census geography tools through real HTTP using unmodified official CSDI captures in `tests/fixtures/batch090`. The tools run for real; only CSDI is a simulation member.

## Execution

Run `postman simulation run postman/simulations/batch090.sim.yaml --port 4990 --no-history --output ndjson`, then `bun --conditions=react-server scripts/check-batch090.ts simulation`. Stop this owned simulation with SIGINT before freezing evidence. `live` mode separately calls the official provider and is not permission to retry a genuine failure.

## Assumptions

2026-10-26: the owner's published mock was not retrieved; this local mock is derived from the captured provider bodies and layer schemas. It models numeric object-ID filtering, paging and geometry omission. It does not emulate bbox intersections; tests assert the generated envelope parameters, while separate live checks exercised bbox+object-ID queries. English and Traditional Chinese aliases share the same bilingual provider body; Simplified Chinese is rejected. Orbit returned unrelated US Census candidates; none were used.

## Observations

2026-10-26: 130 simulation checks passed across API-0204–0213, including success, paging, empty/malformed/error bodies, HTTP errors, timeout and unreachable upstream. The single `census` member served every retained ID; no member was silent. Separate live execution passed 40 checks across all ten IDs. Evidence: `/private/tmp/batch090-evidence/simulation.ndjson`, `simulation-checks.log`, `live-checks.log`.

## Environment

Sandbox loopback initially failed EPERM; escalation resolved it. Production build requires network for configured fonts and an initialized local SQLite schema for sitemap prerender. No deployed application or remote database was changed.
