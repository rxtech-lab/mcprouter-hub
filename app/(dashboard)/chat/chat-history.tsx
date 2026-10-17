"use client";

import { History, LoaderCircle, MessageSquarePlus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button, ButtonLink, IconButton } from "@/components/m3/button";
import { cn } from "@/components/m3/cn";
import { ConfirmDialog, Dialog } from "@/components/m3/dialog";
import { useSnackbar } from "@/components/m3/snackbar";
import { useActionRunner } from "@/components/use-action-runner";
import { formatRelative } from "@/lib/format";
import type { ChatPage, ChatSummary } from "@/lib/chat-store";
import { deleteChatHistory, listChatHistory } from "./actions";

type ChatHistoryState = {
  items: ChatSummary[];
  nextCursor: string | null;
  loading: boolean;
  query: string;
  activeId: string | null;
  loadMore: () => void;
  /** Reloads the first page, e.g. after a chat gets a new message. */
  refresh: () => void;
  remove: (id: string) => void;
};

const ChatHistoryContext = createContext<ChatHistoryState | null>(null);

export function useChatHistory() {
  return use(ChatHistoryContext);
}

export function ChatHistoryProvider({ initial, children }: { initial: ChatPage; children: ReactNode }) {
  const snackbar = useSnackbar();
  const pathname = usePathname();
  const query = useSearchParams().get("q") ?? "";
  const [page, setPage] = useState(initial);
  const [loading, setLoading] = useState(false);
  const request = useRef(0);
  const activeId = pathname.match(/^\/chat\/([^/]+)/)?.[1] ?? null;

  const fetchPage = useCallback(
    async (cursor: string | null) => {
      const id = ++request.current;
      setLoading(true);
      const result = await listChatHistory({ cursor, query });
      if (id !== request.current) return;
      setLoading(false);
      if (!result.ok) {
        snackbar.show(result.error, { tone: "error" });
        return;
      }
      setPage((current) => (cursor ? { items: [...current.items, ...result.data.items], nextCursor: result.data.nextCursor } : result.data));
    },
    [query, snackbar],
  );

  // The layout renders the unfiltered first page; a search in the URL loads its own.
  const first = useRef(true);
  useEffect(() => {
    if (first.current && !query) {
      first.current = false;
      return;
    }
    first.current = false;
    void fetchPage(null);
  }, [fetchPage, query]);

  const value: ChatHistoryState = {
    ...page,
    loading,
    query,
    activeId,
    loadMore: () => {
      if (page.nextCursor && !loading) void fetchPage(page.nextCursor);
    },
    refresh: () => void fetchPage(null),
    remove: (id) => setPage((current) => ({ ...current, items: current.items.filter((item) => item.id !== id) })),
  };
  return <ChatHistoryContext value={value}>{children}</ChatHistoryContext>;
}

function SearchField() {
  const history = useChatHistory();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [text, setText] = useState(history?.query ?? "");

  // The search lives in `?q=`. Written with history.replaceState so an open chat isn't re-rendered.
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (text.trim()) params.set("q", text.trim());
      else params.delete("q");
      const next = params.toString();
      if (next !== searchParams.toString()) window.history.replaceState(null, "", next ? `${pathname}?${next}` : pathname);
    }, 300);
    return () => clearTimeout(timer);
  }, [text, pathname, searchParams]);

  return (
    <label className="flex h-10 items-center gap-2 rounded-full border-2 border-transparent bg-surface-container-high px-4 text-on-surface-variant transition-colors focus-within:border-primary md:h-12">
      <Search size={18} />
      <input
        type="search"
        aria-label="Search chats"
        placeholder="Search chats"
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="min-w-0 flex-1 bg-transparent type-body-medium text-on-surface outline-none placeholder:text-on-surface-variant"
      />
    </label>
  );
}

