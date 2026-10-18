"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect } from "react";
import { ChatPanel } from "@/components/agent/chat-panel";
import { useSnackbar } from "@/components/m3/snackbar";
import { useT } from "@/lib/i18n/client";
import { ChatHistoryButton, useChatHistory } from "./chat-history";

export function ChatView({ id, initialMessages, isNew = false }: { id: string; initialMessages: UIMessage[]; isNew?: boolean }) {
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

  // Once the server has stored the question, give the chat its own URL and list it in the history.
  const streaming = status === "streaming";
  useEffect(() => {
    if (!streaming) return;
    if (isNew && window.location.pathname !== `/chat/${id}`) window.history.replaceState(null, "", `/chat/${id}${window.location.search}`);
    history?.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when a reply starts
  }, [streaming]);

  return (
    <ChatPanel
      messages={messages}
      status={status}
      onSend={(text) => sendMessage({ text })}
      onStop={() => stop()}
      title={t("Agent")}
      actions={<ChatHistoryButton />}
      intro={t("The agent calls mcprouter tools for you. Tool calls count towards your plan, like calls from your own keys.")}

      canCallAppTools
    />
  );
}
