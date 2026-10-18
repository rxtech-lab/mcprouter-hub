import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { setCacheForTesting } from "@/lib/mcp/cache";
import { fetchUpstream, parseBody, stripBom, UpstreamError } from "@/lib/mcp/fetcher";
import { buildRequest, executeTool, shapeResponse } from "@/lib/mcp/runtime";
import type { ServiceDefinition, ToolDefinition } from "@/lib/mcp/types";
import { toolSpec } from "@/mcp/schema";
import { flattenHolidays } from "@/mcp/services/hk-holidays/handlers";

const service = { baseUrl: "https://api.example.test/v1/", lang: { param: "language", in: "query" as const, map: { en: "EN", tc: "ZH", sc: "ZH" } } };

function spec(value: unknown) {
  const parsed: Partial<ReturnType<typeof toolSpec.parse>> = toolSpec.parse(value);
  delete parsed.handler;
  return parsed as Omit<ReturnType<typeof toolSpec.parse>, "handler">;
}

function memoryCache() {
  const store = new Map<string, unknown>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: unknown) => void store.set(key, value)),
    delete: vi.fn(async () => {}),
    expireTag: vi.fn(async () => {}),
  };
}

describe("buildRequest", () => {
  it("fills path params, maps languages and keeps local inputs out of the URL", () => {
    const tool = spec({
      name: "t",
      description: "d",
      path: "/items/{category}",
      query: { format: "json" },
      input: {
        category: { type: "string", transform: "lower" },
        lang: { type: "string", enum: ["en", "tc", "sc"] },
        name: { type: "string", in: "local" },
        limit: { type: "integer", name: "max" },
      },
    });
    const request = buildRequest(service, tool, { category: "Big Things", lang: "tc", name: "x", limit: 3 });
    expect(request.url).toBe("https://api.example.test/v1/items/big%20things?format=json&language=ZH&max=3");
    expect(request.method).toBe("GET");
    expect(request.body).toBeUndefined();
  });

  it("puts {lang} in the path when the template uses it", () => {
    const tool = spec({ name: "t", description: "d", path: "/data-{lang}.json", input: { lang: { type: "string" } } });
    expect(buildRequest({ ...service, lang: { ...service.lang, in: "path" } }, tool, { lang: "en" }).url).toBe("https://api.example.test/v1/data-EN.json");
  });

  it("builds a POST body from fixed fields and body inputs", () => {
    const tool = spec({ name: "t", description: "d", method: "POST", path: "/submit", body: { fixed: true }, input: { route: { type: "string", in: "body", name: "routeName", transform: "upper" } } });
    expect(buildRequest(service, tool, { route: "k12" })).toMatchObject({ method: "POST", body: { fixed: true, routeName: "K12" } });
  });

  it("refuses to send a request with an unfilled path param", () => {
    const tool = spec({ name: "t", description: "d", path: "/x/{id}", input: { id: { type: "string" } } });
    expect(() => buildRequest(service, tool, {})).toThrow(/Missing required path value: id/);
  });
});

describe("shapeResponse", () => {
  const body = {
    data: {
      items: [
        { code: "A1", name_en: "Alpha Road", name_tc: "甲路", extra: 1 },
        { code: "B2", name_en: "Beta Street", name_tc: "乙街", extra: 2 },
        { code: "C3", name_en: "Gamma Road", name_tc: "丙路", extra: 3 },
      ],
    },
  };
  const response = { format: "json" as const, root: "data.items", filter: { code: "code" }, search: { input: "name", fields: ["name_en", "name_tc"] }, pick: ["code", "name_en"], limit: 2 };

  it("filters case-insensitively, picks keys and limits", () => {
    expect(shapeResponse(body, response, { code: "b2" }).data).toEqual([{ code: "B2", name_en: "Beta Street" }]);
    expect(shapeResponse(body, response, { name: "road" })).toEqual({
      data: [{ code: "A1", name_en: "Alpha Road" }, { code: "C3", name_en: "Gamma Road" }],
      meta: { total: 2, returned: 2, truncated: false },
    });
    expect(shapeResponse(body, response, { name: "丙" }).data).toEqual([{ code: "C3", name_en: "Gamma Road" }]);
    expect(shapeResponse(body, response, {}).meta).toEqual({ total: 3, returned: 2, truncated: true });
  });

  it("picks keys on an object root", () => {
    expect(shapeResponse({ a: 1, b: 2, c: 3 }, { format: "json", pick: ["a", "c"], limit: 200 }, {}).data).toEqual({ a: 1, c: 3 });
  });
});

describe("fetcher", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("strips a UTF-8 BOM and parses JSON, XML and CSV", () => {
    expect(stripBom("﻿{}")).toBe("{}");
    expect(parseBody('﻿{"a":1}', "json")).toEqual({ a: 1 });
    expect(parseBody('<rss><item id="1">Hello</item><item id="2">World</item></rss>', "xml")).toEqual({
      rss: { item: [{ "#text": "Hello", "@_id": "1" }, { "#text": "World", "@_id": "2" }] },
    });
    expect(parseBody("﻿name,count\nA,1\nB,2\n", "csv")).toEqual([{ name: "A", count: "1" }, { name: "B", count: "2" }]);
    expect(() => parseBody("not json", "json")).toThrow(UpstreamError);
  });

  it("turns HTTP failures into UpstreamError", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 })));
    await expect(fetchUpstream({ url: "https://x.test", format: "json" })).rejects.toMatchObject({ code: "upstream_http", status: 503 });
  });
});

