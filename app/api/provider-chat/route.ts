import { AGENT_TOOL_STEPS, GUEST_AGENT_TOOL_STEPS } from "@/lib/agent/stop";
import { validateUIMessages, type UIMessage } from "ai";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { apiChatScope, serviceChatScope } from "@/lib/agent/api-scope";
import { DEFAULT_AGENT_SERVERS, resolveServer } from "@/lib/agent/mcp-servers";
import { streamAgentReply } from "@/lib/agent/run";
import { clientAddress, consumeFreeMessage, freeChatConfig, GUEST_COOKIE, subjectsFor } from "@/lib/free-chat";

export const maxDuration = 120;
const plain = (message: string, status: number) => new Response(message, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

/** Catalogue conversations are ephemeral; signed-in calls still use the member's normal MCP metering. */
export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > 200_000) return plain("This conversation is too long. Start a new chat.", 413);
  let body: { apiId?: unknown; serviceId?: unknown; messages?: UIMessage[] };
  try {
    body = JSON.parse(raw);
    if (!body || typeof body !== "object") return plain("Bad request.", 400);
  } catch {
    return plain("Bad request.", 400);
  }
  const scope = body.serviceId === undefined ? apiChatScope(body.apiId)
    : body.apiId === undefined ? serviceChatScope(body.serviceId) : null;
  if (!scope) return plain("This API has no chat tools available yet.", 400);
  let messages: UIMessage[];
  try {
    const history = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
    const question = history.at(-1);
    const text = question?.role === "user" ? question.parts.filter((part) => part.type === "text").map((part) => part.text).join("") : "";
    if (!text.trim()) return plain("Enter a question.", 400);
    if (text.length > 2_000) return plain("Keep questions under 2000 characters.", 413);
    messages = await validateUIMessages({ messages: history });
  } catch {
    return plain("Bad request.", 400);
  }

  const user = await getCurrentUser();
  const config = freeChatConfig();
  if (!user && !config.enabled) return plain("The free agent is turned off. Sign in to use the agent.", 403);
  let userId = user?.id;
  let guestSubjects: { guest: string; ip: string } | undefined;
  if (!userId) {
    const jar = await cookies();
    const guestId = jar.get(GUEST_COOKIE)?.value ?? crypto.randomUUID();
    jar.set(GUEST_COOKIE, guestId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365, path: "/" });
    const subjects = subjectsFor(guestId, clientAddress(request.headers));
    guestSubjects = { guest: subjects.guest!, ip: subjects.ip };
    userId = guestSubjects.guest;
  }
  let servers;
  try {
    // Never connect configured external servers or include dashboard/account tools in catalogue chat.
    servers = DEFAULT_AGENT_SERVERS.map((server) => resolveServer(server, {
      origin: new URL(request.url).origin, userId, internalKey: process.env.MCPROUTER_INTERNAL_KEY,
      channel: "web", scopes: scope.services, toolMode: "all",
    }));
  } catch {
    return plain("The agent isn't available right now. Try again later.", 503);
  }
  const headers = new Headers();
  if (guestSubjects) {
    const { allowed, quota } = await consumeFreeMessage(guestSubjects, config);
    if (!allowed) return plain("You've used today's free messages. Sign in to keep chatting, or come back tomorrow.", 429);
    headers.set("x-free-chat-remaining", String(quota.remaining));
  }
  try {
    return await streamAgentReply({
      servers, messages, model: user ? (process.env.AI_MODEL ?? config.model) : config.model,
      maxSteps: user ? AGENT_TOOL_STEPS : GUEST_AGENT_TOOL_STEPS, headers,
      toolScope: scope.tools.map((tool) => tool.name),
      channelNote: `This conversation is exclusively about ${scope.title}. Its tools are already loaded. Use only these tools; explain when a question requires another provider.`,
    });
  } catch {
    return plain("The agent could not answer. Try again.", 503);
  }
}
