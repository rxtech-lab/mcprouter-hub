import { Suspense } from "react";
import { requirePageUser } from "@/lib/auth";
import { listChats } from "@/lib/chat-store";
import { ChatHistoryProvider, ChatSidebar } from "./chat-history";

export default async function ChatLayout({ children }: LayoutProps<"/chat">) {
  const user = await requirePageUser();
  const initial = await listChats(user.id, {});
  return (
    <Suspense>
      <ChatHistoryProvider initial={initial}>
        <div className="flex h-[calc(100dvh-5rem)] md:h-dvh">
          <ChatSidebar />
          <div className="flex min-w-0 flex-1 flex-col px-4 pt-6 pb-4 md:rounded-tl-xl md:bg-surface-container-lowest md:px-8">
            <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col">{children}</div>
          </div>
        </div>
      </ChatHistoryProvider>
    </Suspense>
  );
}
