import { generateText, isStepCount, tool, type ToolSet, type UIMessage } from "ai";
import { MockEmbeddingModelV4, MockLanguageModelV4 } from "ai/test";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { MAX_SEARCH_RESULTS, SEARCH_TOOL_NAME, fuseRankings, rankTools, searchTools, tokenize, toolDocument, usedToolNames, withToolSearch } from "@/lib/agent/tool-search";
import { services } from "@/generated/registry";

const catalogue = services.flatMap((service) => service.tools.map((tool) => ({ name: tool.name, description: tool.description })));
const top = (query: string) => rankTools(query, catalogue).slice(0, MAX_SEARCH_RESULTS);

/** A fake embedding space with one dimension per concept, plus a constant so no vector is zero. */
const CONCEPTS = [
  ["weather", "forecast", "umbrella", "rain"],
  ["kmb", "citybus", "bus"],
  ["carpark", "car park", "parking", "drive"],
];
const fakeEmbedding = (text: string) => [...CONCEPTS.map((words) => (words.some((word) => text.toLowerCase().includes(word)) ? 1 : 0)), 0.1];

function embeddingModel(modelId: string, fail = false) {
  return new MockEmbeddingModelV4({
    modelId,
    maxEmbeddingsPerCall: null,
    doEmbed: async ({ values }) => {
      if (fail) throw new Error("gateway down");
      return { embeddings: values.map(fakeEmbedding), warnings: [] };
    },
  });
}

describe("agent tool search", () => {
  it("splits tool names into word stems", () => {
    expect(tokenize("kmb_route_stops")).toEqual(["kmb", "route", "stop"]);
    expect(tokenize("other__getCarParks")).toEqual(["other", "get", "car", "park"]);
  });

  it("finds the right service's tools for everyday questions", () => {
    expect(top("KMB bus arrivals")).toEqual(expect.arrayContaining(["bus"]));
    expect(top("next MTR train")[0]).toBe("mtr_next_train");
    expect(top("car park vacancy")[0]).toBe("carpark_vacancy");
    expect(top("A&E waiting time")[0]).toBe("ha_aed_waiting_times");
    expect(top("typhoon signal")).toContain("hko_warning_summary");
  });

  it("expands synonyms, including Chinese ones", () => {
    expect(top("parking")).toContain("carpark_vacancy");
    expect(top("subway")).toContain("mtr_next_train");
    expect(top("今日天氣")).toContain("hko_current_weather");
    expect(top("巴士")).toEqual(expect.arrayContaining(["bus"]));
  });

  it("ignores filler words and returns nothing for unrelated queries", () => {
    expect(rankTools("what is the", catalogue)).toEqual([]);
    expect(rankTools("stock prices", catalogue)).toEqual([]);
  });

  it("finds tools by meaning when no keyword matches", async () => {
    expect(rankTools("will I need an umbrella", catalogue)).toEqual([]);
    const names = await searchTools("will I need an umbrella", catalogue, embeddingModel("semantic"));
    expect(names).toEqual(expect.arrayContaining(["hko_local_forecast", "hko_nine_day_forecast"]));
    expect(names.some((name) => name.startsWith("kmb_") || name.startsWith("carpark_"))).toBe(false);
  });

  it("embeds each tool once, then only the query", async () => {
    const model = embeddingModel("cached");
    await searchTools("where can I park", catalogue, model);
    await searchTools("bus to the airport", catalogue, model);
    const embedded = model.doEmbedCalls.map((call) => call.values.length).sort((a, b) => b - a);
    // One batch of every tool, plus the two queries.
    expect(embedded).toEqual([new Set(catalogue.map(toolDocument)).size, 1, 1]);
  });

  it("falls back to keyword search when embedding fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await searchTools("car park vacancy", catalogue, embeddingModel("down", true))).toEqual(rankTools("car park vacancy", catalogue));
    // The failure isn't cached: once the failed batch settles, a working model with the same id embeds again.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const recovered = embeddingModel("down");
    await searchTools("parking", catalogue, recovered);
    expect(recovered.doEmbedCalls.length).toBeGreaterThan(0);
  });

  it("fuses rankings so tools both rankings agree on come first", () => {
    expect(fuseRankings(["a", "b"], ["b"])).toEqual(["b", "a"]);
    expect(fuseRankings([], ["x"])).toEqual(["x"]);
  });

  it("collects tools already called in the conversation", () => {
    const messages = [
      {
        id: "m1",
        role: "assistant",
        parts: [
          { type: "tool-search_tools", toolCallId: "c0", state: "output-available", input: {}, output: {} },
          { type: "dynamic-tool", toolName: "kmb_stop_eta", toolCallId: "c1", state: "output-available", input: {}, output: {} },
          { type: "text", text: "hi" },
        ],
      },
    ] as unknown as UIMessage[];
    expect(usedToolNames(messages)).toEqual(new Set(["search_tools", "kmb_stop_eta"]));
  });

  it("defers every tool except those already used, and adds the search tool", () => {
    const tools = { kmb_stop_eta: { description: "a" }, mtr_next_train: { description: "b" } } as unknown as ToolSet;
    const result = withToolSearch(tools, new Set(["kmb_stop_eta"]));
    expect(result.kmb_stop_eta.deferLoading).toBeUndefined();
    expect(result.mtr_next_train.deferLoading).toBe(true);
    expect(result[SEARCH_TOOL_NAME]).toBeDefined();
    expect(result[SEARCH_TOOL_NAME].deferLoading).toBeFalsy();
    // The source tools aren't mutated; MCP clients may reuse them.
    expect((tools.mtr_next_train as { deferLoading?: boolean }).deferLoading).toBeUndefined();
  });

  it("loads the tools a search finds on the next model step", async () => {
    const tools = Object.fromEntries(
      catalogue.map(({ name, description }) => [name, tool({ description, inputSchema: z.object({}), execute: async () => ({ ok: true }) })]),
    ) as ToolSet;
    const seen: string[][] = [];
    const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 1, text: 1, reasoning: undefined } };
    const replies = [
      { type: "tool-call" as const, toolCallId: "c1", toolName: SEARCH_TOOL_NAME, input: JSON.stringify({ query: "car park vacancy" }) },
      { type: "text" as const, text: "done" },
    ];
    const model = new MockLanguageModelV4({
      doGenerate: async (options) => {
        seen.push((options.tools ?? []).map((t) => t.name).sort());
        const reply = replies[seen.length - 1];
        return { content: [reply], finishReason: { unified: reply.type === "text" ? "stop" : "tool-calls", raw: undefined }, usage, warnings: [] };
      },
    });

    await generateText({ model, tools: withToolSearch(tools, new Set(), embeddingModel("e2e")), prompt: "Any parking?", stopWhen: isStepCount(3) });

    expect(seen[0]).toEqual([SEARCH_TOOL_NAME]);
    expect(seen[1]).toEqual(expect.arrayContaining([SEARCH_TOOL_NAME, "carpark_vacancy", "carpark_info"]));
    expect(seen[1].length).toBeLessThanOrEqual(MAX_SEARCH_RESULTS + 1);
  });
});
