import type { Card, CardBuilder, CardInput } from "@/mcp/apps/card";
import { buildCard as catalogCard } from "@/mcp/services/datagovhk-catalog/card";
import { buildCard as aedCard } from "@/mcp/services/ha-aed/card";
import { buildCard as busCard } from "@/mcp/services/hk-bus/card";
import { buildCard as holidaysCard } from "@/mcp/services/hk-holidays/card";
import { buildCard as weatherCard } from "@/mcp/services/hko-weather/card";
import { buildCard as mtrCard } from "@/mcp/services/mtr/card";
import { buildCard as carparkCard } from "@/mcp/services/td-carpark/card";

/**
 * Chat cards for results of tools with an MCP App: the channels that can't run
 * the app (Telegram, WhatsApp) send a picture of the result instead. Each
 * service's `card.ts` mirrors its `app.ts`.
 */

const BUILDERS: Record<string, CardBuilder> = {
  "datagovhk-catalog": catalogCard,
  "ha-aed": aedCard,
  "hk-bus": busCard,
  "hk-holidays": holidaysCard,
  "hko-weather": weatherCard,
  mtr: mtrCard,
  "td-carpark": carparkCard,
};

/** At most this many pictures go with one reply. */
export const MAX_CARDS_PER_REPLY = 3;

type ToolResult = { structuredContent?: unknown; isError?: boolean };

/**
 * A tool result as the `{ tool, input, data, meta }` an app sees (see `appStructuredContent`),
 * or null when it isn't one of this app's tools with an MCP App, or it failed.
 */
export function cardInput(output: unknown): (CardInput & { service: string }) | null {
  const result = output as ToolResult | null;
  if (!result || typeof result !== "object" || result.isError) return null;
  const structured = result.structuredContent as Record<string, unknown> | undefined;
  if (!structured || typeof structured !== "object" || typeof structured.service !== "string" || typeof structured.tool !== "string") return null;
  const { service, tool, input, ...rest } = structured;
  const data = "data" in rest ? rest.data : rest;
  const meta = (rest.meta && typeof rest.meta === "object" ? rest.meta : {}) as CardInput["meta"];
  return { service, tool, input: input ?? {}, data, meta };
}

/** The card for one tool result, or null when its tool has none. A builder that throws on odd data yields no card. */
export function cardForToolResult(output: unknown): Card | null {
  const parsed = cardInput(output);
  const build = parsed ? BUILDERS[parsed.service] : undefined;
  if (!parsed || !build) return null;
  try {
    return build(parsed);
  } catch (error) {
    console.warn(`[cards] could not build a card for ${parsed.tool}`, error);
    return null;
  }
}

/**
 * Cards for a reply's tool results, in call order. A tool called again with the
 * same input keeps only its latest result, and at most `MAX_CARDS_PER_REPLY` are kept (the latest).
 */
export function cardsForToolResults(outputs: unknown[]): Card[] {
  const latest = new Map<string, Card>();
  for (const output of outputs) {
    const card = cardForToolResult(output);
    if (!card) continue;
    const parsed = cardInput(output)!;
    const key = `${parsed.tool} ${JSON.stringify(parsed.input)}`;
    latest.delete(key);
    latest.set(key, card);
  }
  return [...latest.values()].slice(-MAX_CARDS_PER_REPLY);
}
