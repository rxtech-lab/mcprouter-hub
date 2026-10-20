import { AGENT_TOOL_STEPS, GUEST_AGENT_TOOL_STEPS } from "@/lib/agent/stop";
import { validateUIMessages, type UIMessage } from "ai";
import { cookies } from "next/headers";
import { DEFAULT_AGENT_SERVERS, resolveServer } from "@/lib/agent/mcp-servers";
import { streamAgentReply } from "@/lib/agent/run";
import { getCurrentUser } from "@/lib/auth";
import { clientAddress, consumeFreeMessage, freeChatConfig, GUEST_COOKIE, subjectsFor } from "@/lib/free-chat";

export const maxDuration = 60;

/** Earlier turns come from the browser (free chats aren't stored), so their size is capped. */
const MAX_HISTORY = 20;
const MAX_HISTORY_BYTES = 200_000;
const MAX_QUESTION_CHARS = 2_000;

const plain = (message: string, status: number) => new Response(message, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const config = freeChatConfig();
  if (!user && !config.enabled) return plain("The free agent is turned off. Sign in to use the agent.", 404);

  const raw = await request.text();
  if (raw.length > MAX_HISTORY_BYTES) return plain("This conversation is too long for the free agent. Start a new chat.", 413);
  let body: { messages?: UIMessage[] };
  try {
    body = JSON.parse(raw);
  } catch {
    return plain("Bad request.", 400);
  }
  const history = Array.isArray(body.messages) ? body.messages.slice(-MAX_HISTORY) : [];
  const question = history.at(-1);
  const text = question?.role === "user" ? question.parts.map((part) => (part.type === "text" ? part.text : "")).join("") : "";
  if (!text.trim()) return plain("Bad request.", 400);
  if (text.length > MAX_QUESTION_CHARS) return plain(`Keep questions under ${MAX_QUESTION_CHARS} characters.`, 413);

  let messages: UIMessage[];
  try {
    messages = await validateUIMessages({ messages: history });
  } catch {
    return plain("Bad request.", 400);
  }

  // Members use their session identity and normal MCP metering; only guests consume free messages.
  let userId = user?.id;
  let subjects: { guest: string; ip: string } | undefined;
  if (!userId) {
    const jar = await cookies();
    const guestId = jar.get(GUEST_COOKIE)?.value ?? crypto.randomUUID();
    jar.set(GUEST_COOKIE, guestId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365, path: "/" });
    const visitor = subjectsFor(guestId, clientAddress(request.headers));
    subjects = { guest: visitor.guest!, ip: visitor.ip };
    userId = subjects.guest;
  }

  let servers;
  try {
    // Only this app's own tools: other configured servers may carry credentials meant for members.
    servers = DEFAULT_AGENT_SERVERS.map((server) =>
      resolveServer(server, { origin: new URL(request.url).origin, userId, internalKey: process.env.MCPROUTER_INTERNAL_KEY, channel: "web" }),
    );
  } catch (error) {
    console.error("[free-chat]", error);
    return plain("The free agent isn't available right now.", 503);
  }

  const headers = new Headers();
  if (subjects) {
    // Counted only once the message is going to be answered.
    const { allowed, quota } = await consumeFreeMessage(subjects, config);
    if (!allowed) return plain(`You've used today's ${quota.limit} free messages. Sign in to keep chatting, or come back tomorrow.`, 429);
    headers.set("x-free-chat-remaining", String(quota.remaining));
  }

  return streamAgentReply({
    servers,
    messages,
    model: user ? (process.env.AI_MODEL ?? config.model) : config.model,
    maxSteps: user ? AGENT_TOOL_STEPS : GUEST_AGENT_TOOL_STEPS,
    headers,
  });
}
