import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth";
import { chatIdSchema, loadChat } from "@/lib/chat-store";
import { getT } from "@/lib/i18n/server";
import { ChatView } from "../chat-view";

export async function generateMetadata({ params }: PageProps<"/chat/[id]">) {
  const { id } = await params;
  const user = await requirePageUser();
  const chat = chatIdSchema.safeParse(id).success ? await loadChat(user.id, id) : null;
  const t = await getT();
  return { title: chat?.chat.title ?? t("Agent") };

}

export default async function ChatPage({ params }: PageProps<"/chat/[id]">) {
  const { id } = await params;
  const user = await requirePageUser();
  if (!chatIdSchema.safeParse(id).success) notFound();
  const chat = await loadChat(user.id, id);
  if (!chat) notFound();
  return <ChatView key={id} id={id} initialMessages={chat.messages} />;
}
