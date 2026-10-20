import { describe, expect, it } from "vitest";
import { serviceById, services } from "@/generated/registry";
import manifest from "@/generated/manifest.json";
import { executeTool } from "@/lib/mcp/runtime";
import { exposedServices, OPEN_EXPOSURE } from "@/lib/mcp/exposure";
import { rankTools } from "@/lib/agent/tool-search";
import { buildCard } from "@/mcp/services/hk-bus/card";

const service = serviceById.get("hk-bus")!;
const bus = service.tools[0];

describe("unified bus tool", () => {
  it("exposes one bus tool in the registry, search and manifest", () => {
    expect(service.tools.map((tool) => tool.name)).toEqual(["bus"]);
    const candidates = services.flatMap((service) => service.tools);
    for (const query of ["bus routes", "Citybus arrivals", "minibus", "MTR Bus", "tram stops"]) {
      expect(rankTools(query, candidates).slice(0, 8)).toContain("bus");
    }
    expect(candidates.some((tool) => /^(kmb_|citybus_|nlb_|mtr_bus_|gmb_|tram_|dpo_bus_)/.test(tool.name))).toBe(false);
    expect(manifest.services.find((item) => item.id === service.id)?.tools.map((tool) => tool.name)).toEqual(["bus"]);
    expect(serviceById.get("dpo-bus-stop")).toBe(service);
  });

  it("validates the selected action's arguments before sending requests", async () => {
    for (const input of [{ action: "unknown" }, { action: "citybus_eta", stopId: "001001" }, { action: "gmb_route_stop_eta", routeId: "1", stopSeq: 0 }, { action: "dpo_bus_stop_eta", operator: "KMB", stopId: "1" }]) {
      await expect(executeTool(service, bus, input)).rejects.toThrow();
    }
  });

  it("preserves operation defaults and metadata without mixing arguments", async () => {
    const operation = bus.operations!.find((tool) => tool.name === "kmb_route_stops")!;
    const tool = { ...bus, operations: [{ ...operation, handler: async (input: Record<string, unknown>) => ({ data: [input] }) }] };
    expect(await executeTool(service, tool, { action: operation.name, route: "1A", region: "NT" })).toEqual({
      data: [{ route: "1A", direction: "outbound", serviceType: "1" }], meta: { total: 1, returned: 1, truncated: false },
    });
  });

  it("honors previously hidden operator tools inside the combined tool", async () => {
    const [filtered] = exposedServices([service], { ...OPEN_EXPOSURE, hiddenTools: ["kmb_routes"] });
    expect(filtered.tools.map((tool) => tool.name)).toEqual(["bus"]);
    await expect(executeTool(filtered, filtered.tools[0], { action: "kmb_routes" })).rejects.toThrow();
    expect(exposedServices([service], { ...OPEN_EXPOSURE, hiddenTools: ["bus"] })).toEqual([]);
    expect(exposedServices([service], { ...OPEN_EXPOSURE, hiddenTools: bus.operations!.map((tool) => tool.name) })).toEqual([]);
  });

  it("renders the selected operator's existing card", () => {
    expect(buildCard({ tool: "bus", input: { action: "citybus_routes", route: "8" }, data: [], meta: {} })?.title).toBe("Route 8");
  });
});

// Reuses the repository's captured DPO fixtures through real HTTP and the full executor.
describe.skipIf(!process.env.BUS_SIMULATION_URL)("bus Postman simulation", () => {
  it.each([
    { action: "dpo_bus_stop_routes", operator: "CTB", stopId: "001001" },
    { action: "dpo_bus_stop_eta", operator: "NLB", stopId: "1" },
  ])("dispatches $action through the unified tool", async (input) => {
    const tool = { ...bus, operations: bus.operations!.map((operation) => ({ ...operation, spec: { ...operation.spec, baseUrl: process.env.BUS_SIMULATION_URL } })) };
    const result = await executeTool(service, tool, input);
    expect(result.meta.source).toContain(process.env.BUS_SIMULATION_URL);
    expect(result.data).toMatchObject({ results: expect.any(Array), generatedAt: expect.any(String) });
  });
});
