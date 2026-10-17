"use client";

import type { UIMessage } from "ai";
import { ArrowUp, CircleAlert, CircleCheck, LoaderCircle, Search, Sparkles, Square, Wrench } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { IconButton } from "@/components/m3/button";
import { SEARCH_TOOL_NAME } from "@/lib/agent/tool-search";
import { Markdown } from "./markdown";

export const SUGGESTIONS = [
  "What's the weather in Hong Kong right now? Any warnings?",
  "When is the next KMB 1A from Star Ferry?",
  "Which A&E has the shortest waiting time on Hong Kong Island?",
  "Is next Monday a public holiday?",
  "Find datasets about air quality",
];

type Part = UIMessage["parts"][number];
type ToolPart = Extract<Part, { type: "dynamic-tool" }>;
type SearchPart = {
  type: `tool-${string}`;
  state: ToolPart["state"];
  input?: { query?: string };
  output?: { tools?: { name: string; description?: string }[] };
  errorText?: string;
};

const SEARCH_PART_TYPE = `tool-${SEARCH_TOOL_NAME}`;

/** The agent looking up which tools to load: shows its query, then the tools it found. */
function ToolSearchCard({ part }: { part: SearchPart }) {
  const running = part.state === "input-streaming" || part.state === "input-available";
  const failed = part.state === "output-error";
  const found = part.output?.tools ?? [];
  return (
    <div className="my-2 flex flex-col gap-2 rounded-md border border-outline-variant bg-surface-container-low px-3 py-2 animate-message-in" data-testid="tool-search">
      <div className="flex items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-tertiary-container text-on-tertiary-container">
          <Search size={14} />
        </span>
        <span className="min-w-0 flex-1 truncate type-body-medium">
          {running ? "Searching tools" : "Searched tools"}
          {part.input?.query ? <span className="text-on-surface-variant"> for “{part.input.query}”</span> : null}
        </span>
        <span className="flex shrink-0 items-center gap-1 type-label-medium text-on-surface-variant">
          {running ? <LoaderCircle size={14} className="animate-spin" /> : null}
          {part.state === "output-available" ? <><CircleCheck size={14} /> {found.length} found</> : null}
          {failed ? <><CircleAlert size={14} className="text-error" /> Failed</> : null}
        </span>
      </div>
      {found.length ? (
        <div className="flex flex-wrap gap-1.5 pl-9">
          {found.map((tool) => (
            <span key={tool.name} title={tool.description} className="rounded-sm bg-surface-container-highest px-2 py-0.5 font-mono text-xs text-on-surface-variant">
              {tool.name}
            </span>
          ))}
        </div>
      ) : null}
      {failed ? <p className="pl-9 type-body-small text-error">{part.errorText}</p> : null}
    </div>
  );
}

function ToolCallCard({ part }: { part: ToolPart }) {
  const running = part.state === "input-streaming" || part.state === "input-available";
  const failed = part.state === "output-error";
  return (
    <details className="group my-2 rounded-md border border-outline-variant bg-surface-container-low animate-message-in" data-testid="tool-call">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
          <Wrench size={14} />
        </span>
        <span className="font-mono text-[13px]">{part.toolName}</span>
        <span className="ml-auto flex items-center gap-1 type-label-medium text-on-surface-variant">
          {running ? <><LoaderCircle size={14} className="animate-spin" /> Running</> : null}
          {part.state === "output-available" ? <><CircleCheck size={14} /> Done</> : null}
          {failed ? <><CircleAlert size={14} className="text-error" /> Failed</> : null}
        </span>
      </summary>
      <div className="flex flex-col gap-2 border-t border-outline-variant px-3 py-2">
        <div>
          <span className="type-label-small text-on-surface-variant">Input</span>
          <pre className="mt-1 max-h-40 overflow-auto rounded-xs bg-surface-container-highest p-2 font-mono text-xs">{JSON.stringify(part.input ?? {}, null, 2)}</pre>
        </div>
        {part.state === "output-available" ? (
          <div>
            <span className="type-label-small text-on-surface-variant">Result</span>
            <pre className="mt-1 max-h-60 overflow-auto rounded-xs bg-surface-container-highest p-2 font-mono text-xs">{JSON.stringify(part.output, null, 2)}</pre>
          </div>
        ) : null}
        {failed ? <p className="type-body-small text-error">{part.errorText}</p> : null}
      </div>
    </details>
  );
}

