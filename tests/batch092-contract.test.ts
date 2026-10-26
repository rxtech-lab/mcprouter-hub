import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import { services } from "@/generated/registry";
import { setCacheForTesting } from "@/lib/mcp/cache";
import { batch092, call092, fixture092 } from "./batch092-cases";

afterEach(() => { vi.unstubAllGlobals(); setCacheForTesting(null); });
it("retains exactly nine verified IDs and leaves failed API-0298 unregistered", () => {
  expect(batch092.map((c) => c.api)).toEqual(["API-0224", "API-0225", "API-0226", "API-0227", "API-0228", "API-0230", "API-0231", "API-0232", "API-0233"]);
  expect(services.filter((s) => s.apis.includes("API-0298"))).toEqual([]);
});
it.each(batch092)("derives complete field contracts from hash-verified official schemas: $api", (c) => {
  const bytes = readFileSync(new URL(`./fixtures/batch092/${c.file}-schema.json`, import.meta.url));
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(c.schemaSha256);
  const schema = JSON.parse(bytes.toString());
  const contract = JSON.parse(readFileSync(new URL(`../mcp/services/${c.service}/contracts/${c.api.slice(4)}.json`, import.meta.url), "utf8"));
  expect(contract.fields).toEqual(Object.fromEntries(schema.fields.map((f: { name: string; type: string }) => [f.name, f.type])));
  expect(contract.geometry).toBe(schema.geometryType);
  expect(contract.oid).toBe(schema.objectIdField);
  expect(schema.advancedQueryCapabilities.supportsPagination).toBe(true);
  expect(schema.advancedQueryCapabilities.supportsOrderBy).toBe(true);
  expect(c.url).toContain(`/FeatureServer/${c.layerId}/query?`);
  expect(new URL(c.url).searchParams.get("returnGeometry")).toBe("true");
  expect(c.resources.some((r) => r.format === "API")).toBe(true);
});
it.each(batch092)("validates every official field before emitting a record: $api", async (c) => {
  const contract = JSON.parse(readFileSync(new URL(`../mcp/services/${c.service}/contracts/${c.api.slice(4)}.json`, import.meta.url), "utf8"));
  setCacheForTesting({ get: async () => null, set: async () => {}, delete: async () => {}, expireTag: async () => {} });
  const mock = vi.fn<typeof fetch>(); vi.stubGlobal("fetch", mock);
  for (const [field, type] of Object.entries(contract.fields)) {
    const body = fixture092(c); body.features[0].attributes[field] = type === "esriFieldTypeString" ? 17 : "not-a-number";
    mock.mockResolvedValueOnce(Response.json(body));
    await expect(call092(c)).rejects.toMatchObject({ code: "upstream_parse" });
  }
  expect(mock).toHaveBeenCalledTimes(Object.keys(contract.fields).length);
});
it.each(batch092)("preserves source periods, nulls and suppression values: $api", async (c) => {
  const body = fixture092(c);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(body)));
  setCacheForTesting({ get: async () => null, set: async () => {}, delete: async () => {}, expireTag: async () => {} });
  const data = (await call092(c)).data as { results: Record<string, unknown>[] };
  for (let index = 0; index < body.features.length; index++) {
    for (const [field, value] of Object.entries(body.features[index].attributes)) expect(data.results[index][field]).toEqual(value);
  }
});
