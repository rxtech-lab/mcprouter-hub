"use client";

import { trackEvent } from "@/lib/analytics";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowUp, ChevronDown, ChevronUp, CircleAlert, Maximize2, MessageSquareText, Minimize2, RotateCcw, Square } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button, IconButton } from "@/components/m3/button";
import { cn } from "@/components/m3/cn";
import type { FreeChatQuota } from "@/lib/free-chat";
import { getFreeChatQuota } from "@/lib/free-chat-actions";
import { useT } from "@/lib/i18n/client";
import { MessageParts, SUGGESTIONS, TypingDots } from "./chat-panel";
import { McpAppHost } from "./tool-app";

/** Below Tailwind's `md` breakpoint the chat leaves the hero and docks at the bottom of the screen. */
const mobileQuery = "(max-width: 767px)";

/** The free chat isn't stored on the server, so the conversation is kept in this browser instead. */
const storageKey = "hero-chat-messages";

function loadMessages(): UIMessage[] {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveMessages(messages: UIMessage[]) {
  try {
    if (messages.length === 0) localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, JSON.stringify(messages));
  } catch {
    // Storage is full or blocked (private mode): the chat still works, it just isn't kept.
  }
}

/** Fired by the hero's "Ask the agent" button to pull the docked sheet up on phones. */
const openEvent = "hero-chat:open";

