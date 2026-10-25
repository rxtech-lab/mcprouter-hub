/** bun --conditions=react-server scripts/check-batch088.ts live|simulation */
import assert from "node:assert/strict";
import { services } from "../generated/registry";
import { executeTool } from "../lib/mcp/runtime";
import { setCacheForTesting } from "../lib/mcp/cache";
import type { ToolInput, ToolDefinition } from "../lib/mcp/types";

const mode = process.argv[2]; assert.ok(mode === "live" || mode === "simulation");
const service = services.find((s) => s.id === "pland-development")!;
setCacheForTesting({ get: async () => null, set: async () => {}, delete: async () => {}, expireTag: async () => {} });
let checks = 0, failures = 0;
for (const original of service.tools) {
  const tool: ToolDefinition = mode === "simulation" ? { ...original, spec: { ...original.spec, baseUrl: "http://127.0.0.1:4988/development" } } : original;
  const inputs: ToolInput[] = original.name === "pland_land_use_cell" ? Array.from({ length: 8 }, (_, n) => ({ longitude: 114.17, latitude: 22.3, year: 2018 + n })) :
    original.spec.input.lang?.enum?.map((lang) => ({ lang, limit: 1 })) ?? [{ limit: 1 }];
  try {
    for (const input of inputs) {
      const result = await executeTool(service, tool, input);
      const data = result.data as { returned: number; results: unknown[]; source?: string };
      assert.equal(data.returned, 1); assert.equal(data.results.length, 1);
      assert.ok(Buffer.byteLength(JSON.stringify(data)) < 103000);
      console.log(JSON.stringify({ mode, tool: tool.name, input, status: "PASS", source: data.source ?? result.meta.source })); checks++;
    }
    if (mode === "simulation") {
      for (const failure of ["http", "json", "malformed", "timeout"]) {
        const failing = { ...tool, spec: { ...tool.spec, headers: { "x-fixture-failure": failure }, ...(failure === "timeout" ? { timeoutMs: 50 } : {}) } };
        const code = failure === "http" ? "upstream_http" : failure === "timeout" ? "upstream_timeout" : "upstream_parse";
        await assert.rejects(executeTool(service, failing, inputs[0]), { code }); checks++;
      }
      const offline = { ...tool, spec: { ...tool.spec, baseUrl: "http://127.0.0.1:1/development" } };
      await assert.rejects(executeTool(service, offline, inputs[0]), { code: "upstream_network" }); checks++;
      {
        const empty: ToolDefinition = { ...tool, spec: { ...tool.spec, headers: { "x-fixture-failure": "empty" } } };
        assert.deepEqual(((await executeTool(service, empty, inputs[0])).data as { results: unknown[] }).results, []); checks++;
      }
    }
  } catch (error) { failures++; console.error(JSON.stringify({ mode, tool: original.name, status: "FAIL", error: String(error) })); }
}
setCacheForTesting(null);
console.log(JSON.stringify({ mode, checks, failures })); if (failures) process.exitCode = 1;
