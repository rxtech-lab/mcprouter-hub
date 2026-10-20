import "server-only";
import { createMCPClient, mcpAppClientCapabilities, splitMCPAppTools, type MCPClient } from "@ai-sdk/mcp";
import {
  convertToModelMessages,
  createIdGenerator,
  createUIMessageStreamResponse,
  generateText,
  isStepCount,
  hasToolCall,
  streamText,
  toUIMessageStream,
  type ToolSet,
  type UIMessage,
} from "ai";
import { cachedInstructions, gatewayCaching, markLastMessage, stableTools } from "@/lib/agent/cache";
import type { resolveServer } from "@/lib/agent/mcp-servers";
import { selfMcpFetch } from "@/lib/agent/self-fetch";
import { APP_TOOL_HINT, chosenVisuals, definitionHasApp, SHOW_UI_NOTE, showUiTools } from "@/lib/agent/display-tools";
import { usedToolNames, withToolSearch } from "@/lib/agent/tool-search";
import { REQUEST_INPUT_TOOL_NAME, USER_INPUT_NOTE, userInputTools } from "@/lib/agent/user-input";
import { LOCATION_NOTE, REQUEST_LOCATION_TOOL_NAME, locationTools } from "@/lib/agent/location";
import { mapTools } from "@/lib/agent/map";

export const AGENT_INSTRUCTIONS = `You are the mcprouter assistant. You answer questions with live open data through your tools. Coverage starts with Hong Kong:
weather and warnings, bus and minibus (KMB, Citybus, green minibus) and MTR arrivals, A&E waiting times, car parks, public holidays and the DATA.GOV.HK catalogue.
Most tools are not loaded yet: call search_tools describing what you need (e.g. "when is the next bus", "is it going to rain") to load the right tools, then call them.
Always call a tool for live or factual data instead of guessing, and say when data comes back empty.
Times are Hong Kong time (UTC+8). Reply in the user's language; use tc data for Traditional Chinese questions.
Be concise: summarise tool results, don't dump raw JSON.`;

/** Added when this app's server lists only its three search tools instead of every tool. */
export const SEARCH_MODE_NOTE = `Here search_tools only finds tool names: call read_tool for a tool's arguments, then use_tool with its name and arguments to run it.`;

/** Today's date in Hong Kong. Day-level, so the cached instructions only change once a day. */
export function agentInstructions(now = new Date()) {
  const today = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Hong_Kong" }).format(now);
  return `${AGENT_INSTRUCTIONS}\nToday is ${today} (Hong Kong). Work out relative dates such as "next Monday" from this.`;
}

type ResolvedServer = ReturnType<typeof resolveServer>;

/** Whether this app's server is in search mode, so it already hands the model search_tools, read_tool and use_tool. */
const inSearchMode = (servers: ResolvedServer[]) => servers.some((server) => server.self && server.toolMode === "search");

/** The instructions, with how to show results, the channel's note and, in search mode, how to reach tools. */
function instructionsFor(servers: ResolvedServer[], channelNote: string | undefined) {
  return [agentInstructions(), inSearchMode(servers) ? SEARCH_MODE_NOTE : null, SHOW_UI_NOTE, channelNote].filter(Boolean).join("\n");
}

/**
 * The model's tools. In search mode the server's own search tools stand in for the agent's tool search,
 * so nothing is deferred (tools from other servers are loaded as they are).
 */
function modelTools(servers: ResolvedServer[], tools: ToolSet, messages: UIMessage[], channelTools: ToolSet | undefined) {
  const served = inSearchMode(servers) ? tools : withToolSearch(tools, usedToolNames(messages), process.env.AI_EMBEDDING_MODEL || undefined);
  return stableTools({ ...served, ...channelTools });
}

/** Every tool a server lists, across pages. */
async function listAllTools(client: MCPClient) {
  let page = await client.listTools();
  const tools = [...page.tools];
  while (page.nextCursor) {
    page = await client.listTools({ params: { cursor: page.nextCursor } });
    tools.push(...page.tools);
  }
  return { tools };
}

/**
 * Connects to every MCP server; one that is down is logged and skipped. The
 * chat renders MCP Apps, so it says so; tools only an app may call are kept
 * from the model.
 */
