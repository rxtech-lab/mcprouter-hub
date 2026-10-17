# mcprouter brand assets

Redesigned with the built-in imagegen tool: interlocking ivory and mint ribbons
form an abstract m on midnight teal.

- `icon-preview.png`: generated master and preview.
- `icon-composite.png`: normalized 1024px master export.
- `mcprouter.ora`: editable OpenRaster source with an extracted monogram over a
  separate midnight-teal background.
- `og-source.png`: generated social preview master.
- `../../public/brand/layers/`: editable layer PNGs.
- `../../public/brand/icon-v2.webp`: 512px production icon; `icon.webp` is an alias.
- `../../app/favicon.ico`: 16, 32 and 48px browser icon frames.
- `../../app/apple-icon.png`: 180px home-screen icon.
- `../../app/opengraph-image.png`: 1200 × 630 social preview.
- `previous/`: archived first design.

Run `node scripts/build-brand-assets.mjs` to regenerate production assets from
the icon and OG masters. Production exports use the original icon master to
preserve clean edges; the extracted layers are available for future editing.

## Imagegen prompts

**Icon:** Completely new professional app icon for mcprouter, a Hong Kong
open-data MCP routing app. Flat modern editorial identity, midnight teal #102f3b
background to all edges. Two interlocking chunky rounded ribbons form a compact
abstract m and branching route in negative space. Ivory #f5f3e9 and mint #71e5bc.
Bold centered geometry, ample negative space, crisp edges. No 3D, bevel, glass,
shadows, gloss, network node circles, trident, text, mockup or border.

**Foreground:** Extract the interlocking ivory-and-mint ribbon monogram with
true transparent alpha. Remove the teal background and internal negative
spaces. Preserve geometry, colors, canvas, scale, placement and edges. No crop,
recentering, shadow, new shapes or text.

**OG:** Wide 1.905:1 banner, midnight teal background. Exact ivory text on left:
“mcprouter”, “Hong Kong open data.”, “Ready for AI.” Same interlocking ivory and
mint monogram on right, about 30 percent of width. Modern Swiss editorial layout,
precise sans-serif type, ample padding. No 3D, gradients, shadows, texture,
connection lines or decorative nodes. Export at 1200 × 630.
