import { defineConfig, devices } from "@playwright/test";

// MCP Apps are standalone iframe documents; these checks need no database or Next server.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "mcp-bus.spec.ts",
  use: { trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
