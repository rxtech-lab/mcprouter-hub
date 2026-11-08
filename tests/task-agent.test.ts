import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateAgentReply, qualifiedToolName } from "@/lib/agent/run";

const mocks = vi.hoisted(() => ({
  annotations: undefined as undefined | { readOnlyHint: boolean; idempotentHint: boolean },
  connect: vi.fn(async () => {}),
  execute: vi.fn(async () => ({ content: [{ type: "text", text: "fixture result" }] })),
  close: vi.fn(),
  stream: vi.fn(),
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
vi.mock("ai", async (original) => ({ ...await original<typeof import("ai")>(), generateText: mocks.generate, streamText: mocks.stream }));
vi.mock("@ai-sdk/mcp", async (original) => ({ ...await original<typeof import("@ai-sdk/mcp")>(), createMCPClient: async () => {
  await mocks.connect();
  return { listTools: async () => ({ tools: [{ name: "fetch_report", inputSchema: { type: "object" }, annotations: mocks.annotations }] }), toolsFromDefinitions: () => ({ fetch_report: { description: "Fetch a report", execute: mocks.execute } }), close: mocks.close };
} }));
const servers = [{ name: "hk", url: "https://app.test/mcp", headers: {}, self: true, toolMode: null }];
beforeEach(() => { vi.clearAllMocks(); mocks.annotations = undefined; });

describe("shared agent MCP access and scripts", () => {
  it("delivers partial and completed UI messages while consuming a background stream", async () => {
    const stream = new ReadableStream({ start(controller) {
      for (const chunk of [
        { type: "start" },
        { type: "text-start", id: "text-1" },
        { type: "text-delta", id: "text-1", text: "Live " },
        { type: "text-delta", id: "text-1", text: "report" },
        { type: "text-end", id: "text-1" },
        { type: "finish", finishReason: "stop" },
      ]) controller.enqueue(chunk);
      controller.close();
    } });
    mocks.stream.mockReturnValueOnce({ stream, text: Promise.resolve("Live report"), steps: Promise.resolve([]) });
    const snapshots: import("ai").UIMessage[] = [];
    const result = await generateAgentReply({ servers, userId: "alice", messages: [], model: "fixture/model", scheduled: true, onProgress: async message => { snapshots.push(message); } });
    expect(snapshots.length).toBeGreaterThan(1);
    expect(snapshots.at(-1)?.parts).toEqual([{ type: "text", text: "Live report", state: "done" }]);
    expect(result.text).toBe("Live report");
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.close).toHaveBeenCalledTimes(2);
  });

  it.each(["error", "abort"])("propagates background stream %s and closes MCP connections", async type => {
    const providerError = Object.assign(new Error("Provider unavailable"), { statusCode: 503 });
    mocks.stream.mockImplementationOnce((options) => ({ stream: new ReadableStream({ start(controller) {
      if (type === "error") options.onError({ error: providerError });
      controller.enqueue(type === "error" ? { type, error: providerError } : { type });
      controller.close();
    } }) }));
    const reply = generateAgentReply({ servers, messages: [], model: "fixture/model", onProgress: async () => {} });
    if (type === "error") await expect(reply).rejects.toBe(providerError);
    else await expect(reply).rejects.toThrow("interrupted or timed out");
    expect(mocks.close).toHaveBeenCalledTimes(1);
  });

  it("saves a recovered streamed result after a tool error and another MCP call", async () => {
    mocks.stream.mockReturnValueOnce({ stream: new ReadableStream({ start(controller) {
      for (const chunk of [
        { type: "start" },
        { type: "tool-call", toolCallId: "call-1", toolName: "fetch_report", input: {}, dynamic: true },
        { type: "tool-error", toolCallId: "call-1", toolName: "fetch_report", error: new Error("Invalid arguments"), dynamic: true },
        { type: "tool-call", toolCallId: "call-2", toolName: "fetch_report", input: { corrected: true }, dynamic: true },
        { type: "tool-result", toolCallId: "call-2", toolName: "fetch_report", output: { report: "data" }, dynamic: true },
        { type: "text-start", id: "text-1" },
        { type: "text-delta", id: "text-1", text: "Recovered report" },
        { type: "text-end", id: "text-1" },
        { type: "finish", finishReason: "stop" },
      ]) controller.enqueue(chunk);
      controller.close();
    } }), text: Promise.resolve("Recovered report"), steps: Promise.resolve([]) });
    const snapshots: import("ai").UIMessage[] = [];
    const result = await generateAgentReply({ servers, messages: [], model: "fixture/model", scheduled: true, onProgress: async message => { snapshots.push(message); } });
    expect(result.text).toBe("Recovered report");
    expect(snapshots.at(-1)?.parts).toEqual(expect.arrayContaining([
      expect.objectContaining({ toolCallId: "call-1", state: "output-error" }),
      expect.objectContaining({ toolCallId: "call-2", state: "output-available" }),
      expect.objectContaining({ type: "text", text: "Recovered report" }),
    ]));
  });

  it("does not impose a time budget on scheduled runs", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    const timeout = vi.spyOn(AbortSignal, "timeout");
    try {
      await generateAgentReply({ servers, messages: [], model: "fixture/model", scheduled: true });
      expect(timeout).not.toHaveBeenCalled();
      const options = mocks.generate.mock.calls[0][0] as { prepareStep: (step: { messages: never[]; stepNumber: number }) => { toolChoice?: string; messages: unknown[] } };
      expect(options.prepareStep({ messages: [], stepNumber: 1 }).toolChoice).toBeUndefined();
      clock.mockReturnValue(1_000_000 + 3_600_000);
      const final = options.prepareStep({ messages: [], stepNumber: 2 });
      expect(final.toolChoice).toBeUndefined();
      expect(JSON.stringify(final.messages)).not.toContain("Give your final answer");
    } finally {
      clock.mockRestore();
      timeout.mockRestore();
    }
  });

  it("keeps long OAuth tool names stable, distinct and within provider limits", () => {
    const server = `oauth_${"a".repeat(32)}`;
    const first = qualifiedToolName(server, "a_very_long_remote_tool_name_for_a_connected_provider");
    expect(first.length).toBeLessThanOrEqual(64);
    expect(first).toBe(qualifiedToolName(server, "a_very_long_remote_tool_name_for_a_connected_provider"));
    expect(first).not.toBe(qualifiedToolName(server, "another_very_long_remote_tool_name_for_a_connected_provider"));
  });
  it("loads only the authenticated owner's OAuth tools and executes a bounded workflow", async () => {
    const onMcpCall = vi.fn(async () => {});
    const reply = await generateAgentReply({ servers, userId: "alice", messages: [], model: "fixture/model", scheduled: true, onMcpCall, script: '[{"tool":"oauth_fixture__fetch_report","arguments":{"limit":3}}]' });
    expect(mocks.external).toHaveBeenCalledWith("alice");
    expect(mocks.execute).toHaveBeenCalledWith({ limit: 3 }, expect.objectContaining({ abortSignal: expect.any(AbortSignal) }));
    expect(reply.text).toBe("Report");
    expect(onMcpCall).toHaveBeenCalledTimes(1);
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

  it("retries only a failed scheduled step and meters every attempt", async () => {
    const success = { content: [{ type: "text", text: "fixture result" }] };
    mocks.execute.mockResolvedValueOnce(success).mockRejectedValueOnce(new Error("External MCP request failed")).mockResolvedValueOnce(success);
    const onMcpCall = vi.fn(async () => {});
    await generateAgentReply({ servers, messages: [], model: "fixture/model", scheduled: true, onMcpCall,
      script: '[{"tool":"fetch_report","arguments":{"part":1}},{"tool":"fetch_report","arguments":{"part":2}}]' });
    expect(mocks.execute.mock.calls.map(call => (call as unknown[])[0])).toEqual([{ part: 1 }, { part: 2 }, { part: 2 }]);
    expect(onMcpCall).toHaveBeenCalledTimes(3);
    expect(mocks.generate).toHaveBeenCalledOnce();
  });

  it("passes exhausted script errors to the agent and continues subsequent steps", async () => {
    for (let attempt = 0; attempt < 3; attempt++) mocks.execute.mockRejectedValueOnce(new Error("External MCP request failed"));
    const result = await generateAgentReply({ servers, messages: [], model: "fixture/model", scheduled: true,
      script: '[{"tool":"fetch_report","arguments":{}},{"tool":"fetch_report","arguments":{"part":2}}]' });
    expect(result.text).toBe("Report");
    expect(mocks.execute).toHaveBeenCalledTimes(4);
    const options = mocks.generate.mock.calls[0][0] as { messages: unknown[]; instructions: unknown };
    expect(JSON.stringify(options.messages)).toContain("External MCP request failed");
    expect(JSON.stringify(options.messages)).toContain("fixture result");
    expect(JSON.stringify(options.instructions)).toContain("keep making tool calls");
  });

  it("lets the agent recover a missing saved tool instead of failing the scheduled run", async () => {
    await generateAgentReply({ servers, messages: [], model: "fixture/model", scheduled: true, script: '[{"tool":"missing","arguments":{}}]' });
    expect(JSON.stringify((mocks.generate.mock.calls[0][0] as { messages: unknown[] }).messages)).toContain("Script tool is unavailable");
  });

  it("returns uncertain non-idempotent write failures without automatically replaying them", async () => {
    mocks.annotations = { readOnlyHint: false, idempotentHint: false };
    mocks.execute.mockRejectedValueOnce(new Error("External MCP request failed"));
    await generateAgentReply({ servers, messages: [], model: "fixture/model", scheduled: true, script: '[{"tool":"fetch_report","arguments":{}}]' });
    expect(mocks.execute).toHaveBeenCalledOnce();
    expect(JSON.stringify((mocks.generate.mock.calls[0][0] as { messages: unknown[] }).messages)).toContain("External MCP request failed");
  });

  it("retries scheduled connection failures and keeps healthy connections available", async () => {
    mocks.connect.mockRejectedValueOnce(new Error("External MCP request failed"));
    await generateAgentReply({ servers, messages: [], model: "fixture/model", scheduled: true });
    expect(mocks.connect).toHaveBeenCalledTimes(2);
    expect(mocks.close).toHaveBeenCalledOnce();
  });

  it("continues with available tools after a connection exhausts its retries", async () => {
    for (let attempt = 0; attempt < 3; attempt++) mocks.connect.mockRejectedValueOnce(new Error("External MCP request failed"));
    await generateAgentReply({ servers, messages: [], model: "fixture/model", scheduled: true });
    expect(mocks.connect).toHaveBeenCalledTimes(3);
    expect(JSON.stringify((mocks.generate.mock.calls[0][0] as { instructions: unknown }).instructions)).toContain("Unavailable MCP connections: hk");
  });
});
