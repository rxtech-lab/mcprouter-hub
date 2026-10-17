import sharp from "sharp";
import { writeFile } from "node:fs/promises";

// Export the imagegen master directly to preserve its precise ribbon edges.
const icon = await sharp("design/brand/icon-preview.png").resize(1024, 1024).png().toBuffer();
await sharp(icon).toFile("design/brand/icon-composite.png");
await sharp(icon).resize(512, 512).webp({ quality: 92, alphaQuality: 100 }).toFile("public/brand/icon.webp");
await sharp(icon).resize(512, 512).webp({ quality: 92, alphaQuality: 100 }).toFile("public/brand/icon-v2.webp");
await sharp(icon).resize(180, 180).flatten({ background: "#102f3b" }).png().toFile("app/apple-icon.png");
await sharp("design/brand/og-source.png").resize(1200, 630, { fit: "cover" }).png().toFile("app/opengraph-image.png");

// ICO directory with PNG frames for crisp browser tabs at common pixel densities.
const sizes = [16, 32, 48];
const frames = await Promise.all(sizes.map(size => sharp(icon).resize(size, size).ensureAlpha().png().toBuffer()));
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
frames.forEach((frame, i) => {
  const entry = 6 + 16 * i;
  header[entry] = sizes[i];
  header[entry + 1] = sizes[i];
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(frame.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += frame.length;
});
await writeFile("app/favicon.ico", Buffer.concat([header, ...frames]));
