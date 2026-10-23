# Batch 053 fixtures

Captured from the official C&SD get.php API on 2026-10-23 in en, tc and sc. Each fixture retains the original header and all unchanged observations from the earliest and latest periods, covering every indicator and dimension code. header.count refers to the complete upstream table, not this compact fixture. captures.json records complete response hashes, URLs, status and row counts. Full raw bodies and HTTP headers are retained outside the branch in /private/tmp/batch053-evidence for independent verification.

No fixtures are invented. Synthetic missing-value/error tests are explicitly constructed in the test suite. DATA.GOV.HK source pages publish web table CSV/Excel downloads; the provider also serves the verified public JSON endpoint used by this service, with no auth. Table 330-41011 uses M period codes in the JSON even though its survey is quarterly: the published source period is preserved.
