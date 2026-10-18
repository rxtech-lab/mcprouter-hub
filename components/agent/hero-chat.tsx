"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ArrowUp, CircleAlert, LoaderCircle, RotateCcw, Square } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { IconButton } from "@/components/m3/button";
import { cn } from "@/components/m3/cn";
import type { FreeChatQuota } from "@/lib/free-chat";
import { getFreeChatQuota } from "@/lib/free-chat-actions";
import { useT } from "@/lib/i18n/client";
import { MessageParts, SUGGESTIONS } from "./chat-panel";
import { McpAppHost } from "./tool-app";

/** The free, signed-out agent, embedded in the landing page hero. */
export function HeroChat({ dailyLimit }: { dailyLimit: number }) {
  const t = useT();
  const [input, setInput] = useState("");
  const [quota, setQuota] = useState<FreeChatQuota | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const refreshQuota = async () => {
    const result = await getFreeChatQuota();
    if (result.ok) setQuota(result.data);
  };
  // The page is static, so the visitor's allowance is fetched once it loads.
  useEffect(() => {
    let active = true;
    void getFreeChatQuota().then((result) => {
      if (active && result.ok) setQuota(result.data);
    });
    return () => {
      active = false;
    };
  }, []);

  const { messages, setMessages, sendMessage, status, stop } = useChat({
    // Free chats aren't stored, so the whole conversation goes with each message.
    transport: new DefaultChatTransport({ api: "/api/free-chat" }),
    onError: (failure) => {
      setError(failure.message || t("The agent could not answer. Try again."));
      void refreshQuota();
    },
    onFinish: () => void refreshQuota(),
  });
  const busy = status === "submitted" || status === "streaming";
  const usedUp = quota?.remaining === 0;

  // Follow the answer as it streams in.
  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const send = (text: string) => {
    if (!text.trim() || busy || usedUp) return;
    setError(null);
    setQuota((current) => (current ? { ...current, remaining: Math.max(0, current.remaining - 1), used: current.used + 1 } : current));
    void sendMessage({ text: text.trim() });
    setInput("");
  };
  // Follow-ups asked from inside an MCP App. Visitors' apps can't call tools: those calls would bypass the free allowance.
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  });
  const askFromApp = useCallback((text: string) => sendRef.current(text), []);

  return (
    <div id="try" className="flex h-[32rem] scroll-mt-24 flex-col overflow-hidden rounded-xl bg-surface-container-lowest text-on-surface shadow-elevation-2" data-testid="hero-chat">
      <div className="flex items-center gap-3 border-b border-outline-variant py-2 pr-2 pl-5">
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
        </span>
        <h2 className="flex-1 type-title-small">{t("Ask the Hong Kong agent")}</h2>
        {messages.length > 0 ? (
          <IconButton
            label={t("New chat")}
            onClick={() => {
              stop();
              setMessages([]);
              setError(null);
            }}
          >
            <RotateCcw size={18} />
          </IconButton>
        ) : (
          <span className="h-10" />
        )}
      </div>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-5 py-4" aria-live="polite">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col justify-end gap-3">
            <p className="max-w-[85%] rounded-lg rounded-bl-xs bg-surface-container-high px-4 py-2 type-body-medium">
              {t("Hi! I check live government data for you: weather, buses, MTR, A&E waits and more. What do you want to know?")}
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.slice(0, 4).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  disabled={usedUp}
                  onClick={() => send(t(suggestion))}
                  className="state-layer cursor-pointer rounded-sm border border-outline px-3 py-1.5 text-left type-label-large text-on-surface-variant disabled:cursor-default disabled:opacity-40"
                >
                  {t(suggestion)}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <McpAppHost canCallTools={false} sendMessage={askFromApp}>
            <ul className="flex flex-col gap-4">
              {messages.map((message) =>
                message.role === "user" ? (
                  <li key={message.id} className="max-w-[85%] self-end rounded-lg rounded-br-xs bg-primary px-4 py-2 type-body-medium text-on-primary" data-testid="user-message">
                    <MessageParts message={message} />
                  </li>
                ) : (
                  <li key={message.id} className="type-body-medium" data-testid="agent-message">
                    <MessageParts message={message} />
                  </li>
                ),
              )}
              {status === "submitted" ? (
                <li className="flex items-center gap-2 type-body-medium text-on-surface-variant">
                  <LoaderCircle size={16} className="animate-spin" /> {t("Thinking…")}
                </li>
              ) : null}
            </ul>
          </McpAppHost>
        )}
      </div>

      <div className="px-3 pb-3">
        <form
          className="flex items-end gap-2 rounded-xl border-2 border-transparent bg-surface-container-high p-1.5 pl-4 transition-colors focus-within:border-primary"
          onSubmit={(event) => {
            event.preventDefault();
            send(input);
          }}
        >
          <textarea
            aria-label={t("Message")}
            rows={1}
            value={input}
            disabled={usedUp}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                send(input);
              }
            }}
            placeholder={usedUp ? t("No free messages left today") : t("Ask about weather, buses, MTR…")}
            className="max-h-28 min-h-10 flex-1 resize-none bg-transparent py-2 type-body-large outline-none placeholder:text-on-surface-variant disabled:opacity-60"
          />
          {busy ? (
            <IconButton label={t("Stop")} variant="tonal" onClick={() => stop()}>
              <Square size={18} />
            </IconButton>
          ) : (
            <IconButton label={t("Send")} variant="filled" type="submit" disabled={usedUp || !input.trim()}>
              <ArrowUp size={20} />
            </IconButton>
          )}
        </form>
        <p role="status" className={cn("mt-2 flex items-center gap-1.5 px-2 type-body-small", error || usedUp ? "text-error" : "text-on-surface-variant")}>
          {error || usedUp ? <CircleAlert size={14} className="shrink-0" /> : null}
          <span className="min-w-0 flex-1">
            {error ??
              (usedUp
                ? t("You've used today's {limit} free messages. More at midnight Hong Kong time.", { limit: quota?.limit ?? dailyLimit })
                : t("{remaining} of {limit} free messages left today. Not saved.", { remaining: quota?.remaining ?? dailyLimit, limit: quota?.limit ?? dailyLimit }))}
          </span>
          <Link href="/login" className="shrink-0 type-label-large text-primary hover:underline">
            {t("Sign in for more")}
          </Link>
        </p>
      </div>
    </div>
  );
}
