## Purpose

Exercise the nine retained batch079 GPA/HAD tools over real HTTP with captured official CSDI records. This verifies client, schema, pagination and error behavior against stand-ins; it does not establish current provider availability.

## Execution

From the repository root, start `postman simulation run postman/simulations/batch079.sim.yaml --port 4979 --no-history --output ndjson`, then run `bun --conditions=react-server scripts/check-batch079.ts simulation`. Stop the simulation with SIGINT before hashing its logs. Network/loopback permission is required in the restricted sandbox.

## Assumptions

2026-10-25: the owning providers have no Postman mocks in this checkout; the local mock replays actual official feature captures in `tests/fixtures/batch079`. The simulation models paging and geometry exclusion, not CSDI SQL or spatial evaluation. Unit tests check generated predicates; independent upstream reads verified localized LIKE predicates. Unknown routes answer 501.

## Observations

2026-10-25: both runs passed 106 asserted checks each. The single `development` member served all nine APIs and all four historical layers. Across both runs its stopped log contains 194 HTTP request events (176 HTTP 200, 18 intentionally injected HTTP 503). Client timeouts use 50 ms against a 250 ms response; malformed JSON, malformed records, ArcGIS errors, empty pages, unreachable ports and invalid inputs were also exercised. No member was silent. Evidence: `/private/tmp/batch079-evidence/simulation.ndjson`, `simulation-checks-final.log`.

## What did not work

2026-10-25: initial sandbox launch failed with loopback EPERM before listening. Approved escalation resolved it. Simulation stopped cleanly with SIGINT; final summary recorded before hashes were frozen.
