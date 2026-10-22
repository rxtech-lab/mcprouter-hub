import { tool } from "ai";
import { z } from "zod";
import { checkUiSpec, describeComponents, uiSpecSchema, type UiSpec } from "@/lib/agent/ui-catalog";

export const SHOW_TOOL_UI_TOOL_NAME = "show_tool_ui";
export const SHOW_UI_TOOL_NAME = "show_ui";

/** Appended to an app tool's description, so the agent knows its result can be shown. */
export const APP_TOOL_HINT = `Has a visual app: call ${SHOW_TOOL_UI_TOOL_NAME} with this tool's name to show it. Do not recreate the same result with ${SHOW_UI_TOOL_NAME}.`;

export const SHOW_UI_NOTE = `The user doesn't see your tool calls, only your text and the UI you choose to show (a live view on the web, a picture card in chat apps). After getting live data, show it visually:
- When a tool whose description says "Has a visual app" returned the data the user asked about (weather, arrivals, A&E waits, car parks…), call ${SHOW_TOOL_UI_TOOL_NAME} with its name.
- The MCP App already provides the result UI. Do not also recreate that same result with ${SHOW_UI_TOOL_NAME}, another card, table or chart; add only a brief text interpretation. A different format explicitly requested by the user is fine.
- Otherwise, when numbers, a list or a comparison would read better as UI, compose one with ${SHOW_UI_TOOL_NAME} from the data you got (never invent values).
- When show_map is available, use it for places or routes with sourced coordinates. Pins show places; supplied polylines show exact sourced geometry or clearly labeled schematic stop connections. Never guess coordinates or stop order.
- For a bus route map, fetch the ordered stops for the correct operator, route and direction with the bus tool (for example action citybus_route_stops or kmb_route_stops). These actions return stop names and coordinates. If a stop lacks coordinates, use the corresponding stop-details action. Include the boarding and alighting stops when known. Do not merely describe stops in text or show only the walk to the bus stop when the user asks for the bus route.
- Use draw_route to calculate and display walking, cycling or driving routes between sourced coordinates. It displays the map itself; do not repeat it with show_map. For a bus route, prefer official transport geometry with show_map when available. Otherwise use draw_route with mode driving through the sourced bus stops in travel order to connect them along real roads. Label both the map title and route line as an estimated driving path through bus stops. It may differ from the bus's actual path due to bus-only roads and restrictions; say this briefly, and do not present driving duration as bus travel time or a timetable. Do not refuse merely because official bus geometry is missing. Each call accepts at most 25 waypoints: for longer journeys use consecutive batches sharing the boundary stop, retaining all intermediate stops, or draw the requested boarding-to-alighting segment. If directions fail, show the sourced stop pins; if the user wants straight connections, show a clearly labeled schematic with show_map. Never fabricate a successful road route.
Show each result once, with the most suitable display tool. Skip visuals for a one-line answer (e.g. a yes/no holiday check), for lookups that only fed another call, and for failed calls. Then keep the text short: the UI carries the details.`;

/** Whether an MCP tool definition comes with an MCP App (`_meta.ui.resourceUri`, or the older `ui/resourceUri`). */
export function definitionHasApp(definition: { _meta?: unknown }) {
  const meta = definition._meta as Record<string, unknown> | undefined;
  const ui = meta?.ui as { resourceUri?: unknown } | undefined;
  const uri = ui?.resourceUri ?? meta?.["ui/resourceUri"];
  return typeof uri === "string" && uri.startsWith("ui://");
}

/**
 * The display tools, which the agent uses to decide what the user sees:
 * - `show_tool_ui` shows the MCP App of tool results it already got: the web chat renders the app of the
 *   latest call of each named tool where this call sits in the reply, and the chat bots send its card.
 *   `appTools` are the chat names of tools with an app, so the agent hears back when it names one without.
 * - `show_ui` shows a UI it composes from the catalog's components (a json-render spec): rendered live
 *   on the web, drawn as a card in the chat bots.
 * Every other tool call stays hidden (folded, on the web).
 */
export function showUiTools(appTools: ReadonlySet<string>) {
  return {
    [SHOW_TOOL_UI_TOOL_NAME]: tool({
      description: "Show the visual app of tool results you already got in this reply, in the chat where this call is made. Pass the tool names, e.g. the arrivals you just fetched.",
      inputSchema: z.object({
        tools: z.array(z.string().min(1).max(200)).min(1).max(5).describe("Names of tools called earlier in this reply"),
      }),
      execute: async ({ tools }) => {
        const shown = [...new Set(tools)].filter((name) => appTools.has(name));
        const withoutApp = tools.filter((name) => !appTools.has(name));
        return { shown, ...(withoutApp.length ? { withoutApp, note: `These tools have no visual app; use ${SHOW_UI_TOOL_NAME} or text.` } : {}) };
      },
    }),
    [SHOW_UI_TOOL_NAME]: tool({
      description: `Show a small UI you compose from data you already got, in the chat where this call is made. Use it for results that have no visual app.
The spec is a flat map: "root" is the top element's key; each element has "type", "props" and, for Stack, Grid and Card, "children" (element keys). Keys are short ids like "card", "temp".
Components and props (? = optional; tone is neutral, primary, tertiary, success or error):
${describeComponents()}
Keep it compact: a Card or Stack at the root, at most a few dozen elements, values as display strings with units.`,
      inputSchema: z.object({ spec: uiSpecSchema }),
      execute: async ({ spec }) => {
        const problems = checkUiSpec(spec);
        return problems.length ? { shown: false, problems, note: "Fix these and call again." } : { shown: true };
      },
    }),
  };
}

/** Something the agent chose to show: a tool's result (drawn as its app or card), or a UI it composed. */
export type Visual = { type: "tool"; toolName: string; output: unknown } | { type: "ui"; spec: UiSpec };

type ToolResult = { toolName: string; input: unknown; output: unknown };

/**
 * The visuals a reply's tool results ask for, in order, for channels that draw them after the reply
 * (the chat bots). `show_tool_ui` names tools, so it picks the latest result of each before it.
 */
export function chosenVisuals(results: ToolResult[]): Visual[] {
  const latest = new Map<string, unknown>();
  const visuals: Visual[] = [];
  for (const { toolName, input, output } of results) {
    if (toolName === SHOW_TOOL_UI_TOOL_NAME) {
      for (const name of (output as { shown?: string[] } | null)?.shown ?? []) {
        if (latest.has(name)) visuals.push({ type: "tool", toolName: name, output: latest.get(name) });
      }
    } else if (toolName === SHOW_UI_TOOL_NAME) {
      const spec = (input as { spec?: UiSpec } | null)?.spec;
      if ((output as { shown?: boolean } | null)?.shown && spec) visuals.push({ type: "ui", spec });
    } else {
      latest.set(toolName, output);
    }
  }
  return visuals;
}
