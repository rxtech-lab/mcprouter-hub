import { describe, expect, it } from "vitest";
import { DEFAULT_AGENT_SERVERS, parseMcpServers, resolveServer } from "@/lib/agent/mcp-servers";

describe("AGENT_MCP_SERVERS", () => {
  it("defaults to this app's own server", () => {
    expect(parseMcpServers(undefined)).toEqual(DEFAULT_AGENT_SERVERS);
  });

  it("parses a list of servers", () => {
    expect(parseMcpServers('[{"name":"hk","url":"self"},{"name":"other","url":"https://mcp.example.test/mcp","headers":{"Authorization":"Bearer x"}}]')).toEqual([
      { name: "hk", url: "self", headers: {} },
      { name: "other", url: "https://mcp.example.test/mcp", headers: { Authorization: "Bearer x" } },
    ]);
  });

  it("rejects invalid JSON, bad URLs and duplicate names", () => {
    expect(() => parseMcpServers("{nope")).toThrow(/not valid JSON/);
    expect(() => parseMcpServers('[{"name":"x","url":"ftp:/bad"}]')).toThrow(/invalid/);
    expect(() => parseMcpServers('[{"name":"x","url":"self"},{"name":"x","url":"self"}]')).toThrow(/twice/);
    expect(() => parseMcpServers("[]")).toThrow(/invalid/);
  });

  it("resolves self to the internal endpoint for the signed-in user", () => {
    expect(resolveServer({ name: "hk", url: "self", headers: {} }, { origin: "https://hk.test", userId: "u1", internalKey: "k".repeat(32) })).toEqual({
      name: "hk",
      url: "https://hk.test/api/mcp/mcp",
      headers: { Authorization: `Bearer ${"k".repeat(32)}`, "x-mcprouter-user": "u1" },
      self: true,
    });
    expect(() => resolveServer({ name: "hk", url: "self", headers: {} }, { origin: "https://hk.test", userId: "u1", internalKey: undefined })).toThrow(/MCPROUTER_INTERNAL_KEY/);
  });
});

describe("agentInstructions", () => {
  it("tells the agent today's Hong Kong date", async () => {
    const { agentInstructions } = await import("@/lib/agent/run");
    // 17:00 UTC is already the next day in Hong Kong.
    expect(agentInstructions(new Date("2026-10-17T17:00:00Z"))).toContain("Today is Sunday, 18 October 2026 (Hong Kong).");
  });
});
