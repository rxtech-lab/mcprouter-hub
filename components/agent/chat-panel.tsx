"use client";

import type { UIMessage } from "ai";
import { ArrowUp, ChevronDown, CircleAlert, CircleCheck, ExternalLink, LayoutDashboard, LoaderCircle, MapPin, Search, Sparkles, Square, Wrench } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { IconButton } from "@/components/m3/button";
import { ACCOUNT_SUMMARY_TOOL_NAME, LIST_KEYS_TOOL_NAME, NAVIGATION_PART_TYPES, type DashboardNavigation } from "@/lib/agent/dashboard-tools";
import { SHOW_TOOL_UI_TOOL_NAME, SHOW_UI_TOOL_NAME } from "@/lib/agent/display-tools";
import type { UiSpec } from "@/lib/agent/ui-catalog";
import { SEARCH_TOOL_NAME } from "@/lib/agent/tool-search";
import { useT } from "@/lib/i18n/client";
import { msg } from "@/lib/i18n/translate";
import { GenerativeUi } from "./generative-ui";
import { Markdown } from "./markdown";
import { UserLocationCard } from "./user-location";
import { REQUEST_LOCATION_TOOL_NAME, locationRequestSchema, parseLocationAnswer } from "@/lib/agent/location";
import { UserInputCard } from "./user-input";
import { REQUEST_INPUT_TOOL_NAME, userInputSchema } from "@/lib/agent/user-input";
import { McpAppHost, ToolAppCard, toolPartApp } from "./tool-app";
import { SHOW_MAP_TOOL_NAME, mapSchema } from "@/lib/agent/map";
import { AgentMapCard, MapCanvas } from "./map";

