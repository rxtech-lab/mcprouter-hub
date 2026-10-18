import { describe, expect, it, vi } from "vitest";
import { serviceById } from "@/generated/registry";
import { callOwnTool, ownToolApp, splitToolName } from "@/lib/agent/mcp-apps";
import { appHtml, appResourceUri, appStructuredContent, readAppResource, serviceIdFromAppUri, toolAppMeta } from "@/lib/mcp/apps";
import { meterToolCall } from "@/lib/mcp/meter";
import type { ServiceDefinition } from "@/lib/mcp/types";
import { GET as sandboxPage } from "@/app/mcp-app-sandbox/route";

const mtr = serviceById.get("mtr")!;
const weather = serviceById.get("hko-weather")!;
const quiet = { log: async () => {}, defer: () => {}, billingEnabled: false } as const;

describe("MCP App resources", () => {
  it("round-trips service ids through ui:// URIs", () => {
    expect(appResourceUri("mtr")).toBe("ui://mcprouter/mtr");
    expect(serviceIdFromAppUri("ui://mcprouter/mtr")).toBe("mtr");
    expect(serviceIdFromAppUri("ui://elsewhere/mtr")).toBeNull();
  });

  it("serves self-contained HTML with the app's CSP", () => {
    const { contents } = readAppResource(weather);
    expect(contents[0]).toMatchObject({ uri: "ui://mcprouter/hko-weather", mimeType: "text/html;profile=mcp-app" });
    expect(contents[0]._meta.ui.csp.resourceDomains).toEqual(["https://www.hko.gov.hk"]);
    expect(contents[0].text).toMatch(/<style>[\s\S]+<\/style>[\s\S]+<script>[\s\S]+<\/script>/);
  });

  it("can't be broken out of by a script that mentions </script>", () => {
    const service = { ...mtr, app: { ...mtr.app!, script: 'console.log("</script><img src=x>")' } } as ServiceDefinition;
    expect(appHtml(service)).not.toContain("</script><img");
  });

  it("links tools to their app for current and draft hosts", () => {
    expect(toolAppMeta(mtr)).toEqual({ ui: { resourceUri: "ui://mcprouter/mtr", visibility: ["model", "app"] }, "ui/resourceUri": "ui://mcprouter/mtr" });
  });

  it("tells the app which tool produced a result", () => {
    const structured = appStructuredContent(mtr, mtr.tools[0], { line: "TML" });
    expect(structured({ data: [1], meta: { total: 1 } })).toEqual({ service: "mtr", tool: mtr.tools[0].name, input: { line: "TML" }, data: [1], meta: { total: 1 } });
  });
});

describe("meterToolCall structured content", () => {
  it("adds structuredContent for apps but keeps the model's text unchanged", async () => {
    const result = await meterToolCall(
      { userId: "u", apiKeyId: null, scopes: [] },
      { service: "mtr", tool: "mtr_next_train", structured: (value) => ({ tool: "mtr_next_train", ...(value as object) }) },
      async () => ({ data: { eta: 3 } }),
      quiet,
    );
    expect(result.content).toEqual([{ type: "text", text: '{"data":{"eta":3}}' }]);
    expect(result.structuredContent).toEqual({ tool: "mtr_next_train", data: { eta: 3 } });
  });
});

describe("chat host", () => {
  it("tells this app's tools from other servers' prefixed tools", () => {
    expect(splitToolName("mtr_next_train")).toEqual({ server: null, tool: "mtr_next_train" });
    expect(splitToolName("github__search_repos")).toEqual({ server: "github", tool: "search_repos" });
  });

  it("loads an own app only for a tool of that service", () => {
    const app = ownToolApp("ui://mcprouter/mtr", "mtr_next_train");
    expect(app.resource.html).toContain("<!doctype html>");
    expect(app.resource.meta?.csp).toEqual({ resourceDomains: [], connectDomains: [] });
    expect(app.appTools).toEqual(mtr.tools.map((tool) => tool.name));
    expect(() => ownToolApp("ui://mcprouter/mtr", "hko_current_weather")).toThrow("NOT_FOUND");
    expect(() => ownToolApp("ui://mcprouter/nope", "mtr_next_train")).toThrow("NOT_FOUND");
  });

  it("refuses app tool calls outside the service that opened the app", async () => {
    const caller = { userId: "u", apiKeyId: null, scopes: [] };
    await expect(callOwnTool(caller, "mtr_next_train", "hko_current_weather", {})).rejects.toThrow("FORBIDDEN");
  });

  it("runs an app's own tool call through the meter", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ status: 1, data: {} }));
    try {
      const result = await callOwnTool({ userId: "u", apiKeyId: null, scopes: [], guest: true }, "mtr_next_train", "mtr_next_train", { line: "TML", sta: "TUM" });
      expect(result.isError).toBeUndefined();
      expect(result.structuredContent).toMatchObject({ service: "mtr", tool: "mtr_next_train", input: { line: "TML", sta: "TUM" } });
    } finally {
      fetch.mockRestore();
    }
  });
});

describe("sandbox proxy page", () => {
  it("only takes HTML from this site and never grants allow-same-origin", async () => {
    const response = sandboxPage(new Request("https://mcprouter.example/mcp-app-sandbox"));
    const html = await response.text();
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(html).toContain('"hosts":["https://mcprouter.example"');
    const allowed = JSON.parse(html.match(/"allowedSandbox":(\[[^\]]*\])/)![1]) as string[];
    expect(allowed).toContain("allow-scripts");
    expect(allowed).not.toContain("allow-same-origin");
  });
});
