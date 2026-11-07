"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { TaskErrorDetails } from "@/components/task-error-details";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import { ChatPanel, SUGGESTIONS } from "@/components/agent/chat-panel";
import { ChatAllowance } from "@/components/agent/chat-allowance";
import { useSnackbar } from "@/components/m3/snackbar";
import { useT } from "@/lib/i18n/client";
import { trackChatMessage } from "@/lib/analytics";
import { msg } from "@/lib/i18n/translate";
import type { ChatRun } from "@/lib/tasks/chat-run";
import { ChatHistoryButton, useChatHistory } from "./chat-history";

/** Signed in, the agent also runs the dashboard, so it offers a few of those next to the data questions. */
const DASHBOARD_SUGGESTIONS = [...SUGGESTIONS.slice(0, 3), msg("How many calls have I made today?"), msg("Create an API key for Claude Code"), msg("Write a daily weather briefing task"), msg("Help me write an MCP workflow script")];

type ChatViewProps = {
  id: string;
  initialMessages: UIMessage[];
  isNew?: boolean;
  initialRun?: ChatRun | null;
  /** Sent as the first message as soon as the chat opens. */
  initialPrompt?: string;
};

export function ChatView({ id, initialMessages, isNew = false, initialPrompt, initialRun = null }: ChatViewProps) {
  const t = useT();
  const snackbar = useSnackbar();
  const { show, dismiss } = snackbar;
  const history = useChatHistory();
  const router = useRouter();
  const searchParams = useSearchParams();
  const detailQuery = new URLSearchParams(searchParams);
  detailQuery.delete("error");
  const closeErrorHref = `/chat/${id}${detailQuery.size ? `?${detailQuery}` : ""}`;
  detailQuery.set("error", "1");
  const openErrorHref = `/chat/${id}?${detailQuery}`;
  const [run, setRun] = useState(initialRun);
  const { messages, setMessages, sendMessage, status, stop } = useChat({
    id,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      // Earlier messages are stored on the server; only the newest one is sent.
      prepareSendMessagesRequest: ({ id, messages }) => ({ body: { id, message: messages.at(-1) } }),
    }),
    onError: (error) => snackbar.show(error.message || t("The agent could not answer. Try again."), { tone: "error" }),
    onFinish: () => history?.refresh(),
  });

  const backgroundRunning = run?.status === "running";
  useEffect(() => {
    if (!backgroundRunning) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const response = await fetch(`/api/chat/${id}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Could not refresh task result");
        const snapshot = await response.json() as { messages: UIMessage[]; run: ChatRun | null };
        if (controller.signal.aborted) return;
        setMessages(snapshot.messages);
        setRun(snapshot.run);
        if (snapshot.run?.status !== "running") {
          history?.refresh();
          return;
        }
      } catch {
        if (controller.signal.aborted) return;
        // A temporary network failure should not stop following the background run.
      }
      timer = setTimeout(poll, 1500);
    };
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [id, backgroundRunning, setMessages, history]);

  useEffect(() => {
    if (!backgroundRunning) return;
    const notification = show(t("Task is running. Results update automatically."), { tone: "progress" });
    return () => dismiss(notification);
  }, [backgroundRunning, show, dismiss, t]);

  useEffect(() => {
    if (run?.status === "failed") {
      show(t("Task failed"), { tone: "error", action: {
        label: t("Error details"),
        onClick: () => {
          const query = new URLSearchParams(window.location.search);
          query.set("error", "1");
          router.push(`/chat/${id}?${query}`, { scroll: false });
        },
      } });
    }
  }, [run?.status, run?.error, show, t, router, id]);

  const prompted = useRef(false);
  useEffect(() => {
    if (!initialPrompt || prompted.current) return;
    prompted.current = true;
    trackChatMessage("dashboard");
    void sendMessage({ text: initialPrompt });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on open
  }, []);

  // Once the server has stored the question, give the chat its own URL and list it in the history.
  const streaming = status === "streaming";
  useEffect(() => {
    if (!streaming) return;
    if (isNew && window.location.pathname !== `/chat/${id}`) {
      // `?ask=` has been sent; keep the rest (the history search).
      const params = new URLSearchParams(window.location.search);
      params.delete("ask");
      const search = params.toString();
      window.history.replaceState(null, "", `/chat/${id}${search ? `?${search}` : ""}`);
    }
    history?.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when a reply starts
  }, [streaming]);

  return (
    <ChatPanel
      messages={messages}
      status={backgroundRunning ? "submitted" : status}
      canStop={!backgroundRunning}
      disabled={backgroundRunning}
      onSend={(text) => {
        trackChatMessage("dashboard");
        void sendMessage({ text });
      }}
      onStop={() => stop()}
      title={t("Agent")}
      actions={<div className="flex items-center gap-3">
        {run?.status === "failed" && run.error && <TaskErrorDetails error={run.error} open={searchParams.get("error") === "1"} openHref={openErrorHref} closeHref={closeErrorHref} />}
        <ChatHistoryButton />
      </div>}
      intro={t("The agent calls mcprouter tools for you, and can link you to dashboard pages and actions like creating a key. Tool calls count towards your plan, like calls from your own keys.")}
      suggestions={DASHBOARD_SUGGESTIONS}
      notice={<ChatAllowance status={status} />}
      canCallAppTools
    />
  );
}
