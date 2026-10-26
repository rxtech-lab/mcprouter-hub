## Purpose

Exercise nine retained population geography tools through real HTTP using official CSDI bodies in `tests/fixtures/batch092`. Generated runtime and HTTP client run for real; only the CSDI dependency is mocked.

## Execution

Run `postman simulation run postman/simulations/batch092.sim.yaml --port 4992 --no-history --output ndjson`, then `bun --conditions=react-server scripts/check-batch092.ts simulation`. Stop only this owned simulation with SIGINT. `BATCH092_EVIDENCE_DIR=/private/tmp/batch092-evidence/live bun --conditions=react-server scripts/check-batch092.ts live` separately captures uncached provider responses. Do not retry genuine provider failures.

## Assumptions

2026-10-26: no owner's published mock was retrieved; this local mock derives from actual official schemas and two-record statistics/geometry captures. It models object-ID filtering, pagination and geometry omission. It does not model bbox intersection; parameter assertions and separate real-provider queries exercise that path. English and Traditional Chinese aliases share source attributes; Simplified Chinese is rejected. Orbit returned unrelated US Census resources, none selected.

## Observations

2026-10-26: 117 HTTP simulation checks passed across API-0224–0228 and API-0230–0233. The census member served all nine IDs; no member was silent. Logs contain 90 request events: 81 served responses and nine deliberately injected HTTP 503 failures. Separate live execution passed 36 checks, with captured bodies/hashes. Evidence: `/private/tmp/batch092-evidence/simulation.ndjson`, `simulation-checks.log`, `simulation-audit.json`, `live-checks.log`, `live/`. Simulation stopped with SIGINT before evidence freeze.

## Environment and limits

Sandbox startup/loopback required escalation. Production build used an initialized worktree-local SQLite database and network access for existing font downloads. API-0298 is excluded after its published JSON URL returned HTTP 403; no retry or alternate-resource validation followed. No deployment or whole-dataset validity claim is made.
