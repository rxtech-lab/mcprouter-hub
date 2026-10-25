## Purpose
Run the real Batch088 tool runtime through HTTP against original official feature and raster captures. The mock does not evaluate SQL, spatial intersection or real raster geography.

## Commands
`postman simulation run postman/simulations/batch088.sim.yaml --port 4988 --no-history --output ndjson`
`bun --conditions=react-server scripts/check-batch088.ts simulation`
Separate `live` mode calls published providers. Stop the simulation with SIGINT before finalizing evidence.

## Boundaries
Single `development` member serves every retained tool and all eight raster years. Injected HTTP503, invalid JSON, malformed records, empty responses, timeouts and unreachable-port checks are separate from live success evidence. No workspace push or shared resource mutation.

## Results
2026-10-26: Postman CLI 1.75.0 signed out; owner mock search skipped. Frozen-lock runtime passed 100 checks, zero failures. All twelve retained tools and eight raster years served; HTTP, malformed/invalid JSON, empty, timeout and offline cases exercised. Final log is `/private/tmp/batch088-evidence/simulation.ndjson`. Separate actual-provider runtime passed 28 checks. Initial loopback EPERM used required escalation. No shared workspace publication.
