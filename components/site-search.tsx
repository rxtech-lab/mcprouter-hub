"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Database, Home, LoaderCircle, MessageSquareText, CornerDownLeft, Search, Wallet, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "@/components/localized-link";
import { useT } from "@/lib/i18n/client";
import type { SearchDestination } from "@/lib/site-search/types";
import { requestSiteSearch } from "@/lib/site-search/request";

const SearchChat = dynamic(() => import("@/components/site-search-chat"));
const icons = { home: Home, sources: Database, guides: BookOpen, pricing: Wallet };

function changeUrl(text: string | null, view = "search") {
  const url = new URL(window.location.href);
  if (text === null) { url.searchParams.delete("search"); url.searchParams.delete("searchView"); }
  else { url.searchParams.set("search", text); url.searchParams.set("searchView", view); }
  window.history.replaceState(null, "", url);
}

/** URL holds the search/view; conversation history is stored separately in this browser. */
export function SiteSearch({ destinations, active }: { destinations: SearchDestination[]; active?: string }) {
  const t = useT();
  const params = useSearchParams();
  const query = (params.get("search") ?? "").slice(0, 2000);
  const opened = params.has("search");
  const chatting = params.get("searchView") === "chat";
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const decision = useRef<AbortController | null>(null);
  const id = useId();
  const [selected, setSelected] = useState(-1);
  const [found, setFound] = useState<{ query: string; results: SearchDestination[]; intent: "search" | "chat" }>({ query: "", results: destinations, intent: "search" });
  const [error, setError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState(false);
  const [chat, setChat] = useState<{ id: string; question?: string } | null>(null);
  const results = query === found.query ? found.results : [];
  const searching = query !== found.query;
  const recommendChat = query === found.query && found.intent === "chat" && Boolean(query.trim());
  const resultOffset = recommendChat ? 1 : 0;
  const commandCount = results.length + resultOffset;
  const enterChat = () => {
    decision.current?.abort();
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    setDeciding(false);
    setChat({ id: crypto.randomUUID(), question: query });
    // Only an explicit selection starts the private conversation.
    changeUrl("", "chat");
  };

  const showChat = () => {
    decision.current?.abort();
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    setDeciding(false);
    setError(null);
    if (!chat) setChat({ id: crypto.randomUUID() });
    changeUrl("", "chat");
  };
  const open = () => { changeUrl(""); setSelected(-1); setError(null); };
  const close = () => { decision.current?.abort(); if (debounceTimer.current) clearTimeout(debounceTimer.current); setDeciding(false); changeUrl(null); };
  const executeSearch = useCallback(async (text: string, controller: AbortController) => {
    setDeciding(Boolean(text.trim())); setError(null);
    await requestSiteSearch(text, t.locale, controller.signal, {
      results: (data, source) => {
        // A late text response must preserve a decision already received.
        setFound((previous) => ({ query: text, results: data.results, intent: source === "decision" ? data.intent : previous.query === text ? previous.intent : "search" }));
        if (source === "decision" && data.intent === "chat") setSelected(0);
      },
      routingUnavailable: () => setError(t("AI routing is unavailable. Showing text matches.")),
      routingComplete: () => { if (decision.current === controller) setDeciding(false); },
      unavailable: () => { setFound({ query: text, results: [], intent: "search" }); setError(t("Search is unavailable. Try again or open the catalogue.")); },
    });
  }, [t, setDeciding, setError, setFound, setSelected]);
  const submit = () => {
    if (recommendChat) { enterChat(); return; }
    if (!query.trim() || deciding) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    const controller = new AbortController();
    decision.current?.abort(); decision.current = controller;
    void executeSearch(query, controller);
  };

  useEffect(() => {
    if (opened) { if (!dialog.current?.open) dialog.current?.showModal(); if (!chatting) input.current?.focus(); }
    else if (!opened && dialog.current?.open) dialog.current.close();
  }, [opened, chatting]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        const url = new URL(window.location.href);
        if (dialog.current?.open) { url.searchParams.delete("search"); url.searchParams.delete("searchView"); decision.current?.abort(); }
        else { url.searchParams.set("search", ""); url.searchParams.set("searchView", "search"); }
        window.history.replaceState(null, "", url);
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => { window.removeEventListener("keydown", shortcut); decision.current?.abort(); };
  }, []);
  useEffect(() => {
    if (!opened || chatting) return;
    const controller = new AbortController();
    decision.current = controller;
    debounceTimer.current = setTimeout(() => void executeSearch(query, controller), query.trim() ? 1000 : 0);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); controller.abort(); };
  }, [query, opened, chatting, executeSearch]);

  return <>
    <button ref={trigger} type="button" onClick={open} aria-haspopup="dialog" aria-label={t("Search")} aria-keyshortcuts="Meta+K Control+K" className="state-layer flex h-10 items-center gap-3 rounded-full bg-surface-container px-4 text-on-surface-variant"><Search size={20} aria-hidden="true" /><span className="type-label-large max-sm:hidden">{t("Search")}</span></button>
    <dialog ref={dialog} onCancel={(event) => { event.preventDefault(); close(); }} onClose={() => trigger.current?.focus()} aria-label={t("Search")} onClick={(event) => { if (event.target === dialog.current) close(); }} className="site-search-dialog fixed inset-0 m-auto max-h-[85dvh] w-[min(720px,calc(100vw-24px))] overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low p-0 text-on-surface shadow-elevation-3 backdrop:bg-scrim/35 backdrop:backdrop-blur-sm">
      <div className={`relative flex max-h-[85dvh] flex-col ${chatting ? "h-[min(720px,85dvh)]" : ""}`}>
        {chatting ? <div className="flex shrink-0 items-center gap-3 p-3">
          <button type="button" aria-label={t("Back to search")} onClick={() => changeUrl("")} className="state-layer flex h-10 shrink-0 items-center gap-2 rounded-full px-3 type-label-large text-primary"><ArrowLeft size={18} /><span>{t("Back to search")}</span></button><h2 className="flex-1 type-title-medium">{t("Ask the agent")}</h2>
          <button type="button" aria-label={t("Close")} onClick={close} className="state-layer flex size-10 items-center justify-center rounded-full"><X size={20} /></button>
        </div> : <div className="m-3 flex shrink-0 items-center gap-3 rounded-lg bg-surface-container-high px-4">
          <Search size={22} className="shrink-0 text-on-surface-variant" aria-hidden="true" />
          <input ref={input} value={query} maxLength={2000} placeholder={t("Search or ask a question…")} aria-label={t("Search or ask a question…")} role="combobox" aria-expanded="true" aria-controls={id} aria-autocomplete="list" aria-activedescendant={selected >= 0 && selected < commandCount ? `${id}-${selected}` : undefined} onChange={(event) => {
            decision.current?.abort(); setDeciding(false); setError(null);
            // URL updates can render later; invalidate stale options before keyboard selection.
            setFound((previous) => ({ ...previous, results: [], intent: "search" }));
            setSelected(-1);
            changeUrl(event.target.value);
          }} onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault(); if (!commandCount) return;
              const next = selected < 0 ? (event.key === "ArrowDown" ? 0 : commandCount - 1) : (selected + (event.key === "ArrowDown" ? 1 : -1) + commandCount) % commandCount;
              setSelected(next); list.current?.querySelectorAll<HTMLElement>('[role="option"]')[next]?.scrollIntoView({ block: "nearest" });
            } else if (event.key === "Enter" && !event.nativeEvent.isComposing) {
              event.preventDefault();
              if (selected >= 0 && selected < commandCount) list.current?.querySelectorAll<HTMLElement>('[role="option"]')[selected]?.click();
              else void submit();
            }
          }} className="h-14 min-w-0 flex-1 bg-transparent type-body-large outline-none" />
          {query.trim() ? <button type="button" aria-label={t("Search or ask")} disabled={deciding} onClick={() => void submit()} className="state-layer flex size-9 shrink-0 items-center justify-center rounded-full text-primary">{deciding ? <LoaderCircle size={18} className="animate-spin" /> : <ArrowRight size={20} />}</button> : null}
          <button type="button" aria-label={t("Close")} onClick={close} className="state-layer flex size-9 shrink-0 items-center justify-center rounded-full"><X size={18} /></button>
        </div>}
        <div hidden={chatting}>
          <p className="px-6 py-2 type-label-medium text-on-surface-variant">{query ? t("Search results") : t("Navigation")}</p>
          <div ref={list} id={id} role="listbox" aria-label={t("Search results")} aria-busy={searching} className="max-h-[48dvh] overflow-y-auto overscroll-contain px-3 pb-3">
            {recommendChat ? <button type="button" id={`${id}-0`} role="option" aria-selected={selected === 0} onMouseEnter={() => setSelected(0)} onFocus={() => setSelected(0)} onClick={enterChat} className={`state-layer flex min-h-16 w-full items-center gap-4 rounded-lg px-4 py-3 text-left ${selected === 0 ? "bg-secondary-container text-on-secondary-container" : "text-on-surface"}`}>
              <MessageSquareText size={22} className="shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1"><span className="block type-body-large">{t("Chat with the agent about this")}</span><span className="line-clamp-2 break-words type-body-small text-on-surface-variant">{query}</span></span>
              <CornerDownLeft size={18} className="shrink-0 text-on-surface-variant" aria-hidden="true" />
            </button> : null}
            {results.map((item, index) => {
              const commandIndex = index + resultOffset;
              const Icon = icons[item.key as keyof typeof icons] ?? Database;
              return <Link key={item.href} href={item.href} id={`${id}-${commandIndex}`} role="option" aria-selected={selected === commandIndex} aria-current={active === item.key ? "page" : undefined} onMouseEnter={() => setSelected(commandIndex)} onFocus={() => setSelected(commandIndex)} onClick={close} data-analytics-event="navigation_click" data-analytics-label={item.key} className={`state-layer flex min-h-14 items-center gap-4 rounded-lg px-4 py-2 ${selected === commandIndex ? "bg-secondary-container text-on-secondary-container" : "text-on-surface"}`}><Icon size={22} className="shrink-0" aria-hidden="true" /><span className="min-w-0"><span className="block type-body-large">{item.label}</span>{item.description ? <span className="line-clamp-1 type-body-small text-on-surface-variant">{item.description}</span> : null}</span><ArrowUpRight size={16} className="ml-auto shrink-0 text-on-surface-variant" aria-hidden="true" /></Link>;
            })}
            {!commandCount && !searching ? <p className="px-4 py-5 type-body-medium text-on-surface-variant">{t("No text matches. Try asking the agent.")}</p> : null}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant p-3">
            <Link href={`/sources/apis${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`} onClick={close} className="state-layer rounded-full px-4 py-2 type-label-large text-primary">{t("Search APIs")}</Link>
            <button type="button" onClick={showChat} className="state-layer flex items-center gap-2 rounded-full bg-secondary-container px-4 py-2 type-label-large text-on-secondary-container"><MessageSquareText size={18} aria-hidden="true" />{t("Chat")}</button>
          </div>
        </div>
        {chat || chatting ? <div hidden={!chatting} className={chatting ? "flex min-h-0 flex-1 flex-col" : "hidden"}><SearchChat key={chat?.id ?? "direct"} initialQuestion={chat?.question} active={opened && chatting} /></div> : null}
        {!chatting && (deciding || searching) ? <div role="status" className="pointer-events-none absolute inset-x-3 bottom-16 flex items-center gap-2 rounded-lg bg-surface-container-highest px-4 py-3 type-body-small shadow-elevation-2"><LoaderCircle size={16} className="animate-spin" />{deciding ? t("Understanding your search…") : t("Searching…")}</div> : null}
        {!chatting && error ? <div role="status" className="absolute inset-x-3 bottom-16 rounded-lg bg-error-container px-4 py-3 type-body-small text-on-error-container shadow-elevation-2" onClick={() => setError(null)}>{error}</div> : null}
      </div>
    </dialog>
  </>;
}
