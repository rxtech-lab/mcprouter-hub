## Purpose
Exercise actual Batch086 MCP runtime over real HTTP/TCP against source-derived provider captures. The implementation is not a simulation member.

## Execution
`postman simulation run postman/simulations/batch086.sim.yaml --port 4986 --no-history --output ndjson`, then `bun --conditions=react-server scripts/check-batch086.ts simulation`. Separate `live` mode calls official sources. Stop with SIGINT before freezing logs.

## Assumptions
2026-10-26: Postman CLI 1.75.0 is signed out; owner mock search skipped. Single `development` member replays official CSDI, raw NMEA and gzip CompactRINEX captures. Mock does not emulate SQL/spatial filtering. HTTP raw-frame replay exercises the same TCP parser as the production ICY caster; live checks separately establish ICY compatibility. No external workspace writes.

## Observations
2026-10-26: retained eight-ID run passed 118 asserted checks, including real NMEA transport through the MCP route. All twelve retained tools served requests through the single development member; no member was silent. Frozen log `/private/tmp/batch086-evidence/simulation-final.ndjson` records 104 request events (92 served, 12 injected failures). Separate fresh live execution passed 17 checks. Initial raw RTCM and old-map download failures are excluded, with no retry and no retained mock paths.

## Limits
Snapshots sample one selected station; other published mountpoints are allowlisted from provider documentation, not individually live-tested. RINEX reader supports hourly RINEX2 1s/5s headers; Hatanaka observations are not decoded. Large map downloads may exceed the 64 MB bound and return an explicit error.
