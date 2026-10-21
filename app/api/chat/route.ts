import { consumeChatMessage, chatBillingMessage, DuplicateChatMessageError } from "@/lib/billing/chat";
import { UsageLimitError } from "@/lib/billing/errors";
import { validateUIMessages, type UIMessage } from "ai";
import { getCurrentUser } from "@/lib/auth";
import { chatIdSchema, ensureChat, loadChat, saveMessages } from "@/lib/chat-store";
import { dashboardData } from "@/lib/agent/dashboard-data";
import { DASHBOARD_NOTE, dashboardTools } from "@/lib/agent/dashboard-tools";
import { parseMcpServers, resolveServer } from "@/lib/agent/mcp-servers";
import { streamAgentReply } from "@/lib/agent/run";

export const maxDuration = 120;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  // The client sends only its newest message; earlier ones are loaded from the database.
  const body = (await request.json()) as { id?: unknown; message?: UIMessage };
  const parsedId = chatIdSchema.safeParse(body.id);
  if (!parsedId.success || !body.message || body.message.role !== "user") return Response.json({ error: "bad request" }, { status: 400 });
  const chatId = parsedId.data;

  let messages: UIMessage[];
  try {
    const existing = await loadChat(user.id, chatId);
    const previous = (existing?.messages ?? []).filter((message) => message.id !== body.message!.id);
    messages = await validateUIMessages({ messages: [...previous, body.message] });
    await ensureChat(user.id, chatId, body.message);
    // Stored before the reply starts, so a reload mid-answer still shows the question.
    await saveMessages(chatId, [body.message], previous.length);
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") return Response.json({ error: "forbidden" }, { status: 403 });
    return Response.json({ error: "invalid message" }, { status: 400 });
  }
  const origin = new URL(request.url).origin;

  let servers;
  try {
    servers = parseMcpServers(process.env.AGENT_MCP_SERVERS).map((server) =>
      resolveServer(server, { origin, userId: user.id, internalKey: process.env.MCPROUTER_INTERNAL_KEY, channel: "web", chatMetered: true }),
    );
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }

  try {
    await consumeChatMessage({ userId: user.id, messageId: body.message.id, channel: "web" });
  } catch (error) {
    return new Response(chatBillingMessage(error), { status: error instanceof DuplicateChatMessageError ? 409 : error instanceof UsageLimitError ? 402 : 503, headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  return streamAgentReply({
    servers,
    messages,
    model: process.env.AI_MODEL ?? "anthropic/claude-sonnet-5-5",
    channelNote: DASHBOARD_NOTE,
    channelTools: dashboardTools(dashboardData(user)),
    onFinished: (finished) => saveMessages(chatId, finished),
  });
}
