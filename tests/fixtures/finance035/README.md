# Batch 035 fixture provenance

Captured from official resources on 2026-10-21. These are compact fixtures,
not complete registers or assertions of continuing live availability.

- `address-local.json`, `address-foreign.json`: complete official Companies Registry
  responses for published sample registration numbers C1572528 and 75698252.
- `tcsp.csv`: header and first six records from the official bilingual CSV.
- `warehouse-{en,tc,sc}.csv`: reserialized subsets of official language files,
  including each warehouse category, empty licences and trailing empty columns.
  Source CRLF line endings and header whitespace are preserved intentionally.
- `hkma_hibor.json`: complete initial official three-record HIBOR response with
  `segment=hibor.fixing`; missing nine-month rates remain null.

Fixtures and tests for the six removed HKMA tools, including all synthetic
schema examples, have been removed. See `docs/finance-batch035.md` for blockers.
