import { describe, expect, it } from "vitest";
import { datasetFromPackage } from "@/lib/catalog/ckan";
import { filterRows, humanise, resolveRows, summarise, type TrackerDataset } from "@/lib/tracker";

const dataset = (id: string, overrides: Partial<TrackerDataset> = {}): TrackerDataset => ({
  id,
  titleEn: id,
  titleTc: null,
  organization: "hk-hko",
  organizationTitle: "Hong Kong Observatory",
  groups: ["climate-and-weather"],
  formats: ["JSON"],
  isApi: false,
  syncedAt: null,
  ...overrides,
});

describe("tracker", () => {
  const rows = resolveRows(
    [dataset("a", { isApi: true }), dataset("b"), dataset("c", { organization: "hk-td", organizationTitle: "Transport Department", groups: ["transport"], formats: ["CSV"] }), dataset("d")],
    new Map([
      ["b", { status: "planned", reason: null, priority: 2 }],
      ["a", { status: "skipped", reason: "ignored because converted", priority: 0 }],
      ["d", { status: "skipped", reason: "PDF only", priority: 0 }],
    ]),
    { a: ["hko-weather"] },
  );

  it("treats manifest datasets as converted regardless of manual status", () => {
    expect(rows.map((row) => row.status)).toEqual(["converted", "planned", "not_started", "skipped"]);
    expect(rows[0].services).toEqual(["hko-weather"]);
  });

  it("summarises overall, API-only, per category and per provider", () => {
    const summary = summarise(rows);
    expect(summary.overall).toMatchObject({ total: 4, converted: 1, counts: { converted: 1, planned: 1, not_started: 1, skipped: 1, in_progress: 0 } });
    expect(summary.apiOnly).toMatchObject({ total: 1, converted: 1 });
    expect(summary.byCategory.map((group) => [group.key, group.total])).toEqual([["climate-and-weather", 3], ["transport", 1]]);
    expect(summary.byProvider[0]).toMatchObject({ key: "hk-hko", label: "Hong Kong Observatory", total: 3 });
  });

  it("filters and sorts by priority, then API availability", () => {
    expect(filterRows(rows, {}).map((row) => row.id)).toEqual(["b", "a", "c", "d"]);
    expect(filterRows(rows, { apiOnly: true }).map((row) => row.id)).toEqual(["a"]);
    expect(filterRows(rows, { format: "CSV" }).map((row) => row.id)).toEqual(["c"]);
    expect(filterRows(rows, { status: "skipped" }).map((row) => row.id)).toEqual(["d"]);
    expect(filterRows(rows, { category: "transport", provider: "hk-td" }).map((row) => row.id)).toEqual(["c"]);
  });

  it("maps CKAN packages to dataset rows", () => {
    expect(
      datasetFromPackage(
        {
          name: "hk-x",
          title: "X",
          metadata_modified: "2026-01-01T00:00:00",
          organization: { name: "hk-x-org", title: "X Org" },
          groups: [{ name: "transport" }, { name: "climate-and-weather" }],
          resources: [{ format: "json", is_api: "N" }, { format: "CSV", is_api: "Y" }, { format: "JSON" }],
        },
        "甲",
      ),
    ).toEqual({
      id: "hk-x",
      titleEn: "X",
      titleTc: "甲",
      organization: "hk-x-org",
      organizationTitle: "X Org",
      groups: ["climate-and-weather", "transport"],
      formats: ["CSV", "JSON"],
      isApi: true,
      url: "https://data.gov.hk/en-data/dataset/hk-x",
      metadataModified: "2026-01-01T00:00:00",
    });
    expect(humanise("climate-and-weather")).toBe("Climate and weather");
  });
});
