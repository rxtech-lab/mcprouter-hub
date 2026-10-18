import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { cardForToolResult, cardInput, cardsForToolResults, MAX_CARDS_PER_REPLY } from "@/lib/cards";
import { cardTree, renderCardPng, renderCardSvg } from "@/lib/cards/render";
import type { Card } from "@/mcp/apps/card";

/** A tool result as `meterToolCall` returns it for a tool with an MCP App. */
const result = (service: string, tool: string, input: object, data: unknown, meta: object = {}) => ({
  content: [{ type: "text", text: JSON.stringify({ data, meta }) }],
  structuredContent: { service, tool, input, data, meta },
});

const soon = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

describe("cardInput", () => {
  it("reads the app's structured content", () => {
    expect(cardInput(result("mtr", "mtr_next_train", { line: "TKL" }, { a: 1 }, { truncated: false }))).toEqual({
      service: "mtr",
      tool: "mtr_next_train",
      input: { line: "TKL" },
      data: { a: 1 },
      meta: { truncated: false },
    });
  });

  it("ignores errors, plain results and other servers' tools", () => {
    expect(cardInput({ ...result("mtr", "mtr_next_train", {}, {}), isError: true })).toBeNull();
    expect(cardInput({ content: [{ type: "text", text: "{}" }] })).toBeNull();
    expect(cardInput({ structuredContent: { temperature: 20 } })).toBeNull();
    expect(cardInput(null)).toBeNull();
    expect(cardInput("text")).toBeNull();
  });
});

