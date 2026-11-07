import { generateId } from "ai";
import { requirePageUser } from "@/lib/auth";
import { ChatView } from "../chat/chat-view";

export const metadata = { title: "Task agent" };
export default async function TaskAgentPage() {
  await requirePageUser();
  const id = generateId();
  return <div className="flex h-[calc(100dvh-10rem)] flex-col"><ChatView id={id} initialMessages={[]} isNew taskAgent /></div>;
}
