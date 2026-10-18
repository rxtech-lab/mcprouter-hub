import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { Visual } from "@/lib/agent/display-tools";
import type { UiSpec } from "@/lib/agent/ui-catalog";
import { cardForToolResult, cardInput, cardsForVisuals, MAX_CARDS_PER_REPLY } from "@/lib/cards";
import { uiSpecCard } from "@/lib/cards/ui-card";
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

  it("draws the airport board with each flight's status", () => {
    const card = cardForToolResult(
      result("hk-airport", "airport_departures", { date: "2026-10-18" }, [
        { scheduled: "2026-10-18T00:05+08:00", flight: "CX 261", airline: "CPA", codeshares: ["QF 8261"], destinations: ["CDG"], status: "Dep 00:46", state: "departed", terminal: "T1", gate: "7" },
        { scheduled: "2026-10-18T07:40+08:00", flight: "5X 003", airline: "UPS", destinations: ["BLR", "CGN"], status: "Cancelled", state: "cancelled" },
        { scheduled: "2026-10-18T23:55+08:00", flight: "UO 848", airline: "HKE", destinations: ["NRT"], status: null, state: "scheduled" },
      ], { total: 3, returned: 3, truncated: false }),
    )!;
    expect(card.title).toBe("Departures · Sun 18 Oct");
    expect(card.blocks).toEqual([
      { kind: "notice", text: "1 flight cancelled", tone: "warning" },
      { kind: "row", leading: { text: "00:05" }, title: "CX 261", subtitle: "To CDG · Gate 7 · Also QF 8261", trailing: [{ text: "Dep 00:46", tone: "success" }], muted: false },
      { kind: "row", leading: { text: "07:40" }, title: "5X 003", subtitle: "To BLR · CGN", trailing: [{ text: "Cancelled", tone: "danger" }], muted: true },
      { kind: "row", leading: { text: "23:55" }, title: "UO 848", subtitle: "To NRT", trailing: [{ text: "Scheduled", tone: "neutral" }], muted: false },
    ]);
  });

  it("colours border queues by how busy they are", () => {
    const queue = (status: string, label: string) => ({ status, label, wait: null });
    const card = cardForToolResult(
      result("hk-border", "border_waiting_times", {}, {
        controlPoints: [
          {
            code: "LWS",
            name: "Lo Wu",
            residents: { arrival: queue("very_busy", "Very busy"), departure: queue("closed", "Outside service hours") },
            visitors: { arrival: queue("normal", "Normal"), departure: queue("busy", "Busy") },
          },
        ],
      }),
    )!;
    expect(card.blocks).toEqual([
      {
        kind: "row",
        leading: { text: "LWS" },
        title: "Lo Wu",
        subtitle: "Visitors: in Normal, out Busy",
        trailing: [{ text: "In Very busy", tone: "danger" }, { text: "Out Outside service hours", tone: "neutral" }],
      },
    ]);
  });

  it("shows Kowloon East free spaces out of the total, coloured by how full the car park is", () => {
    const card = cardForToolResult(
      result("kowloon-east-parking", "ke_parking_vacancy", { carparkId: 12 }, [
        {
          id: 12,
          name: "Amoy Plaza",
          area: "Kowloon Bay",
          closed: false,
          updatedAt: null,
          vacancies: { privateCar: { vacant: 13, spaces: 389, ev: 1 }, LGV: { vacant: 0, spaces: 5 }, motorCycle: { vacant: 4 } },
        },
      ]),
    )!;
    expect(card).toMatchObject({ title: "Amoy Plaza", subtitle: "Kowloon Bay", accent: "#d9531e" });
    expect(card.blocks).toEqual([
      {
        kind: "row",
        title: "Amoy Plaza",
        subtitle: "Kowloon Bay",
        trailing: [{ text: "Car 13/389", tone: "success" }, { text: "Light goods 0/5", tone: "danger" }, { text: "Motorcycle 4", tone: "warning" }],
        muted: false,
      },
    ]);
  });

  it("lists the worst-graded beaches first and flags them", () => {
    const beach = (code: string, name: string, grade: number, rating: string) => ({ code, name, district: "Southern", grade, rating, latitude: 22.2, longitude: 114.2, report: null });
    const card = cardForToolResult(
      result("epd-beach", "beach_water_quality", {}, { updated: "2026-10-16T14:04:42+08:00", count: 2, beaches: [beach("RB", "Repulse Bay Beach", 1, "Good"), beach("DW", "Deep Water Bay Beach", 3, "Poor")] }),
    )!;
    expect(card).toMatchObject({ badge: "≈", accent: "#00838f", subtitle: "2 beaches · graded Fri 16 Oct, 14:04" });
    expect(card.blocks).toEqual([
      { kind: "notice", text: "Below the swimming standard: Deep Water Bay Beach", tone: "warning" },
      { kind: "row", leading: { text: "DW" }, title: "Deep Water Bay Beach", subtitle: "Southern", trailing: [{ text: "Poor · 3", tone: "warning" }] },
      { kind: "row", leading: { text: "RB" }, title: "Repulse Bay Beach", subtitle: "Southern", trailing: [{ text: "Good · 1", tone: "success" }] },
    ]);
  });

  it("lists a day's high and low tides with their heights", () => {
    const card = cardForToolResult(
      result("hko-tides", "hko_tide_times", { station: "QUB" }, {
        station: { code: "QUB", name: "Quarry Bay" },
        days: [{ date: "2026-10-18", tides: [{ time: "00:30", type: "high", heightM: 2.27 }, { time: "09:47", type: "low", heightM: 1.03 }] }],
      }),
    )!;
    expect(card.title).toBe("Tides at Quarry Bay");
    expect(card.footer).toBe("Sun 18 Oct · Hong Kong time");
    expect(card.blocks).toEqual([
      { kind: "row", leading: { text: "High", tone: "info" }, title: "00:30", trailing: [{ text: "2.27 m", tone: "accent" }] },
      { kind: "row", leading: { text: "Low", tone: "neutral" }, title: "09:47", trailing: [{ text: "1.03 m", tone: "accent" }] },
    ]);
  });

  it("colours AQHI stations by health risk and groups them by type", () => {
    const card = cardForToolResult(
      result("epd-aqhi", "aqhi_current", {}, {
        updated: "2026-10-18T22:30:00+08:00",
        stations: [
          { station: "Central/Western", type: "general", aqhi: 3, risk: "low", riskLabel: "Low" },
          { station: "Central", type: "roadside", aqhi: 10, risk: "serious", riskLabel: "Serious" },
        ],
      }),
    )!;
    expect(card).toMatchObject({ accent: "#00843d", badge: "AQHI", subtitle: "Updated Sun 18 Oct, 22:30" });
    expect(card.blocks).toEqual([
      { kind: "section", title: "General stations" },
      { kind: "row", leading: { text: "3", tone: "success" }, title: "Central/Western", trailing: [{ text: "Low", tone: "success" }] },
      { kind: "section", title: "Roadside stations" },
      { kind: "row", leading: { text: "10+", tone: "danger" }, title: "Central", trailing: [{ text: "Serious", tone: "danger" }] },
    ]);
  });

  it("lists the wettest weather stations first", () => {
    const card = cardForToolResult(
      result("hko-regional", "hko_rainfall_past_hour", {}, {
        observedAt: "2026-10-18T22:45:00+08:00",
        stations: [
          { station: "Lau Fau Shan", id: "RF001", rainfallMm: 0 },
          { station: "Sha Tin", id: "RF020", rainfallMm: 3 },
          { station: "Tuen Mun", id: "RF019", rainfallMm: 12 },
        ],
      }),
    )!;
    expect(card).toMatchObject({ accent: "#1565c0", badge: "HKO", title: "Rainfall in the past hour", subtitle: "Observed Sun 18 Oct, 22:45" });
    expect(card.blocks).toEqual([
      { kind: "row", leading: { text: "RF019" }, title: "Tuen Mun", trailing: [{ text: "12 mm", tone: "info" }] },
      { kind: "row", leading: { text: "RF020" }, title: "Sha Tin", trailing: [{ text: "3 mm", tone: "info" }] },
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

describe("cardsForVisuals", () => {
  const holiday = (date: string) => result("hk-holidays", "hk_is_public_holiday", { date }, { date, isPublicHoliday: false, holiday: null, isSunday: false });
  const shown = (output: unknown): Visual => ({ type: "tool", toolName: "hk_is_public_holiday", output });

  it("draws what the agent showed, once per tool and input, in order", () => {
    const cards = cardsForVisuals([shown(holiday("2026-12-25")), shown({ content: [] }), shown(holiday("2026-12-26")), shown(holiday("2026-12-25"))]);
    expect(cards.map((card) => card.title)).toEqual(["Saturday, 26 December 2026", "Friday, 25 December 2026"]);
  });

  it("draws a composed UI as a card", () => {
    const spec: UiSpec = { root: "t", elements: { t: { type: "Text", props: { text: "Hello" } } } };
    expect(cardsForVisuals([{ type: "ui", spec }, shown(holiday("2026-12-25"))]).map((card) => card.title)).toEqual(["mcprouter", "Friday, 25 December 2026"]);
  });

  it(`sends at most ${MAX_CARDS_PER_REPLY}, the latest`, () => {
    const cards = cardsForVisuals(["2026-12-21", "2026-12-22", "2026-12-23", "2026-12-24"].map((date) => shown(holiday(date))));
    expect(cards).toHaveLength(MAX_CARDS_PER_REPLY);
    expect(cards[0].title).toContain("22 December");
  });
});

describe("uiSpecCard", () => {
  it("heads the card with the root Card and maps components to blocks", () => {
    const card = uiSpecCard({
      root: "card",
      elements: {
        card: { type: "Card", props: { title: "Hong Kong now", subtitle: "HKO" }, children: ["grid", "warn", "list", "table", "kv", "source"] },
        grid: { type: "Grid", props: {}, children: ["temp", "humidity"] },
        temp: { type: "Metric", props: { label: "Temperature", value: "28", unit: "°C" } },
        humidity: { type: "Metric", props: { label: "Humidity", value: "71", unit: "%" } },
        warn: { type: "Alert", props: { title: "Thunderstorm warning", message: "Until 23:00", tone: "error" } },
        list: { type: "List", props: { items: [{ title: "1A", subtitle: "Star Ferry", trailing: "3 min" }] } },
        table: { type: "Table", props: { columns: ["Hospital", "Region", "Wait"], rows: [["QMH", "HK Island", "2 hours"]] } },
        kv: { type: "KeyValue", props: { items: [{ label: "Updated", value: "a very long value that will not fit" }] } },
        source: { type: "Link", props: { label: "Source", href: "https://www.hko.gov.hk" } },
      },
    });
    expect(card).toMatchObject({ title: "Hong Kong now", subtitle: "HKO", badge: "H", accent: "#216487" });
    expect(card.blocks).toEqual([
      { kind: "stats", items: [{ label: "Temperature", value: "28°C" }, { label: "Humidity", value: "71%" }] },
      { kind: "notice", text: "Thunderstorm warning: Until 23:00", tone: "danger" },
      { kind: "row", title: "1A", subtitle: "Star Ferry", trailing: [{ text: "3 min", tone: "accent" }] },
      { kind: "row", title: "QMH", subtitle: "Region: HK Island", trailing: [{ text: "2 hours", tone: "accent" }] },
      { kind: "row", title: "a very long value that will not fit", subtitle: "Updated" },
      { kind: "text", text: "Source: https://www.hko.gov.hk", muted: true },
    ]);
  });

  it("uses a leading heading as the title and never loops", () => {
    const card = uiSpecCard({
      root: "stack",
      elements: {
        stack: { type: "Stack", props: {}, children: ["heading", "metric", "stack"] },
        heading: { type: "Heading", props: { text: "九天天氣預報" } },
        metric: { type: "Metric", props: { label: "最高", value: "32", unit: "°C" } },
      },
    });
    expect(card).toMatchObject({ title: "九天天氣預報", badge: "九" });
    expect(card.blocks).toEqual([{ kind: "hero", value: "32°C", label: "最高", detail: null }]);
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
