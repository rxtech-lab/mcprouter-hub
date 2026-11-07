import { getCurrentUser } from "@/lib/auth";
import { chatIdSchema, loadChat } from "@/lib/chat-store";
import { chatRun } from "@/lib/tasks/chat-run";

export async function GET(_request: Request, { params }: RouteContext<"/api/chat/[id]">) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!chatIdSchema.safeParse(id).success) return Response.json({ error: "not found" }, { status: 404 });
  // Read status first: a terminal snapshot must include the final saved messages.
  const run = await chatRun(user.id, id);
  const chat = await loadChat(user.id, id);
  if (!chat) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json({ messages: chat.messages, run }, { headers: { "Cache-Control": "private, no-store" } });
}
