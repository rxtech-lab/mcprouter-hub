import { describe, expect, it } from "vitest";
import { generateText, tool, type StepResult, type ToolSet } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod";
import { agentLoop, hasFinalAnswer } from "@/lib/agent/stop";

const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 1, text: 1, reasoning: undefined } };
function modelWithTools(toolSteps: number, toolName = "lookup") {
  let calls = 0;
  return new MockLanguageModelV4({ doGenerate: async (options) => {
    const callTool = calls++ < toolSteps && options.toolChoice?.type !== "none";
    return {
      content: callTool ? [{ type: "tool-call", toolCallId: `call-${calls}`, toolName, input: "{}" }] : [{ type: "text", text: "Here are the results and any remaining limitations." }],
      finishReason: { unified: callTool ? "tool-calls" : "stop", raw: undefined }, usage, warnings: [],
    };
  } });
}
const lookup = tool({ inputSchema: z.object({}), execute: async () => ({ result: "live data" }) });

describe("agent completion policy", () => {
  it("does not mistake progress text accompanying tools for completion", async () => {
    const steps = [{ text: "Checking now", toolCalls: [{ toolName: "lookup" }] }] as unknown as StepResult<ToolSet>[];
    expect(await hasFinalAnswer({ steps })).toBe(false);
    expect(await hasFinalAnswer({ steps: [] })).toBe(false);
    expect(await hasFinalAnswer({ steps: [{ text: " ", toolCalls: [] }] as unknown as StepResult<ToolSet>[] })).toBe(false);
  });

  it("continues past the former ten-step cutoff and produces an answer", async () => {
    const result = await generateText({ model: modelWithTools(12), tools: { lookup }, prompt: "Complete a multi-part task", ...agentLoop() });
    expect(result.steps).toHaveLength(13);
    expect(result.text).toContain("Here are the results");
    expect(await hasFinalAnswer({ steps: result.steps })).toBe(true);
  });

  it("reserves a final response when the tool safety budget is exhausted", async () => {
    const model = modelWithTools(100);
    const result = await generateText({ model, tools: { lookup }, prompt: "A task that keeps calling tools", ...agentLoop(3) });
    expect(result.steps).toHaveLength(4);
    expect(result.steps.flatMap((step) => step.toolCalls)).toHaveLength(3);
    expect(result.text).toContain("remaining limitations");
    expect(model.doGenerateCalls.at(-1)?.toolChoice).toEqual({ type: "none" });
    expect(JSON.stringify(model.doGenerateCalls.at(-1)?.prompt)).toContain("Clearly state any unfinished parts");
  });

  for (const name of ["request_user_input", "request_user_location"]) {
    it(`pauses immediately for ${name}`, async () => {
      const result = await generateText({ model: modelWithTools(100, name), tools: { [name]: lookup }, prompt: "Need clarification", ...agentLoop() });
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].toolCalls[0].toolName).toBe(name);
    });
  }
});
