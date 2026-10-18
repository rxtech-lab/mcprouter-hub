import { generateId } from "ai";
import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { ChatView } from "./chat-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Agent") };
}


export default async function NewChatPage() {
  await requirePageUser();
  // A fresh id per visit; the chat is only stored once its first message is sent.
  const id = generateId();
  return <ChatView key={id} id={id} initialMessages={[]} isNew />;
}
