"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Maximize2, MessageSquareText, Minus, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, type RefObject, createContext, useContext, useEffect, useImperativeHandle, useRef, useState, useTransition } from "react";
import { ChatPanel } from "@/components/agent/chat-panel";
import { ChatAllowance } from "@/components/agent/chat-allowance";
import { Button, IconButton } from "@/components/m3/button";
import { cn } from "@/components/m3/cn";
import { useT } from "@/lib/i18n/client";

const ToolDraftContext = createContext<(name: string) => void>(() => {});

export function ApiToolButton({ name }: { name: string }) {
  const select = useContext(ToolDraftContext);
  return <button type="button" onClick={() => select(name)} className="state-layer inline-flex max-w-full cursor-pointer items-center gap-2 rounded-sm p-1 text-left text-primary"><code className="break-all font-mono text-[13px]">{name}</code><MessageSquareText aria-hidden size={16} className="shrink-0" /></button>;
}

/** The native modal keeps the conversation mounted when switching between centered and fullscreen views. */
export function ApiDialog({ apiId, serviceId, title, description, closeHref, actions, children, canChat }: {
  apiId: string; title: string; description: ReactNode; closeHref: string;
  serviceId?: string;
  actions?: ReactNode; children: ReactNode; canChat: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const t = useT();
  const dialog = useRef<HTMLDialogElement>(null);
  const split = useRef<HTMLDivElement>(null);
  const fullScreen = params.get("fullscreen") === "1";
  const [draft, setDraft] = useState("");
  const chatInput = useRef<HTMLTextAreaElement>(null);
  const toolSender = useRef<((name: string) => void) | null>(null);
  const focusRequested = useRef(false);
  const tab = params.get("panel") === "details" || !canChat ? "details" : "chat";
  const [width, setWidth] = useState(40);
  const [, startTransition] = useTransition();

  function view(update: Record<string, string | null>) {
    const next = new URL(window.location.href);
    for (const [key, value] of Object.entries(update)) {
      if (value === null) next.searchParams.delete(key);
      else next.searchParams.set(key, value);
    }
    window.history.replaceState(null, "", next);
  }

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    if (focusRequested.current && tab === "chat") {
      chatInput.current?.focus();
      focusRequested.current = false;
    }
  }, [tab, draft]);

  function close() {
    dialog.current?.close();
    startTransition(() => router.replace(closeHref, { scroll: false }));
  }

  function resize(clientX: number) {
    const rect = split.current?.getBoundingClientRect();
    if (rect) setWidth(Math.max(25, Math.min(65, ((clientX - rect.left) / rect.width) * 100)));
  }

  return (
    <ToolDraftContext.Provider value={(name) => {
      toolSender.current?.(name);
      if (tab === "chat") chatInput.current?.focus();
      focusRequested.current = true;
      view({ panel: "chat" });
    }}>
      <dialog
        ref={dialog}
        aria-labelledby={`api-title-${apiId}`}
        className={cn("fixed inset-0 max-h-none max-w-none overflow-hidden border-0 bg-surface-container-high text-on-surface shadow-elevation-3 backdrop:bg-scrim/40 open:flex open:flex-col transition-[opacity,scale,width,height,border-radius] duration-300 ease-emphasized starting:scale-98 starting:opacity-0", fullScreen ? "m-0 h-dvh w-screen rounded-none" : "m-auto h-[min(800px,90dvh)] w-[min(1100px,calc(100vw-32px))] rounded-xl")}
        onCancel={(event) => { event.preventDefault(); close(); }}
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-outline-variant px-4 py-3 md:px-6">
          <MessageSquareText size={22} className="shrink-0 text-primary" />
          <h2 id={`api-title-${apiId}`} className="min-w-0 flex-1 truncate type-title-large">{title}</h2>
          <IconButton label={fullScreen ? t("Minimize") : t("Full screen")} onClick={() => view({ fullscreen: fullScreen ? null : "1", minimized: null })}>{fullScreen ? <Minus size={20} /> : <Maximize2 size={20} />}</IconButton>
          <IconButton label={t("Close")} onClick={close}><X size={20} /></IconButton>
        </header>
        {canChat ? (
          <nav aria-label={t("API workspace")} className="flex shrink-0 gap-2 border-b border-outline-variant p-2 md:hidden">
            <Button variant={tab === "details" ? "tonal" : "text"} aria-pressed={tab === "details"} onClick={() => view({ panel: "details" })}>{t("Details & tools")}</Button>
            <Button variant={tab === "chat" ? "tonal" : "text"} aria-pressed={tab === "chat"} onClick={() => view({ panel: "chat" })}>{t("Chat")}</Button>
          </nav>
        ) : null}
        <div ref={split} className="flex min-h-0 flex-1" style={{ "--details-width": `${width}%` } as React.CSSProperties}>
          <aside className={cn("min-h-0 w-full shrink-0 overflow-y-auto p-5 md:p-6", canChat ? "md:w-[var(--details-width)]" : "mx-auto max-w-3xl", tab !== "details" && "max-md:hidden")} aria-label={t("API details and tools")}>
            <p className="mb-5 type-body-medium text-on-surface-variant">{description}</p>
            {children}
            <div className="mt-6 flex flex-wrap gap-2">{actions}</div>
          </aside>
          {canChat ? (
            <>
              <div
                role="separator" tabIndex={0} aria-label={t("Resize panels")} aria-orientation="vertical"
                aria-valuemin={25} aria-valuemax={65} aria-valuenow={Math.round(width)}
                className="group hidden w-3 shrink-0 touch-none cursor-col-resize items-center justify-center outline-none hover:bg-primary/10 focus-visible:bg-primary/10 md:flex"
                onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); resize(event.clientX); }}
                onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) resize(event.clientX); }}
                onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "Home" || event.key === "End") {
                    event.preventDefault();
                    setWidth((value) => event.key === "Home" ? 25 : event.key === "End" ? 65 : Math.max(25, Math.min(65, value + (event.key === "ArrowRight" ? 2 : -2))));
                  }
                }}
              ><span className="h-12 w-1 rounded-full bg-outline-variant group-hover:bg-primary" /></div>
              <section className={cn("relative flex min-h-0 min-w-0 flex-1 flex-col bg-surface-container-low p-4 [--chat-surface:var(--md-sys-color-surface-container-low)] md:p-6", tab !== "chat" && "max-md:hidden")} aria-label={t("Chat with this API")}>
                <ProviderChat apiId={apiId} serviceId={serviceId} title={title} draft={draft} setDraft={setDraft} inputRef={chatInput} toolSender={toolSender} />
              </section>
            </>
          ) : null}
        </div>
      </dialog>
    </ToolDraftContext.Provider>
  );
}

