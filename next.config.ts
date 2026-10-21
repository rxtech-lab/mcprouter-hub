import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mapbox raster tiles use a browser-visible public token. Never expose secret tokens.
  env: {
    NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: [process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN, process.env.MAPBOX_API_KEY].find((token) => token?.startsWith("pk.")) ?? "",
  },
  // Cache eligibility must see the original RSC/prefetch headers and _rsc query.
  // Next otherwise strips these before invoking proxy.ts.
  skipProxyUrlNormalize: true,
  // The account menu sits at the bottom of the navigation rail.
  devIndicators: { position: "bottom-right" },
  // Keep the optional Webpack build path styled as well. The Tailwind loader
  // implements Webpack's loader interface (also consumed by Turbopack).
  webpack(config) {
    config.module.rules.push({
      // Keep Next's CSS extraction rules; only preprocess their input.
      oneOf: [{ test: /\.css$/, enforce: "pre", use: ["@tailwindcss/turbopack"] }],
    });
    return config;
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
