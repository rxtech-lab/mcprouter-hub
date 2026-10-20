Official Census and Statistics Department GDP JSON responses captured on
2026-10-21 (Hong Kong time), in English, Traditional Chinese and Simplified Chinese.

Source pattern:
`https://www.censtatd.gov.hk/api/get.php?id=<table>&lang=<en|tc|sc>&full_series=1`

These are compact source fixtures, not invented observations. For each table
and language, retain the latest observation for each distinct combination of
`GDP_COMPONENT`, `freq`, `sv` and `svDesc`, plus the first unavailable figure
where present. Preserve the original header and notes, omitting only the
request-specific `header.count` timing/count block. Figure values, units,
revision flags and component descriptions are unchanged.

See `docs/finance-batch028.md` for the verified catalogue pages, full-table
counts, tool mapping, contract and validation results. The local Postman mock
replays these same files; it is not intended for public deployment.
