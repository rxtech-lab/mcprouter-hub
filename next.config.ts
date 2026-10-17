import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