async function connectTools(servers: ResolvedServer[]) {
  const clients: MCPClient[] = [];
  const tools: ToolSet = {};
  const appTools = new Set<string>();
  await Promise.all(
    servers.map(async (server) => {
      try {
        const transport = { type: "http" as const, url: server.url, headers: server.headers, fetch: server.self ? selfMcpFetch : undefined };
        const client = await createMCPClient({ transport, capabilities: mcpAppClientCapabilities });
        clients.push(client);
        const definitions = splitMCPAppTools(await listAllTools(client)).modelVisible;
        // Tools from other servers are prefixed so their names can't collide with ours.
        const chatName = (name: string) => (server.self ? name : `${server.name}__${name}`);
        for (const definition of definitions.tools) if (definitionHasApp(definition)) appTools.add(chatName(definition.name));
        for (const [name, tool] of Object.entries(client.toolsFromDefinitions(definitions))) {
          // Tools with an app say so, so the agent knows it can show their result.
          tools[chatName(name)] = appTools.has(chatName(name)) ? ({ ...tool, description: [tool.description, APP_TOOL_HINT].filter(Boolean).join("\n") } as typeof tool) : tool;
        }
      } catch (error) {
        console.error(`[agent] could not connect to MCP server "${server.name}"`, error);
      }
    }),
  );
  const closeAll = async () => {
    await Promise.allSettled(clients.map((client) => client.close()));
  };
  return { tools, appTools, closeAll };
}

/** Keep provider data tools and their visual apps in the same scope, while always offering UI composition. */
export function scopedAgentTools(tools: ToolSet, appTools: ReadonlySet<string>, scope: readonly string[]) {
  const scoped = Object.fromEntries(Object.entries(tools).filter(([name]) => scope.includes(name)));
  if (!Object.keys(scoped).length) throw new Error("No tools available for this API");
  return stableTools({ ...scoped, ...showUiTools(new Set([...appTools].filter((name) => name in scoped))), ...mapTools(), ...userInputTools(), ...locationTools() });
}

/** Streams one agent reply as a UI message response, calling `onFinished` with the full conversation. */
export async function streamAgentReply(options: {
  servers: ResolvedServer[];
  messages: UIMessage[];
  model: string;
  maxSteps?: number;
  headers?: HeadersInit;
  /** Appended to the instructions, e.g. the web chat's dashboard guide. */
  channelNote?: string;
  /** The channel's own tools (e.g. the dashboard tools); always loaded, never behind `search_tools`. */
  channelTools?: ToolSet;
  /** Catalogue chat: a server-resolved allowlist, loaded immediately without global tool search. */
  toolScope?: string[];
  onFinished?: (messages: UIMessage[]) => Promise<void>;
}) {
  const { tools, appTools, closeAll } = await connectTools(options.servers);
  try {
    const scopedTools = options.toolScope ? scopedAgentTools(tools, appTools, options.toolScope) : undefined;
    const instructions = `${instructionsFor(options.servers, options.channelNote)}\n${USER_INPUT_NOTE}\n${LOCATION_NOTE}`;
    const result = streamText({
      model: options.model,
      instructions: cachedInstructions(instructions),
      messages: markLastMessage(await convertToModelMessages(options.messages)),
      tools: scopedTools ?? modelTools(options.servers, tools, options.messages, { ...options.channelTools, ...showUiTools(appTools), ...mapTools(), ...userInputTools(), ...locationTools() }),
      providerOptions: gatewayCaching,
      // Each tool step resends the conversation; keep the breakpoint on its newest message.
      prepareStep: ({ messages: stepMessages }) => ({ messages: markLastMessage(stepMessages) }),
      stopWhen: [isStepCount(options.maxSteps ?? 10), hasToolCall(REQUEST_INPUT_TOOL_NAME), hasToolCall(REQUEST_LOCATION_TOOL_NAME)],
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

/**
 * One complete agent reply, for channels that can't stream (Telegram, WhatsApp). `channelNote` is appended
 * to the instructions. `visuals` are what the agent chose to show, in order, for drawing chat cards.
 */
export async function generateAgentReply(options: {
  servers: ResolvedServer[];
  messages: UIMessage[];
  model: string;
  maxSteps?: number;
  channelNote?: string;
  /** The channel's own tools (e.g. `sign_out`); always loaded, never behind `search_tools`. */
  channelTools?: ToolSet;
}) {
  const { tools, appTools, closeAll } = await connectTools(options.servers);
  try {
    const instructions = instructionsFor(options.servers, options.channelNote);
    const result = await generateText({
      model: options.model,
      instructions: cachedInstructions(instructions),
      messages: markLastMessage(await convertToModelMessages(options.messages)),
      tools: modelTools(options.servers, tools, options.messages, { ...options.channelTools, ...showUiTools(appTools) }),
      providerOptions: gatewayCaching,
      prepareStep: ({ messages: stepMessages }) => ({ messages: markLastMessage(stepMessages) }),
      stopWhen: isStepCount(options.maxSteps ?? 10),
    });
    return { text: result.text, visuals: chosenVisuals(result.steps.flatMap((step) => step.toolResults)) };
  } finally {
    await closeAll();
  }
}
