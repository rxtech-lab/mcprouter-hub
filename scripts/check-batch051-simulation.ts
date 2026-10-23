/** Generated tools and shared HTTP client run over real Postman loopback HTTP. */
import assert from "node:assert/strict";
import { services } from "../generated/registry";
import { executeTool } from "../lib/mcp/runtime";
import { setCacheForTesting } from "../lib/mcp/cache";

const base = process.env.BATCH051_SIM_URL ?? "http://127.0.0.1:4911/upstream";
assert.match(base, /^http:\/\/(127\.0\.0\.1|localhost):\d+\/upstream$/);
const names = ["hktr_interest_rate_positions", "hktr_members_lei", "ird_offices", "hk_address_lookup", "lcsd_swimming_pools", "hk_government_press_releases", "regional_office_counts", "regional_office_employment", "regional_offices_parent_location"];
const realFetch = globalThis.fetch;
let failure = "";
let requests = 0;
// Transport-only host rewrite also covers handlers with fixed official endpoints.
// Every response still goes through fetchUpstream, parsing and the generated transformer.
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(String(input));
  const headers = new Headers(init?.headers);
  if (failure) headers.set("x-fixture-failure", failure);
  requests++;
  return realFetch(`${base}/${url.host}${url.pathname}${url.search}`, { ...init, headers });
}) as typeof fetch;
setCacheForTesting({ get: async () => null, set: async () => {}, delete: async () => {}, expireTag: async () => {} });
let successes = 0;
let errors = 0;
try {
  for (const name of names) {
    const service = services.find((s) => s.tools.some((t) => t.name === name))!;
    const tool = service.tools.find((t) => t.name === name)!;
    const input = { ...(name === "hk_address_lookup" ? { q: "central government offices" } : {}), limit: 3 };
    for (const lang of tool.spec.input.lang?.enum ?? ["en"]) {
      failure = "";
      const { data } = await executeTool(service, tool, { ...input, ...(tool.spec.input.lang ? { lang } : {}) });
      const result = data as { returned: number; results: unknown[] };
      assert.equal(result.returned, name === "hk_address_lookup" ? 1 : 3);
      assert.equal(result.results.length, result.returned);
      successes++;
    }
    for (const kind of ["http", "parse", "provider", "malformed"]) {
      failure = kind;
      const code = kind === "http" || (kind === "provider" && ["ird_offices", "lcsd_swimming_pools"].includes(name)) ? "upstream_http" : "upstream_parse";
      await assert.rejects(executeTool(service, tool, input), { code });
      errors++;
    }
    const before = requests;
    await assert.rejects(executeTool(service, tool, { ...input, limit: 101 }));
    assert.equal(requests, before);
  }
  console.log(JSON.stringify({ successes, expectedErrors: errors, requests, invalidInputs: names.length }));
} finally { globalThis.fetch = realFetch;setCacheForTesting(null); }
