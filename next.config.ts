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
