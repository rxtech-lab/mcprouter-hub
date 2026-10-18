"use client";

import { experimental_MCPAppRenderer as MCPAppRenderer, type MCPAppBridgeHandlers, type MCPAppSandboxConfig } from "@ai-sdk/react";
import type { DynamicToolUIPart } from "ai";
import { Braces, CircleCheck, LayoutGrid, LoaderCircle } from "lucide-react";
import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { IconButton } from "@/components/m3/button";
import { Dialog } from "@/components/m3/dialog";
import type { ActionResult } from "@/lib/action-result";
import { useT } from "@/lib/i18n/client";
import { callAppTool, loadToolApp } from "@/lib/agent/mcp-app-actions";
import type { ToolApp } from "@/lib/agent/mcp-apps";

/**
 * Renders a tool result as its MCP App: the server's `ui://` HTML in a
 * sandboxed iframe (through `/mcp-app-sandbox`), fed the tool input and
 * result over the MCP Apps bridge. The app can open links, ask a follow-up in
 * the chat and, for members, call its service's tools (e.g. to refresh).
 */

const SANDBOX_URL = process.env.NEXT_PUBLIC_MCP_APP_SANDBOX_URL || "/mcp-app-sandbox";
const HOST_INFO = { name: "mcprouter", version: "1.0.0" };
const MAX_HEIGHT = 1600;

type AppHost = { canCallTools: boolean; sendMessage: (text: string) => void };

const AppHostContext = createContext<AppHost>({ canCallTools: false, sendMessage: () => {} });

/** What apps in this chat may do: members' apps can call tools; every app can ask a follow-up. */
export function McpAppHost({ canCallTools, sendMessage, children }: AppHost & { children: ReactNode }) {
  const value = useMemo(() => ({ canCallTools, sendMessage }), [canCallTools, sendMessage]);
  return <AppHostContext.Provider value={value}>{children}</AppHostContext.Provider>;
}

/** The `ui://` resource a tool part renders with, from the tool's `_meta.ui` as passed through by the MCP client. */
export function toolPartApp(part: DynamicToolUIPart) {
  const app = part.toolMetadata?.app as { resourceUri?: unknown; mimeType?: unknown } | undefined;
  return typeof app?.resourceUri === "string" && app.resourceUri.startsWith("ui://") && app.mimeType === "text/html;profile=mcp-app" ? app.resourceUri : null;
}

// One load per app resource per page, however many tool parts show it.
const loads = new Map<string, Promise<ActionResult<ToolApp>>>();
function loadApp(toolName: string, uri: string) {
  const server = toolName.includes("__") ? toolName.slice(0, toolName.indexOf("__")) : "";
  const key = `${server}|${uri}`;
  let load = loads.get(key);
  if (!load) {
    load = loadToolApp(toolName, uri).then((result) => {
      if (!result.ok) loads.delete(key);
      return result;
    });
    loads.set(key, load);
  }
  return load;
}

