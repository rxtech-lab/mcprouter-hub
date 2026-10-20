Captured from the official C&SD JSON resources on 2026-10-21 (Asia/Hong_Kong).

All ten DATA.GOV.HK pages were fetched and checked for the exact English,
Traditional Chinese and Simplified Chinese resource URLs before registration:

`https://www.censtatd.gov.hk/api/get.php?id=<table>&lang=<en|tc|sc>&full_series=1`

Table IDs are listed in `tests/finance031-cases.ts`. All 30 full responses had
successful provider status and nonempty dataSet arrays. No source was unavailable.

These compact fixtures retain the first and last observation for every combination
of native dimensions (including FLOWS), frequency, statistical variable and unit.
They also retain examples of each observed revision/status flag, missing figure
representation and negative numeric figure. Original observations and header
metadata are preserved, with header.count.noOfRecords adjusted to fixture size.
Synthetic edge cases are added separately in tests, never to these captures.

The live-check script validates every row of each full live resource through the
generated tool. The Postman simulation replays these captures over real HTTP,
with separate injected HTTP, malformed JSON and failed provider status responses.
