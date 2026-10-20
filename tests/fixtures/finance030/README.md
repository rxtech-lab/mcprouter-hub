Captured from official C&SD JSON resources on 2026-10-21 (Asia/Hong_Kong).

Each table's DATA.GOV.HK dataset page was fetched and checked for all three
`en`, `tc`, `sc` resource URLs before downloading:

`https://www.censtatd.gov.hk/api/get.php?id=<table>&lang=<language>&full_series=1`

The ten table IDs are listed in `tests/finance030-cases.ts`. All 30 resources
returned a successful provider status and nonempty `dataSet` arrays.

Fixtures retain earliest/latest observations for every source dimension,
indicator, unit and frequency, plus one example of every status flag and any
available missing or negative figure. Original titles, notes, descriptions,
figures and flags are preserved. `header.count.noOfRecords` is adjusted to the
fixture size. These are compact snapshots, not full upstream tables. The unit
test that synthesizes missing/negative figures is explicitly separate from the
captured observations.

`bun --conditions=react-server scripts/check-finance030-live.ts` verifies all
30 full live responses through generated tools. `check-finance030-simulation.ts`
verifies real HTTP against these fixtures and explicitly injected failure cases.
