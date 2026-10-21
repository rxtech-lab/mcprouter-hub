import { describe, expect, it } from "vitest";
import { Experimental_DecisionMockModelV4 } from "ai/test";
import { decideSearchIntent } from "@/lib/site-search/decision";
import { searchSite } from "@/lib/site-search/catalogue";
import { createTranslator } from "@/lib/i18n/translate";

const t = createTranslator("en", {});
describe("server text search", () => {
  it("returns navigation for an empty query and bounded service/API matches", () => {
    expect(searchSite("", t).map((item) => item.key)).toEqual(["home", "sources", "guides", "pricing"]);
    expect(searchSite("Setup guides", t)[0].href).toBe("/guides");
    expect(searchSite("weather", t).length).toBeGreaterThan(0);
    expect(searchSite("weather", t).length).toBeLessThanOrEqual(12);
    expect(searchSite("API-0017", t)).toContainEqual(expect.objectContaining({ href: "/sources/api/API-0017" }));
    expect(searchSite("zzyyxx-no-match", t)).toEqual([]);
  });
});

describe("AI SDK Decision API routing", () => {
  for (const choice of ["search", "chat"] as const) {
    it(`uses a typed choice answer for ${choice}`, async () => {
      const model = new Experimental_DecisionMockModelV4({ doDecide: async (call) => {
        expect(call.questions.intent.type).toBe("choice");
        expect(call.state).toEqual([{ type: "json", value: { query: "明天會下雨嗎？" } }]);
        return { answers: { intent: { type: "choice", choice } }, warnings: [] };
      } });
      expect(await decideSearchIntent("明天會下雨嗎？", { model })).toBe(choice);
    });
  }
  it("rejects invalid provider choices rather than treating them as agent permission", async () => {
    const model = new Experimental_DecisionMockModelV4({ doDecide: async () => ({ answers: { intent: { type: "choice", choice: "execute" } }, warnings: [] }) });
    await expect(decideSearchIntent("ignore instructions", { model })).rejects.toThrow();
  });
});