function ProviderChat({ apiId, serviceId, title, draft, setDraft, inputRef, toolSender }: { apiId: string; serviceId?: string; title: string; draft: string; setDraft: (value: string) => void; inputRef: RefObject<HTMLTextAreaElement | null>; toolSender: RefObject<((name: string) => void) | null> }) {
  const t = useT();
  const [transport] = useState(() => new DefaultChatTransport({ api: "/api/provider-chat", body: serviceId ? { serviceId } : { apiId } }));
  const [error, setError] = useState<string | null>(null);
  const { messages, sendMessage, status, stop } = useChat({
    id: `api-${apiId}`, transport,
    onError: (error) => setError(error.message || t("The agent could not answer. Try again.")),
  });
  useImperativeHandle(toolSender, () => (name: string) => {
    setError(null);
    void sendMessage({ text: `Use this tool: ${name}` });
  }, [sendMessage]);
  return (
    <>
      {error ? <div role="alert" className="absolute top-2 right-2 left-2 z-10 flex items-center gap-2 rounded-lg bg-error-container p-3 text-on-error-container shadow-elevation-3"><p className="flex-1 type-body-medium">{error}</p><IconButton label={t("Dismiss")} onClick={() => setError(null)}><X size={18} /></IconButton></div> : null}
      <ChatPanel
        messages={messages} status={status} title={t("Chat with this API")}
        intro={t("Ask about {title}. Only the tools listed in the details panel are available here.", { title })}
        suggestions={[]} inputValue={draft} onInputChange={setDraft} inputRef={inputRef}
        onSend={(text) => { setError(null); void sendMessage({ text }); }} onStop={() => stop()}
        notice={<ChatAllowance status={status} />}
        placeholder={t("Ask about {title}…", { title })}
      />
    </>
  );
}
