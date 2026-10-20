# Finance 034 official C&SD fixtures

Captured on 2026-10-21 (Hong Kong time) from the JSON resource links on the
DATA.GOV.HK `hk-censtatd-tablechart-<table>` dataset pages, for all ten tables
340-47002/47011/47012/92002/95001/95002/95003/95004/95005/95006 and en/tc/sc.

Resource contract:
`https://www.censtatd.gov.hk/api/get.php?id=<table>&full_series=1&lang=<en|tc|sc>`

Each fixture preserves the earliest and latest observation for every combination
of statistical variable, frequency, component and unit, and at least one example
of every source status flag. Source row order, original numeric/string codes,
figures, labels, title, notes and source are retained. Header record counts are
adjusted to fixture length; they do not represent live full-series counts.

Missing figures remain empty strings, with flags such as `-`, `[#7]`, `[-§25]`
and `r` preserved. Never replace an empty figure with zero. Measures retain the
source currency and scale; no conversion or aggregation is performed. Labels
and notes may include markup and are returned as text, never rendered as HTML.

The fixture-based tests exercise the generated tools, shared runtime, cache and
MCP route, plus all languages, pagination, dimensions, periods, unit distinctions
and malformed responses. The Postman mock replays these same captures over real
HTTP. The live-check script validates every observation of each full upstream
response before returning a bounded page. See `docs/finance-batch034.md` for
exact validation evidence and reproduction commands.
