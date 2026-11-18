import { generateId } from "ai";
import type { Metadata } from "next";
import { requirePageUser } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { ChatView } from "./chat-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Agent") };
}


/** `?ask=` starts the chat with that question, e.g. from the dashboard's quick start card. */
export default async function NewChatPage({ searchParams }: PageProps<"/chat">) {
  await requirePageUser();
  const { ask } = await searchParams;
  const prompt = (Array.isArray(ask) ? ask[0] : ask)?.trim().slice(0, 500) || undefined;
  // A fresh id per visit; the chat is only stored once its first message is sent.
  const id = generateId();
  return <ChatView key={id} id={id} initialMessages={[]} isNew initialPrompt={prompt} />;
}
