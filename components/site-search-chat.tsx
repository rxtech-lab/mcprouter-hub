"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, validateUIMessages, type UIMessage } from "ai";
import { ArrowUp, RotateCcw, Square } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatAllowance } from "@/components/agent/chat-allowance";
import { MessageParts, toTurns, TypingDots } from "@/components/agent/chat-panel";
import { McpAppHost } from "@/components/agent/tool-app";
import type { ChatAllowance as Allowance } from "@/lib/chat-allowance";
import { useT } from "@/lib/i18n/client";

const storageKey = "site-search-chat-messages";

function saveMessages(messages: UIMessage[]) {
  try {
    if (messages.length) localStorage.setItem(storageKey, JSON.stringify(messages));
    else localStorage.removeItem(storageKey);
  } catch {
    // Chat remains usable when storage is blocked or full.
  }
}

/** Shares the existing server-enforced chat allowance and full MCP agent renderer. */
export default function SiteSearchChat({ initialQuestion, active }: { initialQuestion?: string; active: boolean }) {
  const t = useT();
  const [input, setInput] = useState("");
  const [allowance, setAllowance] = useState<Allowance | null>(null);
  const [restored, setRestored] = useState(false);
  const initialSent = useRef(false);
  const composer = useRef<HTMLTextAreaElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const { messages, setMessages, sendMessage, status, stop, error, clearError } = useChat({ transport: new DefaultChatTransport({ api: "/api/free-chat" }) });
  const busy = status === "submitted" || status === "streaming";
  const usedUp = allowance?.kind === "guest" && allowance.quota.remaining === 0;
  const turns = useMemo(() => toTurns(messages), [messages]);
  const send = useCallback((text: string) => {
    if (!text.trim() || busy || usedUp || !restored) return;
    clearError();
    void sendMessage({ text: text.trim() });
    setInput("");
  }, [busy, usedUp, restored, clearError, sendMessage]);

  useEffect(() => {
    let active = true;
    const restore = async () => {
      let saved: UIMessage[] = [];
      try {
        const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
        if (Array.isArray(parsed)) saved = await validateUIMessages({ messages: parsed });
      } catch {
        // Ignore corrupt or incompatible history, including unavailable storage.
      }
      if (!active) return;
      setMessages(saved);
      setRestored(true);
    };
    void restore();
    return () => { active = false; };
  }, [setMessages]);
  useEffect(() => {
    if (restored && !busy) saveMessages(messages);
  }, [restored, busy, messages]);

  useEffect(() => {
    if (!restored || initialSent.current || !initialQuestion || !allowance || !active) return;
    initialSent.current = true;
    send(initialQuestion);
  }, [restored, initialQuestion, allowance, active, send]);
  useEffect(() => { if (active && allowance) composer.current?.focus(); }, [active, allowance]);
  useEffect(() => { if (!active) void stop(); }, [active, stop]);
  useEffect(() => { if (active) bottom.current?.scrollIntoView({ block: "nearest" }); }, [messages, active]);

  return <section aria-label={t("Chat")} className="flex min-h-0 flex-1 flex-col">
    <div className="flex items-center justify-between px-5 pb-2">
      <p className="type-body-small text-on-surface-variant">{t("Ask a question, then keep the conversation going.")}</p>
      <button type="button" aria-label={t("New chat")} disabled={!restored} onClick={() => { initialSent.current = true; void stop(); setMessages([]); saveMessages([]); setInput(""); clearError(); }} className="state-layer flex size-9 shrink-0 items-center justify-center rounded-full"><RotateCcw size={18} /></button>
    </div>
    <div className="min-h-32 flex-1 overflow-y-auto overscroll-contain px-5 py-3" aria-live="polite" data-testid="search-chat-messages">
      <McpAppHost canCallTools={false} sendMessage={send}>
        <ul className="flex flex-col gap-4">
          {turns.map((turn) => <li key={turn.id} className="flex flex-col gap-3">
            {turn.user ? <div className="max-w-[90%] self-end rounded-lg rounded-br-xs bg-primary px-4 py-2 type-body-medium text-on-primary" data-testid="user-message"><MessageParts message={turn.user} /></div> : null}
            {turn.replies.map((message) => <div key={message.id} className="type-body-medium" data-testid="agent-message"><MessageParts message={message} onAnswer={send} inputDisabled={message.id !== messages.at(-1)?.id || busy || usedUp} /></div>)}
          </li>)}
          {busy ? <li><TypingDots /></li> : null}
        </ul>
      </McpAppHost>
      <div ref={bottom} />
    </div>
    <div className="px-3 pb-3">
      <form onSubmit={(event) => { event.preventDefault(); send(input); }} className="flex items-end gap-2 rounded-lg border border-outline-variant bg-surface-container-high p-2 pl-4 focus-within:border-primary">
        <textarea ref={composer} aria-label={t("Message")} value={input} maxLength={2000} rows={1} disabled={usedUp || !allowance || !restored} placeholder={t("Ask the agent")} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(input); } }} className="max-h-28 min-h-10 min-w-0 flex-1 resize-none bg-transparent py-2 type-body-large outline-none" />
        {busy ? <button type="button" aria-label={t("Stop")} onClick={() => void stop()} className="state-layer flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary-container"><Square size={18} /></button> : <button type="submit" aria-label={t("Send")} disabled={!input.trim() || usedUp || !allowance || !restored} className="state-layer flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary disabled:opacity-40"><ArrowUp size={20} /></button>}
      </form>
      <ChatAllowance status={status} onChange={setAllowance} />
    </div>
    {error || usedUp ? <div role="alert" className="absolute inset-x-3 bottom-28 z-10 rounded-lg bg-error-container px-4 py-3 type-body-medium text-on-error-container shadow-elevation-2">{error?.message ?? t("No free messages left today")}</div> : null}
  </section>;
}
