import { describe, expect, it } from "vitest";
import { chosenVisuals, definitionHasApp, SHOW_TOOL_UI_TOOL_NAME, SHOW_UI_TOOL_NAME, showUiTools } from "@/lib/agent/display-tools";
import { checkUiSpec, describeComponents, type UiSpec } from "@/lib/agent/ui-catalog";

const context = { toolCallId: "1", messages: [] } as never;
const tools = showUiTools(new Set(["kmb_stop_eta", "weather__forecast"]));
const showToolUi = (names: string[]) => tools[SHOW_TOOL_UI_TOOL_NAME].execute!({ tools: names }, context);
const showUi = (spec: UiSpec) => tools[SHOW_UI_TOOL_NAME].execute!({ spec }, context);

const weather: UiSpec = {
  root: "card",
  elements: {
    card: { type: "Card", props: { title: "Hong Kong now" }, children: ["grid", "warnings"] },
    grid: { type: "Grid", props: { columns: 2 }, children: ["temp", "humidity"] },
    temp: { type: "Metric", props: { label: "Temperature", value: "28", unit: "°C" } },
    humidity: { type: "Metric", props: { label: "Humidity", value: "71", unit: "%" } },
    warnings: { type: "Alert", props: { title: "No warnings in force", tone: "success" } },
  },
};

describe("show_tool_ui", () => {
  it("shows tools that have an app, once each", async () => {
    expect(await showToolUi(["kmb_stop_eta", "weather__forecast", "kmb_stop_eta"])).toEqual({ shown: ["kmb_stop_eta", "weather__forecast"] });
  });

  it("tells the agent which tools have no app", async () => {
    expect(await showToolUi(["kmb_stop_eta", "hk_is_public_holiday"])).toMatchObject({ shown: ["kmb_stop_eta"], withoutApp: ["hk_is_public_holiday"] });
  });
});

describe("show_ui", () => {
  it("accepts a valid spec", async () => {
    expect(await showUi(weather)).toEqual({ shown: true });
    expect(checkUiSpec(weather)).toEqual([]);
  });

  it("reports wrong props and missing children so the agent can fix them", async () => {
    const broken: UiSpec = {
      root: "card",
      elements: { card: { type: "Card", props: {}, children: ["temp", "ghost"] }, temp: { type: "Metric", props: { label: "Temperature" } } },
    };
    const result = (await showUi(broken)) as { shown: boolean; problems: string[] };
    expect(result.shown).toBe(false);
    expect(result.problems.some((problem) => problem.startsWith("temp (Metric): value"))).toBe(true);
    expect(result.problems.some((problem) => problem.includes("ghost"))).toBe(true);
  });

  it("rejects an element that contains itself", () => {
    expect(checkUiSpec({ root: "a", elements: { a: { type: "Stack", props: {}, children: ["b"] }, b: { type: "Card", props: {}, children: ["a"] } } })).toHaveLength(1);
  });

  it("only allows web links", () => {
    expect(checkUiSpec({ root: "a", elements: { a: { type: "Link", props: { label: "x", href: "javascript:alert(1)" } } } })).toHaveLength(1);
  });

  it("lists every component with its props for the tool description", () => {
    expect(describeComponents()).toContain("Metric {label, value, unit?, caption?}");
  });
});

describe("chosenVisuals", () => {
  it("picks the latest result of each shown tool and the shown UIs, in order", () => {
    const visuals = chosenVisuals([
      { toolName: "kmb_stop_eta", input: {}, output: "old" },
      { toolName: "hko_current_weather", input: {}, output: "weather" },
      { toolName: "kmb_stop_eta", input: {}, output: "new" },
      { toolName: SHOW_UI_TOOL_NAME, input: { spec: weather }, output: { shown: false, problems: ["x"] } },
      { toolName: SHOW_UI_TOOL_NAME, input: { spec: weather }, output: { shown: true } },
      { toolName: SHOW_TOOL_UI_TOOL_NAME, input: {}, output: { shown: ["kmb_stop_eta", "never_called"] } },
    ]);
    expect(visuals).toEqual([
      { type: "ui", spec: weather },
      { type: "tool", toolName: "kmb_stop_eta", output: "new" },
    ]);
  });
});

describe("definitionHasApp", () => {
  it("reads the app resource from _meta.ui or the older ui/resourceUri key", () => {
    expect(definitionHasApp({ _meta: { ui: { resourceUri: "ui://kmb/app.html" } } })).toBe(true);
    expect(definitionHasApp({ _meta: { "ui/resourceUri": "ui://kmb/app.html" } })).toBe(true);
    expect(definitionHasApp({ _meta: { ui: { visibility: ["model"] } } })).toBe(false);
    expect(definitionHasApp({})).toBe(false);
  });
});