describe("card builders", () => {
  it("draws an MTR board in the line's colour, nearest train first", () => {
    const card = cardForToolResult(
      result("mtr", "mtr_next_train", { line: "TKL", sta: "TKO" }, { status: 1, curr_time: "2026-10-18 13:38:12", data: { "TKL-TKO": { UP: [{ plat: "1", dest: "POA", time: "2026-10-18 13:40:00", ttnt: "2" }] } } }),
    )!;
    expect(card).toMatchObject({ accent: "#7d499d", badge: "TKL", title: "Tseung Kwan O", subtitle: "Tseung Kwan O Line", footer: "Updated 13:38" });
    expect(card.blocks).toEqual([
      { kind: "section", title: "To Po Lam" },
      { kind: "row", leading: { text: "Platform 1" }, title: "Po Lam", subtitle: "13:40", trailing: [{ text: "2 min", tone: "accent" }] },
    ]);
  });

  it("groups bus arrivals by route and reads the asked-for language", () => {
    const rows = [
      { route: "1A", dir: "O", seq: 5, dest_en: "STAR FERRY", dest_tc: "尖沙咀碼頭", eta: soon(3) },
      { route: "1A", dir: "O", seq: 5, dest_en: "STAR FERRY", dest_tc: "尖沙咀碼頭", eta: soon(14) },
      { route: "N216", dir: "O", seq: 5, dest_en: "YAU TONG", dest_tc: "油塘", eta: null, rmk_tc: "最後班次已開出" },
    ];
    const card = cardForToolResult(result("hk-bus", "kmb_stop_eta", { stopId: "AB12", lang: "tc" }, rows))!;
    expect(card).toMatchObject({ badge: "KMB", accent: "#e1251b", subtitle: "AB12" });
    expect(card.blocks.map((block) => block.kind === "row" && [block.title, block.trailing?.map((chip) => chip.text)])).toEqual([
      ["To 尖沙咀碼頭", ["3 min", "14 min"]],
      ["To 油塘", ["最後班次已開出"]],
    ]);
  });

  it("ranks A&E waits and colours them by length", () => {
    const card = cardForToolResult(
      result("ha-aed", "ha_aed_waiting_times", {}, { waitTime: [{ hospName: "QEH", t45p50: "3.5 hours" }, { hospName: "TKOH", t45p50: "45 minutes" }] }),
    )!;
    expect(card.blocks.map((block) => block.kind === "row" && [block.title, block.trailing?.[0]])).toEqual([
      ["TKOH", { text: "45 minutes", tone: "success" }],
      ["QEH", { text: "3.5 hours", tone: "danger" }],
    ]);
  });

  it("shows the weather with its warnings", () => {
    const card = cardForToolResult(
      result("hko-weather", "hko_current_weather", {}, { temperature: { data: [{ place: "Hong Kong Observatory", value: 27 }] }, warningMessage: "Strong Monsoon Signal" }),
    )!;
    expect(card.blocks.slice(0, 2)).toEqual([
      { kind: "hero", value: "27°C", label: "Hong Kong Observatory", detail: undefined, tone: undefined },
      { kind: "notice", text: "Strong Monsoon Signal", tone: "warning" },
    ]);
  });

  it("has no card for tools whose result doesn't picture well, or data a builder can't read", () => {
    expect(cardForToolResult(result("datagovhk-catalog", "datagovhk_archive_get_file", {}, { content: "a,b" }))).toBeNull();
    expect(cardForToolResult(result("hko-weather", "hko_earthquake", {}, {}))).toBeNull();
    expect(cardForToolResult(result("unknown-service", "x", {}, {}))).toBeNull();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(cardForToolResult(result("hko-weather", "hko_nine_day_forecast", {}, { weatherForecast: [null] }))).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("cardsForToolResults", () => {
  const holiday = (date: string) => result("hk-holidays", "hk_is_public_holiday", { date }, { date, isPublicHoliday: false, holiday: null, isSunday: false });

  it("keeps the latest result per tool and input, in call order", () => {
    const cards = cardsForToolResults([holiday("2026-12-25"), { content: [] }, holiday("2026-12-26"), holiday("2026-12-25")]);
    expect(cards.map((card) => card.title)).toEqual(["Saturday, 26 December 2026", "Friday, 25 December 2026"]);
  });

  it(`sends at most ${MAX_CARDS_PER_REPLY}, the latest`, () => {
    const cards = cardsForToolResults(["2026-12-21", "2026-12-22", "2026-12-23", "2026-12-24"].map(holiday));
    expect(cards).toHaveLength(MAX_CARDS_PER_REPLY);
    expect(cards[0].title).toContain("22 December");
  });
});

describe("render", () => {
  // The test font stands in for Noto Sans HK so nothing is fetched.
  const font = readFileSync(path.join(import.meta.dirname, "../node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf"));
  const fetcher = vi.fn(async (url: string) =>
    url.startsWith("https://fonts.googleapis.com/")
      ? new Response("@font-face { src: url(https://fonts.gstatic.com/l/font?kit=x) format('truetype'); }")
      : new Response(new Uint8Array(font)),
  ) as unknown as typeof fetch;

  const rows = Array.from({ length: 14 }, (_, index) => ({ kind: "row" as const, title: `Stop ${index + 1}`, trailing: [{ text: `${index} min` }] }));
  const card: Card = { accent: "#1565c0", badge: "HKO", title: "Test card", subtitle: "Subtitle", blocks: [{ kind: "notice", text: "Heads up", tone: "warning" }, ...rows], footer: "Updated 08:00" };

  it("cuts long lists with a count of the rest", () => {
    const text = JSON.stringify(cardTree(card));
    expect(text).toContain("Stop 10");
    expect(text).not.toContain("Stop 11");
    expect(text).toContain("+4 more");
  });

  it("subsets the font to the characters drawn", async () => {
    await renderCardSvg(card, fetcher);
    const cssUrl = new URL(vi.mocked(fetcher).mock.calls[0][0] as string);
    expect(cssUrl.searchParams.get("family")).toBe("Noto Sans HK:wght@400");
    const chars = cssUrl.searchParams.get("text")!;
    expect(new Set(chars).size).toBe(chars.length);
    for (const char of "Test cardmcprouter+4") expect(chars).toContain(char);
    // Satori draws an ellipsis where it cuts text; without it in the subset it shows as a box.
    expect(chars).toContain("…");
  });

  it("draws an SVG and a PNG twice its size", async () => {
    const svg = await renderCardSvg(card, fetcher);
    expect(svg).toMatch(/^<svg width="540" height="\d+"/);
    const png = await renderCardPng(card, fetcher);
    expect([...png.subarray(0, 4)]).toEqual([137, 80, 78, 71]);
    expect(png.readUInt32BE(16)).toBe(1080);
  });

  it("fails when the font can't be loaded", async () => {
    const down = vi.fn(async () => new Response("", { status: 503 })) as unknown as typeof fetch;
    await expect(renderCardSvg(card, down)).rejects.toThrow("Google Fonts 503");
  });
});
