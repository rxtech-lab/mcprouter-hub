import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateAgentReply, qualifiedToolName } from "@/lib/agent/run";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(async () => ({ content: [{ type: "text", text: "fixture result" }] })),
  close: vi.fn(),
  external: vi.fn(async (user: string) => {
    void user;
    return [{ name: "oauth_fixture", url: "https://external.test/mcp", headers: {}, self: false, toolMode: null }];
  }),
  generate: vi.fn(async (options: unknown) => {
    void options;
    return { text: "Report", steps: [] };
  }),
}));
vi.mock("@/lib/external-mcp/servers", () => ({ externalServers: mocks.external }));
vi.mock("ai", async (original) => ({ ...await original<typeof import("ai")>(), generateText: mocks.generate }));
vi.mock("@ai-sdk/mcp", async (original) => ({ ...await original<typeof import("@ai-sdk/mcp")>(), createMCPClient: async () => ({ listTools: async () => ({ tools: [{ name: "fetch_report", inputSchema: { type: "object" } }] }), toolsFromDefinitions: () => ({ fetch_report: { description: "Fetch a report", execute: mocks.execute } }), close: mocks.close }) }));
const servers = [{ name: "hk", url: "https://app.test/mcp", headers: {}, self: true, toolMode: null }];
beforeEach(() => vi.clearAllMocks());

describe("shared agent MCP access and scripts", () => {
  it("keeps long OAuth tool names stable, distinct and within provider limits", () => {
    const server = `oauth_${"a".repeat(32)}`;
    const first = qualifiedToolName(server, "a_very_long_remote_tool_name_for_a_connected_provider");
    expect(first.length).toBeLessThanOrEqual(64);
    expect(first).toBe(qualifiedToolName(server, "a_very_long_remote_tool_name_for_a_connected_provider"));
    expect(first).not.toBe(qualifiedToolName(server, "another_very_long_remote_tool_name_for_a_connected_provider"));
  });
  it("loads only the authenticated owner's OAuth tools and executes a bounded workflow", async () => {
    const reply = await generateAgentReply({ servers, userId: "alice", messages: [], model: "fixture/model", scheduled: true, script: '[{"tool":"oauth_fixture__fetch_report","arguments":{"limit":3}}]' });
    expect(mocks.external).toHaveBeenCalledWith("alice");
    expect(mocks.execute).toHaveBeenCalledWith({ limit: 3 }, expect.objectContaining({ abortSignal: expect.any(AbortSignal) }));
    expect(reply.text).toBe("Report");
    const options = mocks.generate.mock.calls[0][0] as unknown as { tools: Record<string, unknown>; messages: unknown[] };
    expect(options.tools).not.toHaveProperty("draft_scheduled_task");
    expect(JSON.stringify(options.messages)).toContain("fixture result");
    expect(mocks.close).toHaveBeenCalledTimes(2);
  });
  it("offers task draft tools in signed-in interactive agents but never to guests", async () => {
    await generateAgentReply({ servers, userId: "alice", messages: [], model: "fixture/model" });
    expect((mocks.generate.mock.calls[0][0] as unknown as { tools: Record<string, unknown> }).tools).toHaveProperty("draft_scheduled_task");
    vi.clearAllMocks();
    await generateAgentReply({ servers, messages: [], model: "fixture/model" });
    expect(mocks.external).not.toHaveBeenCalled();
    expect((mocks.generate.mock.calls[0][0] as unknown as { tools: Record<string, unknown> }).tools).not.toHaveProperty("draft_scheduled_task");
  });
  it("rejects unavailable script tools and closes connections before model generation", async () => {
    await expect(generateAgentReply({ servers, userId: "alice", messages: [], model: "fixture/model", script: '[{"tool":"missing","arguments":{}}]' })).rejects.toThrow("Script tool is unavailable");
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.close).toHaveBeenCalledTimes(2);
  });
});
