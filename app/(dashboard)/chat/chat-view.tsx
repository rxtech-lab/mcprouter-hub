"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef } from "react";
import { ChatPanel, SUGGESTIONS } from "@/components/agent/chat-panel";
import { useSnackbar } from "@/components/m3/snackbar";
import { useT } from "@/lib/i18n/client";
import { trackChatMessage } from "@/lib/analytics";
import { msg } from "@/lib/i18n/translate";
import { ChatHistoryButton, useChatHistory } from "./chat-history";

/** Signed in, the agent also runs the dashboard, so it offers a few of those next to the data questions. */
const DASHBOARD_SUGGESTIONS = [...SUGGESTIONS.slice(0, 3), msg("How many calls have I made today?"), msg("Create an API key for Claude Code"), msg("Show me the dashboard tour")];

type ChatViewProps = {
  id: string;
  initialMessages: UIMessage[];
  isNew?: boolean;
  /** Sent as the first message as soon as the chat opens. */
  initialPrompt?: string;
};

export function ChatView({ id, initialMessages, isNew = false, initialPrompt }: ChatViewProps) {
  const t = useT();
  const snackbar = useSnackbar();
  const history = useChatHistory();
  const { messages, sendMessage, status, stop } = useChat({
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
      status={status}
      onSend={(text) => {
        trackChatMessage("dashboard");
        void sendMessage({ text });
      }}
      onStop={() => stop()}
      title={t("Agent")}
      actions={<ChatHistoryButton />}
      intro={t("The agent calls mcprouter tools for you, and can link you to dashboard pages and actions like creating a key. Tool calls count towards your plan, like calls from your own keys.")}
      suggestions={DASHBOARD_SUGGESTIONS}
      canCallAppTools
    />
  );
}
