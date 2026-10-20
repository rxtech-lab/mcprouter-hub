Offline regression fixtures for the card renderer, downloaded from the Google
Fonts CSS API on 2026-10-21. Both are regular (400), TrueType subsets for:

`HKmcprouter重阳节翌日圣诞節聖誕…`

- `hk.ttf`: Noto Sans HK (omits 节 and 诞).
- `sc.ttf`: Noto Sans SC (includes 节 and 诞).

The renderer tests supply these for both weights to verify glyph fallback in
regular and bold text without network access. They also verify both weights
are requested from each family.

Source: `https://fonts.googleapis.com/css2?family=Noto+Sans+HK:wght@400&text=...`
(substitute `SC` for the second family). License: SIL Open Font License 1.1,
included in `OFL.txt` from `google/fonts/ofl/notosanshk/OFL.txt`.
