import { generateId } from "ai";
import { requirePageUser } from "@/lib/auth";
import { ChatView } from "./chat-view";

export const metadata = { title: "Agent" };

export default async function NewChatPage() {
  await requirePageUser();
  // A fresh id per visit; the chat is only stored once its first message is sent.
  const id = generateId();
  return <ChatView key={id} id={id} initialMessages={[]} isNew />;
}
