Official EPD CSV and CSDI ArcGIS captures from 2026-10-22, rechecked during the authorized retry. CSV fixtures retain the UTF-8 BOM, full headers and first three records; ArcGIS fixtures retain two records (geometry disabled). The golden normalized first and second observations were produced independently in Python. Missing CSV cells and literal `null` become JSON null; detection bounds and measurement labels/units remain verbatim.

Historical fixtures use 2025 in each language; generated-tool live checks additionally exercise 1986. Captured metadata lists every published annual resource from 1986 through 2025. Recycling/collector/permit/complaint services use the official CSDI FeatureServer linked by the DATA.GOV.HK spatial dataset, rather than treating the portal HTML or a file download as a new REST API.

Postman replay: `postman simulation run postman/simulations/environment021.sim.yaml --port 4921 --output ndjson`, then `bun --conditions=react-server scripts/check-environment021-simulation.ts`. It serves these captured fixtures locally and models pagination plus error/malformed responses. Provider-owned mock discovery was unavailable because the CLI is signed out; no provider mock was assumed.

Live verification: `ENVIRONMENT021_LIVE_REPORT=/tmp/environment021-live.json bun --conditions=react-server scripts/check-environment021-live.ts`. This calls official upstreams through generated tools and disables the test cache so every probe reaches HTTP. Fixture and simulation passes alone do not establish live availability.

Full metadata, download, layer/query probes, live output, and validation logs for this retry: `/private/tmp/batch021-retry-evidence`. Original captured sources and failed-attempt report: `/private/tmp/batch021-evidence`.