const darkQuery = "(prefers-color-scheme: dark)";
function subscribeToScheme(onChange: () => void) {
  const query = window.matchMedia(darkQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

// The MCP Apps standard style variables, from this site's Material tokens, so apps look native here.
const STYLE_TOKENS: Record<string, string> = {
  "--color-background-primary": "--md-sys-color-surface-container-low",
  "--color-background-secondary": "--md-sys-color-surface-container-lowest",
  "--color-background-tertiary": "--md-sys-color-surface-container-highest",
  "--color-text-primary": "--md-sys-color-on-surface",
  "--color-text-secondary": "--md-sys-color-on-surface-variant",
  "--color-border-primary": "--md-sys-color-outline-variant",
  "--color-ring-primary": "--md-sys-color-primary",
  "--color-background-info": "--md-sys-color-primary-container",
  "--color-text-info": "--md-sys-color-on-primary-container",
  "--color-background-danger": "--md-sys-color-error-container",
  "--color-text-danger": "--md-sys-color-on-error-container",
};

function styleVariables() {
  const computed = getComputedStyle(document.documentElement);
  const variables: Record<string, string> = { "--font-sans": getComputedStyle(document.body).fontFamily };
  for (const [name, token] of Object.entries(STYLE_TOKENS)) {
    const value = computed.getPropertyValue(token).trim();
    if (value) variables[name] = value;
  }
  return variables;
}

function useHostContext(part: DynamicToolUIPart) {
  const dark = useSyncExternalStore(subscribeToScheme, () => window.matchMedia(darkQuery).matches, () => false);
  return useMemo(
    () => ({
      theme: dark ? ("dark" as const) : ("light" as const),
      displayMode: "inline" as const,
      availableDisplayModes: ["inline" as const],
      locale: navigator.language,
      timeZone: "Asia/Hong_Kong",
      platform: "web",
      styles: { variables: styleVariables() },
      toolInfo: { id: part.toolCallId, tool: { name: (part.toolMetadata?.toolName as string | undefined) ?? part.toolName } },
    }),
    [dark, part.toolCallId, part.toolMetadata?.toolName, part.toolName],
  );
}

/** The text of a `ui/message` request: `{ role: "user", content: [{ type: "text", text }] }`. */
function messageText(params: unknown) {
  const content = (params as { content?: unknown } | undefined)?.content;
  const parts = Array.isArray(content) ? content : content ? [content] : [];
  return parts
    .map((part) => (part && typeof part === "object" && (part as { type?: unknown }).type === "text" ? String((part as { text?: unknown }).text ?? "") : ""))
    .join("\n")
    .trim();
}

type LoadState = { status: "loading" } | { status: "ready"; app: ToolApp } | { status: "error"; error: string };

export function ToolAppCard({ part, resourceUri, fallback }: { part: DynamicToolUIPart; resourceUri: string; fallback: ReactNode }) {
  const t = useT();
  const host = useContext(AppHostContext);
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [height, setHeight] = useState(0);
  const [showData, setShowData] = useState(false);
  const hostContext = useHostContext(part);
  const running = part.state === "input-streaming" || part.state === "input-available";
  const failed = part.state === "output-error";

  useEffect(() => {
    let active = true;
    void loadApp(part.toolName, resourceUri).then((result) => {
      if (active) setLoad(result.ok ? { status: "ready", app: result.data } : { status: "error", error: result.error });
    });
    return () => {
      active = false;
    };
  }, [part.toolName, resourceUri]);

  const appTools = load.status === "ready" ? load.app.appTools : null;
  const { canCallTools, sendMessage } = host;
  const handlers = useMemo<MCPAppBridgeHandlers>(
    () => ({
      // Without a callTool handler the app is told it can't call tools, and hides its refresh buttons.
      ...(canCallTools && appTools
        ? {
            allowedTools: appTools,
            callTool: async ({ name, arguments: args }) => {
              const result = await callAppTool(part.toolName, name, args ?? {});
              if (!result.ok) throw new Error(result.error);
              return result.data;
            },
          }
        : {}),
      openLink: ({ url }) => {
        window.open(url, "_blank", "noopener,noreferrer");
        return {};
      },
      sendMessage: (params) => {
        const text = messageText(params);
        if (text) sendMessage(text);
        return {};
      },
      onSizeChange: ({ height: next }) => {
        if (typeof next === "number" && next > 0) setHeight(Math.min(Math.ceil(next), MAX_HEIGHT));
      },
    }),
    [appTools, canCallTools, part.toolName, sendMessage],
  );

  const sandbox = useMemo<MCPAppSandboxConfig>(
    () => ({
      url: SANDBOX_URL,
      title: t("{tool} results", { tool: (part.toolMetadata?.title as string | undefined) ?? part.toolName }),
      className: "block w-full transition-[height] duration-300 ease-[cubic-bezier(0.05,0.7,0.1,1)]",
      style: { height, border: 0 },
    }),
    [height, part.toolMetadata?.title, part.toolName, t],
  );

  // An app that can't be loaded falls back to the plain JSON card.
  if (load.status === "error" || failed) return fallback;

  const title = (part.toolMetadata?.title as string | undefined) ?? part.toolName;
  return (
    <div className="my-2 overflow-hidden rounded-md border border-outline-variant bg-surface-container-low animate-message-in" data-testid="tool-app">
      <div className="flex items-center gap-2 py-1 pr-1 pl-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
          <LayoutGrid size={14} />
        </span>
        <span className="min-w-0 flex-1 truncate type-label-large" title={part.toolName}>{title}</span>
        <span className="flex shrink-0 items-center gap-1 type-label-medium text-on-surface-variant">
          {running ? <><LoaderCircle size={14} className="animate-spin" /> {t("Running")}</> : null}
          {part.state === "output-available" ? <><CircleCheck size={14} /> {t("Done")}</> : null}
        </span>
        <IconButton label={t("View data")} onClick={() => setShowData(true)}>
          <Braces size={18} />
        </IconButton>
      </div>
      {load.status === "ready" ? (
        <MCPAppRenderer part={part} resource={load.app.resource} sandbox={sandbox} handlers={handlers} hostInfo={HOST_INFO} hostContext={hostContext} />
      ) : null}
      {height === 0 ? (
        <div className="flex flex-col gap-2 px-3 pb-3" aria-label={t("Loading results")}>
          {[90, 70, 50].map((width) => (
            <div key={width} className="h-3.5 animate-pulse rounded-full bg-surface-container-highest" style={{ width: `${width}%` }} />
          ))}
        </div>
      ) : null}
      <Dialog
        open={showData}
        onOpenChange={setShowData}
        title={title}
        description={<span className="font-mono">{part.toolName}</span>}
        className="w-[min(720px,calc(100vw-32px))]"
      >
        <div className="flex flex-col gap-3 pb-2">
          <div>
            <span className="type-label-small text-on-surface-variant">{t("Input")}</span>
            <pre className="mt-1 max-h-40 overflow-auto rounded-xs bg-surface-container-highest p-2 font-mono text-xs">{JSON.stringify(part.input ?? {}, null, 2)}</pre>
          </div>
          {part.state === "output-available" ? (
            <div>
              <span className="type-label-small text-on-surface-variant">{t("Result")}</span>

              <pre className="mt-1 max-h-[50vh] overflow-auto rounded-xs bg-surface-container-highest p-2 font-mono text-xs">{JSON.stringify(part.output, null, 2)}</pre>
            </div>
          ) : null}
        </div>
      </Dialog>
    </div>
  );
}

