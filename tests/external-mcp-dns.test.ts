import { afterEach, describe, expect, it, vi } from "vitest";

const dns = vi.hoisted(() => ({
  lookup: vi.fn(), resolve4: vi.fn(), resolve6: vi.fn(), setServers: vi.fn(),
}));
vi.mock("node:dns/promises", () => ({
  lookup: dns.lookup,
  Resolver: class {
    setServers = dns.setServers;
    resolve4 = dns.resolve4;
    resolve6 = dns.resolve6;
  },
}));

import { assertPublicUrl } from "@/lib/external-mcp/safe-fetch";

afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); });

describe("MCP DNS validation", () => {
  it("resolves local VPN synthetic answers independently in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    dns.lookup.mockResolvedValue([{ address: "198.18.35.242" }]);
    dns.resolve4.mockResolvedValue(["216.150.16.65", "216.150.1.65"]);
    dns.resolve6.mockRejectedValue(new Error("ENODATA"));
    expect((await assertPublicUrl("https://summary.rxlab.app/api/mcp")).hostname).toBe("summary.rxlab.app");
    expect(dns.setServers).toHaveBeenCalledWith(["1.1.1.1", "8.8.8.8"]);
    expect(dns.resolve4).toHaveBeenCalledWith("summary.rxlab.app");
  });

  it.each(["production", "test"])("never falls back in %s", async (environment) => {
    vi.stubEnv("NODE_ENV", environment);
    dns.lookup.mockResolvedValue([{ address: "198.18.35.242" }]);
    await expect(assertPublicUrl("https://summary.rxlab.app/api/mcp")).rejects.toThrow("Private network");
    expect(dns.setServers).not.toHaveBeenCalled();
  });

  it("still rejects private or mixed public/private fallback answers", async () => {
    vi.stubEnv("NODE_ENV", "development");
    dns.lookup.mockResolvedValue([{ address: "198.18.35.242" }]);
    dns.resolve4.mockResolvedValue(["216.150.16.65", "127.0.0.1"]);
    dns.resolve6.mockResolvedValue([]);
    await expect(assertPublicUrl("https://summary.rxlab.app/api/mcp")).rejects.toThrow("Private network");
  });

  it("fails closed when independent resolution fails", async () => {
    vi.stubEnv("NODE_ENV", "development");
    dns.lookup.mockResolvedValue([{ address: "198.18.35.242" }]);
    dns.resolve4.mockRejectedValue(new Error("ETIMEOUT"));
    dns.resolve6.mockRejectedValue(new Error("ETIMEOUT"));
    await expect(assertPublicUrl("https://summary.rxlab.app/api/mcp")).rejects.toThrow("Private network");
  });

  it("does not fall back for private names, mixed answers or literal synthetic IPs", async () => {
    vi.stubEnv("NODE_ENV", "development");
    for (const addresses of [[{ address: "10.0.0.1" }], [{ address: "198.18.35.242" }, { address: "127.0.0.1" }]]) {
      dns.lookup.mockResolvedValue(addresses);
      await expect(assertPublicUrl("https://private.test/mcp")).rejects.toThrow("Private network");
    }
    await expect(assertPublicUrl("https://198.18.35.242/mcp")).rejects.toThrow("Private network");
    expect(dns.setServers).not.toHaveBeenCalled();
  });
});
