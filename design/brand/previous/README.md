# mcprouter brand assets

Generated with the built-in imagegen tool. The icon retains the existing one-input,
three-output routing concept and teal/ice-blue brand palette.

- `icon-preview.png`: initial generated preview.
- `mcprouter.ora`: editable OpenRaster source with separate base and routing layers.
- `icon-composite.png`: composite of the two final transparent PNG layers.
- `og-source.png`: generated social preview source.
- `../../public/brand/layers/`: full-resolution transparent layer PNGs.
- `../../public/brand/icon.webp`: 512px production logo.
- `../../app/favicon.ico`: 16, 32 and 48px browser icon frames.
- `../../app/apple-icon.png`: 180px home-screen icon.
- `../../app/opengraph-image.png`: 1200 × 630 social preview, discovered by Next.js.

Run `node scripts/build-brand-assets.mjs` to re-export the web assets after editing
the PNG layers or OG source. The OpenRaster archive contains the original layers.

## Imagegen prompt set

1. **Preview:** Create a square layered app icon for mcprouter, routing one AI
   request to many Hong Kong open-data MCP tools. Preserve one incoming node on
   the left branching to three output nodes on the right. Use #216487 teal,
   #c7e7ff ice blue and white. Front-facing rounded-square teal base with a subtle
   beveled rim, raised icy-blue glass/ceramic routing symbol, soft dimensional
   shadows, bold silhouette, no text or scene.
2. **Base:** From the preview, remove the pale routing symbol and its shadow.
   Preserve the teal tile, rim, lighting, canvas, position and outer margins.
   Use genuine transparent alpha outside the rounded square.
3. **Routing layer:** Extract only the raised icy-blue routing symbol, with its
   four round nodes, curved branches, highlights and soft shadow. Remove the
   tile; retain the full square canvas, position and scale for aligned layering.
4. **OG preview:** Wide 1.905:1 social banner. Reference the icon on the right,
   pale ice-blue background, subtle teal gradient and curved connection lines.
   Left-aligned dark teal text: “mcprouter”, “Hong Kong open data.”, “Ready for AI.”
   Spacious Material 3 styling, safe padding, no other text or watermark.
