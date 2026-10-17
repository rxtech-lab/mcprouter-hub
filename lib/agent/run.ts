import "server-only";
import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import {
  convertToModelMessages,
  createIdGenerator,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type ToolSet,
  type UIMessage,
} from "ai";
import { cachedInstructions, gatewayCaching, markLastMessage, stableTools } from "@/lib/agent/cache";
import type { resolveServer } from "@/lib/agent/mcp-servers";
import { usedToolNames, withToolSearch } from "@/lib/agent/tool-search";

export const AGENT_INSTRUCTIONS = `You are the mcprouter assistant. You answer questions about Hong Kong using live government open data through your tools:
weather and warnings, KMB/Citybus/MTR arrivals, A&E waiting times, car parks, public holidays and the DATA.GOV.HK catalogue.
Most tools are not loaded yet: call search_tools describing what you need (e.g. "when is the next bus", "is it going to rain") to load the right tools, then call them.
Always call a tool for live or factual data instead of guessing, and say when data comes back empty.
Times are Hong Kong time (UTC+8). Reply in the user's language; use tc data for Traditional Chinese questions.
Be concise: summarise tool results, don't dump raw JSON.`;

/** Today's date in Hong Kong. Day-level, so the cached instructions only change once a day. */
export function agentInstructions(now = new Date()) {
  const today = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Hong_Kong" }).format(now);
  return `${AGENT_INSTRUCTIONS}\nToday is ${today} (Hong Kong). Work out relative dates such as "next Monday" from this.`;
}

type ResolvedServer = ReturnType<typeof resolveServer>;

/** Connects to every MCP server; one that is down is logged and skipped. */
async function connectTools(servers: ResolvedServer[]) {
  const clients: MCPClient[] = [];
  const tools: ToolSet = {};
  await Promise.all(
    servers.map(async (server) => {
      try {
        const client = await createMCPClient({ transport: { type: "http", url: server.url, headers: server.headers } });
        clients.push(client);
        const serverTools = await client.tools();
        // Tools from other servers are prefixed so their names can't collide with ours.
        for (const [name, tool] of Object.entries(serverTools)) tools[server.self ? name : `${server.name}__${name}`] = tool;
      } catch (error) {
        console.error(`[agent] could not connect to MCP server "${server.name}"`, error);
      }
    }),
  );
  const closeAll = async () => {
    await Promise.allSettled(clients.map((client) => client.close()));
  };
  return { tools, closeAll };
}

/** Streams one agent reply as a UI message response, calling `onFinished` with the full conversation. */
export async function streamAgentReply(options: {
  servers: ResolvedServer[];
  messages: UIMessage[];
  model: string;
  maxSteps?: number;
  headers?: HeadersInit;
  onFinished?: (messages: UIMessage[]) => Promise<void>;
}) {
  const { tools, closeAll } = await connectTools(options.servers);
  try {
    const result = streamText({
      model: options.model,
      instructions: cachedInstructions(agentInstructions()),
      messages: markLastMessage(await convertToModelMessages(options.messages)),
      tools: stableTools(withToolSearch(tools, usedToolNames(options.messages), process.env.AI_EMBEDDING_MODEL || undefined)),
      providerOptions: gatewayCaching,
      // Each tool step resends the conversation; keep the breakpoint on its newest message.
      prepareStep: ({ messages: stepMessages }) => ({ messages: markLastMessage(stepMessages) }),
      stopWhen: isStepCount(options.maxSteps ?? 10),
      onEnd: async ({ totalUsage }) => {
        const { cacheReadTokens = 0, cacheWriteTokens = 0, noCacheTokens = 0 } = totalUsage.inputTokenDetails;
        console.info(`[agent] input tokens: ${cacheReadTokens} cached, ${cacheWriteTokens} written to cache, ${noCacheTokens} uncached`);
        await closeAll();
      },
      onError: ({ error }) => {
        console.error("[agent] stream failed", error);
        void closeAll();
      },
    });
    // Keep generating (and saving) even if the browser disconnects.
    void result.consumeStream();
    return createUIMessageStreamResponse({
      headers: options.headers,
      stream: toUIMessageStream({
        stream: result.stream,
        originalMessages: options.messages,
        generateMessageId: createIdGenerator({ prefix: "msg", size: 16 }),
        onEnd: async ({ messages: finished }) => {
          try {
            await options.onFinished?.(finished);
          } catch (error) {
            console.error("[agent] could not save chat", error);
          }
        },
      }),
    });
  } catch (error) {
    await closeAll();
    throw error;
  }
}