describe("executeTool", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    setCacheForTesting(memoryCache());
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    setCacheForTesting(null);
  });

  const definition: ServiceDefinition = {
    id: "example",
    title: "Example",
    aliases: [],
    datasets: [],
    baseUrl: "https://api.example.test",
    cacheTtl: 60,
    tools: [],
  };
  const tool: ToolDefinition = {
    name: "example_weather",
    description: "d",
    spec: spec({ name: "example_weather", description: "d", path: "/weather", input: { lang: { type: "string" } }, response: { pick: ["temp"] } }),
    inputSchema: z.object({ lang: z.enum(["en", "tc"]).default("en") }),
  };

  it("validates input, fetches, shapes and caches by URL", async () => {
    fetchMock.mockImplementation(async () => new Response('﻿{"temp":28,"noise":true}'));
    const first = await executeTool(definition, tool, {});
    expect(first).toEqual({ data: { temp: 28 }, meta: { source: "https://api.example.test/weather?lang=en" } });
    await executeTool(definition, tool, {});
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await executeTool(definition, tool, { lang: "tc" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid input before calling upstream", async () => {
    await expect(executeTool(definition, tool, { lang: "fr" })).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe("transformers", () => {
    const feedTool: ToolDefinition = {
      name: "example_feed",
      description: "d",
      spec: spec({
        name: "example_feed",
        description: "d",
        path: "/feed",
        input: { q: { type: "string" } },
        transform: { request: "signRequest", response: "unwrapFeed" },
        response: { root: "entries", pick: ["id"], limit: 1 },
      }),
      inputSchema: z.object({ q: z.string() }),
    };

    it("rewrites the request before fetching and reshapes the body before response shaping", async () => {
      fetchMock.mockImplementation(async () => new Response(JSON.stringify({ feed: { entries: [{ id: 1, x: 0 }, { id: 2, x: 0 }] } })));
      const transformRequest = vi.fn(async (request: { url: string; method: "GET" | "POST" }, input: Record<string, unknown>) => ({
        ...request,
        url: `${request.url}&sig=${String(input.q).length}`,
        headers: { "X-Signed": "yes" },
      }));
      const transformResponse = vi.fn((body: unknown) => (body as { feed: unknown }).feed);
      const result = await executeTool(definition, { ...feedTool, transformRequest, transformResponse }, { q: "abc" });

      expect(transformRequest).toHaveBeenCalledWith(
        { url: "https://api.example.test/feed?q=abc", method: "GET", body: undefined, headers: undefined },
        { q: "abc" },
        expect.objectContaining({ service: definition, fetchUpstream: expect.any(Function) }),
      );
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://api.example.test/feed?q=abc&sig=3");
      expect(init.headers["X-Signed"]).toBe("yes");
      expect(result).toEqual({
        data: [{ id: 1 }],
        meta: { source: "https://api.example.test/feed?q=abc&sig=3", total: 2, returned: 1, truncated: true },
      });
    });

    it("caches the raw body by the transformed request and transforms every call", async () => {
      fetchMock.mockImplementation(async () => new Response(JSON.stringify({ feed: { entries: [{ id: 1 }] } })));
      const transformResponse = vi.fn((body: unknown) => (body as { feed: unknown }).feed);
      const tool = { ...feedTool, transformResponse };
      await executeTool(definition, tool, { q: "a" });
      await executeTool(definition, tool, { q: "a" });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(transformResponse).toHaveBeenCalledTimes(2);
    });

    it("refuses a transformed request that is not http(s)", async () => {
      const tool = { ...feedTool, transformRequest: (request: { url: string; method: "GET" | "POST" }) => ({ ...request, url: "file:///etc/passwd" }) };
      await expect(executeTool(definition, tool, { q: "a" })).rejects.toThrow(/http\(s\) URL/);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it("runs custom handlers with a fetch helper", async () => {
    fetchMock.mockImplementation(async () => new Response("﻿" + JSON.stringify({ vcalendar: [{ vevent: [{ dtstart: ["20261001"], summary: "National Day" }, { dtstart: ["20260101"], summary: "New Year" }] }] })));
    const custom: ToolDefinition = {
      ...tool,
      spec: spec({ name: "example_custom", description: "d", handler: "x" }),
      inputSchema: z.object({}),
      handler: async (_input, context) => flattenHolidays((await context.fetchUpstream("https://cal.test/en.json")) as never),
    };
    expect((await executeTool(definition, custom, {})).data).toEqual([
      { date: "2026-01-01", name: "New Year" },
      { date: "2026-10-01", name: "National Day" },
    ]);
  });
});
