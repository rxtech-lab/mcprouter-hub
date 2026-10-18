import { AppWindow, Bot, History, KeyRound, MessageCircle, Send } from "lucide-react";
import type { ClientKind } from "@/lib/usage";

export const CLIENT_KIND_LABELS: Record<ClientKind, string> = {
  key: "API key",
  oauth: "Connected app",
  web: "Agent",
  telegram: "Agent",
  whatsapp: "Agent",
  agent: "Agent",
};

const icons = { key: KeyRound, oauth: AppWindow, web: Bot, telegram: Send, whatsapp: MessageCircle, agent: History };

export function ClientIcon({ kind, size = 18 }: { kind: ClientKind; size?: number }) {
  const Icon = icons[kind];
  return <Icon size={size} aria-hidden />;
}
