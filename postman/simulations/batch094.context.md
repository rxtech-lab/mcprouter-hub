## Purpose

Run the generated population/vital statistics tools and HTTP client against official C&SD fixture excerpts, including success in three languages, provider errors, HTTP 503/HTML, malformed JSON/observations, empty tables, timeout and unreachable network.

## Execution

`postman simulation run postman/simulations/batch094.sim.yaml --port 4994 --no-history --output ndjson`, followed by `bun --conditions=react-server scripts/check-batch094.ts simulation`. Stop the owned process with SIGINT. `captures` replays hash-verified complete provider bodies from `BATCH094_EVIDENCE_DIR` (default `/private/tmp/batch094-evidence`) and verifies every row across all pages. `live` separately executes uncached tools, capturing bodies and hashes there.

## Assumptions and limits

2026-10-26: Orbit search found unrelated providers; no matching contract was selected. Postman owner's mock search requires login, so this owned mock derives from actual provider captures. It serves excerpts without inventing an upstream pagination API; the production transformer applies filters and pagination. This establishes local behavior, separately from live-provider and deployment evidence.

## Observations

2026-10-26: 270 simulation checks passed. The `census` member served 210 logged HTTP requests spanning all ten tables in en/tc/sc; no silent members. The 30 HTTP 503 responses and 30 timeout injections are intentional. Raw log: `/private/tmp/batch094-evidence/simulation.ndjson`; assertions: `simulation-checks.log`. Sandbox binding/client failures required escalation. Separate uncached generated-tool live calls passed all 30 localized resources. Hash-verified complete-capture replay passed 60 checks and preserved every source field across every page.
