import { describe, expect, it } from "vitest";
import { categoryFor, describe as describeDataset, importApis } from "@/mcp/apis-import";
import { resolveApis } from "@/mcp/apis";

const yaml = `apis:\n  - { id: API-0002, title: T, description: D, provider: P, category: transport, datasets: [listed] }\n`;

describe("importing DATA.GOV.HK datasets", () => {
  it("appends unlisted datasets with the next ids, ordered by provider", () => {
    const { text, added } = importApis(yaml, [
      { name: "listed", title: "Already there" },
      { name: "b-api", title: "Live | feed", notes: "<p>Real-time\n data.</p>", organization: { title: "Zeta" }, groups: [{ name: "climate-and-weather" }], resources: [{ is_api: "Y" }] },
      { name: "a-csv", title: "Yearly figures", organization: { title: "Alpha" }, groups: [{ name: "unknown" }], resources: [{ is_api: "N" }] },
    ]);
    expect(added).toEqual(["API-0003", "API-0004"]);

    const { tracker, problems } = resolveApis(yaml + text, []);
    expect(problems).toEqual([]);
    expect(tracker!.apis.slice(1).map(({ id, title, description, provider, category, datasets, kind }) => ({ id, title, description, provider, category, datasets, kind }))).toEqual([
      { id: "API-0003", title: "Yearly figures", description: "Yearly figures", provider: "Alpha", category: "other", datasets: ["a-csv"], kind: "files" },
      { id: "API-0004", title: "Live | feed", description: "Real-time data.", provider: "Zeta", category: "weather", datasets: ["b-api"], kind: "api" },
    ]);
    expect(importApis(yaml + text, [{ name: "a-csv", title: "x" }]).added).toEqual([]);
  });

  it("maps groups to categories and shortens long notes", () => {
    expect(categoryFor([{ name: "miscellaneous" }, { name: "housing" }])).toBe("other");
    expect(categoryFor([{ name: "law-and-security" }])).toBe("security");
    const long = describeDataset({ name: "x", title: "x", notes: `${"word ".repeat(30)}ends here. ${"more ".repeat(60)}` });
    expect(long.endsWith("ends here.")).toBe(true);
    expect(describeDataset({ name: "x", title: "x", notes: "a".repeat(10) + " b".repeat(200) }).length).toBeLessThanOrEqual(281);
  });
});
