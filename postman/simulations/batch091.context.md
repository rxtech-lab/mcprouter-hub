## Purpose

Exercise the nine retained census geography tools through real HTTP using byte-for-byte official CSDI captures in `tests/fixtures/batch091`. The generated runtime and HTTP client run for real; CSDI is the single `census` simulation member.

## Execution

Run `postman simulation run postman/simulations/batch091.sim.yaml --port 4991 --no-history --output ndjson`, then `bun --conditions=react-server scripts/check-batch091.ts simulation`. Stop only this owned simulation with SIGINT. `BATCH091_EVIDENCE_DIR=/private/tmp/batch091-evidence/live bun --conditions=react-server scripts/check-batch091.ts live` separately captures uncached provider responses. Do not retry a genuine provider failure.

## Assumptions

2026-10-26: no owner's published mock was retrieved. The local mock derives from verified official layer schemas and captured bodies. It models object-ID filtering, paging and geometry omission, but not spatial intersection. Bbox predicates are tested locally and exercised separately against the real provider. English and Traditional Chinese aliases share source attributes; Simplified Chinese is rejected. Orbit supplied a generic CSDI query contract with incomplete pagination details; actual layer schemas establish pagination support.

## Observations

2026-10-26: 117 simulation checks passed for API-0214–0220 and API-0222–0223, covering localized success, pagination/geometry, ID selection, empty/malformed/ArcGIS/HTML responses, HTTP 503, timeout, invalid input and unreachable network. Every retained ID appears in the `census` member request log; no member was silent. Nine HTTP 503 responses are deliberate injections. Separate provider execution passed 36 checks, with raw bodies and hashes captured. Logs: `/private/tmp/batch091-evidence/simulation.ndjson`, `simulation-checks.log`, `live-checks.log`, `live/`.

## Environment and limits

Sandbox loopback EPERM required escalation. The production build uses an initialized worktree-local SQLite database and font-download network access. API-0221 is excluded after codegen rejected an invalid transformer name; its implementation and fixtures are absent from the subset. This simulation does not establish deployment or whole-dataset completeness.
