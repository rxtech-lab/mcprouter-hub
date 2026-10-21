# Batch 035 fixture provenance

Captured from official resources on 2026-10-21. No fixture is a live-availability assertion.

- `address-local.json`, `address-foreign.json`: complete official Companies Registry
  responses for the published sample registration numbers C1572528 and 75698252.
- `tcsp.csv`: header and first six records from the official bilingual CSV
  (7,509 records in the complete download).
- `warehouse-{en,tc,sc}.csv`: header, first six records and the first example of each
  additional warehouse category from the official 60-record language files.
  Empty licence numbers, Chinese leading zeros and Chinese trailing empty columns
  are intentional. CSV samples are reserialized subsets; the adapter normalizes
  the mixed CR/LF boundaries found in the complete upstream SC file.
- `hkma_hibor.json`, `hkma_money_brokers.json`, `hkma_cmu_instruments.json`:
  complete official responses to `pagesize=3&offset=0` during initial discovery.
  HIBOR also used `segment=hibor.fixing`; brokers used `lang=en&segment=en`.
  These three returned JSON initially, but subsequent live calls returned HTTP 405.
- `hkma_exchange_rates.json`, `hkma_interbank_liquidity.json`,
  `hkma_securities_staff.json`, `hkma_cmu_members.json`: **synthetic contract examples**
  derived from the respective official HKMA OpenAPI schemas. These endpoints never
  returned successful live data during this task. Names and figures are test values.
  The four stable tracker IDs remain unregistered. These fixtures support parser,
  request, error, routing and simulation tests, not claims about live coverage.

Official dataset pages, exact endpoint paths and schema URLs are recorded in
`docs/finance-batch035.md`. All fixture values retain the original types; null rates
are unavailable observations, not zero. Fixture samples are not complete registers.
