import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
