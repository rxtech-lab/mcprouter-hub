import { defineConfig, devices } from "@playwright/test";

const port = 3199;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: { baseURL: `http://localhost:${port}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `bunx drizzle-kit migrate && bun run dev --port ${port}`,
    url: `http://localhost:${port}`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      DEV_BYPASS_AUTH: "true",
      AUTH_SECRET: "e2e-only-secret-e2e-only-secret-123456",
      TURSO_DATABASE_URL: "file:e2e.db",
      NEXT_PUBLIC_SITE_URL: `http://localhost:${port}`,
      BILLING_ENABLED: "false",
      NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: "pk.e2e-mapbox-token",
    },
  },
});
