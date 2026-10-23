Compact official captures from 2026-10-23 UTC, linked to the metadata/resources
archive in `/private/tmp/batch051-evidence` for this execution.

- 2336/2337: HKMA trade repository JSON. Three original records, including a null LEI in the member fixture; fixture
  datasize is set to three. Every source field, number and null is retained.
- 0049: Complete ALS JSON response for `central government offices` with
  `Accept: application/json`.
- 2598/0051: First three IRD/LCSD CSDI ArcGIS features in WGS84. Original
  attributes/geometry retained; exceededTransferLimit set true for pagination.
- 0052-en/tc/sc: First three original RSS items; original channel metadata.
- 0573/0574/0575-en/tc/sc: C&SD 325-43001/43002/43011 JSON, retaining two
  observations per source status/country/unit combination, original headers,
  rounding/overlap notes, dimensions, figures, units and flags. Timing/count
  metadata omitted because these are trimmed fixtures.

These are fixtures, not claims about current totals. Malformed/error/empty
responses in tests are deliberate mutations or synthetic failure cases.
API-0050 is excluded: its official JSON resource returned HTTP 403, so no
post-office fixtures or registrations are retained.