function HistoryList({ onNavigate }: { onNavigate?: () => void }) {
  const history = useChatHistory();
  const router = useRouter();
  const { pending, run } = useActionRunner();
  const [deleting, setDeleting] = useState<ChatSummary | null>(null);
  if (!history) return null;

  return (
    <>
      {history.items.length === 0 && !history.loading ? (
        <p className="px-4 py-6 text-center type-body-medium text-on-surface-variant">{history.query ? "No chats match your search." : "Your chats will appear here."}</p>
      ) : null}
      <ul className="flex flex-col gap-0.5" data-testid="chat-history">
        {history.items.map((item) => {
          const active = item.id === history.activeId;
          return (
            <li key={item.id} className="group relative">
              <Link
                href={`/chat/${item.id}`}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "state-layer flex h-14 flex-col justify-center rounded-full pr-12 pl-4",
                  active ? "bg-secondary-container text-on-secondary-container" : "text-on-surface-variant",
                )}
              >
                <span className={cn("truncate type-label-large", active ? undefined : "text-on-surface")}>{item.title}</span>
                <span className={cn("type-body-small", active ? "text-on-secondary-container/80" : "text-on-surface-variant")}>{formatRelative(item.updatedAt)}</span>
              </Link>
              <IconButton
                label={`Delete “${item.title}”`}
                onClick={() => setDeleting(item)}
                className="absolute top-1/2 right-1 -translate-y-1/2 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 max-md:opacity-100"
              >
                <Trash2 size={18} />
              </IconButton>
            </li>
          );
        })}
      </ul>
      {history.loading ? (
        <div className="flex justify-center py-3 text-on-surface-variant" role="status" aria-label="Loading chats">
          <LoaderCircle size={20} className="animate-spin" />
        </div>
      ) : history.nextCursor ? (
        <div className="flex justify-center py-2">
          <Button variant="text" onClick={history.loadMore}>Load more</Button>
        </div>
      ) : null}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete chat?"
        description={deleting ? `“${deleting.title}” and all its messages will be deleted. This can't be undone.` : ""}
        confirmLabel="Delete"
        destructive
        pending={pending}
        onConfirm={() => {
          if (!deleting) return;
          const target = deleting;
          run(() => deleteChatHistory({ id: target.id }), { progress: "Deleting chat…", success: "Chat deleted" }, () => {
            setDeleting(null);
            history.remove(target.id);
            if (target.id === history.activeId) router.push("/chat");
          });
        }}
      />
    </>
  );
}

/** Chat history beside the conversation on medium screens and up. */
export function ChatSidebar() {
  return (
    <aside className="hidden w-72 shrink-0 flex-col gap-3 bg-surface pt-4 pr-3 md:flex" aria-label="Chat history">
      <ButtonLink href="/chat" variant="tonal" icon={<MessageSquarePlus size={20} />} className="h-14 self-start rounded-lg px-5 shadow-elevation-1">New chat</ButtonLink>
      <SearchField />
      <h2 className="px-4 pt-2 type-title-small text-on-surface-variant">Recent</h2>
      <div className="-mr-3 min-h-0 flex-1 overflow-y-auto pr-3 pb-4">
        <HistoryList />
      </div>
    </aside>
  );
}

/** On small screens the history opens in a dialog from the chat header. */
export function ChatHistoryButton() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-1 md:hidden">
      <Link href="/chat" aria-label="New chat" title="New chat" className="state-layer inline-flex size-10 items-center justify-center rounded-full text-on-surface-variant">
        <MessageSquarePlus size={20} />
      </Link>
      <IconButton label="Chat history" onClick={() => setOpen(true)}>
        <History size={20} />
      </IconButton>
      <Dialog open={open} onOpenChange={setOpen} title="Chats" className="h-[80vh]">
        <div className="flex flex-col gap-3">
          <SearchField />
          <HistoryList onNavigate={() => setOpen(false)} />
        </div>
      </Dialog>
    </div>
  );
}

