import { describe, expect, it } from "vitest";
import { services } from "@/generated/registry";
import { exposedServices, isOpenExposure, OPEN_EXPOSURE, serviceExposure } from "@/lib/mcp/exposure";

const bus = services.find((service) => service.aliases.includes("kmb"))!;

describe("exposedServices", () => {
  it("exposes the whole catalogue without settings", () => {
    expect(isOpenExposure(OPEN_EXPOSURE)).toBe(true);
    expect(exposedServices(services, OPEN_EXPOSURE)).toEqual([...services]);
  });

  it("keeps only picked services, also when saved under a merged service's old id", () => {
    const exposed = exposedServices(services, { ...OPEN_EXPOSURE, services: ["kmb"] });
    expect(exposed.map((service) => service.id)).toEqual([bus.id]);
  });

  it("filters by region", () => {
    expect(exposedServices(services, { ...OPEN_EXPOSURE, regions: ["hk"] })).toHaveLength(services.length);
    expect(exposedServices(services, { ...OPEN_EXPOSURE, regions: ["elsewhere"] })).toEqual([]);
    expect(serviceExposure(bus, { ...OPEN_EXPOSURE, regions: ["elsewhere"] })).toBe("region");
  });

  it("drops hidden tools, and a service whose tools are all hidden", () => {
    const bus = services.find((service) => service.id === "hko-weather")!;
    const [first, ...rest] = bus.tools.map((tool) => tool.name);
    const someHidden = exposedServices([bus], { ...OPEN_EXPOSURE, hiddenTools: [first] });
    expect(someHidden[0].tools.map((tool) => tool.name)).toEqual(rest);
    // The registry's own definition is left untouched.
    expect(bus.tools.map((tool) => tool.name)).toContain(first);
    const allHidden = { ...OPEN_EXPOSURE, hiddenTools: [first, ...rest] };
    expect(exposedServices([bus], allHidden)).toEqual([]);
    expect(serviceExposure(bus, allHidden)).toBe("tools");
  });
});
