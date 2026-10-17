import type { ModelMessage } from "ai";
import { describe, expect, it } from "vitest";
import { cachedInstructions, gatewayCaching, markLastMessage, stableTools } from "@/lib/agent/cache";

const breakpoint = { cacheControl: { type: "ephemeral" } };

describe("agent prompt caching", () => {
  it("marks the instructions as a cache breakpoint and asks the gateway to cache", () => {
    expect(cachedInstructions("hi")).toEqual({ role: "system", content: "hi", providerOptions: { anthropic: breakpoint } });
    expect(gatewayCaching).toEqual({ gateway: { caching: "auto" } });
  });

  it("keeps exactly one message breakpoint, on the newest message", () => {
    const first = markLastMessage([
      { role: "user", content: "one" },
      { role: "assistant", content: "two" },
    ]);
    expect(first[0].providerOptions).toBeUndefined();
    expect(first[1].providerOptions).toEqual({ anthropic: breakpoint });

    const next = markLastMessage([...first, { role: "user", content: "three" }]);
    expect(next.filter((message) => message.providerOptions?.anthropic).length).toBe(1);
    expect(next[2].providerOptions).toEqual({ anthropic: breakpoint });
    expect(next[1].providerOptions).toBeUndefined();
  });

  it("keeps other provider options when moving the breakpoint", () => {
    const messages: ModelMessage[] = [
      { role: "user", content: "a", providerOptions: { anthropic: { ...breakpoint, other: 1 }, openai: { x: 1 } } },
      { role: "user", content: "b" },
    ];
    const marked = markLastMessage(messages);
    expect(marked[0].providerOptions).toEqual({ anthropic: { other: 1 }, openai: { x: 1 } });
    expect(markLastMessage([])).toEqual([]);
  });

  it("orders tools by name so the cached prefix is stable", () => {
    const tools = { b_tool: {}, a_tool: {}, c_tool: {} } as never;
    expect(Object.keys(stableTools(tools))).toEqual(["a_tool", "b_tool", "c_tool"]);
  });
});
