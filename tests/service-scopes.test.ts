import { describe, expect, it } from "vitest";
import { keyAllowsService } from "@/lib/api-keys";
import type { Translator } from "@/lib/i18n/translate";
import { serviceScopesSchema, serviceSelection } from "@/lib/service-scopes";
import { NO_SERVICES, selectionToScopes } from "@/lib/service-selection";

const t = ((message: string) => message) as Translator;
const schema = serviceScopesSchema(t);

describe("service scopes", () => {
  it("keeps all, some and none apart", () => {
    expect(schema.parse([])).toEqual([]);
    expect(schema.parse([NO_SERVICES])).toEqual([NO_SERVICES]);
    // Aliases are saved as the service they became; picking a service drops "none".
    expect(schema.parse(["kmb", NO_SERVICES])).toEqual(["hk-bus"]);
    expect(schema.safeParse(["nope"]).success).toBe(false);
  });

  it("round-trips through a picker selection", () => {
    expect(serviceSelection([])).toBe("all");
    expect(serviceSelection([NO_SERVICES])).toEqual([]);
    expect(selectionToScopes("all")).toEqual([]);
    expect(selectionToScopes([])).toEqual([NO_SERVICES]);
    expect(selectionToScopes(serviceSelection(["hk-bus"]))).toEqual(["hk-bus"]);
  });

  it("allows nothing when no services are allowed", () => {
    expect(keyAllowsService([], "hk-bus")).toBe(true);
    expect(keyAllowsService([NO_SERVICES], "hk-bus")).toBe(false);
  });
});