function subscribeToMobile(onChange: () => void) {
  const query = window.matchMedia(mobileQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * The free, signed-out agent, embedded in the landing page hero. On phones it is a small sheet
 * docked at the bottom of the screen that grows into a full-screen chat when tapped. On larger
 * screens it can be expanded to fill the window.
 */
export function HeroChat({ dailyLimit }: { dailyLimit: number }) {
  const t = useT();
  const [input, setInput] = useState("");
  const [quota, setQuota] = useState<FreeChatQuota | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const mobile = useSyncExternalStore(subscribeToMobile, () => window.matchMedia(mobileQuery).matches, () => false);
  const [expanded, setExpanded] = useState(false);
  const open = !mobile || expanded;
  const fullScreen = !mobile && expanded;

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

  // Restore the last conversation once mounted (localStorage isn't available while server rendering).
  const restored = useRef(false);
  useEffect(() => {
    const saved = loadMessages();
    if (saved.length > 0) setMessages(saved);
    restored.current = true;
  }, [setMessages]);
  // Save once each answer settles rather than on every streamed token.
  useEffect(() => {
    if (restored.current && !busy) saveMessages(messages);
  }, [messages, busy]);
  const usedUp = quota?.remaining === 0;

  // Follow the answer as it streams in.
  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const send = (text: string) => {
    if (!text.trim() || busy || usedUp) return;
    trackEvent("chat_message_sent", { chat_type: "guest" });
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

  useEffect(() => {
    const onOpen = () => setExpanded(true);
    window.addEventListener(openEvent, onOpen);
    return () => window.removeEventListener(openEvent, onOpen);
  }, []);

  // The full-screen chat owns the screen: the page behind it stops scrolling and Escape folds it back down.
  useEffect(() => {
    if (!expanded) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [expanded]);

  const remaining = quota?.remaining ?? dailyLimit;
  const limit = quota?.limit ?? dailyLimit;
  const lastMessage = messages.at(-1);
  const preview = lastMessage?.parts.findLast((part) => part.type === "text")?.text;

  const panel = (
    <div
      id="try"
      className={cn(
        "flex flex-col overflow-hidden bg-surface-container-lowest text-on-surface",
        mobile
          ? cn(
              "fixed inset-x-0 bottom-0 z-[35] animate-snackbar-in transition-[height,border-radius,box-shadow] duration-500 ease-emphasized",
              expanded ? "h-dvh rounded-none shadow-none" : "h-[calc(4.5rem+env(safe-area-inset-bottom))] rounded-t-xl shadow-elevation-3",
            )
          : fullScreen
            ? "fixed inset-0 z-[60] animate-pane-in"
            : // Rendered on the server too, so phones keep it out of the hero until the sheet takes over.
              "h-[32rem] scroll-mt-24 rounded-xl shadow-elevation-2 max-md:hidden",
      )}
      data-testid="hero-chat"
    >
      {!open ? (
        // The whole collapsed sheet is the tap target.
        <button
          type="button"
          aria-label={t("Ask the agent")}
          aria-expanded={false}
          aria-controls="try-body"
          onClick={() => setExpanded(true)}
          className="state-layer absolute inset-0 z-10 cursor-pointer rounded-[inherit]"
        />
      ) : null}
      {mobile ? (
        <span aria-hidden className={cn("mx-auto mt-1.5 h-1 w-8 shrink-0 rounded-full bg-outline-variant transition-opacity duration-300", expanded && "opacity-0")} />
      ) : null}
      <div className={cn("relative flex shrink-0 items-center gap-3 py-2 pr-2 pl-5 transition-colors duration-300", open ? "border-b border-outline-variant" : "border-b border-transparent")}>
        <span className="relative flex size-2.5 shrink-0">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="type-title-small">{t("Ask the agent")}</h2>
          {!open ? (
            <p className="truncate type-body-small text-on-surface-variant">
              {busy ? t("Thinking…") : (preview ?? t("{remaining} of {limit} free messages left today. Saved in this browser only.", { remaining, limit }))}
            </p>
          ) : null}
        </div>
        {!open ? (
          <ChevronUp aria-hidden size={20} className="mr-2 shrink-0 text-on-surface-variant" />
        ) : messages.length > 0 ? (
          <IconButton
            label={t("New chat")}
            onClick={() => {
              stop();
              setMessages([]);
              saveMessages([]);
              setError(null);
            }}
          >
            <RotateCcw size={18} />
          </IconButton>
        ) : (
          <span className="h-10" />
        )}
        {mobile && expanded ? (
          <IconButton label={t("Close")} aria-expanded aria-controls="try-body" onClick={() => setExpanded(false)}>
            <ChevronDown size={20} />
          </IconButton>
        ) : !mobile ? (
          <IconButton label={fullScreen ? t("Exit full screen") : t("Full screen")} aria-pressed={fullScreen} onClick={() => setExpanded((value) => !value)}>
            {fullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </IconButton>
        ) : null}
      </div>

      <div id="try-body" inert={!open} className={cn("flex min-h-0 flex-1 flex-col transition-opacity duration-300 ease-emphasized", open ? "opacity-100 delay-100" : "opacity-0")}>
        {/* Full screen scrolls edge to edge; only the conversation itself stays at a readable width. */}
        <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-5 py-4" aria-live="polite">
          <div className={cn("h-full", fullScreen && "mx-auto max-w-3xl")}>
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
                  {busy ? (
                    <li>
                      <TypingDots />
                    </li>
                  ) : null}
                </ul>
              </McpAppHost>
            )}
          </div>
        </div>

        <div className={cn("px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]", fullScreen && "w-full max-w-3xl self-center")}>
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
              className="max-h-28 min-h-10 min-w-0 flex-1 resize-none bg-transparent py-2 type-body-large outline-none placeholder:truncate placeholder:text-on-surface-variant disabled:opacity-60"
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
                  ? t("You've used today's {limit} free messages. More at midnight Hong Kong time.", { limit })
                  : t("{remaining} of {limit} free messages left today. Saved in this browser only.", { remaining, limit }))}
            </span>
            <Link href="/login" className="shrink-0 type-label-large text-primary hover:underline">
              {t("Sign in for more")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );

  // On phones (and in full screen) the chat lives on <body>: the hero's entrance animation would otherwise
  // trap `position: fixed`. A placeholder holds its spot in the hero meanwhile.
  if (mobile) return createPortal(panel, document.body);
  if (fullScreen) return <>{createPortal(panel, document.body)}<div aria-hidden className="h-[32rem] rounded-xl bg-surface-container-low max-md:hidden" /></>;
  return panel;
}

/** Hero call to action on phones, where the chat is docked below the fold: opens it full screen. */
export function HeroChatButton({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <Button variant="tonal" icon={<MessageSquareText size={18} />} onClick={() => window.dispatchEvent(new Event(openEvent))} className={className}>
      {children}
    </Button>
  );
}