export function MessageParts({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  return message.parts.map((part, index) => {
    if (part.type === "text") {
      return isUser ? <p key={index} className="whitespace-pre-wrap">{part.text}</p> : <Markdown key={index}>{part.text}</Markdown>;
    }
    if (part.type === "dynamic-tool") return <ToolCallCard key={index} part={part} />;
    if (part.type === SEARCH_PART_TYPE) return <ToolSearchCard key={index} part={part as SearchPart} />;
    return null;
  });
}

type Turn = { id: string; user?: UIMessage; replies: UIMessage[] };

// A turn is a user message plus the agent replies that follow it.
function toTurns(messages: UIMessage[]): Turn[] {
  const turns: Turn[] = [];
  for (const message of messages) {
    if (message.role === "user" || turns.length === 0) {
      turns.push({ id: message.id, user: message.role === "user" ? message : undefined, replies: message.role === "user" ? [] : [message] });
    } else {
      turns[turns.length - 1].replies.push(message);
    }
  }
  return turns;
}

/** Three bouncing dots, shown for as long as the agent is working on a reply. */
function TypingDots() {
  return (
    <div role="status" aria-label="Agent is responding" className="flex h-6 items-center gap-1 animate-fade-in" data-testid="typing-dots">
      {[0, 150, 300].map((delay) => (
        <span key={delay} className="size-2 rounded-full bg-on-surface-variant animate-typing-dot" style={{ animationDelay: `${delay}ms` }} />
      ))}
    </div>
  );
}

function TurnItem({ turn, minHeight, busy }: { turn: Turn; minHeight?: number; busy: boolean }) {
  return (
    <li data-turn={turn.id} className="flex flex-col gap-4" style={{ minHeight }}>
      {turn.user ? (
        // The question stays pinned to the top while its answer scrolls beneath it.
        <div className="sticky top-0 z-10 flex justify-end bg-surface pb-2 md:bg-surface-container-lowest" data-testid="user-message">
          <div className="max-h-40 max-w-[min(680px,90%)] origin-bottom-right overflow-y-auto rounded-[20px] rounded-br-xs bg-primary-container px-4 py-2 type-body-large text-on-primary-container animate-message-in">
            <MessageParts message={turn.user} />
          </div>
        </div>
      ) : null}
      {turn.replies.map((reply) => (
        <div key={reply.id} className="max-w-[min(680px,90%)] origin-top-left type-body-large text-on-surface animate-message-in" data-testid="agent-message">
          <MessageParts message={reply} />
        </div>
      ))}
      {busy ? <TypingDots /> : null}
    </li>
  );
}

type ChatPanelProps = {
  messages: UIMessage[];
  status: "submitted" | "streaming" | "ready" | "error";
  onSend: (text: string) => void;
  onStop: () => void;
  title: ReactNode;
  /** Trailing header actions, such as the chat history button. */
  actions?: ReactNode;
  /** Supporting text on the empty state. */
  intro: ReactNode;
  /** Shown above the composer, e.g. the free allowance. */
  notice?: ReactNode;
  /** Blocks sending, e.g. when the free allowance is used up. */
  disabled?: boolean;
};

/** The conversation: turns that pin each question to the top, suggestions when empty, and the composer. */
export function ChatPanel({ messages, status, onSend, onStop, title, actions, intro, notice, disabled = false }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const [viewportHeight, setViewportHeight] = useState<number>();
  const busy = status === "submitted" || status === "streaming";
  const turns = useMemo(() => toTurns(messages), [messages]);
  const lastTurnId = turns.at(-1)?.id;

  // The last turn fills the viewport so a new question can scroll all the way to the top.
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setViewportHeight(element.clientHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Pin each new question to the top; the answer then streams in below it.
  useEffect(() => {
    const element = scroller.current;
    const turn = lastTurnId ? element?.querySelector<HTMLElement>(`[data-turn="${CSS.escape(lastTurnId)}"]`) : null;
    if (element && turn) element.scrollTo({ top: turn.offsetTop, behavior: "smooth" });
  }, [lastTurnId]);

  const send = (text: string) => {
    if (!text.trim() || busy || disabled) return;
    onSend(text.trim());
    setInput("");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 pb-4">
        <h1 className="type-headline-medium">{title}</h1>
        {actions}
      </div>
      <div ref={scroller} className="relative min-h-0 flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center animate-message-in">
            <span className="flex size-12 items-center justify-center rounded-lg bg-tertiary-container text-on-tertiary-container">
              <Sparkles size={24} />
            </span>
            <p className="type-title-large">Ask about Hong Kong, live</p>
            <p className="max-w-md type-body-medium text-on-surface-variant">{intro}</p>
            <div className="flex max-w-2xl flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  disabled={disabled}
                  onClick={() => send(suggestion)}
                  className="state-layer h-8 cursor-pointer rounded-sm border border-outline px-3 type-label-large text-on-surface-variant disabled:cursor-default disabled:opacity-40"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ul className="flex flex-col gap-8 pb-4" aria-live="polite">
            {turns.map((turn) => {
              const last = turn.id === lastTurnId;
              return <TurnItem key={turn.id} turn={turn} minHeight={last ? viewportHeight : undefined} busy={last && busy} />;
            })}
          </ul>
        )}
      </div>
      {notice}
      <form
        className="mt-2 flex items-end gap-2 rounded-xl border-2 border-transparent bg-surface-container-high p-2 pl-5 transition-colors focus-within:border-primary"
        onSubmit={(event) => {
          event.preventDefault();
          send(input);
        }}
      >
        <textarea
          aria-label="Message"
          rows={1}
          value={input}
          disabled={disabled}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              send(input);
            }
          }}
          placeholder="Ask about weather, buses, MTR, hospitals…"
          className="max-h-40 min-h-10 flex-1 resize-none bg-transparent py-2 type-body-large outline-none placeholder:text-on-surface-variant disabled:opacity-60"
        />
        {busy ? (
          <IconButton label="Stop" variant="tonal" onClick={onStop}>
            <Square size={18} />
          </IconButton>
        ) : (
          <IconButton label="Send" variant="filled" type="submit" disabled={disabled || !input.trim()}>
            <ArrowUp size={20} />
          </IconButton>
        )}
      </form>
    </div>
  );
}
