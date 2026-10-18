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
        {/* Clipped so the history slides out from behind the rail. */}
        <div className="flex h-[calc(100dvh-4rem)] overflow-hidden md:h-dvh">
          <ChatSidebar />
          {/* Overlaps the sidebar by its corner radius, so the rounded corner shows the history pane behind it. */}
          <div className="relative flex min-w-0 flex-1 animate-pane-in flex-col px-4 pt-2 pb-4 md:pt-6 md:-ml-7 md:rounded-tl-xl md:bg-surface-container-lowest md:px-8 md:[animation-delay:200ms]">
            <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col">{children}</div>
          </div>
        </div>
      </ChatHistoryProvider>
    </Suspense>
  );
}