export const SUGGESTIONS = [
  msg("What's the weather in Hong Kong right now? Any warnings?"),
  msg("When is the next KMB 1A from Star Ferry?"),
  msg("Which A&E has the shortest waiting time on Hong Kong Island?"),
  msg("Is next Monday a public holiday?"),
  msg("Find datasets about air quality"),
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
const SHOW_TOOL_UI_PART_TYPE = `tool-${SHOW_TOOL_UI_TOOL_NAME}`;
const SHOW_UI_PART_TYPE = `tool-${SHOW_UI_TOOL_NAME}`;

type ShowToolUiPart = { type: `tool-${string}`; state: ToolPart["state"]; output?: { shown?: string[] } };
type ShowUiPart = { type: `tool-${string}`; state: ToolPart["state"]; input?: { spec?: UiSpec }; output?: { shown?: boolean } };

const isRunning = (state: ToolPart["state"]) => state === "input-streaming" || state === "input-available";

type DashboardPart = { type: `tool-${string}`; state: ToolPart["state"]; output?: Partial<DashboardNavigation> & { error?: string }; errorText?: string };

const LOOKUP_LABELS: Record<string, [running: string, done: string]> = {
  [`tool-${LIST_KEYS_TOOL_NAME}`]: [msg("Checking your API keys"), msg("Checked your API keys")],
  [`tool-${ACCOUNT_SUMMARY_TOOL_NAME}`]: [msg("Checking your account"), msg("Checked your account")],
};

/** A dashboard page or dialog the agent found for the user. It opens in a new tab, only when they choose to, so the chat stays put. */
function DashboardLinkCard({ part }: { part: DashboardPart }) {
  const t = useT();
  const running = part.state === "input-streaming" || part.state === "input-available";
  const error = part.state === "output-error" ? part.errorText : part.output?.error;
  const target = part.state === "output-available" && part.output?.href && part.output.label ? part.output : null;
  return (
    <div className="my-2 flex items-center gap-3 rounded-md border border-outline-variant bg-surface-container-low px-3 py-2 animate-message-in" data-testid="dashboard-link">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
        <LayoutDashboard size={16} />
      </span>
      <span className="min-w-0 flex-1 truncate type-body-medium">
        {running ? t("Finding the page…") : null}
        {target?.label ? t(target.label) : null}
        {error ? <span className="text-error">{error}</span> : null}
      </span>
      {running ? <LoaderCircle size={16} className="animate-spin text-on-surface-variant" /> : null}
      {target ? (
        <a href={target.href} target="_blank" rel="noopener" className="state-layer inline-flex h-8 items-center gap-1 rounded-full px-3 type-label-large text-primary">
          {t("Open")} <ExternalLink size={16} />
        </a>
      ) : null}
    </div>
  );
}

/** A read-only look at the account (keys, usage): one line, the answer follows in the text. */
function LookupLine({ part, labels }: { part: DashboardPart; labels: [string, string] }) {
  const t = useT();
  const running = part.state === "input-streaming" || part.state === "input-available";
  return (
    <p className="my-1 flex items-center gap-2 type-body-small text-on-surface-variant animate-message-in">
      {running ? <LoaderCircle size={14} className="animate-spin" /> : part.state === "output-error" ? <CircleAlert size={14} className="text-error" /> : <CircleCheck size={14} />}
      {t(running ? labels[0] : labels[1])}
    </p>
  );
}

/** The agent looking up which tools to load: shows its query, then the tools it found. */
function ToolSearchCard({ part }: { part: SearchPart }) {
  const t = useT();
  const running = part.state === "input-streaming" || part.state === "input-available";
  const failed = part.state === "output-error";
  const found = part.output?.tools ?? [];
  const muted = (chunks: ReactNode) => <span className="text-on-surface-variant">{chunks}</span>;

  return (
    <div className="my-2 flex flex-col gap-2 rounded-md border border-outline-variant bg-surface-container-low px-3 py-2 animate-message-in" data-testid="tool-search">
      <div className="flex items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-tertiary-container text-on-tertiary-container">
          <Search size={14} />
        </span>
        <span className="min-w-0 flex-1 truncate type-body-medium">
          {part.input?.query
            ? running
              ? t.rich("Searching tools <muted>for “{query}”</muted>", { muted, query: part.input.query })
              : t.rich("Searched tools <muted>for “{query}”</muted>", { muted, query: part.input.query })
            : running
              ? t("Searching tools")
              : t("Searched tools")}
        </span>
        <span className="flex shrink-0 items-center gap-1 type-label-medium text-on-surface-variant">
          {running ? <LoaderCircle size={14} className="animate-spin" /> : null}
          {part.state === "output-available" ? <><CircleCheck size={14} /> {t("{count} found", { count: found.length })}</> : null}
          {failed ? <><CircleAlert size={14} className="text-error" /> {t("Failed")}</> : null}
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
  const t = useT();
  const running = isRunning(part.state);
  const failed = part.state === "output-error";
  return (
    <details className="group my-2 rounded-md border border-outline-variant bg-surface-container-low animate-message-in" data-testid="tool-call">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
          <Wrench size={14} />
        </span>
        <span className="min-w-0 truncate font-mono text-[13px]">{part.toolName}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1 type-label-medium text-on-surface-variant">
          {running ? <><LoaderCircle size={14} className="animate-spin" /> {t("Running")}</> : null}
          {part.state === "output-available" ? <><CircleCheck size={14} /> {t("Done")}</> : null}
          {failed ? <><CircleAlert size={14} className="text-error" /> {t("Failed")}</> : null}
        </span>
      </summary>
      <div className="flex flex-col gap-2 border-t border-outline-variant px-3 py-2">
        <div>
          <span className="type-label-small text-on-surface-variant">{t("Input")}</span>
          <pre className="mt-1 max-h-40 overflow-auto rounded-xs bg-surface-container-highest p-2 font-mono text-xs">{JSON.stringify(part.input ?? {}, null, 2)}</pre>
        </div>
        {part.state === "output-available" ? (
          <div>
            <span className="type-label-small text-on-surface-variant">{t("Result")}</span>
            <pre className="mt-1 max-h-60 overflow-auto rounded-xs bg-surface-container-highest p-2 font-mono text-xs">{JSON.stringify(part.output, null, 2)}</pre>
          </div>
        ) : null}
        {failed ? <p className="type-body-small text-error">{part.errorText}</p> : null}
      </div>
    </details>
  );
}

/** A step of the agent's work that stays folded: searches, tool calls and account lookups. */
function isActivity(part: Part) {
  return part.type === "dynamic-tool" || part.type === SEARCH_PART_TYPE || part.type in LOOKUP_LABELS;
}

function ActivityPart({ part }: { part: Part }) {
  if (part.type === "dynamic-tool") return <ToolCallCard part={part} />;
  if (part.type === SEARCH_PART_TYPE) return <ToolSearchCard part={part as SearchPart} />;
  return <LookupLine part={part as DashboardPart} labels={LOOKUP_LABELS[part.type]} />;
}

/** A run of tool calls, folded to one line; it opens to show each call. */
function ActivityGroup({ parts }: { parts: Part[] }) {
  const t = useT();
  const calls = parts.filter((part) => part.type === "dynamic-tool");
  // Every activity part is a tool part, so each has a state.
  const running = parts.find((part) => isRunning((part as SearchPart).state));
  const failed = parts.some((part) => (part as SearchPart).state === "output-error");
  const label = running
    ? running.type === "dynamic-tool"
      ? t("Running {tool}", { tool: running.toolName })
      : running.type === SEARCH_PART_TYPE
        ? t("Searching tools")
        : t(LOOKUP_LABELS[running.type][0])
    : calls.length
      ? t.plural("Used {count} tool", "Used {count} tools", calls.length)
      : parts.some((part) => part.type === SEARCH_PART_TYPE)
        ? t("Searched tools")
        : t(LOOKUP_LABELS[parts[0].type][1]);
  return (
    <details className="group my-1 animate-message-in" data-testid="tool-activity">
      <summary className="state-layer inline-flex cursor-pointer list-none items-center gap-2 rounded-full py-1 pr-2 pl-1 type-label-large text-on-surface-variant">
        <span className="flex size-6 items-center justify-center rounded-full bg-surface-container-highest">
          {running ? <LoaderCircle size={14} className="animate-spin" /> : failed ? <CircleAlert size={14} className="text-error" /> : <Wrench size={14} />}
        </span>
        <span className="min-w-0 truncate">{label}</span>
        <ChevronDown size={16} className="shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)] group-open:rotate-180" />
      </summary>
      <div className="mt-1 border-l-2 border-outline-variant pl-3 animate-message-in">
        {parts.map((part, index) => (
          <ActivityPart key={"toolCallId" in part ? part.toolCallId : index} part={part} />
        ))}
      </div>
    </details>
  );
}

/** Where a UI the agent is composing will appear. */
function UiSkeleton() {
  const t = useT();
  return (
    <div className="my-2 flex flex-col gap-2 rounded-md border border-outline-variant p-4 animate-message-in" aria-label={t("Loading results")}>
      {[60, 90, 75].map((width) => (
        <div key={width} className="h-3.5 animate-pulse rounded-full bg-surface-container-highest" style={{ width: `${width}%` }} />
      ))}
    </div>
  );
}

/** The latest call of `toolName` before `before`, if it has an app to show. */
function appCall(parts: Part[], toolName: string, before: number) {
  for (let index = before - 1; index >= 0; index--) {
    const part = parts[index];
    if (part.type === "dynamic-tool" && part.toolName === toolName) {
      const resourceUri = part.state === "output-available" ? toolPartApp(part) : null;
      return resourceUri ? { part, resourceUri } : null;
    }
  }
  return null;
}

/** Structured messages keep their original data in history and show readable summaries. */
function UserMessageText({ text }: { text: string }) {
  const t = useT();
  const location = parseLocationAnswer(text);
  if (location) {
    const capturedAt = new Intl.DateTimeFormat(t.locale, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(location.capturedAt));
    const { latitude, longitude } = location;
    const mapUrl = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`;
    return (
      <div className="w-[min(320px,65vw)] max-w-full py-1" data-testid="shared-location-message">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-current/10"><MapPin aria-hidden size={20} /></span>
          <div className="min-w-0">
            <p className="type-label-large">{t("Location shared")}</p>
            <p className="mt-1 type-body-medium tabular-nums">{Math.abs(location.latitude).toFixed(5)}° {location.latitude < 0 ? "S" : "N"}, {Math.abs(location.longitude).toFixed(5)}° {location.longitude < 0 ? "W" : "E"}</p>
            <p className="mt-1 type-body-small opacity-75">{t("Accuracy: ±{meters} m", { meters: location.accuracyMeters })}</p>
            <time dateTime={location.capturedAt} className="mt-1 block type-body-small opacity-75">{capturedAt} UTC</time>
          </div>
        </div>
        <div className="mt-3"><MapCanvas map={{ title: t("Location shared"), pins: [{ label: t("Location shared"), latitude, longitude }], routes: [] }} /></div>
        <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="state-layer mt-1 inline-flex min-h-10 items-center gap-1 rounded-full px-2 type-label-large underline underline-offset-2">{t("Open in OpenStreetMap")}<ExternalLink aria-hidden size={14} /></a>
      </div>
    );
  }
  const toolName = /^Use this tool: ([a-zA-Z0-9_.:-]+)$/.exec(text.trim())?.[1];
  if (!toolName) return <p className="whitespace-pre-wrap">{text}</p>;
  return (
    <div className="flex items-center gap-3 py-1" data-testid="tool-request-message">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-on-primary-container/10"><Wrench aria-hidden size={20} /></span>
      <div className="min-w-0">
        <p className="type-label-medium opacity-75">{t("Use tool")}</p>
        <p className="mt-0.5 type-title-medium capitalize">{toolName.replace(/[_.:-]+/g, " ")}</p>
        <code className="mt-1 inline-block max-w-full rounded-sm bg-on-primary-container/10 px-2 py-0.5 font-mono text-xs break-all">{toolName}</code>
      </div>
    </div>
  );
}

/**
 * A message's parts. Tool calls fold into one line per run; UI shows only where the agent asked for it:
 * a tool's MCP App with `show_tool_ui`, or a UI it composed with `show_ui`. The reply carries just the visuals that help.
 */
export function MessageParts({ message, onAnswer, inputDisabled = true }: { message: UIMessage; onAnswer?: (answer: string) => void; inputDisabled?: boolean }) {
  const t = useT();
  const isUser = message.role === "user";
  const { parts } = message;
  const nodes: ReactNode[] = [];
  let group: Part[] = [];
  const flush = () => {
    if (group.length) nodes.push(<ActivityGroup key={`activity-${nodes.length}`} parts={group} />);
    group = [];
  };

  parts.forEach((part, index) => {
    if (isActivity(part)) {
      group.push(part);
      return;
    }
    // Step markers sit between tool calls; they don't end a run.
    if (part.type === "step-start") return;
    if (part.type === "text" && !part.text.trim()) return;
    flush();
    if (part.type === `tool-${SHOW_MAP_TOOL_NAME}`) {
      const show = part as { state: ToolPart["state"]; input?: unknown; output?: { shown?: boolean } };
      if (isRunning(show.state)) nodes.push(<UiSkeleton key={index} />);
      else if (show.state === "output-available" && show.output?.shown) {
        const parsed = mapSchema.safeParse(show.input);
        if (parsed.success) nodes.push(<AgentMapCard key={index} map={parsed.data} />);
        else nodes.push(<p key={index} role="status" className="type-body-small text-error">{t("This map could not be displayed.")}</p>);
      } else if (show.state === "output-error" || show.state === "output-available") {
        nodes.push(<p key={index} role="status" className="type-body-small text-error">{t("This map could not be displayed.")}</p>);
      }
    } else if (part.type === `tool-${REQUEST_LOCATION_TOOL_NAME}`) {
      const requestPart = part as { state: string; input?: unknown };
      const parsed = locationRequestSchema.safeParse(requestPart.input);
      if (requestPart.state === "output-available" && parsed.success) {
        nodes.push(<UserLocationCard key={index} reason={parsed.data.reason} disabled={inputDisabled} onAnswer={onAnswer} />);
      } else if (isRunning(requestPart.state as ToolPart["state"])) nodes.push(<UiSkeleton key={index} />);
    } else if (part.type === `tool-${REQUEST_INPUT_TOOL_NAME}`) {
      const requestPart = part as { state: string; input?: unknown };
      const parsed = userInputSchema.safeParse(requestPart.input);
      if (requestPart.state === "output-available" && parsed.success) {
        nodes.push(<UserInputCard key={index} request={parsed.data} disabled={inputDisabled} onAnswer={onAnswer} />);
      } else if (isRunning(requestPart.state as ToolPart["state"])) nodes.push(<UiSkeleton key={index} />);
      else if (requestPart.state === "output-error" && parsed.success) nodes.push(<Markdown key={index}>{parsed.data.question}</Markdown>);
    } else if (part.type === "text") {
      nodes.push(isUser ? <UserMessageText key={index} text={part.text} /> : <Markdown key={index}>{part.text}</Markdown>);
    } else if (part.type === SHOW_UI_PART_TYPE) {
      const show = part as ShowUiPart;
      if (isRunning(show.state)) nodes.push(<UiSkeleton key={index} />);
      else if (show.state === "output-available" && show.output?.shown && show.input?.spec) nodes.push(<GenerativeUi key={index} spec={show.input.spec} />);
    } else if (part.type === SHOW_TOOL_UI_PART_TYPE) {
      for (const name of (part as ShowToolUiPart).output?.shown ?? []) {
        const call = appCall(parts, name, index);
        if (call) nodes.push(<ToolAppCard key={`${index}-${call.part.toolCallId}`} part={call.part} resourceUri={call.resourceUri} fallback={null} />);
      }
    } else if (NAVIGATION_PART_TYPES.includes(part.type)) {
      nodes.push(<DashboardLinkCard key={index} part={part as DashboardPart} />);
    }
  });
  flush();
  return nodes;
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
export function TypingDots() {
  const t = useT();
  return (
    <div role="status" aria-label={t("Agent is responding")} className="flex h-6 items-center gap-1 animate-fade-in" data-testid="typing-dots">
      {[0, 150, 300].map((delay) => (
        <span key={delay} className="size-2 rounded-full bg-on-surface-variant animate-typing-dot" style={{ animationDelay: `${delay}ms` }} />
      ))}
    </div>
  );
}

function TurnItem({ turn, minHeight, busy, onAnswer, inputDisabled }: { turn: Turn; minHeight?: number; busy: boolean; onAnswer: (answer: string) => void; inputDisabled: boolean }) {
  return (
    <li data-turn={turn.id} className="flex flex-col gap-4" style={{ minHeight }}>
      {turn.user ? (
        <div className="flex justify-end pb-2" data-testid="user-message">
          <div className={`${turn.user.parts.some((part) => part.type === "text" && parseLocationAnswer(part.text)) ? "" : "max-h-40"} max-w-[min(680px,90%)] origin-bottom-right overflow-y-auto rounded-[20px] rounded-br-xs bg-primary-container px-4 py-2 type-body-large wrap-anywhere text-on-primary-container animate-message-in`}>
            <MessageParts message={turn.user} />
          </div>
        </div>
      ) : null}
      {turn.replies.map((reply) => (
        <div key={reply.id} className="max-w-[min(680px,100%)] min-w-0 origin-top-left type-body-large wrap-break-word text-on-surface animate-message-in" data-testid="agent-message">
          <MessageParts message={reply} onAnswer={onAnswer} inputDisabled={inputDisabled || reply.id !== turn.replies.at(-1)?.id} />
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
  /** Lets MCP Apps in the replies call their tools, e.g. to refresh. Calls are billed to the signed-in user. */
  canCallAppTools?: boolean;
  /** Starter questions on the empty state. */
  suggestions?: string[];
  placeholder?: string;
  inputValue?: string;
  onInputChange?: (value: string) => void;
  inputRef?: React.Ref<HTMLTextAreaElement>;
};

/** The conversation: scroll new questions to the top, suggestions when empty, and the composer. */
export function ChatPanel({ messages, status, onSend, onStop, title, actions, intro, notice, disabled = false, canCallAppTools = false, suggestions = SUGGESTIONS, placeholder, inputValue, onInputChange, inputRef }: ChatPanelProps) {
  const t = useT();
  const [localInput, setLocalInput] = useState("");
  const input = inputValue ?? localInput;
  const setInput = onInputChange ?? setLocalInput;
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

  // Scroll each new question to the top once; the answer then streams in below it.
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
  // A follow-up asked from inside an MCP App, sent like a typed message.
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  });
  const askFromApp = useCallback((text: string) => sendRef.current(text), []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 pb-4">
        <h1 className="min-w-0 truncate type-headline-medium">{title}</h1>
        {actions}
      </div>
      <div ref={scroller} className="relative min-h-0 flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex min-h-full flex-col items-center justify-center gap-4 py-4 text-center animate-message-in">
            <span className="flex size-12 items-center justify-center rounded-lg bg-tertiary-container text-on-tertiary-container">
              <Sparkles size={24} />
            </span>
            <p className="type-title-large">{t("Ask about live data")}</p>
            <p className="max-w-md type-body-medium text-on-surface-variant">{intro}</p>
            <div className="flex max-w-2xl flex-wrap justify-center gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  disabled={disabled}
                  onClick={() => send(t(suggestion))}
                  className="state-layer min-h-8 cursor-pointer rounded-sm border border-outline px-3 py-1.5 type-label-large text-on-surface-variant disabled:cursor-default disabled:opacity-40"
                >
                  {t(suggestion)}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <McpAppHost canCallTools={canCallAppTools} sendMessage={askFromApp}>
            <ul className="flex flex-col gap-8 pb-4" aria-live="polite">
              {turns.map((turn) => {
                const last = turn.id === lastTurnId;
                return <TurnItem key={turn.id} turn={turn} minHeight={last ? viewportHeight : undefined} busy={last && busy} onAnswer={send} inputDisabled={!last || busy || disabled} />;
              })}
            </ul>
          </McpAppHost>
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
          ref={inputRef}
          aria-label={t("Message")}
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
          placeholder={placeholder ?? t("Ask about weather, buses, MTR, hospitals…")}
          className="max-h-40 min-h-10 min-w-0 flex-1 resize-none bg-transparent py-2 type-body-large outline-none placeholder:truncate placeholder:text-on-surface-variant disabled:opacity-60"
        />
        {busy ? (
          <IconButton label={t("Stop")} variant="tonal" onClick={onStop}>
            <Square size={18} />
          </IconButton>
        ) : (
          <IconButton label={t("Send")} variant="filled" type="submit"
 disabled={disabled || !input.trim()}>
            <ArrowUp size={20} />
          </IconButton>
        )}
      </form>
    </div>
  );
}
